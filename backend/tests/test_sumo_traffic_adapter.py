import os
import unittest
try:
    import traci
except ImportError:
    traci = None

from simulation.sumo.connection import SumoConnection
from simulation.sumo.traffic_adapter import SUMOTrafficAdapter

class TestSUMOTrafficAdapter(unittest.TestCase):
    """
    Stage 4 Test Suite:
    Verifies that the SUMOTrafficAdapter accurately converts FSM/SafetyManager
    approach signals into verified 20-link TraCI states, and that SUMO
    actually receives and adopts the exact state strings.
    """

    @classmethod
    def setUpClass(cls):
        cls.scenario_dir = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "..", "simulation", "sumo", "scenario"
        ))
        cls.cfg_file = os.path.join(cls.scenario_dir, "intersection.sumocfg")

    def setUp(self):
        self.conn = SumoConnection()
        self.adapter = SUMOTrafficAdapter(tls_id="center", connection=self.conn)

    def test_01_color_translation(self):
        self.assertEqual(SUMOTrafficAdapter.color_to_sumo_char("green"), "G")
        self.assertEqual(SUMOTrafficAdapter.color_to_sumo_char("GREEN"), "G")
        self.assertEqual(SUMOTrafficAdapter.color_to_sumo_char("yellow"), "y")
        self.assertEqual(SUMOTrafficAdapter.color_to_sumo_char("YELLOW"), "y")
        self.assertEqual(SUMOTrafficAdapter.color_to_sumo_char("red"), "r")
        self.assertEqual(SUMOTrafficAdapter.color_to_sumo_char("clearance"), "r")

    def test_02_phase_a_green_state_string(self):
        # Phase A: North & South Green, East & West Red
        # North (0..3) = G, East (4..7) = r, South (8..11) = G, West (12..15) = r
        # Crossings (16..19): North(r), East(G), South(r), West(G) -> rGrG
        states = {"north": "green", "south": "green", "east": "red", "west": "red"}
        expected = "GGGG" + "rrrr" + "GGGG" + "rrrr" + "rGrG"
        self.assertEqual(self.adapter.build_state_string(states), expected)

    def test_03_four_way_yellow_state_string(self):
        # Standard safety transition: all 4 approaches show YELLOW simultaneously
        states = {"north": "yellow", "south": "yellow", "east": "yellow", "west": "yellow"}
        expected = "y" * 16 + "rrrr"
        self.assertEqual(self.adapter.build_state_string(states), expected)

    def test_04_all_red_clearance_state_string(self):
        # All-red clearance: all approaches stopped (crossings are Green)
        states = {"north": "red", "south": "red", "east": "red", "west": "red"}
        expected = "r" * 16 + "GGGG"
        self.assertEqual(self.adapter.build_state_string(states), expected)

    def test_05_phase_b_green_state_string(self):
        # Phase B: East & West Green, North & South Red
        # Crossings (16..19): North(G), East(r), South(G), West(r) -> GrGr
        states = {"north": "red", "south": "red", "east": "green", "west": "green"}
        expected = "rrrr" + "GGGG" + "rrrr" + "GGGG" + "GrGr"
        self.assertEqual(self.adapter.build_state_string(states), expected)

    def test_06_live_traci_state_adoption(self):
        """
        Launches SUMO, applies FSM states via adapter, and reads back the active
        TLS state directly from TraCI to prove SUMO adopts our exact external states.
        """
        try:
            ok = self.conn.start(config_path=self.cfg_file, gui=False, step_length=0.1)
            self.assertTrue(ok)
            self.assertTrue(self.conn.is_connected())

            traci.switch(self.conn._traci_label)

            # 1. Apply Phase A Green
            state_a = {"north": "green", "south": "green", "east": "red", "west": "red"}
            self.assertTrue(self.adapter.apply_signals(state_a))
            read_back = traci.trafficlight.getRedYellowGreenState("center")
            self.assertEqual(read_back, "GGGGrrrrGGGGrrrrrGrG")

            # 2. Advance 1 step and apply 4-Way Yellow
            self.conn.step()
            state_y = {"north": "yellow", "south": "yellow", "east": "yellow", "west": "yellow"}
            self.assertTrue(self.adapter.apply_signals(state_y))
            read_back = traci.trafficlight.getRedYellowGreenState("center")
            self.assertEqual(read_back, "yyyyyyyyyyyyyyyyrrrr")

            # 3. Advance 1 step and apply All-Red Clearance
            self.conn.step()
            state_clear = {"north": "red", "south": "red", "east": "red", "west": "red"}
            self.assertTrue(self.adapter.apply_signals(state_clear))
            read_back = traci.trafficlight.getRedYellowGreenState("center")
            self.assertEqual(read_back, "rrrrrrrrrrrrrrrrGGGG")

            # 4. Advance 1 step and apply Phase B Green
            self.conn.step()
            state_b = {"north": "red", "south": "red", "east": "green", "west": "green"}
            self.assertTrue(self.adapter.apply_signals(state_b))
            read_back = traci.trafficlight.getRedYellowGreenState("center")
            self.assertEqual(read_back, "rrrrGGGGrrrrGGGGGrGr")

        finally:
            self.conn.stop()
            self.assertFalse(self.conn.is_connected())

if __name__ == '__main__':
    unittest.main()
