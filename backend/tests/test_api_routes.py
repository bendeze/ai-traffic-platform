import unittest
from starlette.testclient import TestClient
from main import app
from core.app_state import app_state

class TestModularAPIRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_state_endpoint(self):
        res = self.client.get("/state")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("signal", data)
        self.assertIn("approaches", data)
        self.assertEqual(data["active_environment"], "sumo")

    def test_controller_mode_switch(self):
        res = self.client.post("/controller/mode/manual")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["mode"], "manual")
        self.assertEqual(app_state.engine.mode, "manual")

        # Revert back to adaptive
        res2 = self.client.post("/controller/mode/adaptive")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()["mode"], "adaptive")

    def test_manual_loop_start_and_stop(self):
        payload = {"phase_a": 25, "phase_b": 35, "start_phase": "A"}
        res = self.client.post("/controller/manual_loop/start", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["manual_loop_running"])
        self.assertEqual(data["manual_durations"]["A"], 25)
        self.assertEqual(data["manual_durations"]["B"], 35)

        # Stop loop
        res_stop = self.client.post("/controller/manual_loop/stop")
        self.assertEqual(res_stop.status_code, 200)
        self.assertFalse(res_stop.json()["manual_loop_running"])

    def test_priority_overrides(self):
        # 1. Trigger ambulance on north
        res_amb = self.client.post("/priority/ambulance/north")
        self.assertEqual(res_amb.status_code, 200)
        self.assertEqual(res_amb.json()["ambulance_on"], "north")
        self.assertEqual(app_state.active_ambulance, "north")

        # 2. Clear ambulance
        res_clr = self.client.post("/priority/ambulance_clear")
        self.assertEqual(res_clr.status_code, 200)
        self.assertIsNone(app_state.active_ambulance)

        # 3. Pedestrian request
        res_ped = self.client.post("/priority/pedestrian/east")
        self.assertEqual(res_ped.status_code, 200)
        self.assertEqual(res_ped.json()["requested"], "east")

    def test_simulation_status_and_diagnostics(self):
        res_diag = self.client.get("/simulation/sumo/diagnostics")
        self.assertEqual(res_diag.status_code, 200)
        self.assertIn("sumo_home", res_diag.json())

        res_status = self.client.get("/simulation/sumo/status")
        self.assertEqual(res_status.status_code, 200)
        self.assertIn("telemetry", res_status.json())

    def test_serial_status(self):
        res_ser = self.client.get("/serial/status")
        self.assertEqual(res_ser.status_code, 200)
        self.assertIn("connected", res_ser.json())

        res_ports = self.client.get("/serial/ports")
        self.assertEqual(res_ports.status_code, 200)
        self.assertIn("ports", res_ports.json())

    def test_config_endpoints(self):
        res_cfg = self.client.get("/config")
        self.assertEqual(res_cfg.status_code, 200)
        data = res_cfg.json()
        self.assertIn("approaches", data)
        self.assertIn("timing", data)

if __name__ == "__main__":
    unittest.main()
