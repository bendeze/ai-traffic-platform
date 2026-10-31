import time
from typing import Dict, List, Optional
try:
    import traci
except ImportError:
    traci = None

from traffic.state_estimator import ApproachState
from simulation.sumo.connection import sumo_conn

class SUMOPerceptionAdapter:
    """
    Collects real-time microscopic traffic measurements from SUMO via TraCI
    and maps them directly into normalized ApproachState objects consumed by
    the existing DecisionEngine and TrafficStateEstimator.

    Extracts:
    - Vehicle counts per approach (North, South, East, West)
    - Queue lengths / halting counts (speed < 0.1 m/s)
    - Vehicle type breakdown (cars, buses, trucks, motorcycles, ambulances)
    - Waiting times per approach
    - Average speeds and lane occupancies
    - Emergency vehicle detection
    """

    APPROACH_EDGES = {
        "north": "north_in",
        "south": "south_in",
        "east":  "east_in",
        "west":  "west_in"
    }

    APPROACH_LANES = {
        "north": ["north_in_0", "north_in_1"],
        "south": ["south_in_0", "south_in_1"],
        "east":  ["east_in_0",  "east_in_1"],
        "west":  ["west_in_0",  "west_in_1"]
    }

    def __init__(self, connection=sumo_conn):
        self.conn = connection
        self._last_metrics: Dict[str, dict] = {}
        self._cached_states: Dict[str, ApproachState] = {
            a: ApproachState(name=a) for a in self.APPROACH_EDGES
        }

    def step_and_measure(self) -> Dict[str, ApproachState]:
        """
        Advances the TraCI simulation by one step and extracts live approach states.
        """
        if not self.conn.is_connected() or traci is None:
            return self._cached_states

        try:
            traci.switch(self.conn._traci_label)
        except Exception:
            return self._cached_states

        states: Dict[str, ApproachState] = {}
        now = time.time()

        for approach, edge in self.APPROACH_EDGES.items():
            lanes = self.APPROACH_LANES.get(approach, [])
            try:
                veh_ids = list(traci.edge.getLastStepVehicleIDs(edge))
                veh_count = len(veh_ids)
                halting_count = sum(traci.lane.getLastStepHaltingNumber(l) for l in lanes)
                mean_speed = float(traci.edge.getLastStepMeanSpeed(edge))
                occupancy = float(sum(traci.lane.getLastStepOccupancy(l) for l in lanes) / max(1, len(lanes)))

                breakdown = {"car": 0, "truck": 0, "motorcycle": 0, "bus": 0, "ambulance": 0}
                has_ambulance = False
                max_waiting = 0.0

                for vid in veh_ids:
                    vtype = str(traci.vehicle.getTypeID(vid)).lower()
                    vclass = str(traci.vehicle.getVehicleClass(vid)).lower()
                    wtime = float(traci.vehicle.getWaitingTime(vid))
                    if wtime > max_waiting:
                        max_waiting = wtime

                    if "ambulance" in vtype or vclass == "emergency" or "ambulance" in vid.lower():
                        breakdown["ambulance"] += 1
                        has_ambulance = True
                    elif "bus" in vtype or vclass == "bus":
                        breakdown["bus"] += 1
                    elif "truck" in vtype or vclass == "truck":
                        breakdown["truck"] += 1
                    elif "moto" in vtype or vclass == "motorcycle":
                        breakdown["motorcycle"] += 1
                    else:
                        breakdown["car"] += 1

                # Weighted queue estimate: truck/bus = 2, car = 1, motorcycle = 0.5, ambulance = 1.5
                weighted_queue = (
                    breakdown.get("car", 0) * 1.0 +
                    breakdown.get("truck", 0) * 2.0 +
                    breakdown.get("bus", 0) * 2.0 +
                    breakdown.get("motorcycle", 0) * 0.5 +
                    breakdown.get("ambulance", 0) * 1.5
                )

                st = ApproachState(name=approach)
                st.vehicle_count = veh_count
                st.queue_estimate = max(int(round(weighted_queue)), halting_count)
                st.waiting_time = max_waiting
                st.breakdown = breakdown
                st.has_ambulance = has_ambulance
                st.freshness = 0.0
                states[approach] = st

                # Cache detailed metrics for telemetry / experiments
                self._last_metrics[approach] = {
                    "vehicle_count": veh_count,
                    "queue_length": st.queue_estimate,
                    "halting_count": halting_count,
                    "mean_speed": round(mean_speed, 2),
                    "occupancy": round(occupancy, 3),
                    "waiting_time": round(max_waiting, 1),
                    "has_ambulance": has_ambulance,
                    "breakdown": breakdown
                }

            except Exception as e:
                states[approach] = self._cached_states.get(approach, ApproachState(name=approach))

        self._cached_states = states
        return states

    def get_approach_states(self) -> Dict[str, ApproachState]:
        return self._cached_states

    def get_metrics(self) -> Dict[str, dict]:
        return self._last_metrics

    def reset(self):
        """Resets cached approach states and telemetry metrics."""
        self._last_metrics = {}
        self._cached_states = {
            a: ApproachState(name=a) for a in self.APPROACH_EDGES
        }

# Global singleton
sumo_perception_adapter = SUMOPerceptionAdapter()
