import os
import unittest
import sumolib
from simulation.sumo.environment import sumo_env
from simulation.sumo.connection import SumoConnection

class TestSumoScenario(unittest.TestCase):
    """
    Stage 3 Test Suite:
    Validates the 4-way intersection scenario files, network topology,
    traffic light link structure, and initial TraCI stepping.
    """

    @classmethod
    def setUpClass(cls):
        cls.scenario_dir = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "..", "simulation", "sumo", "scenario"
        ))
        cls.net_file = os.path.join(cls.scenario_dir, "intersection.net.xml")
        cls.rou_file = os.path.join(cls.scenario_dir, "intersection.rou.xml")
        cls.cfg_file = os.path.join(cls.scenario_dir, "intersection.sumocfg")

    def test_01_scenario_files_exist(self):
        for f in [self.net_file, self.rou_file, self.cfg_file]:
            self.assertTrue(os.path.isfile(f), f"Required scenario file missing: {f}")

    def test_02_network_topology(self):
        net = sumolib.net.readNet(self.net_file)
        node_ids = [n.getID() for n in net.getNodes()]
        self.assertIn("center", node_ids)
        self.assertIn("node_north", node_ids)
        self.assertIn("node_south", node_ids)
        self.assertIn("node_east", node_ids)
        self.assertIn("node_west", node_ids)

        center = net.getNode("center")
        self.assertEqual(center.getType(), "traffic_light")

        edge_ids = [e.getID() for e in net.getEdges()]
        for req_edge in ["north_in", "north_out", "south_in", "south_out", "east_in", "east_out", "west_in", "west_out"]:
            self.assertIn(req_edge, edge_ids)

    def test_03_tls_links_mapping(self):
        net = sumolib.net.readNet(self.net_file)
        tls_list = net.getTrafficLights()
        self.assertGreaterEqual(len(tls_list), 1)

        center_tls = tls_list[0]
        self.assertEqual(center_tls.getID(), "center")
        links = center_tls.getLinks()
        # 4 incoming approaches * 4 movements (right, 2 straight, left) = 16 links
        self.assertEqual(len(links), 16)

        # Verify approach groupings
        north_links = [i for i in range(4)]
        east_links = [i for i in range(4, 8)]
        south_links = [i for i in range(8, 12)]
        west_links = [i for i in range(12, 16)]

        for i in north_links:
            self.assertTrue(any(c[0].getEdge().getID() == "north_in" for c in links[i]))
        for i in east_links:
            self.assertTrue(any(c[0].getEdge().getID() == "east_in" for c in links[i]))
        for i in south_links:
            self.assertTrue(any(c[0].getEdge().getID() == "south_in" for c in links[i]))
        for i in west_links:
            self.assertTrue(any(c[0].getEdge().getID() == "west_in" for c in links[i]))

    def test_04_traci_load_and_step(self):
        conn = SumoConnection()
        try:
            ok = conn.start(config_path=self.cfg_file, gui=False, step_length=0.1)
            self.assertTrue(ok)
            self.assertTrue(conn.is_connected())

            # Step 20 times (2.0s simulation time)
            for _ in range(20):
                sim_time = conn.step()

            self.assertAlmostEqual(sim_time, 2.0, places=1)
        finally:
            conn.stop()
            self.assertFalse(conn.is_connected())

if __name__ == '__main__':
    unittest.main()

