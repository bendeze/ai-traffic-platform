import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from vision.pipeline import Detection

@dataclass
class ApproachState:
    name: str
    queue_estimate: int = 0
    approaching_count: int = 0
    vehicle_count: int = 0
    waiting_time: float = 0.0
    arrivals: int = 0
    freshness: float = 0.0
    has_ambulance: bool = False
    breakdown: Dict[str, int] = field(default_factory=lambda: {
        "car": 0, "truck": 0, "motorcycle": 0, "bus": 0, "ambulance": 0
    })

class TrafficStateEstimator:
    def __init__(self, settings):
        self.settings = settings
        self._states = {a.name: ApproachState(a.name) for a in settings.approaches}
        self._first_seen = defaultdict(time.time)
        self._last_counts = defaultdict(int)
        self._last_update = defaultdict(float)

    def update(self, detections: List[Detection], manual_ambulance: Optional[str] = None):
        now = time.time()
        counts = defaultdict(int)
        breakdowns = {a.name: defaultdict(int) for a in self.settings.approaches}
        ambulance_flags = {a.name: False for a in self.settings.approaches}

        if manual_ambulance and manual_ambulance in ambulance_flags:
            ambulance_flags[manual_ambulance] = True
            breakdowns[manual_ambulance]["ambulance"] += 1
            counts[manual_ambulance] += 1

        for det in detections:
            if det.approach and det.approach in self._states:
                counts[det.approach] += 1
                cls_clean = det.cls.lower()
                breakdowns[det.approach][cls_clean] += 1
                if det.is_ambulance:
                    ambulance_flags[det.approach] = True

        for name in self._states:
            prev = self._last_counts.get(name, 0)
            curr = counts.get(name, 0)
            st = self._states[name]

            st.vehicle_count = curr
            st.breakdown = dict(breakdowns[name])
            st.has_ambulance = ambulance_flags[name]

            # Weighted queue estimate: truck/bus = 2, car = 1, motorcycle = 0.5
            weighted_queue = (
                st.breakdown.get("car", 0) * 1.0 +
                st.breakdown.get("truck", 0) * 2.0 +
                st.breakdown.get("bus", 0) * 2.0 +
                st.breakdown.get("motorcycle", 0) * 0.5 +
                st.breakdown.get("ambulance", 0) * 1.5
            )
            st.queue_estimate = int(round(weighted_queue))
            st.arrivals = max(0, curr - prev)

            if curr > 0 or st.has_ambulance:
                if prev == 0 and not st.has_ambulance:
                    self._first_seen[name] = now
                st.waiting_time = now - self._first_seen[name]
            else:
                st.waiting_time = 0.0
                self._first_seen[name] = now

            st.freshness = now - self._last_update.get(name, now)
            self._last_update[name] = now
            self._last_counts[name] = curr

    def get_state(self) -> Dict[str, ApproachState]:
        return self._states

    def reset(self):
        """Resets all approach estimates and tracking timers to initial zero state."""
        for name, st in self._states.items():
            st.queue_estimate = 0
            st.vehicle_count = 0
            st.waiting_time = 0.0
            st.arrivals = 0
            st.freshness = 0.0
            st.has_ambulance = False
            st.breakdown = {"car": 0, "truck": 0, "motorcycle": 0, "bus": 0, "ambulance": 0}
        self._first_seen.clear()
        self._last_counts.clear()
        self._last_update.clear()
