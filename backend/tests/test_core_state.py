import unittest
from core.app_state import AppState

class TestCoreAppState(unittest.TestCase):
    def setUp(self):
        self.state = AppState()

    def test_initial_state_defaults(self):
        self.assertEqual(self.state.active_environment, "sumo")
        self.assertFalse(self.state.processing)
        self.assertIsNone(self.state.active_ambulance)
        self.assertIsNotNone(self.state.settings)
        self.assertIsNotNone(self.state.engine)
        self.assertIsNotNone(self.state.safety)
        self.assertIsNotNone(self.state.serial_mgr)
        self.assertIsNotNone(self.state.sumo_mgr)

    def test_build_telemetry_payload_structure(self):
        payload = self.state.build_telemetry_payload()
        self.assertIn("signal", payload)
        self.assertIn("approaches", payload)
        self.assertIn("vision", payload)
        self.assertIn("pedestrian", payload)
        self.assertIn("simulation", payload)
        self.assertIn("hardware", payload)
        self.assertIn("timestamp", payload)

        # Check all 4 approaches are populated
        for app in ("north", "south", "east", "west"):
            self.assertIn(app, payload["approaches"])
            self.assertIn("signal", payload["approaches"][app])
            self.assertIn("timer", payload["approaches"][app])

if __name__ == "__main__":
    unittest.main()

