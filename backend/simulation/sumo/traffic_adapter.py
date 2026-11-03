from typing import Dict, List, Optional, Set
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
    - Verified 20-link junction mapping for 'center':
        Indices 0..3:   North incoming vehicles (north_in_1, north_in_2)
        Indices 4..7:   East incoming vehicles  (east_in_1,  east_in_2)
        Indices 8..11:  South incoming vehicles (south_in_1, south_in_2)
        Indices 12..15: West incoming vehicles  (west_in_1,  west_in_2)
        Index 16:       North pedestrian crossing (across north road)
        Index 17:       East pedestrian crossing  (across east road)
        Index 18:       South pedestrian crossing (across south road)
        Index 19:       West pedestrian crossing  (across west road)
    """

    TLS_ID = "center"

    # Explicit verified link indices for each approach
    APPROACH_LINK_INDICES: Dict[str, List[int]] = {
        "north": [0, 1, 2, 3],
        "east":  [4, 5, 6, 7],
        "south": [8, 9, 10, 11],
        "west":  [12, 13, 14, 15]
    }

    # Pedestrian crossing link indices across each approach road:
    # 16: North crossing, 17: East crossing, 18: South crossing, 19: West crossing
    CROSSING_LINK_INDICES: Dict[str, int] = {
        "north": 16,
        "east":  17,
        "south": 18,
        "west":  19
    }

    TOTAL_LINKS = 20

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

    def build_state_string(self, approach_states: Dict[str, str], active_ped_approaches: Optional[Set[str]] = None) -> str:
        """
        Constructs the exact 20-character TraCI traffic light state string
        from approach states {"north": "...", "south": "...", "east": "...", "west": "..."}.
        16 vehicular approach links + 4 pedestrian crossing links.

        When active_ped_approaches is specified, pedestrian crossings show Green ('G')
        ONLY for approaches where a pedestrian button was explicitly clicked and traffic is stopped.
        Otherwise all crossings stay on Red ('r') so the 10s window is never applied unless requested.
        """
        chars = ["r"] * self.TOTAL_LINKS

        # 1. Map 16 vehicular approach links
        for approach, indices in self.APPROACH_LINK_INDICES.items():
            color = approach_states.get(approach, "red")
            char = self.color_to_sumo_char(color)
            for idx in indices:
                chars[idx] = char

        # 2. Map 4 pedestrian crossings
        n_car = approach_states.get("north", "red").lower()
        s_car = approach_states.get("south", "red").lower()
        e_car = approach_states.get("east", "red").lower()
        w_car = approach_states.get("west", "red").lower()

        if active_ped_approaches is not None:
            chars[16] = "G" if ("north" in active_ped_approaches and "red" in n_car) else "r"
            chars[17] = "G" if ("east" in active_ped_approaches and "red" in e_car) else "r"
            chars[18] = "G" if ("south" in active_ped_approaches and "red" in s_car) else "r"
            chars[19] = "G" if ("west" in active_ped_approaches and "red" in w_car) else "r"
        else:
            # Default / test backward-compatibility fallback
            chars[16] = "G" if "red" in n_car else "r"
            chars[17] = "G" if "red" in e_car else "r"
            chars[18] = "G" if "red" in s_car else "r"
            chars[19] = "G" if "red" in w_car else "r"

        return "".join(chars)

    def apply_signals(self, approach_states: Dict[str, str], active_ped_approaches: Optional[Set[str]] = None) -> bool:
        """
        Sends the translated 20-link signal state to SUMO via TraCI.
        Safe no-op if simulation is not currently running.
        """
        state_str = self.build_state_string(approach_states, active_ped_approaches)

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
