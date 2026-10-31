import os
import time
import asyncio
import threading
from typing import Optional, Dict, Any, List

from simulation.sumo.environment import sumo_env
from simulation.sumo.connection import sumo_conn, SumoConnection
from simulation.sumo.traffic_adapter import sumo_traffic_adapter, SUMOTrafficAdapter
from simulation.sumo.perception_adapter import sumo_perception_adapter, SUMOPerceptionAdapter
from simulation.sumo.metrics_collector import metrics_collector, MetricsCollector

class SUMOManager:
    """
    Master coordinator for SUMO Simulation Mode.
    Orchestrates connection lifecycle, closed-loop perception feeding,
    FSM signal enforcement, emergency vehicle injection, and telemetry reporting.
    """

    def __init__(self, settings=None):
        self.settings = settings
        self.conn: SumoConnection = sumo_conn
        self.traffic_adapter: SUMOTrafficAdapter = sumo_traffic_adapter
        self.perception_adapter: SUMOPerceptionAdapter = sumo_perception_adapter

        self.scenario_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "scenario"))
        self.default_cfg = os.path.join(self.scenario_dir, "intersection.sumocfg")

        self.is_running = False
        self.is_paused = False
        self.is_gui = False
        self.speed_factor = 1.0
        self.active_mode = "closed_loop"  # "closed_loop" or "video_informed"

        self._sim_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._pause_event.set()  # Unpaused initially

        # References to external FSM, SafetyManager, and AppState
        self.fsm_engine = None
        self.safety_manager = None
        self.estimator = None
        self.app_state = None

    def attach_traffic_controllers(self, engine, safety, estimator, app_state=None):
        """Attaches the authoritative FSM, SafetyManager, state estimator, and AppState."""
        self.fsm_engine = engine
        self.safety_manager = safety
        self.estimator = estimator
        self.app_state = app_state

    def start_simulation(self, gui: bool = False, speed_factor: float = 1.0, cfg_path: Optional[str] = None) -> bool:
        """Starts SUMO and begins the autonomous stepping and closed-loop control thread."""
        if self.is_running:
            return True

        target_cfg = cfg_path or self.default_cfg
        self.is_gui = gui
        self.speed_factor = max(0.1, min(5.0, float(speed_factor)))

        ok = self.conn.start(config_path=target_cfg, gui=gui, step_length=0.1)
        if not ok:
            return False

        metrics_collector.reset()
        self.perception_adapter.reset()
        if self.estimator:
            self.estimator.reset()

        self.is_running = True
        self.is_paused = False
        self._stop_event.clear()
        self._pause_event.set()

        self._sim_thread = threading.Thread(target=self._run_loop, daemon=True, name="SUMO_Simulation_Loop")
        self._sim_thread.start()
        return True

    def pause_simulation(self):
        self.is_paused = True
        self._pause_event.clear()

    def resume_simulation(self):
        self.is_paused = False
        self._pause_event.set()

    def stop_simulation(self):
        self.is_running = False
        self.is_paused = False
        self._stop_event.set()
        self._pause_event.set()

        if self._sim_thread and self._sim_thread.is_alive():
            self._sim_thread.join(timeout=1.5)
        self._sim_thread = None

        self.conn.stop()

    def reset_simulation(self) -> bool:
        """
        Resets the simulation to t=0.0s.
        If TraCI is active, uses in-process traci.load() to instantly reload scenario.
        Otherwise falls back to stop/start.
        """
        if self.is_running and self.conn.is_connected():
            was_paused = self.is_paused
            self._pause_event.clear()  # Temporarily pause background stepping thread
            time.sleep(0.05)  # Allow any active conn.step() call to complete

            try:
                ok = self.conn.reload(config_path=self.default_cfg, step_length=0.1)
                if ok:
                    metrics_collector.reset()
                    self.perception_adapter.reset()
                    if self.estimator:
                        self.estimator.reset()
                    self.is_paused = False
                    self._pause_event.set()
                    return True
            except Exception:
                pass

        # Fallback if reload wasn't possible or failed
        gui = self.is_gui
        speed = self.speed_factor
        self.stop_simulation()
        time.sleep(0.3)
        return self.start_simulation(gui=gui, speed_factor=speed)

    def spawn_ambulance(self, approach: str) -> bool:
        """
        Dynamically spawns an emergency ambulance vehicle in SUMO on the designated incoming approach.
        Enables testing immediate green preemption in real-time.
        """
        approach = approach.lower()
        route_map = {
            "north": "r_north_to_south",
            "south": "r_south_to_north",
            "east":  "r_east_to_west",
            "west":  "r_west_to_east"
        }
        route_id = route_map.get(approach)
        if not route_id:
            return False

        if not self.conn.is_connected():
            return False

        try:
            import traci
            traci.switch(self.conn._traci_label)
            veh_id = f"ambulance_{approach}_{int(time.time() * 1000) % 100000}"
            traci.vehicle.add(
                veh_id,
                route_id,
                typeID="emergency_ambulance",
                depart="now",
                departLane="best",
                departSpeed="max"
            )
            return True
        except Exception as e:
            return False

    def _run_loop(self):
        """
        Closed-loop execution thread:
        1. Advances SUMO step.
        2. Measures approach states from SUMO (including emergency ambulances).
        3. Updates estimator so DecisionEngine FSM receives live SUMO measurements.
        4. Transmits authoritative FSM signal states from SafetyManager back into SUMO TraCI.
        """
        step_dt = 0.1

        while not self._stop_event.is_set():
            self._pause_event.wait()
            if self._stop_event.is_set():
                break

            t0 = time.time()

            try:
                # 1. Step simulation and gather perception measurements
                self.conn.step()
                metrics_collector.sample_step()
                approach_states = self.perception_adapter.step_and_measure()

                # 2. Feed measurements into TrafficStateEstimator
                detected_amb = False
                amb_approach = None

                if self.estimator:
                    for app_name, st in approach_states.items():
                        if app_name in self.estimator._states:
                            existing = self.estimator._states[app_name]
                            existing.vehicle_count = st.vehicle_count
                            existing.queue_estimate = st.queue_estimate
                            existing.waiting_time = st.waiting_time
                            existing.breakdown = st.breakdown
                            existing.has_ambulance = st.has_ambulance
                            if st.has_ambulance:
                                detected_amb = True
                                amb_approach = app_name

                # Synchronize detected ambulance into AppState:
                # Active only while the ambulance vehicle is physically detected on the road.
                # As soon as it passes the intersection, it clears immediately.
                if self.app_state:
                    if detected_amb:
                        self.app_state.active_ambulance = amb_approach
                    else:
                        self.app_state.active_ambulance = None

                # 3. Synchronize authoritative SafetyManager states to SUMO
                if self.safety_manager:
                    self.safety_manager.update(time.time())
                    current_signals = self.safety_manager.get_approach_states()
                    self.traffic_adapter.apply_signals(current_signals)

            except Exception as e:
                # Connection broken or process exited
                break

            elapsed = time.time() - t0
            target_sleep = max(0.005, (step_dt / self.speed_factor) - elapsed)
            time.sleep(target_sleep)

        self.is_running = False
        self.conn.stop()

    def get_telemetry(self) -> Dict[str, Any]:
        """Provides structured telemetry for WebSocket broadcast and API."""
        metrics = self.perception_adapter.get_metrics()
        approach_signals = self.safety_manager.get_approach_states() if self.safety_manager else {}
        approach_timers = self.safety_manager.get_approach_timers() if self.safety_manager else {}

        telemetry_approaches = {}
        for app in ("north", "south", "east", "west"):
            m = dict(metrics.get(app, {}))
            m["signal"] = approach_signals.get(app, "red")
            m["timer"] = approach_timers.get(app, 0)
            telemetry_approaches[app] = m

        total_vehs = sum(m.get("vehicle_count", 0) for m in telemetry_approaches.values())
        return {
            "is_running": self.is_running,
            "is_paused": self.is_paused,
            "is_gui": self.is_gui,
            "sim_time": round(self.conn.get_time(), 1),
            "speed_factor": self.speed_factor,
            "active_mode": self.active_mode,
            "active_vehicle_count": total_vehs,
            "approaches": telemetry_approaches,
            "metrics": metrics_collector.get_summary()
        }

# Global singleton manager
sumo_mgr = SUMOManager()
