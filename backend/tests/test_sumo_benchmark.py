import os
import unittest
import tempfile
import json
from simulation.sumo.metrics_collector import MetricsCollector
from simulation.sumo.benchmark import BenchmarkRunner

class TestSUMOBenchmarkAndMetrics(unittest.TestCase):
    """
    Stage 8 Test Suite:
    Verifies that the performance metrics collector and benchmark evaluation engine
    measure waiting times, queue lengths, throughput, and generate comparative reports.
    """

    def test_01_metrics_collector_aggregation_and_export(self):
        collector = MetricsCollector()
        collector.start_sim_time = 0.0
        collector.latest_sim_time = 60.0
        collector.step_samples = 600

        # Simulate 3 completed trips
        collector.completed_trips = [
            {"id": "v1", "depart": 0.0, "arrival": 18.2, "travel_time": 18.2},
            {"id": "v2", "depart": 5.0, "arrival": 25.4, "travel_time": 20.4},
            {"id": "v3", "depart": 10.0, "arrival": 32.1, "travel_time": 22.1}
        ]

        # Simulate queue samples
        collector.queue_samples = [0, 1, 2, 3, 4, 3, 2, 1]
        collector.max_queue_observed = 4
        collector.waiting_time_samples = [0.0, 2.5, 5.0, 7.5]
        collector.total_time_loss = 15.3

        summary = collector.get_summary()
        self.assertEqual(summary["completed_trips"], 3)
        self.assertAlmostEqual(summary["average_travel_time"], 20.23, places=1)
        self.assertAlmostEqual(summary["average_queue_length"], 2.0, places=1)
        self.assertEqual(summary["maximum_queue_length"], 4)
        self.assertGreater(summary["throughput_vehs_per_hour"], 0.0)

        with tempfile.TemporaryDirectory() as tmpdir:
            json_file = os.path.join(tmpdir, "test_report.json")
            csv_file = os.path.join(tmpdir, "test_report.csv")

            collector.export_json(json_file)
            collector.export_csv(csv_file)

            self.assertTrue(os.path.isfile(json_file))
            self.assertTrue(os.path.isfile(csv_file))

            with open(json_file, "r", encoding="utf-8") as f:
                d = json.load(f)
                self.assertEqual(d["completed_trips"], 3)
                self.assertIn("completed_trips_detail", d)

    def test_02_benchmark_comparative_execution(self):
        runner = BenchmarkRunner()
        # Run a concise 15-second benchmark comparison with fixed seed 42
        report = runner.run_comparative_study(duration=15.0, seed=42)

        self.assertIn("comparison", report)
        self.assertIn("fixed", report["comparison"])
        self.assertIn("adaptive", report["comparison"])
        self.assertIn("manual", report["comparison"])
        self.assertIn("improvements_adaptive_vs_fixed", report)
        self.assertIn("exported_files", report)

        exp_json = report["exported_files"]["json"]
        exp_csv = report["exported_files"]["csv"]
        self.assertTrue(os.path.isfile(exp_json))
        self.assertTrue(os.path.isfile(exp_csv))

if __name__ == '__main__':
    unittest.main()

