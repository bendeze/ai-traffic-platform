import os
import sys
import shutil
import subprocess
from typing import Optional, Dict, Any

class SumoEnvironment:
    """
    Detects, validates, and initializes the SUMO execution environment.
    Locates SUMO_HOME, sumo.exe, sumo-gui.exe, and verifies traci/sumolib availability.
    Gracefully handles missing or non-Windows environments.
    """

    DEFAULT_WINDOWS_PATHS = [
        r"C:\Program Files (x86)\SUMO",
        r"C:\Program Files\SUMO",
        r"C:\Program Files (x86)\Eclipse\Sumo",
        r"C:\Program Files\Eclipse\Sumo",
        r"C:\sumo",
        os.path.expanduser(r"~\AppData\Local\Programs\Sumo")
    ]

    def __init__(self):
        self.sumo_home: Optional[str] = None
        self.sumo_bin: Optional[str] = None
        self.sumo_gui_bin: Optional[str] = None
        self.version: Optional[str] = None
        self.traci_available: bool = False
        self.sumolib_available: bool = False
        self.is_installed: bool = False

        self._discover_and_configure()

    def _discover_and_configure(self):
        # 1. Check existing environment variable
        env_home = os.environ.get("SUMO_HOME")
        if env_home and os.path.isdir(env_home):
            self.sumo_home = os.path.abspath(env_home)

        # 2. Check standard installation directories if SUMO_HOME not set
        if not self.sumo_home:
            for candidate in self.DEFAULT_WINDOWS_PATHS:
                if os.path.isdir(candidate):
                    self.sumo_home = candidate
                    os.environ["SUMO_HOME"] = candidate
                    break

        # 3. Locate binaries
        if self.sumo_home:
            bin_dir = os.path.join(self.sumo_home, "bin")
            if bin_dir not in os.environ.get("PATH", ""):
                os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")

            candidate_sumo = os.path.join(bin_dir, "sumo.exe" if os.name == "nt" else "sumo")
            candidate_gui = os.path.join(bin_dir, "sumo-gui.exe" if os.name == "nt" else "sumo-gui")

            if os.path.isfile(candidate_sumo):
                self.sumo_bin = candidate_sumo
            if os.path.isfile(candidate_gui):
                self.sumo_gui_bin = candidate_gui

        # 4. Fallback to system PATH via shutil.which
        if not self.sumo_bin:
            self.sumo_bin = shutil.which("sumo")
        if not self.sumo_gui_bin:
            self.sumo_gui_bin = shutil.which("sumo-gui")

        self.is_installed = bool(self.sumo_bin and os.path.isfile(self.sumo_bin))

        # 5. Extract version if available
        if self.is_installed:
            try:
                res = subprocess.run([self.sumo_bin, "--version"], capture_output=True, text=True, timeout=3.0)
                if res.returncode == 0:
                    first_line = res.stdout.strip().split("\n")[0]
                    # Format e.g.: "Eclipse SUMO sumo 1.28.0"
                    self.version = first_line
            except Exception as e:
                self.version = "Unknown (Error checking version)"

        # 6. Verify Python bindings (traci and sumolib)
        try:
            import traci
            self.traci_available = True
        except ImportError:
            self.traci_available = False

        try:
            import sumolib
            self.sumolib_available = True
        except ImportError:
            self.sumolib_available = False

    def get_binary(self, gui: bool = False) -> Optional[str]:
        """Returns the appropriate binary path, falling back to CLI if GUI unavailable."""
        if gui and self.sumo_gui_bin and os.path.isfile(self.sumo_gui_bin):
            return self.sumo_gui_bin
        return self.sumo_bin

    def get_diagnostics(self) -> Dict[str, Any]:
        """Returns structured diagnostic status dictionary."""
        return {
            "is_installed": self.is_installed,
            "version": self.version or "Not Installed",
            "sumo_home": self.sumo_home,
            "sumo_executable": self.sumo_bin,
            "sumo_gui_executable": self.sumo_gui_bin,
            "traci_available": self.traci_available,
            "sumolib_available": self.sumolib_available,
            "ready_for_simulation": bool(self.is_installed and self.traci_available)
        }

# Global singleton
sumo_env = SumoEnvironment()

