import unittest
from pydantic import ValidationError
from schemas.controls import ManualLoopRequest, ManualConfigRequest, UpdateApproachesRequest, ApproachPolygon
from schemas.simulation import BenchmarkRequest
from schemas.telemetry import SignalInfo, ApproachMetrics, TelemetryPayload, VisionTelemetry

class TestSchemas(unittest.TestCase):
    def test_manual_loop_request_validation(self):
        req = ManualLoopRequest(phase_a=25, phase_b=40, start_phase="A")
        self.assertEqual(req.phase_a, 25)
        self.assertEqual(req.phase_b, 40)
        self.assertEqual(req.start_phase, "A")

        # Invalid start_phase should fail validation
        with self.assertRaises(ValidationError):
            ManualLoopRequest(phase_a=20, phase_b=20, start_phase="C")

        # Durations under 5s should fail validation
        with self.assertRaises(ValidationError):
            ManualLoopRequest(phase_a=2, phase_b=20, start_phase="A")

    def test_benchmark_request_validation(self):
        bm = BenchmarkRequest(duration=45.0, seed=123)
        self.assertEqual(bm.duration, 45.0)
        self.assertEqual(bm.seed, 123)

        # Duration under 10s should fail
        with self.assertRaises(ValidationError):
            BenchmarkRequest(duration=5.0)

    def test_approach_polygon_validation(self):
        poly = ApproachPolygon(name="north", polygon=[(10.0, 20.0), (30.0, 40.0)])
        self.assertEqual(poly.name, "north")
        self.assertEqual(len(poly.polygon), 2)

    def test_telemetry_payload_schema(self):
        sig = SignalInfo(
            phase="A",
            state="green",
            remaining=15.0,
            reason="queue_demand_north",
            yellow_dur=3.0,
            manual_durations={"A": 30, "B": 30},
            mode="adaptive",
            manual_loop_running=False,
            is_pedestrian_active=False
        )
        app_metric = ApproachMetrics(
            queue=3,
            waiting_time=12.5,
            vehicle_count=4,
            breakdown={"car": 3, "bus": 1},
            has_ambulance=False,
            signal="green",
            timer=15
        )
        payload = TelemetryPayload(
            signal=sig,
            approaches={"north": app_metric},
            vision=VisionTelemetry(),
            pedestrian={"north": False},
            active_ambulance=None,
            active_environment="sumo",
            simulation={},
            pipeline={},
            hardware={},
            timestamp=1000.0
        )
        self.assertEqual(payload.signal.phase, "A")
        self.assertEqual(payload.approaches["north"].vehicle_count, 4)

if __name__ == "__main__":
    unittest.main()

