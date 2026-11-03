import os
import sys
import tempfile
import shutil
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from simulation.sumo.evaluation import EvaluationManager, find_next_evaluation_id

SAMPLE_STATS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<statistics xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <performance duration="90.00" clockDuration="10.50"/>
    <vehicles loaded="45" inserted="45" running="12" waiting="0"/>
    <teleports total="0" jam="0" yield="0" wrongLane="0"/>
    <safety collisions="0" emergencyStops="0"/>
    <persons loaded="0" running="0" jammed="0"/>
    <personTeleports total="0" abortWait="0" wrongLane="0"/>
    <vehicleTripStatistics count="33" routeLength="13200.00" speed="7.85" duration="52.40" waitingTime="14.20" timeLoss="21.10" departDelay="0.00" departDelayWaiting="-1.00" totalTravelTime="1729.20" totalDepartDelay="0.00"/>
</statistics>
"""

SAMPLE_TRIPINFO_XML = """<?xml version="1.0" encoding="UTF-8"?>
<tripinfos xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <tripinfo id="veh_0" depart="0.00" arrival="42.50" duration="42.50" routeLength="400.00" waitingTime="8.20" timeLoss="12.00"/>
    <tripinfo id="veh_1" depart="1.00" arrival="58.20" duration="57.20" routeLength="400.00" waitingTime="22.50" timeLoss="27.10"/>
    <tripinfo id="veh_2" depart="2.50" arrival="76.10" duration="73.60" routeLength="400.00" waitingTime="35.00" timeLoss="41.20"/>
</tripinfos>
"""

SAMPLE_SUMMARY_XML = """<?xml version="1.0" encoding="UTF-8"?>
<summary xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <step time="0.00" loaded="1" inserted="1" running="1" waiting="0" ended="0" arrived="0" collisions="0" teleports="0" halting="0" stopped="0" meanWaitingTime="0.00" meanTravelTime="-1.00" meanSpeed="13.89" meanSpeedRelative="1.00" duration="0"/>
    <step time="1.00" loaded="3" inserted="3" running="3" waiting="1" ended="0" arrived="0" collisions="0" teleports="0" halting="1" stopped="0" meanWaitingTime="1.00" meanTravelTime="-1.00" meanSpeed="11.20" meanSpeedRelative="0.80" duration="0"/>
    <step time="2.00" loaded="5" inserted="5" running="5" waiting="3" ended="0" arrived="0" collisions="0" teleports="0" halting="3" stopped="0" meanWaitingTime="2.50" meanTravelTime="-1.00" meanSpeed="6.50" meanSpeedRelative="0.45" duration="0"/>
</summary>
"""

class TestSumoEvaluation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_dir = tempfile.mkdtemp(prefix="cmu_eval_test_")

    @classmethod
    def tearDownClass(cls):
        if os.path.isdir(cls.test_dir):
            shutil.rmtree(cls.test_dir, ignore_errors=True)

    def test_find_next_evaluation_id(self):
        eval_id = find_next_evaluation_id()
        self.assertTrue(eval_id.startswith("evaluation_"))
        idx = int(eval_id.split("_")[1])
        self.assertGreaterEqual(idx, 1)

    def test_xml_parsers(self):
        mgr = EvaluationManager()

        # Write sample files
        stats_file = os.path.join(self.test_dir, "statistics.xml")
        trip_file = os.path.join(self.test_dir, "tripinfo.xml")
        summary_file = os.path.join(self.test_dir, "summary.xml")

        with open(stats_file, "w", encoding="utf-8") as f:
            f.write(SAMPLE_STATS_XML)
        with open(trip_file, "w", encoding="utf-8") as f:
            f.write(SAMPLE_TRIPINFO_XML)
        with open(summary_file, "w", encoding="utf-8") as f:
            f.write(SAMPLE_SUMMARY_XML)

        # 1. Test stats parser
        stats = mgr._parse_statistics_xml(stats_file)
        self.assertEqual(stats["arrivedCount"], 33)
        self.assertAlmostEqual(stats["avgDuration"], 52.40)
        self.assertAlmostEqual(stats["avgWaitingTime"], 14.20)
        self.assertAlmostEqual(stats["avgSpeed"], 7.85)

        # 2. Test tripinfo parser
        trips = mgr._parse_tripinfo_xml(trip_file)
        self.assertEqual(len(trips), 3)
        self.assertEqual(trips[0]["id"], "veh_0")
        self.assertAlmostEqual(trips[0]["waitingTime"], 8.20)

        # 3. Test summary parser
        summary = mgr._parse_summary_xml(summary_file)
        self.assertEqual(len(summary), 3)
        self.assertEqual(summary[2]["halting"], 3)
        self.assertAlmostEqual(summary[2]["meanSpeed"], 6.50)

    def test_timelines_and_charts(self):
        mgr = EvaluationManager()

        manual_trips = [
            {"arrival": 10.0, "waitingTime": 25.0},
            {"arrival": 20.0, "waitingTime": 35.0},
        ]
        adaptive_trips = [
            {"arrival": 8.0, "waitingTime": 5.0},
            {"arrival": 15.0, "waitingTime": 12.0},
        ]

        # Throughput
        tp = mgr._build_throughput_timeline(manual_trips, adaptive_trips, duration=30.0)
        self.assertTrue(len(tp) > 0)
        final_tp = tp[-1]
        self.assertEqual(final_tp["manualThroughput"], 2)
        self.assertEqual(final_tp["adaptiveThroughput"], 2)

        # Waiting distribution
        dist = mgr._build_waiting_distribution(manual_trips, adaptive_trips)
        self.assertEqual(len(dist), 5)  # 5 bins
        bin_0_10 = next(d for d in dist if d["range"] == "0-10s")
        self.assertEqual(bin_0_10["adaptiveCount"], 1)
        self.assertEqual(bin_0_10["manualCount"], 0)

    def test_narrative_generation(self):
        mgr = EvaluationManager()
        metrics = [
            {"name": "avg_waiting_time", "manual": 20.0, "adaptive": 12.0, "improvement": 40.0, "better": "adaptive"},
            {"name": "avg_travel_time", "manual": 60.0, "adaptive": 48.0, "improvement": 20.0, "better": "adaptive"},
            {"name": "avg_speed", "manual": 25.0, "adaptive": 30.0, "improvement": 20.0, "better": "adaptive"},
            {"name": "max_queue_length", "manual": 15.0, "adaptive": 8.0, "improvement": 46.7, "better": "adaptive"},
            {"name": "vehicles_arrived", "manual": 30.0, "adaptive": 35.0, "improvement": 16.7, "better": "adaptive"},
        ]
        narrative = mgr._generate_narrative_analysis(metrics, {}, {})
        self.assertIn("Superior Adaptive Performance", narrative["verdict"])
        self.assertTrue(len(narrative["keyObservations"]) > 0)
        self.assertIn("adaptive", narrative["summary"].lower())

    def test_manager_status(self):
        mgr = EvaluationManager()
        st = mgr.get_status()
        self.assertFalse(st["isRunning"])
        self.assertEqual(st["phase"], "idle")
        self.assertEqual(st["progress"], 0.0)

if __name__ == "__main__":
    unittest.main()
