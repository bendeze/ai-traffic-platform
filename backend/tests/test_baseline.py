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
        # Direct transition sequence: GREEN -> YELLOW (3s) -> GREEN (new phase, no 2s all-red clearance)
        now = time.time()
        self.safety._phase_start = now - 15.0  # Min green elapsed
        self.safety.current_phase = "A"
        self.safety.signal_state = SignalState.GREEN

        # Propose switch to Phase B
        proposal = {"phase": "B", "duration": 25, "yellow_dur": 2.0}
        self.safety.apply(proposal)

        # 1. State must immediately become YELLOW
        self.assertEqual(self.safety.signal_state, SignalState.YELLOW)
        yellow_states = self.safety.get_approach_states()
        # All 4 approaches must show YELLOW simultaneously
        self.assertEqual(yellow_states["north"], "yellow")
        self.assertEqual(yellow_states["south"], "yellow")
        self.assertEqual(yellow_states["east"], "yellow")
        self.assertEqual(yellow_states["west"], "yellow")

        # 2. Advance 3.1s -> Yellow complete -> Must directly activate Phase B GREEN (no 2s all-red clearance)
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
        # A pedestrian request on 'north' while Phase A is GREEN must give YELLOW first, then lock RED for 10s
        now = time.time()
        self.safety.trigger_pedestrian_red("north", duration=10.0)
        # 1. First state is YELLOW to let moving cars decelerate
        self.assertEqual(self.safety.signal_state, SignalState.YELLOW)
        # 2. Advance past yellow (3.1s) -> locks on RED for 10s
        self.safety.update(now=now + 2.1)
        self.assertTrue(self.safety.is_pedestrian_red_active(now + 2.1))

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

    def test_07_zero_car_continuation_keeps_green_on_busy_road(self):
        # If Phase B has cars (east=4, west=4) and Phase A has 0 cars (north=0, south=0),
        # Phase B must continue holding green and NEVER switch to empty Phase A!
        self.engine._last_phase = "B"
        t0 = time.time()
        self.engine._phase_start = t0 - 20.0  # 20s elapsed
        state = self._make_state(north=0, south=0, east=4, west=4)
        decision = self.engine.decide(state, ped_requests={}, now=t0)
        self.assertEqual(decision["phase"], "B")
        self.assertIn("priority_continuation", decision["reason"])

    def test_08_queue_priority_override_on_large_queue(self):
        # If Phase A has 1 car and Phase B has 10 cars, Phase B has massive queue.
        # After 3s of Phase A, system must switch to Phase B to clear the large queue.
        self.engine._last_phase = "A"
        t0 = time.time()
        self.engine._phase_start = t0 - 3.5  # 3.5s elapsed
        state = self._make_state(north=1, south=0, east=5, west=5)
        decision = self.engine.decide(state, ped_requests={}, now=t0)
        self.assertEqual(decision["phase"], "B")
        self.assertTrue(
            "queue_priority" in decision["reason"] or "critical_queue_relief" in decision["reason"]
        )

    def test_09_moving_traffic_prevents_false_gap_out(self):
        # When Phase B is green, if cars are actively approaching within 50m (approaching_count > 0),
        # even if stopped queue is 0, it must NOT gap-out!
        self.engine._last_phase = "B"
        t0 = time.time()
        self.engine._phase_start = t0 - 5.0
        state = self._make_state(north=1, south=0, east=0, west=0)
        state["east"].approaching_count = 3  # 3 cars actively approaching at green
        decision = self.engine.decide(state, ped_requests={}, now=t0)
        self.assertEqual(decision["phase"], "B")

if __name__ == '__main__':
    unittest.main()
