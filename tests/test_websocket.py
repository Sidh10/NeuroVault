"""
Phase 2 — Test 1: WebSocket echo server
Confirms: FastAPI + WebSocket endpoint runs on localhost:8000
"""
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI(title="NeuroVault WS Echo Test")


@app.get("/health")
def health():
    return {"status": "ok", "test": "websocket_echo"}


@app.websocket("/ws/test")
async def websocket_echo(websocket: WebSocket):
    await websocket.accept()
    print("[WS] Client connected")
    try:
        while True:
            data = await websocket.receive_text()
            print(f"[WS] Received: {data[:100]}")
            await websocket.send_text(data)
            print(f"[WS] Echoed back")
    except WebSocketDisconnect:
        print("[WS] Client disconnected")


if __name__ == "__main__":
    print("=" * 50)
    print("TEST 1: WebSocket Echo Server")
    print("Starting on ws://localhost:8000/ws/test")
    print("=" * 50)
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
