import time
from fastapi import APIRouter, Depends, HTTPException

from core.app_state import AppState
from api.dependencies import get_app_state

router = APIRouter(prefix="/priority", tags=["Priority Overrides"])

@router.post("/pedestrian/{approach}")
async def ped_request(approach: str, state: AppState = Depends(get_app_state)):
    if approach not in [a.name for a in state.settings.approaches]:
        raise HTTPException(400, "Unknown approach")

    target_red_phase = "A" if approach in state.settings.phases.get("A", []) else "B"

    # If already active for this phase, return early without extending or doubling the timer
    now = time.time()
    if state.safety.is_pedestrian_red_active(now) and state.safety.pedestrian_red_phase == target_red_phase:
        return {
            "status": "already_active",
            "requested": approach,
            "phase_on_red": state.safety.pedestrian_red_phase,
            "duration": max(1, int(round(state.safety.pedestrian_red_until - now)))
        }

    # Clear pending flags for both directions in this phase so both are held together for 10s once
    for app in state.settings.phases.get(target_red_phase, []):
        state.ped_requests[app] = False

    # Force all roads on this phase to RED for exactly 10.0 seconds total
    state.safety.trigger_pedestrian_red(approach, duration=10.0)
    state.engine.notify_phase_started(state.safety.current_phase)
    state.engine.last_pedestrian_approach = approach
    state.engine.last_reason = f"pedestrian_crossing_{approach.upper()}_10s_RED"

    if state.serial_mgr.is_connected():
        state.serial_mgr.send_signals(state.safety.get_approach_states(), state.safety.current_phase, 10)

    return {
        "status": "ok",
        "requested": approach,
        "phase_on_red": state.safety.pedestrian_red_phase,
        "duration": 10
    }

@router.post("/ambulance/{approach}")
async def trigger_ambulance(approach: str, state: AppState = Depends(get_app_state)):
    if approach not in [a.name for a in state.settings.approaches]:
        raise HTTPException(400, "Unknown approach")
    state.active_ambulance = approach

    # If SUMO simulation is active, inject an actual emergency vehicle into the microscopic network
    if state.sumo_mgr.is_running:
        state.sumo_mgr.spawn_ambulance(approach)

    return {"status": "ok", "ambulance_on": approach}

@router.post("/ambulance_clear")
async def clear_ambulance(state: AppState = Depends(get_app_state)):
    state.active_ambulance = None
    state.vision.active_ambulance_approach = None
    for st in state.estimator._states.values():
        st.has_ambulance = False
    return {"status": "ok", "ambulance_cleared": True}
