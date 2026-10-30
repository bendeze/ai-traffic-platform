import os
import csv
import json
import time
from typing import Dict, List, Optional, Any
try:
    import traci
except ImportError:
    traci = None

class MetricsCollector:
    """
    Collects macroscopic and microscopic performance indicators from SUMO:
    - Average vehicle waiting time (s)
    - Average travel time (s)
    - Average & Maximum queue length (vehs)
    - Vehicle throughput (completed trips)
    - Total delay / time lost (s)
    """

    APPROACH_EDGES = ["north_in", "south_in", "east_in", "west_in"]
    APPROACH_LANES = [
        "north_in_0", "north_in_1",
        "south_in_0", "south_in_1",
        "east_in_0",  "east_in_1",
        "west_in_0",  "west_in_1"
    ]

    def __init__(self):
        self.reset()

    def reset(self):
        self.start_sim_time: float = 0.0
        self.latest_sim_time: float = 0.0
        self.step_samples = 0

        # Time series / samples
        self.queue_samples: List[int] = []
        self.approach_queue_samples: Dict[str, List[int]] = {e: [] for e in self.APPROACH_EDGES}
        self.waiting_time_samples: List[float] = []

        # Vehicle lifecycle tracking
        self.departed_vehicles: Dict[str, float] = {}   # vid -> depart_time
        self.completed_trips: List[Dict[str, Any]] = [] # list of trip records
        self.total_time_loss: float = 0.0
        self.max_queue_observed: int = 0

    def sample_step(self):
        """Called on every simulation step or tick to collect telemetry."""
        if traci is None:
            return

        try:
            curr_time = traci.simulation.getTime()
            if self.step_samples == 0:
                self.start_sim_time = curr_time
            self.latest_sim_time = curr_time
            self.step_samples += 1

            # 1. Track newly departed vehicles
            for vid in traci.simulation.getDepartedIDList():
                self.departed_vehicles[vid] = curr_time

            # 2. Track newly arrived / completed vehicles
            for vid in traci.simulation.getArrivedIDList():
                dep_time = self.departed_vehicles.pop(vid, None)
                travel_time = (curr_time - dep_time) if dep_time is not None else 0.0
                self.completed_trips.append({
                    "id": vid,
                    "depart": dep_time,
                    "arrival": curr_time,
                    "travel_time": round(travel_time, 2)
                })

            # 3. Sample halting queues on all intersection approaches
            total_queue = 0
            for app_edge in self.APPROACH_EDGES:
                lanes = [f"{app_edge}_0", f"{app_edge}_1"]
                q = sum(traci.lane.getLastStepHaltingNumber(l) for l in lanes)
                self.approach_queue_samples[app_edge].append(q)
                total_queue += q

            self.queue_samples.append(total_queue)
            if total_queue > self.max_queue_observed:
                self.max_queue_observed = total_queue

            # 4. Sample waiting times and time loss
            active_vehs = traci.vehicle.getIDList()
            if active_vehs:
                step_wait = sum(traci.vehicle.getWaitingTime(v) for v in active_vehs) / len(active_vehs)
                self.waiting_time_samples.append(step_wait)
                # Accumulate time loss
                for v in active_vehs:
                    self.total_time_loss += traci.vehicle.getTimeLoss(v) * 0.01

        except Exception:
            pass

    def get_summary(self) -> Dict[str, Any]:
        """Calculates aggregated performance benchmark metrics."""
        duration = max(1.0, self.latest_sim_time - self.start_sim_time)
        completed_count = len(self.completed_trips)

        avg_travel = (
            sum(t["travel_time"] for t in self.completed_trips) / completed_count
            if completed_count > 0 else 0.0
        )
        avg_queue = (
            sum(self.queue_samples) / len(self.queue_samples)
            if self.queue_samples else 0.0
        )
        avg_wait = (
            sum(self.waiting_time_samples) / len(self.waiting_time_samples)
            if self.waiting_time_samples else 0.0
        )
        throughput_hourly = round((completed_count / duration) * 3600.0, 1)

        approach_avg_queues = {
            app: round(sum(samples) / len(samples), 2) if samples else 0.0
            for app, samples in self.approach_queue_samples.items()
        }

        return {
            "duration_seconds": round(duration, 1),
            "completed_trips": completed_count,
            "throughput_vehs_per_hour": throughput_hourly,
            "average_travel_time": round(avg_travel, 2),
            "average_waiting_time": round(avg_wait, 2),
            "average_queue_length": round(avg_queue, 2),
            "maximum_queue_length": self.max_queue_observed,
            "total_time_loss": round(self.total_time_loss, 1),
            "approach_avg_queues": approach_avg_queues
        }

    def export_json(self, filepath: str) -> str:
        summary = self.get_summary()
        summary["completed_trips_detail"] = self.completed_trips
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        return filepath

    def export_csv(self, filepath: str) -> str:
        summary = self.get_summary()
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Metric", "Value"])
            for k, v in summary.items():
                if not isinstance(v, (dict, list)):
                    writer.writerow([k, v])
            for app, avg_q in summary.get("approach_avg_queues", {}).items():
                writer.writerow([f"avg_queue_{app}", avg_q])
        return filepath

# Global singleton collector
metrics_collector = MetricsCollector()

