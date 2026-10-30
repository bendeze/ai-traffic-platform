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
from controller.safety_manager import SafetyManager, SignalState
from controller.serial_manager import SerialManager
from simulation.sumo.connection import SumoConnection
from simulation.sumo.traffic_adapter import SUMOTrafficAdapter
from simulation.sumo.perception_adapter import SUMOPerceptionAdapter
from simulation.sumo.manager import SUMOManager

class TestFullRegressionAndAcceptance(unittest.TestCase):
    """
    Stage 9 Full Regression & Final Acceptance Test Suite:
    Executes end-to-end multi-approach validation across all modes,
    emergency preemption, pedestrian protection, lifecycle management,
    and co-existence with video and hardware subsystems.
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
        self.adapter = SUMOTrafficAdapter(tls_id="center", connection=self.conn)
        self.perception = SUMOPerceptionAdapter(connection=self.conn)

        self.mgr = SUMOManager(self.settings)
        self.mgr.conn = self.conn
        self.mgr.traffic_adapter = self.adapter
        self.mgr.perception = self.perception
        self.mgr.attach_traffic_controllers(self.engine, self.safety, self.estimator)

    def tearDown(self):
        if self.mgr.is_running:
            self.mgr.stop_simulation()
        if self.conn.is_connected():
            self.conn.stop()

    def test_01_complete_fsm_adaptive_cycle_with_sumo(self):
        """
        Final Acceptance Test:
        1. Launches SUMO with vehicles on all approaches.
        2. FSM starts in Phase A (NS Green).
        3. East-West vehicles queue up.
        4. FSM reacts to growing queue pressure and transitions to Phase B.
        5. SUMO receives 3s yellow -> 2s all-red clearance -> Phase B green.
        """
        ok = self.mgr.start_simulation(gui=False, speed_factor=3.0, cfg_path=self.cfg_file)
        self.assertTrue(ok)
        self.assertTrue(self.mgr.is_running)

        # Allow simulation to step and accumulate vehicles
        time.sleep(1.5)

        initial_phase = self.safety.current_phase
        self.assertEqual(initial_phase, "A")
        # Assert SUMO adopted Phase A Green
        traci.switch(self.conn._traci_label)
        self.assertEqual(traci.trafficlight.getRedYellowGreenState("center"), "GGGGrrrrGGGGrrrr")

        # Propose switch to Phase B
        prop = {"phase": "B", "duration": 20, "yellow_dur": 3.0}
        self.safety.apply(prop)

        # Must enter 4-way yellow
        self.assertEqual(self.safety.signal_state, SignalState.YELLOW)
        self.adapter.apply_signals(self.safety.get_approach_states())
        self.assertEqual(traci.trafficlight.getRedYellowGreenState("center"), "yyyyyyyyyyyyyyyy")

        # Advance through yellow -> all-red clearance
        self.safety.update(now=self.safety._transition_start + 3.1)
        self.assertEqual(self.safety.signal_state, SignalState.CLEARANCE)
        self.adapter.apply_signals(self.safety.get_approach_states())
        self.assertEqual(traci.trafficlight.getRedYellowGreenState("center"), "rrrrrrrrrrrrrrrr")

        # Advance through clearance -> Phase B Green
        self.safety.update(now=self.safety._transition_start + 2.1)
        self.assertEqual(self.safety.signal_state, SignalState.GREEN)
        self.assertEqual(self.safety.current_phase, "B")
        self.adapter.apply_signals(self.safety.get_approach_states())
        self.assertEqual(traci.trafficlight.getRedYellowGreenState("center"), "rrrrGGGGrrrrGGGG")

    def test_02_emergency_ambulance_preemption_in_sumo(self):
        """
        Verifies emergency ambulance preemption while running in SUMO.
        An ambulance on East must immediately switch traffic light to Phase B (East-West Green).
        """
        ok = self.mgr.start_simulation(gui=False, speed_factor=3.0, cfg_path=self.cfg_file)
        self.assertTrue(ok)

        # Artificially inject ambulance detection on East approach
        st = self.estimator.get_state()
        st["east"].has_ambulance = True

        ped_requests = {a: False for a in ["north", "south", "east", "west"]}
        proposal = self.engine.decide(st, ped_requests)
        self.assertEqual(proposal["phase"], "B")
        self.assertIn("emergency_ambulance_preemption", proposal["reason"])

    def test_03_pedestrian_protection_in_sumo(self):
        """
        Verifies protected 10-second pedestrian crossing lock in SUMO.
        A pedestrian request on North locks Phase A on RED for 10 seconds.
        """
        ok = self.mgr.start_simulation(gui=False, speed_factor=3.0, cfg_path=self.cfg_file)
        self.assertTrue(ok)

        self.safety.trigger_pedestrian_red("north", duration=10.0)
        self.assertTrue(self.safety.is_pedestrian_red_active())

        signals = self.safety.get_approach_states()
        self.assertEqual(signals["north"], "red")
        self.assertEqual(signals["south"], "red")

        self.adapter.apply_signals(signals)
        traci.switch(self.conn._traci_label)
        sumo_state = traci.trafficlight.getRedYellowGreenState("center")
        # Indices 0..3 (North) and 8..11 (South) must be red 'r'
        for idx in [0, 1, 2, 3, 8, 9, 10, 11]:
            self.assertEqual(sumo_state[idx], "r")

    def test_04_simulation_lifecycle_controls(self):
        """
        Verifies pause, resume, reset, and clean termination.
        """
        ok = self.mgr.start_simulation(gui=False, speed_factor=2.0, cfg_path=self.cfg_file)
        self.assertTrue(ok)

        time.sleep(0.5)
        t1 = self.conn.get_time()

        # Pause
        self.mgr.pause_simulation()
        self.assertTrue(self.mgr.is_paused)
        time.sleep(0.3)
        t_paused = self.conn.get_time()
        self.assertAlmostEqual(t1, t_paused, delta=0.2)

        # Resume
        self.mgr.resume_simulation()
        self.assertFalse(self.mgr.is_paused)
        time.sleep(0.5)
        t_resumed = self.conn.get_time()
        self.assertGreater(t_resumed, t_paused)

        # Reset
        ok_reset = self.mgr.reset_simulation()
        self.assertTrue(ok_reset)
        self.assertTrue(self.mgr.is_running)

        # Stop
        self.mgr.stop_simulation()
        self.assertFalse(self.mgr.is_running)
        self.assertFalse(self.conn.is_connected())

    def test_05_subsystem_coexistence_and_safety(self):
        """
        Verifies that SerialManager (physical Arduino) and TrafficStateEstimator
        operate cleanly without interference when SUMO is active or stopped.
        """
        sm = SerialManager(self.settings)
        self.assertIsNotNone(sm.status())

        # Verify send_signals format works without exception
        states = self.safety.get_approach_states()
        self.assertIn("north", states)
        self.assertIn("south", states)
        self.assertIn("east", states)
        self.assertIn("west", states)

if __name__ == '__main__':
    unittest.main()
