from fastapi import APIRouter, Depends, HTTPException

from core.app_state import AppState
from api.dependencies import get_app_state
from simulation.sumo.environment import sumo_env
from simulation.sumo.metrics_collector import metrics_collector
from simulation.sumo.benchmark import benchmark_runner

router = APIRouter(prefix="/simulation", tags=["SUMO Simulation"])

@router.get("/sumo/diagnostics")
async def get_sumo_diagnostics():
    return sumo_env.get_diagnostics()

@router.get("/sumo/status")
async def get_sumo_status(state: AppState = Depends(get_app_state)):
    return {
        "active_environment": state.active_environment,
        "telemetry": state.sumo_mgr.get_telemetry()
    }

@router.post("/environment/{env}")
async def set_active_environment(env: str, state: AppState = Depends(get_app_state)):
    if env not in ("video", "sumo"):
        raise HTTPException(400, "Environment must be 'video' or 'sumo'")
    state.active_environment = env
    if env == "sumo":
        if not state.sumo_mgr.is_running:
            state.sumo_mgr.start_simulation(gui=False)
    else:
        if state.sumo_mgr.is_running:
            state.sumo_mgr.stop_simulation()
    return {"status": "ok", "active_environment": state.active_environment}

@router.post("/sumo/start")
async def sumo_start(gui: bool = False, speed: float = 1.0, state: AppState = Depends(get_app_state)):
    state.active_environment = "sumo"
    ok = state.sumo_mgr.start_simulation(gui=gui, speed_factor=speed)
    if not ok:
        raise HTTPException(500, "Failed to start SUMO simulation. Check diagnostics.")
    return {"status": "ok", "telemetry": state.sumo_mgr.get_telemetry()}

@router.post("/sumo/stop")
async def sumo_stop(state: AppState = Depends(get_app_state)):
    state.sumo_mgr.stop_simulation()
    return {"status": "ok", "telemetry": state.sumo_mgr.get_telemetry()}

@router.post("/sumo/pause")
async def sumo_pause(state: AppState = Depends(get_app_state)):
    state.sumo_mgr.pause_simulation()
    return {"status": "ok", "telemetry": state.sumo_mgr.get_telemetry()}

@router.post("/sumo/resume")
async def sumo_resume(state: AppState = Depends(get_app_state)):
    state.sumo_mgr.resume_simulation()
    return {"status": "ok", "telemetry": state.sumo_mgr.get_telemetry()}

@router.post("/sumo/reset")
async def sumo_reset(state: AppState = Depends(get_app_state)):
    ok = state.sumo_mgr.reset_simulation()
    return {"status": "ok" if ok else "error", "telemetry": state.sumo_mgr.get_telemetry()}

@router.post("/sumo/speed/{factor}")
async def sumo_set_speed(factor: float, state: AppState = Depends(get_app_state)):
    if factor < 0.1 or factor > 10.0:
        raise HTTPException(400, "Speed factor must be between 0.1 and 10.0")
    state.sumo_mgr.speed_factor = float(factor)
    return {"status": "ok", "speed_factor": state.sumo_mgr.speed_factor}

@router.get("/metrics")
async def get_simulation_metrics():
    return metrics_collector.get_summary()

@router.post("/benchmark/run")
async def run_benchmark(duration: float = 30.0, seed: int = 42):
    if duration < 10.0 or duration > 300.0:
        raise HTTPException(400, "Benchmark duration must be between 10s and 300s")
    report = benchmark_runner.run_comparative_study(duration=duration, seed=seed)
    return {"status": "ok", "report": report}
