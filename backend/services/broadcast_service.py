import json
import asyncio
from core.app_state import AppState

async def run_broadcast_loop(state: AppState):
    """
    WebSocket telemetry broadcaster (runs at ~3.3 Hz / 300ms intervals).
    Pushes real-time intersection telemetry to all connected frontend clients.
    """
    while True:
        await asyncio.sleep(0.3)
        if not state.ws_clients:
            continue

        payload_dict = state.build_telemetry_payload()
        payload = json.dumps(payload_dict)

        dead = []
        for ws in state.ws_clients:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)

        for ws in dead:
            if ws in state.ws_clients:
                state.ws_clients.remove(ws)
