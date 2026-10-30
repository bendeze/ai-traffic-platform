import json, os
from dataclasses import dataclass, field
from typing import List, Tuple
from dotenv import load_dotenv

# Load .env file from backend root or current directory
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=False)
load_dotenv()

@dataclass
class ApproachRegion:
    name: str
    polygon: List[Tuple[int, int]]

@dataclass
class TimingConfig:
    min_green: int                  = int(os.getenv("MIN_GREEN", 10))
    max_green: int                  = int(os.getenv("MAX_GREEN", 60))
    yellow_dur: int                 = int(os.getenv("YELLOW_DURATION", 3))
    pedestrian_yellow_dur: int      = int(os.getenv("PEDESTRIAN_YELLOW_DURATION", 10))
    clearance: int                  = int(os.getenv("CLEARANCE_DURATION", 2))
    max_wait_seconds: float         = float(os.getenv("MAX_WAIT_SECONDS", 30.0))
    eval_interval: float            = float(os.getenv("EVAL_INTERVAL", 2.0))
    demand_switch_threshold: float  = float(os.getenv("DEMAND_SWITCH_THRESHOLD", 1.25))

@dataclass
class Settings:
    model_path: str        = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
    confidence: float      = float(os.getenv("YOLO_CONFIDENCE", 0.35))
    serial_port: str       = os.getenv("SERIAL_PORT", "COM3")
    baud_rate: int         = int(os.getenv("SERIAL_BAUD_RATE", 9600))
    serial_enabled: bool   = os.getenv("SERIAL_ENABLED", "false").lower() in ("true", "1", "yes")
    vision_mode: str       = os.getenv("VISION_MODE", "snapshot")      # "tracking" | "snapshot"
    snapshot_interval: float = float(os.getenv("SNAPSHOT_INTERVAL", 5.0)) # default 5.0s
    timing: TimingConfig   = field(default_factory=TimingConfig)
    phases: dict           = field(default_factory=lambda: {
        "A": ["north", "south"],
        "B": ["east",  "west"],
    })
    approaches: List[ApproachRegion] = field(default_factory=lambda: [
        # Calibrated for 1280x720 overhead intersection video
        # North: upper-center road before the crosswalk box
        ApproachRegion("north", [(430, 0),   (760, 0),   (760, 200),  (430, 200)]),
        # South: lower-center road before the crosswalk box
        ApproachRegion("south", [(390, 490), (760, 490), (760, 720),  (390, 720)]),
        # East: right-side road approach
        ApproachRegion("east",  [(860, 170), (1280, 170),(1280, 450), (860, 450)]),
        # West: left-side road approach
        ApproachRegion("west",  [(0, 170),   (380, 170), (380, 450),  (0, 450)]),
    ])
    _path: str = os.path.join(os.path.dirname(__file__), "camera_profile.json")

def load_settings() -> Settings:
    s = Settings()
    if os.path.exists(s._path):
        try:
            with open(s._path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "approaches" in data:
                s.approaches = [
                    ApproachRegion(a["name"], [tuple(p) for p in a["polygon"]])
                    for a in data["approaches"]
                ]
            if "timing" in data:
                for k, v in data["timing"].items():
                    if hasattr(s.timing, k):
                        setattr(s.timing, k, v)
        except Exception as e:
            print(f"[Settings] Error loading camera profile: {e}")
    return s

def save_settings(s: Settings):
    os.makedirs(os.path.dirname(s._path), exist_ok=True)
    with open(s._path, "w", encoding="utf-8") as f:
        json.dump({
            "approaches": [{"name": a.name, "polygon": a.polygon} for a in s.approaches],
            "timing": s.timing.__dict__,
            "vision_mode": s.vision_mode,
            "snapshot_interval": s.snapshot_interval,
        }, f, indent=2)
