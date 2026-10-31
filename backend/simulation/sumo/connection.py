import os
import sys
import time
import threading
from typing import Optional, List, Dict, Any

try:
    import traci
except ImportError:
    traci = None

from simulation.sumo.environment import sumo_env

class SumoConnection:
    """
    Manages the lifecycle of the TraCI connection and SUMO simulation process.
    Supports headless ('sumo') and graphical ('sumo-gui') modes.
    Guarantees thread-safety, proper step execution, and clean termination.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._is_connected = False
        self._traci_label = "cmu_sumo_sim"
        self._current_config: Optional[str] = None
        self._sim_time: float = 0.0

    def is_connected(self) -> bool:
        with self._lock:
            if not self._is_connected or traci is None:
                return False
            try:
                # Check if TraCI connection is still responsive
                traci.switch(self._traci_label)
                return True
            except Exception:
                self._is_connected = False
                return False

    def start(self, config_path: str, gui: bool = False, step_length: float = 0.1, additional_args: Optional[List[str]] = None) -> bool:
        """
        Starts SUMO and establishes TraCI communication via traci.start.
        """
        if not sumo_env.is_installed:
            raise RuntimeError("SUMO is not installed on this system.")
        if not sumo_env.traci_available or traci is None:
            raise RuntimeError("traci Python module is not installed.")

        with self._lock:
            if self._is_connected:
                self._stop_unlocked()

            if not os.path.isfile(config_path):
                raise FileNotFoundError(f"SUMO config file not found: {config_path}")

            binary = sumo_env.get_binary(gui=gui)
            if not binary:
                raise RuntimeError(f"Could not locate SUMO binary (gui={gui}).")

            cmd = [
                binary,
                "-c", os.path.abspath(config_path),
                "--step-length", str(step_length),
                "--no-warnings", "true",
                "--start", "true",
                "--quit-on-end", "true"
            ]
            if additional_args:
                cmd.extend(additional_args)

            try:
                traci.start(cmd, label=self._traci_label)
                traci.switch(self._traci_label)
                self._is_connected = True
                self._current_config = config_path
                self._sim_time = 0.0
                return True
            except Exception as e:
                self._stop_unlocked()
                raise e

    def reload(self, config_path: Optional[str] = None, step_length: float = 0.1, additional_args: Optional[List[str]] = None) -> bool:
        """
        Reloads the active simulation using traci.load in-process.
        This instantaneously resets simulation time to 0.0s and reloads all routes/vehicles
        without closing the GUI window or recreating TraCI TCP sockets.
        """
        with self._lock:
            if not self._is_connected or traci is None:
                return False
            cfg = config_path or self._current_config
            if not cfg or not os.path.isfile(cfg):
                return False
            try:
                traci.switch(self._traci_label)
                cmd = [
                    "-c", os.path.abspath(cfg),
                    "--step-length", str(step_length),
                    "--no-warnings", "true",
                    "--start", "true",
                    "--quit-on-end", "true"
                ]
                if additional_args:
                    cmd.extend(additional_args)
                traci.load(cmd)
                self._sim_time = 0.0
                return True
            except Exception:
                self._is_connected = False
                return False

    def step(self) -> float:
        """Advances the simulation by one step. Returns current simulation time in seconds."""
        with self._lock:
            if not self._is_connected or traci is None:
                raise RuntimeError("Simulation is not running.")
            traci.switch(self._traci_label)
            traci.simulationStep()
            self._sim_time = traci.simulation.getTime()
            return self._sim_time

    def get_time(self) -> float:
        with self._lock:
            return self._sim_time

    def stop(self):
        """Cleanly stops the simulation and closes TraCI."""
        with self._lock:
            self._stop_unlocked()

    def _stop_unlocked(self):
        if self._is_connected:
            try:
                if traci is not None:
                    traci.switch(self._traci_label)
                    traci.close()
            except Exception:
                pass
            self._is_connected = False
            self._current_config = None

# Global connection manager
sumo_conn = SumoConnection()
