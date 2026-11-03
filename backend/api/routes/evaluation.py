import os
import json
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

from simulation.sumo.evaluation import evaluation_mgr, EVALUATIONS_ROOT

router = APIRouter(prefix="/simulation/evaluate", tags=["Simulation Evaluation"])

class StartEvaluationRequest(BaseModel):
    duration: float = Field(default=3600.0, description="Simulation duration in seconds for each scenario (1 hour = 3600s)")
    gui: bool = Field(default=True, description="Whether to display the SUMO GUI during evaluation")
    seed: int = Field(default=42, description="Random seed for deterministic vehicle routing and demand")
    scale: str = Field(default="standard", description="Traffic scale preset: 'off_peak', 'standard', or 'rush_hour'")

@router.get("/status")
async def get_evaluation_status():
    """Returns real-time progress and phase of the active or latest simulation evaluation."""
    return evaluation_mgr.get_status()

@router.post("/start")
async def start_evaluation(req: Optional[StartEvaluationRequest] = None):
    """
    Triggers automated dual-phase evaluation:
    1. Runs Manual Mode with fixed-time signals.
    2. Runs Adaptive Mode with AI control under identical traffic demand and seed.
    """
    duration = req.duration if req else 3600.0
    gui = req.gui if req else True
    seed = req.seed if req else 42
    scale = req.scale if req and req.scale else "standard"

    try:
        eval_id = evaluation_mgr.start_evaluation(duration=duration, gui=gui, seed=seed, traffic_scale=scale)
        return {
            "status": "started",
            "evaluationId": eval_id,
            "message": f"Evaluation {eval_id} started successfully."
        }
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop")
async def stop_evaluation():
    """Cancels the currently running evaluation process."""
    evaluation_mgr.stop_evaluation()
    return {"status": "ok", "message": "Evaluation cancellation requested."}

@router.get("/results/{evaluation_id}")
async def get_evaluation_results(evaluation_id: str):
    """Fetches the complete comparative analysis and chart datasets for a specific evaluation ID."""
    eval_dir = os.path.join(EVALUATIONS_ROOT, evaluation_id)
    results_path = os.path.join(eval_dir, "results.json")

    if not os.path.isfile(results_path):
        raise HTTPException(status_code=404, detail=f"Results not found for {evaluation_id}")

    try:
        with open(results_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read evaluation results: {str(e)}")

@router.get("/history")
async def get_evaluation_history():
    """Lists all historical simulation evaluations with high-level summary metadata."""
    if not os.path.isdir(EVALUATIONS_ROOT):
        return {"evaluations": []}

    history = []
    subdirs = sorted(os.listdir(EVALUATIONS_ROOT), reverse=True)

    for d in subdirs:
        res_file = os.path.join(EVALUATIONS_ROOT, d, "results.json")
        if os.path.isfile(res_file):
            try:
                with open(res_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    meta = data.get("metadata", {})
                    narrative = data.get("narrative", {})
                    metrics = data.get("metrics", [])
                    wait_metric = next((m for m in metrics if m.get("name") == "avg_waiting_time"), {})

                    history.append({
                        "evaluationId": meta.get("evaluationId", d),
                        "timestamp": meta.get("timestamp"),
                        "networkName": meta.get("networkName"),
                        "simulationDuration": meta.get("simulationDuration"),
                        "trafficScale": meta.get("trafficScale", "standard"),
                        "scaleLabel": meta.get("scaleLabel", "Standard Peak (~1905 veh/h)"),
                        "status": meta.get("status", "Completed"),
                        "verdict": narrative.get("verdict"),
                        "waitingImprovement": wait_metric.get("improvement", 0.0)
                    })
            except Exception:
                continue

    return {"evaluations": history}

