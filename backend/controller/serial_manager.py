import json, time, threading
from typing import Optional, Dict, List
import serial
import serial.tools.list_ports

class SerialManager:
    """
    Manages USB Serial communications between FastAPI and the Arduino Traffic Signal Controller.
    Supports:
    - Auto-detecting Arduino/USB-serial devices across COM ports
    - Frame-accurate signal state synchronization (pins 2 to 13)
    - Diagnostic LED hardware test sweep
    - Thread-safe non-blocking command dispatch
    """

    def __init__(self, settings):
        self.settings = settings
        self._serial: Optional[serial.Serial] = None
        self._lock = threading.Lock()
        self._seq = 0
        self.connected_port: Optional[str] = None
        self.last_error: Optional[str] = None

        if settings.serial_enabled:
            self.connect(self.settings.serial_port)

    @staticmethod
    def list_available_ports() -> List[dict]:
        """Lists all detected COM ports on the computer, prioritizing USB/Arduino."""
        results = []
        try:
            ports = list(serial.tools.list_ports.comports())
            for p in ports:
                desc = p.description or ""
                hwid = p.hwid or ""
                is_bt = "bth" in hwid.lower() or "bluetooth" in desc.lower()
                is_usb = "usb" in hwid.lower() or "usb" in desc.lower()
                # 2341 is official Arduino AG VID
                is_ard = ("2341:" in hwid.lower()) or any(k in desc.lower() for k in ["arduino", "ch340", "ftdi", "nano"]) or (is_usb and not is_bt)

                results.append({
                    "port": p.device,
                    "description": desc,
                    "hwid": hwid,
                    "is_arduino": is_ard,
                    "is_usb": is_usb and not is_bt,
                    "is_bluetooth": is_bt
                })

            # Sort: Arduino/USB ports first, Bluetooth ports last
            results.sort(key=lambda x: (not x["is_arduino"], not x["is_usb"], x["port"]))
        except Exception as e:
            print(f"[Serial] Error listing ports: {e}")
        return results

    def connect(self, port: Optional[str] = None) -> bool:
        """Connects to a specific port, or automatically finds an Arduino."""
        with self._lock:
            self.disconnect()

            # If no port specified or port is 'auto', scan for Arduino
            target_port = port or self.settings.serial_port
            if not target_port or target_port.lower() == "auto":
                available = self.list_available_ports()
                arduino_ports = [p["port"] for p in available if p["is_arduino"]]
                if arduino_ports:
                    target_port = arduino_ports[0]
                elif available:
                    # Fallback to first non-bluetooth port
                    non_bt = [p["port"] for p in available if "bluetooth" not in p["description"].lower()]
                    target_port = non_bt[0] if non_bt else available[0]["port"]

            if not target_port:
                self.last_error = "No serial port specified or detected."
                return False

            try:
                print(f"[Serial] Connecting to {target_port} at {self.settings.baud_rate} baud...")
                self._serial = serial.Serial(
                    target_port,
                    self.settings.baud_rate,
                    timeout=0.5,
                    write_timeout=0.5
                )
                time.sleep(1.8) # Wait for Arduino bootloader reset
                self.connected_port = target_port
                self.settings.serial_port = target_port
                self.settings.serial_enabled = True
                self.last_error = None
                print(f"[Serial] Connected successfully to {target_port}")
                return True
            except Exception as e:
                self.last_error = str(e)
                print(f"[Serial] Connection failed on {target_port}: {e}")
                self._serial = None
                self.connected_port = None
                return False

    def disconnect(self):
        """Closes serial connection."""
        if self._serial:
            try:
                self._serial.close()
            except Exception:
                pass
            self._serial = None
            self.connected_port = None

    def is_connected(self) -> bool:
        return bool(self._serial and self._serial.is_open)

    def send_signals(self, approach_states: Dict[str, str], phase: str = "A", duration: int = 15):
        """
        Sends frame-accurate signal states to Arduino to update physical LEDs:
        Example: {"seq":12,"phase":"A","dur":15,"n":"G","s":"G","e":"R","w":"R"}
        """
        if not self.is_connected():
            return

        self._seq += 1
        
        # Color mapper: green -> 'G', yellow -> 'Y', red/clearance -> 'R'
        def c2char(c: str) -> str:
            c = str(c).lower()
            if "green" in c: return "G"
            if "yel" in c: return "Y"
            return "R"

        n = c2char(approach_states.get("north", "R"))
        s = c2char(approach_states.get("south", "R"))
        e = c2char(approach_states.get("east", "R"))
        w = c2char(approach_states.get("west", "R"))

        cmd = json.dumps({
            "seq": self._seq,
            "phase": phase,
            "dur": int(duration),
            "n": n,
            "s": s,
            "e": e,
            "w": w
        }) + "\n"

        with self._lock:
            try:
                self._serial.write(cmd.encode("ascii"))
                self._serial.flush()
            except Exception as ex:
                print(f"[Serial] Write error: {ex}")
                self.last_error = str(ex)

    def send_command(self, phase: str, duration: int):
        """Legacy phase command dispatcher."""
        if not self.is_connected():
            return
        self._seq += 1
        cmd = json.dumps({
            "seq": self._seq,
            "phase": phase,
            "duration": int(duration)
        }) + "\n"
        with self._lock:
            try:
                self._serial.write(cmd.encode("ascii"))
                self._serial.flush()
            except Exception as ex:
                print(f"[Serial] Write error: {ex}")
                self.last_error = str(ex)

    def send_test_pattern(self):
        """Triggers the Arduino sequential 12-LED diagnostic test sweep."""
        if not self.is_connected():
            return False
        cmd = json.dumps({"cmd": "test"}) + "\n"
        with self._lock:
            try:
                self._serial.write(cmd.encode("ascii"))
                self._serial.flush()
                return True
            except Exception as ex:
                self.last_error = str(ex)
                return False

    def status(self) -> dict:
        return {
            "enabled": self.settings.serial_enabled,
            "connected": self.is_connected(),
            "port": self.connected_port,
            "baud_rate": self.settings.baud_rate,
            "last_error": self.last_error
        }
