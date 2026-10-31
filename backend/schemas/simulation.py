from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

class SimulationStatusResponse(BaseModel):
    active_environment: str
    telemetry: Dict[str, Any]

class BenchmarkRequest(BaseModel):
    duration: float = Field(default=30.0, ge=10.0, le=300.0, description="Benchmark duration in seconds")
    seed: int = Field(default=42, description="Random seed for repeatable traffic insertion")
