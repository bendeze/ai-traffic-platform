import unittest
import time
from config.settings import load_settings
from traffic.state_estimator import ApproachState
from traffic.decision_engine import DecisionEngine
from controller.safety_manager import SafetyManager, SignalState
from controller.serial_manager import SerialManager

class TestBaselineFSMAndSafety(unittest.TestCase):
    """
    Stage 1 Baseline Test Suite:
    Verifies that the existing DecisionEngine FSM, SafetyManager interlocks,
    and SerialManager protocols operate exactly according to specification
    before introducing SUMO integration.
    """

    def setUp(self):
        self.settings = load_settings()
        self.settings.serial_enabled = False
        self.engine = DecisionEngine(self.settings)
        self.safety = SafetyManager(self.settings, on_phase_started=self.engine.notify_phase_started)
        self.engine.safety_ref = self.safety

    def _make_state(self, north=0, south=0, east=0, west=0, ambulance=None):
        def _app(name, cnt):
            st = ApproachState(name=name)
            st.vehicle_count = cnt
            st.queue_estimate = cnt
            st.density = min(1.0, cnt / 15.0)
            st.has_ambulance = (name == ambulance)
            return st
        return {
            "north": _app("north", north),
            "south": _app("south", south),
            "east":  _app("east", east),
            "west":  _app("west", west),
        }

    def test_01_fsm_initial_state(self):
        self.assertEqual(self.engine.mode, "adaptive")
        self.assertEqual(self.safety.current_phase, "A")
        self.assertEqual(self.safety.signal_state, SignalState.GREEN)
        states = self.safety.get_approach_states()
        self.assertEqual(states["north"], "green")
        self.assertEqual(states["south"], "green")
        self.assertEqual(states["east"], "red")
        self.assertEqual(states["west"], "red")

    def test_02_safety_interlock_sequence(self):
        # Mandatory sequence: GREEN -> YELLOW (3s) -> CLEARANCE All-Red (2s) -> GREEN
        now = time.time()
        self.safety._phase_start = now - 15.0  # Min green elapsed
        self.safety.current_phase = "A"
        self.safety.signal_state = SignalState.GREEN

        # Propose switch to Phase B
        proposal = {"phase": "B", "duration": 25, "yellow_dur": 3.0}
        self.safety.apply(proposal)

        # 1. State must immediately become YELLOW
        self.assertEqual(self.safety.signal_state, SignalState.YELLOW)
        yellow_states = self.safety.get_approach_states()
        # All 4 approaches must show YELLOW simultaneously
        self.assertEqual(yellow_states["north"], "yellow")
        self.assertEqual(yellow_states["south"], "yellow")
        self.assertEqual(yellow_states["east"], "yellow")
        self.assertEqual(yellow_states["west"], "yellow")

        # 2. Advance 3.1s -> Must enter CLEARANCE (All-Red)
        self.safety.update(now=self.safety._transition_start + 3.1)
        self.assertEqual(self.safety.signal_state, SignalState.CLEARANCE)
        clearance_states = self.safety.get_approach_states()
        self.assertEqual(clearance_states["north"], "red")
        self.assertEqual(clearance_states["south"], "red")
        self.assertEqual(clearance_states["east"], "red")
        self.assertEqual(clearance_states["west"], "red")

        # 3. Advance additional 2.1s -> Must activate Phase B GREEN
        self.safety.update(now=self.safety._transition_start + 2.1)
        self.assertEqual(self.safety.signal_state, SignalState.GREEN)
        self.assertEqual(self.safety.current_phase, "B")
        b_states = self.safety.get_approach_states()
        self.assertEqual(b_states["east"], "green")
        self.assertEqual(b_states["west"], "green")
        self.assertEqual(b_states["north"], "red")
        self.assertEqual(b_states["south"], "red")

    def test_03_emergency_ambulance_preemption(self):
        # When Phase A is active, an ambulance on East approach must force Phase B
        self.engine._last_phase = "A"
        state = self._make_state(north=5, south=5, east=1, west=0, ambulance="east")
        ped_requests = {"north": False, "south": False, "east": False, "west": False}

        decision = self.engine.decide(state, ped_requests)
        self.assertEqual(decision["phase"], "B")
        self.assertIn("emergency_ambulance_preemption", decision["reason"])

    def test_04_pedestrian_10s_red_override(self):
        # A pedestrian request on 'north' must immediately lock North & South (Phase A) on RED
        now = time.time()
        self.safety.trigger_pedestrian_red("north", duration=10.0)
        self.assertTrue(self.safety.is_pedestrian_red_active(now))

        states = self.safety.get_approach_states()
        self.assertEqual(states["north"], "red")
        self.assertEqual(states["south"], "red")
        self.assertEqual(states["east"], "green")
        self.assertEqual(states["west"], "green")

    def test_05_manual_duration_cycling(self):
        self.engine.set_manual_durations(phase_a=15, phase_b=20)
        self.assertEqual(self.engine.manual_durations["A"], 15)
        self.assertEqual(self.engine.manual_durations["B"], 20)

    def test_06_serial_manager_format(self):
        # Verify SerialManager handles disabled/disconnected state gracefully
        sm = SerialManager(self.settings)
        self.assertFalse(sm.is_connected())
        status = sm.status()
        self.assertIn("connected", status)
        self.assertIn("baud_rate", status)

if __name__ == '__main__':
    unittest.main()
