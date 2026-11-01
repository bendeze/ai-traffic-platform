import unittest
from unittest.mock import MagicMock, patch
import time

from config.settings import load_settings
from controller.safety_manager import SafetyManager
from simulation.sumo.manager import SUMOManager

class TestPedestrianCrossingStop(unittest.TestCase):
    def setUp(self):
        self.settings = load_settings()
        self.safety = SafetyManager(self.settings)
        self.manager = SUMOManager(self.settings)
        self.manager.safety_manager = self.safety

    def test_pedestrian_approach_tracking_in_safety_manager(self):
        """Verifies that trigger_pedestrian_red accurately tracks active pedestrian approaches."""
        now = time.time()
        self.safety.trigger_pedestrian_red("north", duration=10.0)
        self.assertTrue(self.safety.is_pedestrian_red_active(now))
        self.assertEqual(self.safety.pedestrian_approach, "north")
        self.assertIn("north", self.safety.active_pedestrian_approaches)

        # Fast forward past 10 seconds
        future = now + 10.5
        self.safety.update(future)
        self.assertFalse(self.safety.is_pedestrian_red_active(future))
        self.assertIsNone(self.safety.pedestrian_approach)
        self.assertEqual(len(self.safety.active_pedestrian_approaches), 0)

    def test_pedestrian_stopping_deceleration_profile(self):
        """
        Verifies that vehicles on the pedestrian approach decelerate and stop ~2m before the zebra line (175.5m),
        and emergency ambulances are NOT stopped.
        """
        mock_traci = MagicMock()
        with patch.dict("sys.modules", {"traci": mock_traci}):
            self.manager.conn.is_connected = MagicMock(return_value=True)
            self.manager.conn._traci_label = "test_conn"

            # Mock vehicles on north_in
            # veh1: close to stopline (pos = 171.0, dist = 4.5m <= 6m) -> full stop
            # veh2: mid approach (pos = 160.0, dist = 15.5m <= 20m) -> slowDown to 2.5
            # veh3: warning zone (pos = 140.0, dist = 35.5m <= 50m) -> slowDown to 5.5
            # amb1: ambulance -> must be ignored!
            mock_traci.edge.getLastStepVehicleIDs.return_value = ("veh1", "veh2", "veh3", "amb1")
            mock_traci.vehicle.getIDList.return_value = ["veh1", "veh2", "veh3", "amb1"]

            def mock_getTypeID(vid):
                return "emergency_ambulance" if vid == "amb1" else "passenger_car"

            def mock_getLanePosition(vid):
                positions = {"veh1": 171.0, "veh2": 160.0, "veh3": 140.0, "amb1": 165.0}
                return positions.get(vid, 0.0)

            def mock_getSpeed(vid):
                return 8.0

            mock_traci.vehicle.getTypeID.side_effect = mock_getTypeID
            mock_traci.vehicle.getLanePosition.side_effect = mock_getLanePosition
            mock_traci.vehicle.getSpeed.side_effect = mock_getSpeed

            # Trigger pedestrian request on north
            self.safety.trigger_pedestrian_red("north", duration=10.0)

            # Run crossing stop enforcement
            self.manager._apply_pedestrian_crossing_stops()

            # veh1 should be commanded to stop (0.0 m/s)
            mock_traci.vehicle.slowDown.assert_any_call("veh1", 0.0, 0.8)
            self.assertIn("veh1", self.manager._ped_stopped_vehicles)

            # veh2 should decelerate towards 2.5 m/s
            mock_traci.vehicle.slowDown.assert_any_call("veh2", 2.5, 1.2)
            self.assertIn("veh2", self.manager._ped_stopped_vehicles)

            # veh3 should decelerate towards 5.5 m/s
            mock_traci.vehicle.slowDown.assert_any_call("veh3", 5.5, 2.0)
            self.assertIn("veh3", self.manager._ped_stopped_vehicles)

            # Ambulance must NEVER be stopped
            calls = [c[0][0] for c in mock_traci.vehicle.slowDown.call_args_list]
            self.assertNotIn("amb1", calls)

            # Now simulate expiration of pedestrian phase
            future = time.time() + 11.0
            self.safety.update(future)
            self.assertFalse(self.safety.is_pedestrian_red_active(future))

            # Run crossing stop enforcement after expiration
            self.manager._apply_pedestrian_crossing_stops()

            # All stopped vehicles must have setSpeed(vid, -1.0) called to resume autonomous driving
            mock_traci.vehicle.setSpeed.assert_any_call("veh1", -1.0)
            mock_traci.vehicle.setSpeed.assert_any_call("veh2", -1.0)
            mock_traci.vehicle.setSpeed.assert_any_call("veh3", -1.0)
            self.assertEqual(len(self.manager._ped_stopped_vehicles), 0)

if __name__ == '__main__':
    unittest.main()
