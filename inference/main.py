import asyncio
import json
import logging
import os
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from inference.feature_extractor import extract_features, FEATURE_NAMES
from inference.inference_engine import enroll, score, PROFILES_DIR

app = FastAPI(title="NeuroVault Inference API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Optional: Serve collector files for testing
collector_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "collector")
if os.path.exists(collector_dir):
    app.mount("/collector", StaticFiles(directory=collector_dir, html=True), name="collector")

# In-memory session buffers
buffers = {}
locks = {}
trust_connections = {}
consecutive_anomalies = {}
scoring_tasks = {}

def get_lock(session_id: str) -> asyncio.Lock:
    if session_id not in locks:
        locks[session_id] = asyncio.Lock()
    return locks[session_id]

async def scoring_loop(session_id: str):
    logger = logging.getLogger("uvicorn")
    while True:
        await asyncio.sleep(5.0)
        
        lock = get_lock(session_id)
        async with lock:
            if session_id not in buffers:
                continue
                
            events = buffers[session_id]
            
            profile_path = os.path.join(PROFILES_DIR, f"{session_id}.joblib")
            if not os.path.exists(profile_path):
                # Don't clear buffer if not enrolled, keep accumulating for /enroll
                continue
                
            if not events:
                events = []
            
            # Clear buffer since we are going to process it
            buffers[session_id] = []
            
        # Extract and Score (outside lock)
        import numpy as np
        if not events:
            feature_vector = extract_features([])
        else:
            feature_vector = extract_features(events)
            
        try:
            result = score(session_id, feature_vector)
            t_score = result["trust_score"]
            
            # Linked logic
            if session_id not in consecutive_anomalies:
                consecutive_anomalies[session_id] = 0
                
            if t_score < 40:
                consecutive_anomalies[session_id] += 1
            else:
                consecutive_anomalies[session_id] = 0
                
            is_locked = consecutive_anomalies[session_id] >= 2
            
            payload = {
                "trust_score": t_score,
                "shap_features": result["shap_features"],
                "top_anomaly": result["top_anomaly"],
                "locked": is_locked,
                "window_id": int(time.time() * 1000)
            }
            
            # Debug via logger
            logger.warning(f"[SCORE] {session_id} - Trust: {t_score} (Locked: {is_locked}) | Top Anomaly: {result['top_anomaly']}")
            
            if session_id in trust_connections:
                dead_socks = []
                for ws in trust_connections[session_id]:
                    try:
                        await ws.send_json(payload)
                    except Exception:
                        dead_socks.append(ws)
                for ws in dead_socks:
                    trust_connections[session_id].remove(ws)
                    
        except Exception as e:
            logger.error(f"Error scoring {session_id}: {e}")

@app.websocket("/ws/collect/{session_id}")
async def ws_collect(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    lock = get_lock(session_id)
    async with lock:
        if session_id not in buffers:
            buffers[session_id] = []
        if session_id not in scoring_tasks:
            scoring_tasks[session_id] = asyncio.create_task(scoring_loop(session_id))
            
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                events = payload.get("events", [])
                if events:
                    async with lock:
                        buffers[session_id].extend(events)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        print(f"Collector {session_id} disconnected")

@app.websocket("/ws/trust/{session_id}")
async def ws_trust(websocket: WebSocket, session_id: str):
    await websocket.accept()
    if session_id not in trust_connections:
        trust_connections[session_id] = []
    trust_connections[session_id].append(websocket)
    print(f"Trust listener connected for {session_id}")
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if session_id in trust_connections and websocket in trust_connections[session_id]:
            trust_connections[session_id].remove(websocket)
        print(f"Trust listener {session_id} disconnected")

@app.post("/enroll/{session_id}")
async def api_enroll(session_id: str):
    lock = get_lock(session_id)
    async with lock:
        events = buffers.get(session_id, [])
        if not events:
            return {"status": "error", "message": "No events buffered for session"}
        buffers[session_id] = []
        
    # Split events into 5-second windows
    events = sorted(events, key=lambda e: e.get("timestamp_ms", 0))
    start_ts = events[0].get("timestamp_ms", 0)
    
    windows = []
    current_window = []
    window_start = start_ts
    
    for e in events:
        ts = e.get("timestamp_ms", 0)
        if ts - window_start >= 5000:
            windows.append(current_window)
            current_window = []
            window_start = ts
            
        current_window.append(e)
        
    if current_window:
        windows.append(current_window)
        
    import numpy as np
    feature_matrix = []
    for w in windows:
        f_vec = extract_features(w)
        feature_matrix.append(f_vec)
        
    feature_matrix = np.array(feature_matrix)
    enroll(session_id, feature_matrix)
    
    return {
        "status": "enrolled",
        "windows_used": len(windows),
        "feature_means": {FEATURE_NAMES[i]: float(np.mean(feature_matrix[:, i])) for i in range(len(FEATURE_NAMES))} if len(windows) > 0 else {}
    }

@app.get("/health")
def health():
    return {"status": "ok", "active_sessions": len(buffers)}

@app.post("/demo/load")
async def load_demo():
    # Load demo profile from json
    demo_json_path = os.path.join(PROFILES_DIR, "demo.json")
    demo_joblib_path = os.path.join(PROFILES_DIR, "demo.joblib")
    
    if os.path.exists(demo_json_path):
        import shutil
        shutil.copyfile(demo_json_path, demo_joblib_path)
        return {"status": "demo_loaded", "session_id": "demo", "from": "json", "windows": 200}
    
    # Fallback initialization (enables instant demo without live enrollment)
    import numpy as np
    np.random.seed(42)
    fake_matrix = np.array([np.random.normal(loc=1.0, scale=0.1, size=12) for _ in range(50)])
    enroll("demo", fake_matrix)
    
    return {"status": "demo_loaded_from_fallback", "session_id": "demo", "windows": 50}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("inference.main:app", host="0.0.0.0", port=8000, reload=True)
