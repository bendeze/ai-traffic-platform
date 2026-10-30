import os
import unittest
try:
    import traci
except ImportError:
    traci = None

from simulation.sumo.connection import SumoConnection
from simulation.sumo.traffic_adapter import SUMOTrafficAdapter

class TestSUMOVehicleDynamics(unittest.TestCase):
    """
    Stage 5 Test Suite:
    Demonstrates and validates physical vehicle stopping and movement
    under the direct control of our FSM signal outputs.
    Proves that vehicles physically decelerate to 0 m/s at red lights
    and accelerate/proceed on green lights without custom speed overrides.
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

    def test_01_vehicles_stop_at_red_and_move_at_green(self):
        try:
            ok = self.conn.start(config_path=self.cfg_file, gui=False, step_length=0.1)
            self.assertTrue(ok)
            traci.switch(self.conn._traci_label)

            # ─────────────────────────────────────────────────────────────────
            # 1. PHASE A GREEN (North-South Green, East-West Red)
            # ─────────────────────────────────────────────────────────────────
            phase_a = {"north": "green", "south": "green", "east": "red", "west": "red"}
            self.adapter.apply_signals(phase_a)

            # Advance 220 steps (22.0s) to allow vehicles to traverse 200m approach
            for _ in range(220):
                self.conn.step()
                self.adapter.apply_signals(phase_a)

            # Check East and West (RED approaches):
            # Vehicles must stop at stop line; speed should be 0.0 m/s
            all_vehs = traci.vehicle.getIDList()
            east_vehs = [v for v in all_vehs if traci.vehicle.getRoadID(v) == "east_in"]
            stopped_at_red = [v for v in east_vehs if traci.vehicle.getSpeed(v) < 0.1]

            self.assertGreater(len(stopped_at_red), 0,
                               "At least one vehicle on East must be stopped (speed < 0.1 m/s) at RED light")

            # Check North and South (GREEN approaches):
            # Vehicles must be moving through and clearing the intersection into outgoing edges
            north_cleared = [v for v in all_vehs if v.startswith("flow_n") and
                             traci.vehicle.getRoadID(v) in ("south_out", "east_out", "west_out")]
            self.assertGreater(len(north_cleared), 0,
                               "North vehicles facing GREEN must cross intersection and enter outgoing roads")

            # ─────────────────────────────────────────────────────────────────
            # 2. MANDATORY SAFETY SEQUENCE: 4-WAY YELLOW (3s) -> ALL-RED (2s)
            # ─────────────────────────────────────────────────────────────────
            yellow_state = {"north": "yellow", "south": "yellow", "east": "yellow", "west": "yellow"}
            for _ in range(30): # 3.0 seconds yellow
                self.conn.step()
                self.adapter.apply_signals(yellow_state)

            all_red_state = {"north": "red", "south": "red", "east": "red", "west": "red"}
            for _ in range(20): # 2.0 seconds clearance
                self.conn.step()
                self.adapter.apply_signals(all_red_state)

            # ─────────────────────────────────────────────────────────────────
            # 3. PHASE B GREEN (East-West Green, North-South Red)
            # ─────────────────────────────────────────────────────────────────
            phase_b = {"north": "red", "south": "red", "east": "green", "west": "green"}
            self.adapter.apply_signals(phase_b)

            # Advance 150 steps (15.0s)
            for _ in range(150):
                self.conn.step()
                self.adapter.apply_signals(phase_b)

            # The previously stopped East vehicles must now be moving on GREEN and crossing intersection!
            all_vehs_b = traci.vehicle.getIDList()
            east_moving = [v for v in all_vehs_b if traci.vehicle.getRoadID(v) in ("west_out", "north_out", "south_out")]
            self.assertGreater(len(east_moving), 0,
                               "East vehicles must accelerate and cross intersection when light turns GREEN")

            # Conversely, incoming North and South vehicles facing RED must now stop
            north_vehs_b = [v for v in all_vehs_b if traci.vehicle.getRoadID(v) == "north_in"]
            north_stopped_b = [v for v in north_vehs_b if traci.vehicle.getSpeed(v) < 0.1]
            self.assertGreater(len(north_stopped_b), 0,
                               "Incoming North vehicles must halt (speed < 0.1 m/s) at RED light during Phase B")

        finally:
            self.conn.stop()
            self.assertFalse(self.conn.is_connected())

if __name__ == '__main__':
    unittest.main()
