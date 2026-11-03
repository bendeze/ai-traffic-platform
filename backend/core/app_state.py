import time
from typing import Dict, List, Optional
import numpy as np
from fastapi import WebSocket

from config.settings import Settings, load_settings
from vision.pipeline import VisionPipeline, Detection
from traffic.state_estimator import TrafficStateEstimator
from traffic.decision_engine import DecisionEngine
from controller.safety_manager import SafetyManager
from controller.serial_manager import SerialManager
from simulation.sumo.manager import sumo_mgr, SUMOManager

class AppState:
    """
    Centralized, strongly-typed state container for Group Z Intelligent Traffic System.
    Replaces loose, scattered global variables with a single testable container.
    """
    def __init__(self, settings: Optional[Settings] = None):
        self.settings: Settings = settings or load_settings()
        self.vision: VisionPipeline = VisionPipeline(self.settings)
        self.estimator: TrafficStateEstimator = TrafficStateEstimator(self.settings)
        self.engine: DecisionEngine = DecisionEngine(self.settings)
        self.safety: SafetyManager = SafetyManager(
            self.settings, 
            on_phase_started=self.engine.notify_phase_started
        )
        self.engine.safety_ref = self.safety
        self.serial_mgr: SerialManager = SerialManager(self.settings)
        self.sumo_mgr: SUMOManager = sumo_mgr

        # Connect simulation manager to authoritative traffic controllers and AppState
        self.sumo_mgr.attach_traffic_controllers(self.engine, self.safety, self.estimator, self)

        # Real-time WebSockets & Frames
        self.ws_clients: List[WebSocket] = []
        self.current_frame: Optional[np.ndarray] = None
        
        # Operational runtime flags
        self.processing: bool = False
        self.video_source: Optional[str] = None
        self.active_source: Optional[str] = None
        self.active_environment: str = "sumo"  # Default environment is SUMO
        
        # Priority states
        self.ped_requests: Dict[str, bool] = {a.name: False for a in self.settings.approaches}
        self.active_ambulance: Optional[str] = None

        # Snapshot cache & tracking
        self.cached_snapshot_detections: List[Detection] = []
        self.last_snapshot_time: float = 0.0

        # Hardware serial rate-limiter & diff tracker
        self.last_sent_serial_states: dict = {}
        self.last_serial_sync_time: float = 0.0

    def refresh_settings(self):
        """Hot-reloads settings directly from .env and updates all controller references."""
        self.settings = load_settings()
        self.engine.settings = self.settings
        self.safety.settings = self.settings
        self.safety._active_yellow_dur = float(self.settings.timing.yellow_dur)
        self.estimator.settings = self.settings
        self.vision.settings = self.settings
        self.serial_mgr.settings = self.settings

    def build_telemetry_payload(self) -> dict:
        """Constructs canonical 300ms real-time state payload for UI and API."""
        now = time.time()
        self.safety.update(now)
        traffic_state = self.estimator.get_state()
        approach_signals = self.safety.get_approach_states()
        approach_timers = self.safety.get_approach_timers()
        time_to_next_snap = max(0.0, self.settings.snapshot_interval - (now - self.last_snapshot_time))

        return {
            "signal": {
                "phase": self.safety.current_phase,
                "state": self.safety.signal_state.value,
                "remaining": round(self.safety.remaining_green, 1),
                "reason": self.engine.last_reason,
                "yellow_dur": round(self.safety._active_yellow_dur, 1),
                "manual_durations": self.engine.manual_durations,
                "mode": self.engine.mode,
                "manual_loop_running": self.engine.manual_loop_running,
                "is_pedestrian_active": self.safety.is_pedestrian_red_active(),
                "pedestrian_red_phase": self.safety.pedestrian_red_phase,
                "pedestrian_approach": self.engine.last_pedestrian_approach if self.safety.is_pedestrian_red_active() else None,
            },
            "approaches": {
                name: {
                    "queue": st.queue_estimate,
                    "waiting_time": round(st.waiting_time, 1),
                    "vehicle_count": st.vehicle_count,
                    "breakdown": st.breakdown,
                    "has_ambulance": st.has_ambulance,
                    "signal": approach_signals.get(name, "red"),
                    "timer": approach_timers.get(name, 0),
                }
                for name, st in traffic_state.items()
            },
            "vision": {
                "mode": self.settings.vision_mode,
                "snapshot_interval": self.settings.snapshot_interval,
                "snapshots_taken": self.vision.snapshot_count,
                "next_snapshot_in": round(time_to_next_snap, 1),
            },
            "pedestrian": self.ped_requests,
            "active_ambulance": self.active_ambulance,
            "active_environment": self.active_environment,
            "video_source": self.video_source,
            "simulation": self.sumo_mgr.get_telemetry(),
            "pipeline": self.vision.health(),
            "hardware": self.serial_mgr.status(),
            "timestamp": now,
        }

# Global application state singleton
app_state = AppState()
