import time
from enum import Enum
from typing import Optional, Callable, Set, Dict, List

class SignalState(Enum):
    GREEN     = "green"
    YELLOW    = "yellow"
    CLEARANCE = "clearance"   # all-red interval between phases
    RED       = "red"

class SafetyManager:
    """
    Hardware-interlock state machine.

    Transition sequence (MANDATORY — never skip):
        GREEN  →  YELLOW  →  CLEARANCE (all-red)  →  GREEN (new phase)

    Rules:
    - Conflicting green phases are NEVER active simultaneously.
    - STANDARD TRANSITIONS: All 4 approaches turn YELLOW simultaneously
      to announce the intersection state change to all traffic.
    - PEDESTRIAN TRANSITIONS: The active moving phase gets 10s yellow to stop safely,
      while non-moving approaches stay red.
    - Python proposes; SafetyManager validates and executes.
    """

    def __init__(self, settings, on_phase_started: Optional[Callable] = None):
        self.settings                 = settings
        self._on_phase_started        = on_phase_started   # callback → DecisionEngine
        self.current_phase            = "A"
        self.signal_state             = SignalState.GREEN
        self.remaining_green          = float(settings.timing.min_green)
        self._phase_start             = time.time()
        self._transition_start: Optional[float] = None
        self._pending_phase: Optional[str] = None
        self._in_transition           = False
        self._next_green_dur          = float(settings.timing.min_green)
        self._active_yellow_dur       = float(settings.timing.yellow_dur)
        self._is_pedestrian_transition = False

        # Pedestrian 10s RED hold: forces the requested road's phase to RED for 10s immediately
        self.pedestrian_red_phase: Optional[str] = None
        self.pedestrian_red_until: float = 0.0
        self.pedestrian_approach: Optional[str] = None
        self.active_pedestrian_approaches: Set[str] = set()

    def is_pedestrian_red_active(self, now: Optional[float] = None) -> bool:
        if now is None:
            now = time.time()
        return bool(self.pedestrian_red_phase and now < self.pedestrian_red_until)

    def trigger_pedestrian_red(self, approach: str, duration: float = 10.0):
        """
        Immediately forces all roads on this approach's phase to RED for 10 seconds.
        E.g. if 'north' or 'south': Phase A immediately turns RED for 10 seconds.
        Phase B (east & west) turns GREEN, giving pedestrians safe crosswalk passage.
        """
        now = time.time()
        target_red_phase = "A" if approach in self.settings.phases.get("A", []) else "B"
        green_phase = "B" if target_red_phase == "A" else "A"

        self.pedestrian_red_phase = target_red_phase
        self.pedestrian_red_until = now + duration
        self.pedestrian_approach = approach.lower()
        self.active_pedestrian_approaches.add(approach.lower())

        self.current_phase = green_phase
        self.signal_state = SignalState.GREEN
        self.remaining_green = float(duration)
        self._phase_start = now
        self._in_transition = False
        self._pending_phase = None
        self._is_pedestrian_transition = True

        if self._on_phase_started:
            self._on_phase_started(green_phase)

    # ─────────────────────────────────────────────────────────────────────────
    def update(self, now: Optional[float] = None):
        """Called every frame to smoothly update timers and advance transitions."""
        if now is None:
            now = time.time()

        if self.is_pedestrian_red_active(now):
            rem = max(0.0, self.pedestrian_red_until - now)
            self.remaining_green = rem
            return
        elif self.pedestrian_red_phase:
            # 10s RED period expired; clear and resume standard flow
            self.pedestrian_red_phase = None
            self.pedestrian_approach = None
            self.active_pedestrian_approaches.clear()
            self._is_pedestrian_transition = False
            self._phase_start = now
            self.remaining_green = float(self.settings.timing.min_green)

        if self._in_transition:
            elapsed = now - (self._transition_start or now)
            if self.signal_state == SignalState.YELLOW:
                if elapsed >= self._active_yellow_dur:
                    # YELLOW done → enter all-red CLEARANCE
                    self.signal_state      = SignalState.CLEARANCE
                    self._transition_start = now
            elif self.signal_state == SignalState.CLEARANCE:
                if elapsed >= self.settings.timing.clearance:
                    # CLEARANCE done → activate new phase
                    self.current_phase   = self._pending_phase
                    self.signal_state    = SignalState.GREEN
                    self._phase_start    = now
                    self.remaining_green = float(self._next_green_dur)
                    self._in_transition  = False
                    self._pending_phase  = None
                    self._active_yellow_dur = float(self.settings.timing.yellow_dur)
                    self._is_pedestrian_transition = False
                    if self._on_phase_started:
                        self._on_phase_started(self.current_phase)
        else:
            elapsed = now - self._phase_start
            self.remaining_green = max(0.0, self.remaining_green - elapsed)
            self._phase_start    = now

    # ─────────────────────────────────────────────────────────────────────────
    def apply(self, proposal: dict):
        """Called periodically by decision_loop."""
        now = time.time()
        self.update(now)

        # Active pedestrian 10s RED hold: freeze any transition until 10s expires
        if self.is_pedestrian_red_active(now):
            return

        # Mid-transition: state machine is advancing via update()
        if self._in_transition:
            return

        requested = proposal.get("phase", self.current_phase)
        dur = float(proposal.get("duration", self.settings.timing.min_green))

        # ── Phase change proposed ─────────────────────────────────────────────
        if requested != self.current_phase and requested in self.settings.phases:
            reason = str(proposal.get("reason", "")).lower()
            custom_yellow = proposal.get("yellow_dur")

            if "pedestrian" in reason or (custom_yellow and custom_yellow >= 9):
                self._is_pedestrian_transition = True
                self._active_yellow_dur = float(custom_yellow or 10.0)
            else:
                self._is_pedestrian_transition = False
                self._active_yellow_dur = float(custom_yellow or self.settings.timing.yellow_dur)

            # Start mandatory sequence: YELLOW → CLEARANCE → GREEN
            self.signal_state       = SignalState.YELLOW
            self._pending_phase     = requested
            self._transition_start  = now
            self._in_transition     = True
            self._next_green_dur    = dur
        elif proposal.get("manual") or proposal.get("force_duration"):
            self.remaining_green    = dur

    def end_emergency_hold(self):
        """Immediately ends emergency green hold once the vehicle has cleared the road."""
        if self.signal_state == SignalState.GREEN and self.remaining_green > float(self.settings.timing.min_green):
            self.remaining_green = float(self.settings.timing.min_green)

    # ─────────────────────────────────────────────────────────────────────────
    def request_phase(self, phase: str, duration: Optional[int] = None, manual: bool = False, yellow_dur: Optional[float] = None):
        """Direct phase request with custom green duration."""
        if phase in self.settings.phases and not self._in_transition:
            dur = duration if duration is not None else self.settings.timing.min_green
            if manual and phase == self.current_phase and self.signal_state == SignalState.GREEN:
                self.remaining_green = float(dur)
                return
            prop = {"phase": phase, "duration": dur, "manual": manual}
            if yellow_dur is not None:
                prop["yellow_dur"] = yellow_dur
            self.apply(prop)

    # ─────────────────────────────────────────────────────────────────────────
    def get_approach_states(self) -> dict:
        now = time.time()
        # 1. Active Pedestrian 10s RED override
        if self.is_pedestrian_red_active(now):
            red_apps = self.settings.phases.get(self.pedestrian_red_phase, [])
            result = {}
            for phase_apps in self.settings.phases.values():
                for app in phase_apps:
                    result[app] = "red" if app in red_apps else "green"
            return result

        green_now = self.settings.phases.get(self.current_phase, [])
        result    = {}

        for phase_apps in self.settings.phases.values():
            for app in phase_apps:
                if self._in_transition:
                    if self.signal_state == SignalState.YELLOW:
                        if self._is_pedestrian_transition:
                            result[app] = "yellow" if app in green_now else "red"
                        else:
                            # Standard transition: ALL 4 approaches show YELLOW simultaneously!
                            result[app] = "yellow"
                    else:
                        # ALL-RED CLEARANCE
                        result[app] = "red"
                else:
                    result[app] = "green" if app in green_now else "red"
        return result

    # ─────────────────────────────────────────────────────────────────────────
    def get_approach_timers(self) -> dict:
        """
        Returns live countdown in seconds for each approach:
        - Active green: countdown until yellow
        - Active yellow: countdown of yellow
        - Clearance: countdown of clearance
        - Waiting red: countdown until this approach turns green
        """
        now = time.time()

        # 1. Active Pedestrian 10s RED override: exact 10s countdown on all approaches
        if self.is_pedestrian_red_active(now):
            rem = max(0, int(round(self.pedestrian_red_until - now)))
            timers = {}
            for phase_apps in self.settings.phases.values():
                for app in phase_apps:
                    timers[app] = rem
            return timers

        green_now = self.settings.phases.get(self.current_phase, [])
        timers = {}

        if self._in_transition:
            elapsed = now - (self._transition_start or now)
            if self.signal_state == SignalState.YELLOW:
                rem_yellow = max(0.0, self._active_yellow_dur - elapsed)
                rem_clear = float(self.settings.timing.clearance)
                for phase_apps in self.settings.phases.values():
                    for app in phase_apps:
                        if app in green_now or not self._is_pedestrian_transition:
                            timers[app] = int(round(rem_yellow))
                        else:
                            timers[app] = int(round(rem_yellow + rem_clear))
            else: # CLEARANCE
                rem_clear = max(0.0, float(self.settings.timing.clearance) - elapsed)
                for phase_apps in self.settings.phases.values():
                    for app in phase_apps:
                        timers[app] = int(round(rem_clear))
        else:
            # Normal green state
            rem_green = max(0.0, self.remaining_green)
            trans_overhead = float(self._active_yellow_dur) + float(self.settings.timing.clearance)
            for phase_apps in self.settings.phases.values():
                for app in phase_apps:
                    if app in green_now:
                        timers[app] = int(round(rem_green))
                    else:
                        # Time remaining until this waiting red phase gets green
                        timers[app] = int(round(rem_green + trans_overhead))

        return timers
