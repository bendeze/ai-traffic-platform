from typing import Dict, List, Optional
from pydantic import BaseModel, Field

class SignalInfo(BaseModel):
    phase: str = Field(..., description="Active phase: 'A' or 'B'")
    state: str = Field(..., description="Signal state: 'green', 'yellow', 'red', 'clearance'")
    remaining: float = Field(..., description="Remaining seconds in current state")
    reason: str = Field(..., description="Decision engine rule reasoning")
    yellow_dur: float = Field(..., description="Yellow clearance duration in seconds")
    manual_durations: Dict[str, int] = Field(default_factory=dict)
    mode: str = Field(..., description="'adaptive' or 'manual'")
    manual_loop_running: bool = False
    is_pedestrian_active: bool = False
    pedestrian_red_phase: Optional[str] = None
    pedestrian_approach: Optional[str] = None

class ApproachMetrics(BaseModel):
    queue: int = 0
    waiting_time: float = 0.0
    vehicle_count: int = 0
    breakdown: Dict[str, int] = Field(default_factory=dict)
    has_ambulance: bool = False
    signal: str = "red"
    timer: int = 0

class VisionTelemetry(BaseModel):
    mode: str = "continuous"
    snapshot_interval: float = 5.0
    snapshots_taken: int = 0
    next_snapshot_in: float = 0.0

class PipelineHealth(BaseModel):
    fps: float = 0.0
    status: str = "ok"

class HardwareStatus(BaseModel):
    connected: bool = False
    port: str = "USB"

class TelemetryPayload(BaseModel):
    signal: SignalInfo
    approaches: Dict[str, ApproachMetrics]
    vision: VisionTelemetry
    pedestrian: Dict[str, bool]
    active_ambulance: Optional[str] = None
    active_environment: str = "sumo"
    simulation: Dict[str, object] = Field(default_factory=dict)
    pipeline: Dict[str, object] = Field(default_factory=dict)
    hardware: Dict[str, object] = Field(default_factory=dict)
    timestamp: float
