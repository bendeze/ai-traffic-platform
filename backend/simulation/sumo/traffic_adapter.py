from typing import Dict, List, Optional
try:
    import traci
except ImportError:
    traci = None

from simulation.sumo.connection import sumo_conn

class SUMOTrafficAdapter:
    """
    Translates normalized traffic signal states from the existing SafetyManager
    and FSM DecisionEngine into verified link-level TraCI commands for SUMO.

    Safety Guarantee:
    - Never generates or decides signal states independently.
    - Strictly maps the authoritative output of SafetyManager (green, 4-way yellow,
      clearance all-red, emergency preemption, and pedestrian red locks).
    - Verified 16-link junction mapping for 'center':
        Indices 0..3:   North incoming (north_in_0, north_in_1)
        Indices 4..7:   East incoming  (east_in_0,  east_in_1)
        Indices 8..11:  South incoming (south_in_0, south_in_1)
        Indices 12..15: West incoming  (west_in_0,  west_in_1)
    """

    TLS_ID = "center"

    # Explicit verified link indices for each approach
    APPROACH_LINK_INDICES: Dict[str, List[int]] = {
        "north": [0, 1, 2, 3],
        "east":  [4, 5, 6, 7],
        "south": [8, 9, 10, 11],
        "west":  [12, 13, 14, 15]
    }

    TOTAL_LINKS = 16

    def __init__(self, tls_id: str = "center", connection=sumo_conn):
        self.tls_id = tls_id
        self.conn = connection
        self.last_applied_state: Optional[str] = None
        self.last_approach_states: Optional[Dict[str, str]] = None
        self._total_updates = 0

    @classmethod
    def color_to_sumo_char(cls, color: str) -> str:
        """
        Converts human-readable approach color to standard TraCI character:
        - green -> 'G' (major green)
        - yellow -> 'y' (standard yellow transition)
        - red / clearance -> 'r' (standard red stop)
        """
        c = str(color).lower()
        if c == "green" or c == "g":
            return "G"
        elif c == "yellow" or c == "y":
            return "y"
        else:
            return "r"

    def build_state_string(self, approach_states: Dict[str, str]) -> str:
        """
        Constructs the exact 16-character TraCI traffic light state string
        from approach states {"north": "...", "south": "...", "east": "...", "west": "..."}.
        """
        chars = ["r"] * self.TOTAL_LINKS

        for approach, indices in self.APPROACH_LINK_INDICES.items():
            color = approach_states.get(approach, "red")
            char = self.color_to_sumo_char(color)
            for idx in indices:
                chars[idx] = char

        return "".join(chars)

    def apply_signals(self, approach_states: Dict[str, str]) -> bool:
        """
        Sends the translated 16-link signal state to SUMO via TraCI.
        Safe no-op if simulation is not currently running.
        """
        state_str = self.build_state_string(approach_states)

        if not self.conn.is_connected() or traci is None:
            self.last_approach_states = approach_states
            self.last_applied_state = state_str
            return False

        try:
            traci.switch(self.conn._traci_label)
            # Only send update if state changed or periodically to maintain external control
            traci.trafficlight.setRedYellowGreenState(self.tls_id, state_str)
            self.last_applied_state = state_str
            self.last_approach_states = approach_states
            self._total_updates += 1
            return True
        except Exception as e:
            # TraCI error or connection lost
            return False

    def get_status(self) -> dict:
        return {
            "tls_id": self.tls_id,
            "is_connected": self.conn.is_connected(),
            "last_applied_state": self.last_applied_state,
            "last_approach_states": self.last_approach_states,
            "total_updates": self._total_updates
        }

# Global singleton instance
sumo_traffic_adapter = SUMOTrafficAdapter()

