from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends

from core.app_state import AppState
from api.dependencies import get_app_state

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, state: AppState = Depends(get_app_state)):
    await ws.accept()
    state.ws_clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if ws in state.ws_clients:
            state.ws_clients.remove(ws)
