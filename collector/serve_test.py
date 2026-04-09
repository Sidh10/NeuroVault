"""
Phase 3A — WebSocket server with static file serving for collector testing.
Serves collector/* at /collector/* and echoes WS messages.
"""
import uvicorn
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="NeuroVault Collector Test Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve collector files at /collector/*
collector_dir = Path(__file__).parent.parent / "collector"
app.mount("/collector", StaticFiles(directory=str(collector_dir), html=True), name="collector")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws/test")
async def websocket_echo(websocket: WebSocket):
    await websocket.accept()
    batch_count = 0
    total_events = 0
    try:
        while True:
            data = await websocket.receive_text()
            batch_count += 1

            # Parse to count events (for logging)
            import json
            try:
                parsed = json.loads(data)
                n_events = len(parsed.get("events", []))
                total_events += n_events

                # Log every batch that has events (key for verification)
                if n_events > 0:
                    event_types = {}
                    for evt in parsed.get("events", []):
                        t = evt.get("type", "?")
                        event_types[t] = event_types.get(t, 0) + 1
                    type_str = ", ".join(f"{k}={v}" for k, v in event_types.items())
                    print(f"[WS] Batch #{batch_count}: {n_events} events ({type_str}) | Total: {total_events}", flush=True)
                elif batch_count % 50 == 0:
                    print(f"[WS] Heartbeat — batch #{batch_count}, no events | Total: {total_events}", flush=True)
            except json.JSONDecodeError:
                print(f"[WS] Batch #{batch_count}: (non-JSON)", flush=True)

            # Echo back
            await websocket.send_text(data)

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected — {batch_count} batches, {total_events} events total", flush=True)


if __name__ == "__main__":
    print("=" * 60)
    print("NeuroVault Collector Test Server")
    print("  Collector:  http://localhost:8000/collector/test.html")
    print("  WebSocket:  ws://localhost:8000/ws/test")
    print("  Health:     http://localhost:8000/health")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
