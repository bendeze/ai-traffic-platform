import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from core.app_state import AppState
from api.dependencies import get_app_state
from controller.safety_manager import SignalState
from schemas.controls import ManualLoopRequest, ManualConfigRequest

router = APIRouter(tags=["Traffic Controller"])

@router.get("/state")
async def get_state(state: AppState = Depends(get_app_state)):
    return state.build_telemetry_payload()

@router.post("/controller/phase/{phase}")
async def set_phase(phase: str, duration: Optional[int] = None, state: AppState = Depends(get_app_state)):
    if phase not in ("A", "B"):
        raise HTTPException(400, "Phase must be A or B")
    dur = duration if duration is not None else state.engine.manual_durations.get(phase, 30)
    state.engine.manual_durations[phase] = dur
    state.engine.notify_phase_started(phase)
    state.safety.request_phase(phase, duration=dur, manual=True)
    return {"status": "ok", "phase": phase, "duration": dur}

@router.post("/controller/mode/{mode}")
async def set_mode(mode: str, state: AppState = Depends(get_app_state)):
    if mode not in ("adaptive", "manual"):
        raise HTTPException(400, "Mode must be 'adaptive' or 'manual'")
    state.engine.mode = mode
    if mode == "adaptive":
        state.engine.manual_loop_running = False
    return {"status": "ok", "mode": mode, "manual_loop_running": state.engine.manual_loop_running}

@router.post("/controller/manual_loop/start")
async def start_manual_loop(body: ManualLoopRequest, state: AppState = Depends(get_app_state)):
    phase_a = body.phase_a
    phase_b = body.phase_b
    start_phase = body.start_phase

    was_running = (state.engine.mode == "manual" and state.engine.manual_loop_running)

    state.engine.mode = "manual"
    state.engine.manual_loop_running = True
    state.engine.set_manual_durations(phase_a, phase_b)

    # If loop was not running, start initial phase with full duration
    # If loop was already running, WAIT for the active running timer to finish first!
    if not was_running:
        dur = phase_a if start_phase == "A" else phase_b
        state.engine.notify_phase_started(start_phase, duration=dur)
        state.safety.current_phase = start_phase
        state.safety.signal_state = SignalState.GREEN
        state.safety.remaining_green = float(dur)
        state.safety._phase_start = time.time()
        state.safety._in_transition = False
        state.safety._pending_phase = None

        if state.serial_mgr.is_connected():
            state.serial_mgr.send_signals(state.safety.get_approach_states(), start_phase, dur)

    return {
        "status": "ok",
        "manual_loop_running": True,
        "active_phase": state.safety.current_phase,
        "manual_durations": state.engine.manual_durations,
        "wait_current_timer": was_running
    }

@router.post("/controller/manual_loop/stop")
async def stop_manual_loop(state: AppState = Depends(get_app_state)):
    state.engine.manual_loop_running = False
    return {"status": "ok", "manual_loop_running": False}

@router.post("/controller/manual_config")
async def set_manual_config(body: ManualConfigRequest, state: AppState = Depends(get_app_state)):
    state.engine.set_manual_durations(body.phase_a, body.phase_b)
    return {"status": "ok", "manual_durations": state.engine.manual_durations}

