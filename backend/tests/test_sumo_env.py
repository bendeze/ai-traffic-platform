import unittest
from simulation.sumo.environment import SumoEnvironment

class TestSumoEnvironment(unittest.TestCase):
    """
    Stage 2 Test Suite:
    Verifies that the SUMO installation, binaries, and Python TraCI bindings
    are correctly discovered and reported.
    """

    def setUp(self):
        self.env = SumoEnvironment()

    def test_01_sumo_installed_and_detected(self):
        self.assertTrue(self.env.is_installed, "SUMO binary should be detected on the development machine")
        self.assertIsNotNone(self.env.sumo_home, "SUMO_HOME should be resolved")
        self.assertIsNotNone(self.env.sumo_bin, "sumo.exe binary path should not be None")
        self.assertIsNotNone(self.env.sumo_gui_bin, "sumo-gui.exe binary path should not be None")

    def test_02_version_detection(self):
        self.assertIsNotNone(self.env.version)
        self.assertIn("1.28.0", self.env.version)

    def test_03_traci_and_sumolib_available(self):
        self.assertTrue(self.env.traci_available, "traci Python library must be available")
        self.assertTrue(self.env.sumolib_available, "sumolib Python library must be available")

    def test_04_diagnostics_payload(self):
        diag = self.env.get_diagnostics()
        self.assertTrue(diag["is_installed"])
        self.assertTrue(diag["ready_for_simulation"])
        self.assertIn("1.28.0", diag["version"])
        self.assertEqual(diag["traci_available"], True)
        self.assertEqual(diag["sumolib_available"], True)

if __name__ == '__main__':
    unittest.main()

