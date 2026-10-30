import os
import sys
import time
import socket
import threading
import subprocess
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
    Guarantees thread-safety, proper socket port selection, and clean termination.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._process: Optional[subprocess.Popen] = None
        self._is_connected = False
        self._traci_label = "cmu_sumo_sim"
        self._current_config: Optional[str] = None
        self._sim_time: float = 0.0

    @staticmethod
    def _find_free_port() -> int:
        """Finds an unused local TCP port for TraCI."""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("", 0))
            return s.getsockname()[1]

    def is_connected(self) -> bool:
        with self._lock:
            return self._is_connected and (self._process is not None and self._process.poll() is None)

    def start(self, config_path: str, gui: bool = False, step_length: float = 0.1, additional_args: Optional[List[str]] = None) -> bool:
        """
        Starts SUMO and establishes TraCI communication.
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

            port = self._find_free_port()
            cmd = [
                binary,
                "-c", os.path.abspath(config_path),
                "--remote-port", str(port),
                "--step-length", str(step_length),
                "--start",
                "--quit-on-end", "false"
            ]
            if additional_args:
                cmd.extend(additional_args)

            try:
                # Launch SUMO process
                self._process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    cwd=os.path.dirname(os.path.abspath(config_path))
                )

                # Connect via TraCI with retry
                connected = False
                for attempt in range(25):
                    if self._process.poll() is not None:
                        err = self._process.stderr.read().decode("utf-8", errors="ignore")
                        raise RuntimeError(f"SUMO process terminated prematurely: {err}")
                    try:
                        traci.connect(port=port, label=self._traci_label)
                        connected = True
                        break
                    except Exception:
                        time.sleep(0.2)

                if not connected:
                    self._stop_unlocked()
                    raise TimeoutError(f"Could not connect to TraCI on port {port} after 5 seconds.")

                # Switch connection to current label
                traci.switch(self._traci_label)
                self._is_connected = True
                self._current_config = config_path
                self._sim_time = 0.0
                return True

            except Exception as e:
                self._stop_unlocked()
                raise e

    def step(self) -> float:
        """Advances the simulation by one step. Returns current simulation time in seconds."""
        with self._lock:
            if not self._is_connected:
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
                traci.switch(self._traci_label)
                traci.close()
            except Exception:
                pass
            self._is_connected = False

        if self._process:
            try:
                self._process.terminate()
                self._process.wait(timeout=1.5)
            except Exception:
                try:
                    self._process.kill()
                except Exception:
                    pass
            self._process = None

# Global connection manager
sumo_conn = SumoConnection()

