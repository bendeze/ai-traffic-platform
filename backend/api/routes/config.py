from fastapi import APIRouter, Depends, HTTPException

from core.app_state import AppState
from api.dependencies import get_app_state
from config.settings import ApproachRegion as AR, save_settings
from schemas.controls import UpdateApproachesRequest

router = APIRouter(prefix="/config", tags=["Configuration"])

@router.get("")
async def get_config(state: AppState = Depends(get_app_state)):
    state.refresh_settings()
    return {
        "approaches": [{"name": a.name, "polygon": a.polygon} for a in state.settings.approaches],
        "timing": state.settings.timing.__dict__,
        "vision_mode": state.settings.vision_mode,
        "snapshot_interval": state.settings.snapshot_interval,
    }

@router.put("/approaches")
async def update_approaches(body: UpdateApproachesRequest, state: AppState = Depends(get_app_state)):
    state.settings.approaches = [
        AR(a.name, [tuple(p) for p in a.polygon])
        for a in body.approaches
    ]
    state.vision.settings.approaches = state.settings.approaches
    save_settings(state.settings)
    state.refresh_settings()
    return {"status": "ok", "saved": len(state.settings.approaches)}

