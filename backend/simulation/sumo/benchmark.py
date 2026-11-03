import os
import time
import json
import csv
from typing import Dict, Any, List

from config.settings import load_settings
from traffic.state_estimator import TrafficStateEstimator
from traffic.decision_engine import DecisionEngine
from controller.safety_manager import SafetyManager
from simulation.sumo.connection import SumoConnection
from simulation.sumo.traffic_adapter import SUMOTrafficAdapter
from simulation.sumo.perception_adapter import SUMOPerceptionAdapter
from simulation.sumo.metrics_collector import MetricsCollector

class BenchmarkRunner:
    """
    Executes controlled comparative experiments across traffic signal control strategies:
    1. Fixed-Time Control
    2. Adaptive AI Control
    3. Manual Timed Control

    Ensures scientific fairness by executing each mode under the exact same
    seed, scenario geometry, and traffic generation distributions.
    """

    def __init__(self, scenario_cfg: Optional[str] = None):
        self.settings = load_settings()
        self.settings.serial_enabled = False

        if scenario_cfg:
            self.cfg_file = scenario_cfg
        else:
            scenario_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "scenario"))
            self.cfg_file = os.path.join(scenario_dir, "intersection.sumocfg")

    def run_single_mode(self, mode: str, duration: float = 60.0, seed: int = 42) -> Dict[str, Any]:
        """
        Runs one evaluation run for a specific mode for 'duration' simulation seconds.
        """
        estimator = TrafficStateEstimator(self.settings)
        engine = DecisionEngine(self.settings)
        engine.mode = mode
        if mode == "manual":
            engine.manual_loop_running = True
            engine.set_manual_durations(phase_a=25, phase_b=25)

        safety = SafetyManager(self.settings, on_phase_started=engine.notify_phase_started)
        engine.safety_ref = safety

        conn = SumoConnection()
        adapter = SUMOTrafficAdapter(tls_id="center", connection=conn)
        perception = SUMOPerceptionAdapter(connection=conn)
        collector = MetricsCollector()

        additional_args = ["--seed", str(seed)]
        conn.start(config_path=self.cfg_file, gui=False, step_length=0.1, additional_args=additional_args)

        collector.reset()
        ped_requests = {a: False for a in ["north", "south", "east", "west"]}

        step_count = int(duration / 0.1)

        try:
            for _ in range(step_count):
                sim_time = conn.step()
                collector.sample_step()
                approach_states = perception.step_and_measure()

                # Update estimator with SUMO measurements
                for app_name, st in approach_states.items():
                    if app_name in estimator._states:
                        existing = estimator._states[app_name]
                        existing.vehicle_count = st.vehicle_count
                        existing.queue_estimate = st.queue_estimate
                        existing.waiting_time = st.waiting_time
                        existing.breakdown = st.breakdown
                        existing.has_ambulance = st.has_ambulance

                # FSM makes decision
                proposal = engine.decide(estimator.get_state(), ped_requests, now=sim_time)
                safety.apply(proposal, now=sim_time)
                safety.update(sim_time)

                # Send authoritative signals to SUMO
                signals = safety.get_approach_states()
                adapter.apply_signals(signals)

            summary = collector.get_summary()
            summary["control_mode"] = mode
            summary["seed"] = seed
            return summary

        finally:
            conn.stop()

    def run_comparative_study(self, duration: float = 60.0, seed: int = 42) -> Dict[str, Any]:
        """
        Runs Fixed, Adaptive, and Manual strategies sequentially and calculates improvements.
        """
        fixed_res = self.run_single_mode("fixed", duration=duration, seed=seed)
        adaptive_res = self.run_single_mode("adaptive", duration=duration, seed=seed)
        manual_res = self.run_single_mode("manual", duration=duration, seed=seed)

        # Calculate improvement percentages (Adaptive vs Fixed)
        def _reduction(val_fixed, val_adaptive):
            if val_fixed == 0:
                return 0.0
            return round(((val_fixed - val_adaptive) / val_fixed) * 100.0, 1)

        wait_reduction = _reduction(fixed_res["average_waiting_time"], adaptive_res["average_waiting_time"])
        queue_reduction = _reduction(fixed_res["average_queue_length"], adaptive_res["average_queue_length"])

        study_report = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "seed": seed,
            "duration_per_run_seconds": duration,
            "comparison": {
                "fixed": fixed_res,
                "adaptive": adaptive_res,
                "manual": manual_res
            },
            "improvements_adaptive_vs_fixed": {
                "waiting_time_reduction_percent": wait_reduction,
                "queue_reduction_percent": queue_reduction
            }
        }

        # Auto-export report
        exp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "experiments"))
        os.makedirs(exp_dir, exist_ok=True)
        ts_slug = int(time.time())
        json_path = os.path.join(exp_dir, f"benchmark_{ts_slug}.json")
        csv_path = os.path.join(exp_dir, f"benchmark_{ts_slug}.csv")

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(study_report, f, indent=2)

        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Metric", "Fixed-Time", "Adaptive AI", "Manual Timed"])
            writer.writerow(["Average Waiting Time (s)", fixed_res["average_waiting_time"], adaptive_res["average_waiting_time"], manual_res["average_waiting_time"]])
            writer.writerow(["Average Queue Length (vehs)", fixed_res["average_queue_length"], adaptive_res["average_queue_length"], manual_res["average_queue_length"]])
            writer.writerow(["Maximum Queue (vehs)", fixed_res["maximum_queue_length"], adaptive_res["maximum_queue_length"], manual_res["maximum_queue_length"]])
            writer.writerow(["Completed Trips", fixed_res["completed_trips"], adaptive_res["completed_trips"], manual_res["completed_trips"]])
            writer.writerow(["Throughput (vehs/hr)", fixed_res["throughput_vehs_per_hour"], adaptive_res["throughput_vehs_per_hour"], manual_res["throughput_vehs_per_hour"]])

        study_report["exported_files"] = {"json": json_path, "csv": csv_path}
        return study_report

# Global singleton runner
benchmark_runner = BenchmarkRunner()

