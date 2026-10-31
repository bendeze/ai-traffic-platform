from typing import Optional, List, Tuple
from pydantic import BaseModel, Field

class ManualLoopRequest(BaseModel):
    phase_a: int = Field(default=30, ge=5, le=300, description="Phase A green duration in seconds")
    phase_b: int = Field(default=30, ge=5, le=300, description="Phase B green duration in seconds")
    start_phase: str = Field(default="A", pattern="^[AB]$", description="Initial phase to begin with: 'A' or 'B'")

class ManualConfigRequest(BaseModel):
    phase_a: int = Field(default=30, ge=5, le=300)
    phase_b: int = Field(default=30, ge=5, le=300)

class SetPhaseRequest(BaseModel):
    phase: str = Field(..., pattern="^[AB]$")
    duration: Optional[int] = Field(None, ge=5, le=300)

class ApproachPolygon(BaseModel):
    name: str
    polygon: List[Tuple[float, float]]

class UpdateApproachesRequest(BaseModel):
    approaches: List[ApproachPolygon]

