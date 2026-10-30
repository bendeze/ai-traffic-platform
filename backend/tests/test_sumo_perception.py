import os
import time
import unittest
try:
    import traci
except ImportError:
    traci = None

from config.settings import load_settings
from traffic.state_estimator import TrafficStateEstimator
from traffic.decision_engine import DecisionEngine
from controller.safety_manager import SafetyManager
from simulation.sumo.connection import SumoConnection
from simulation.sumo.traffic_adapter import SUMOTrafficAdapter
from simulation.sumo.perception_adapter import SUMOPerceptionAdapter
from simulation.sumo.manager import SUMOManager

class TestSUMOPerceptionAndClosedLoop(unittest.TestCase):
    """
    Stage 6 Test Suite:
    Validates the SUMO perception adapter and the complete closed-loop feedback:
    SUMO -> PerceptionAdapter -> Estimator -> DecisionEngine -> SafetyManager -> TrafficAdapter -> SUMO.
    """

    @classmethod
    def setUpClass(cls):
        cls.scenario_dir = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "..", "simulation", "sumo", "scenario"
        ))
        cls.cfg_file = os.path.join(cls.scenario_dir, "intersection.sumocfg")

    def setUp(self):
        self.settings = load_settings()
        self.settings.serial_enabled = False
        self.estimator = TrafficStateEstimator(self.settings)
        self.engine = DecisionEngine(self.settings)
        self.safety = SafetyManager(self.settings, on_phase_started=self.engine.notify_phase_started)
        self.engine.safety_ref = self.safety

        self.conn = SumoConnection()
        self.traffic_adapter = SUMOTrafficAdapter(tls_id="center", connection=self.conn)
        self.perception_adapter = SUMOPerceptionAdapter(connection=self.conn)

    def test_01_perception_adapter_measurements(self):
        try:
            ok = self.conn.start(config_path=self.cfg_file, gui=False, step_length=0.1)
            self.assertTrue(ok)
            traci.switch(self.conn._traci_label)

            # Advance 150 steps so vehicles enter all 4 approaches
            for _ in range(150):
                self.conn.step()

            states = self.perception_adapter.step_and_measure()

            # Verify all 4 approaches are measured
            for app in ["north", "south", "east", "west"]:
                self.assertIn(app, states)
                st = states[app]
                self.assertGreaterEqual(st.vehicle_count, 0)
                self.assertGreaterEqual(st.queue_estimate, 0)
                self.assertIn("car", st.breakdown)
                self.assertIn("bus", st.breakdown)

            # Total vehicles across intersection approaches must be > 0
            total_vehs = sum(s.vehicle_count for s in states.values())
            self.assertGreater(total_vehs, 0, "SUMO perception must detect generated vehicles")

            # Verify metrics dictionary
            metrics = self.perception_adapter.get_metrics()
            self.assertIn("north", metrics)
            self.assertIn("mean_speed", metrics["north"])
            self.assertIn("occupancy", metrics["north"])

        finally:
            self.conn.stop()
            self.assertFalse(self.conn.is_connected())

    def test_02_complete_closed_loop_feedback(self):
        """
        Executes the master SUMOManager closed-loop cycle.
        Proves that SUMO perception data updates the estimator, which feeds
        the DecisionEngine FSM, which applies safety interlocks, which controls SUMO.
        """
        mgr = SUMOManager(self.settings)
        mgr.conn = self.conn
        mgr.traffic_adapter = self.traffic_adapter
        mgr.perception_adapter = self.perception_adapter
        mgr.attach_traffic_controllers(self.engine, self.safety, self.estimator)

        try:
            ok = mgr.start_simulation(gui=False, speed_factor=3.0, cfg_path=self.cfg_file)
            self.assertTrue(ok)
            self.assertTrue(mgr.is_running)

            # Let simulation run for 2.0 seconds real time (~60 steps at 3.0x speed)
            time.sleep(2.0)

            # Verify estimator holds live SUMO counts
            state = self.estimator.get_state()
            total_est_vehs = sum(s.vehicle_count for s in state.values())
            self.assertGreater(total_est_vehs, 0, "Estimator must receive live SUMO vehicle counts")

            # Verify FSM can make a valid decision using this state
            ped_requests = {a: False for a in ["north", "south", "east", "west"]}
            decision = self.engine.decide(state, ped_requests)
            self.assertIn(decision["phase"], ("A", "B"))
            self.assertGreater(decision["duration"], 0)

            # Verify telemetry output
            telemetry = mgr.get_telemetry()
            self.assertTrue(telemetry["is_running"])
            self.assertGreater(telemetry["sim_time"], 0.0)
            self.assertGreaterEqual(telemetry["active_vehicle_count"], 0)

        finally:
            mgr.stop_simulation()
            self.assertFalse(mgr.is_running)

if __name__ == '__main__':
    unittest.main()

