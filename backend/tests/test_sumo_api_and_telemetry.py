import unittest
from fastapi.testclient import TestClient
from main import app, sumo_mgr, _build_payload

class TestSUMOApiAndTelemetry(unittest.TestCase):
    """
    Stage 7 Test Suite:
    Verifies that the backend REST endpoints and 300ms WebSocket payload
    properly expose SUMO simulation controls, lifecycle management, and telemetry.
    """

    def setUp(self):
        self.client = TestClient(app)

    def tearDown(self):
        if sumo_mgr.is_running:
            sumo_mgr.stop_simulation()

    def test_01_diagnostics_endpoint(self):
        res = self.client.get("/simulation/sumo/diagnostics")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("is_installed"))
        self.assertTrue(data.get("ready_for_simulation"))

    def test_02_status_endpoint(self):
        res = self.client.get("/simulation/sumo/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("active_environment", data)
        self.assertIn("telemetry", data)
        self.assertIn("is_running", data["telemetry"])

    def test_03_environment_switch_endpoint(self):
        res = self.client.post("/simulation/environment/video")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["active_environment"], "video")

        res_invalid = self.client.post("/simulation/environment/unknown")
        self.assertEqual(res_invalid.status_code, 400)

    def test_04_speed_endpoint(self):
        res = self.client.post("/simulation/sumo/speed/2.5")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["speed_factor"], 2.5)

        res_bad = self.client.post("/simulation/sumo/speed/25.0")
        self.assertEqual(res_bad.status_code, 400)

    def test_05_payload_contains_simulation_telemetry(self):
        payload = _build_payload()
        self.assertIn("simulation", payload)
        self.assertIn("active_environment", payload)
        sim_data = payload["simulation"]
        self.assertIn("is_running", sim_data)
        self.assertIn("sim_time", sim_data)
        self.assertIn("active_vehicle_count", sim_data)
        self.assertIn("approaches", sim_data)

if __name__ == '__main__':
    unittest.main()

