from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from core.app_state import AppState
from api.dependencies import get_app_state

router = APIRouter(prefix="/serial", tags=["Hardware Serial (Arduino)"])

@router.get("/status")
async def get_serial_status(state: AppState = Depends(get_app_state)):
    return state.serial_mgr.status()

@router.get("/ports")
async def get_serial_ports(state: AppState = Depends(get_app_state)):
    return {"ports": state.serial_mgr.list_available_ports()}

@router.post("/connect")
async def serial_connect(port: Optional[str] = None, state: AppState = Depends(get_app_state)):
    success = state.serial_mgr.connect(port)
    if not success:
        return {"status": "error", "error": state.serial_mgr.last_error, "serial": state.serial_mgr.status()}
    return {"status": "ok", "serial": state.serial_mgr.status()}

@router.post("/disconnect")
async def serial_disconnect(state: AppState = Depends(get_app_state)):
    state.serial_mgr.disconnect()
    return {"status": "ok", "serial": state.serial_mgr.status()}

@router.post("/test")
async def serial_test(state: AppState = Depends(get_app_state)):
    ok = state.serial_mgr.send_test_pattern()
    if not ok:
        raise HTTPException(400, "Arduino not connected or write failed")
    return {"status": "ok", "message": "Diagnostic test sweep triggered on Arduino"}

