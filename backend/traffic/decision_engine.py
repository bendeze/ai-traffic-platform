import time
from typing import Dict, Optional
from traffic.state_estimator import ApproachState

class DecisionEngine:
    """
    Traffic Decision Engine with Strict Priority Hierarchy:

    1. EMERGENCY AMBULANCE PREEMPTION (Top Priority)
       - If ambulance on Phase A & light is B: switch immediately via standard yellow.
       - If ambulance on Phase B & light is A: switch immediately via standard yellow.
       - Overrides minimum green and fairness.

    2. PEDESTRIAN CROSSING (Safety Window)
       - When a pedestrian request occurs, yellow light holds for pedestrian_yellow_dur (10s)
         before transitioning to stop traffic safely.

    3. FAIRNESS CAP (Configurable, default 30s Wait)
       - No approach/phase is allowed to wait for more than max_wait_seconds.

    4. DEMAND PRIORITY (East-West vs North-South)
       - Phase with heavier traffic queue (cars, trucks, motorcycles, buses)
         gets priority if it exceeds demand_switch_threshold.

    5. MANUAL TIMED CYCLING
       - In manual mode, each phase runs for its user-configured seconds (default 30s).
       - Automatically passes to the next phase after its timing expires.
    """

    def __init__(self, settings):
        self.settings       = settings
        self.mode           = "adaptive"
        self._last_phase    = "A"
        self._phase_start   = time.time()
        self._last_green: Dict[str, float] = {"A": time.time(), "B": time.time()}
        self.last_reason    = "system_startup"
        self.last_ambulance_approach: Optional[str] = None
        self.last_pedestrian_approach: Optional[str] = None
        self.manual_durations: Dict[str, int] = {"A": 30, "B": 30} # Default 30s each
        self._active_phase_allocated_dur: int = 30
        self.manual_loop_running: bool = False
        self.safety_ref     = None

    def set_manual_durations(self, phase_a: int = 30, phase_b: int = 30):
        self.manual_durations["A"] = max(5, int(phase_a))
        self.manual_durations["B"] = max(5, int(phase_b))

    def decide(self, state: Dict[str, ApproachState], ped_requests: dict) -> dict:
        t = self.settings.timing
        now     = time.time()
        elapsed = now - self._phase_start
        other   = "B" if self._last_phase == "A" else "A"

        # ── ACTIVE PEDESTRIAN 10s RED OVERRIDE ────────────────────────────────
        if self.safety_ref and self.safety_ref.is_pedestrian_red_active(now):
            rem = max(1, int(round(self.safety_ref.pedestrian_red_until - now)))
            return {
                "phase": self.safety_ref.current_phase,
                "duration": rem,
                "yellow_dur": t.yellow_dur,
                "reason": f"pedestrian_red_active_{self.safety_ref.pedestrian_red_phase}_10s"
            }

        # ── 1. EMERGENCY AMBULANCE PREEMPTION (Highest Priority) ─────────────
        ambulance_phase = None
        for phase, approaches in self.settings.phases.items():
            for app in approaches:
                if state.get(app) and state[app].has_ambulance:
                    ambulance_phase = phase
                    self.last_ambulance_approach = app
                    break
            if ambulance_phase:
                break

        if ambulance_phase:
            if ambulance_phase != self._last_phase:
                self.last_reason = f"emergency_ambulance_preemption_{ambulance_phase}"
                return {
                    "phase": ambulance_phase,
                    "duration": 25,
                    "yellow_dur": t.yellow_dur,
                    "reason": self.last_reason
                }
            else:
                self.last_reason = f"ambulance_clearing_phase_{ambulance_phase}"
                return {
                    "phase": self._last_phase,
                    "duration": 25,
                    "yellow_dur": t.yellow_dur,
                    "reason": self.last_reason
                }

        # ── 2. PEDESTRIAN 10s RED OVERRIDE ───────────────────────────────────
        # When a pedestrian request is queued, immediately trigger the 10-second RED lock!
        ped_needed = [a for a, req in ped_requests.items() if req]
        if ped_needed:
            app = ped_needed[0]
            ped_requests[app] = False
            if self.safety_ref:
                self.safety_ref.trigger_pedestrian_red(app, duration=10.0)
            self.last_pedestrian_approach = app
            self.last_reason = f"pedestrian_crossing_{app.upper()}_10s_RED"
            target_red_phase = "A" if app in self.settings.phases.get("A", []) else "B"
            active_green_phase = "B" if target_red_phase == "A" else "A"
            return {
                "phase": active_green_phase,
                "duration": 10,
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # ── 3. MANUAL TIMED CYCLING MODE ──────────────────────────────────────
        if self.mode == "manual":
            if not self.manual_loop_running:
                # Standby: waiting for user to validate and start the loop!
                return {
                    "phase": self._last_phase,
                    "duration": 99,
                    "yellow_dur": t.yellow_dur,
                    "reason": "manual_standby_waiting_validation"
                }

            # Must wait for the currently running timer to finish first!
            target_dur = self._active_phase_allocated_dur
            if elapsed >= target_dur:
                # Timer expired! Automatically transition to next phase with its configured duration
                next_dur = self.manual_durations.get(other, 30)
                self.last_reason = f"manual_loop_cycle_to_{other}"
                return {
                    "phase": other,
                    "duration": next_dur,
                    "yellow_dur": t.yellow_dur,
                    "reason": self.last_reason
                }
            else:
                rem = max(1, int(round(target_dur - elapsed)))
                return {
                    "phase": self._last_phase,
                    "duration": rem,
                    "yellow_dur": t.yellow_dur,
                    "reason": f"manual_loop_phase_{self._last_phase}"
                }

        # ── Compute Vehicle Demand Scores (Cars, Trucks, Bikes, Buses) ────────
        scores = {}
        for phase, approaches in self.settings.phases.items():
            q_sum = sum(state[a].queue_estimate for a in approaches if a in state)
            w_max = max((state[a].waiting_time for a in approaches if a in state), default=0.0)
            scores[phase] = q_sum * 2.5 + w_max * 0.4

        # ── 3. FAIRNESS CAP: Anti-Starvation Wait Limit ────────────────────────
        other_waited = now - self._last_green.get(other, now)
        if other_waited >= t.max_wait_seconds:
            self.last_reason = f"fairness_cap_waited_{int(other_waited)}s"
            return {
                "phase": other,
                "duration": self._adaptive_duration(scores[other]),
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # ── 4. MAX GREEN CAP ──────────────────────────────────────────────────
        if elapsed >= t.max_green:
            self.last_reason = "max_green_limit_reached"
            return {
                "phase": other,
                "duration": self._adaptive_duration(scores[other]),
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # ── 5. MINIMUM GREEN PROTECTION ───────────────────────────────────────
        if elapsed < t.min_green:
            self.last_reason = "min_green_enforced"
            return {
                "phase": self._last_phase,
                "duration": t.min_green,
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # ── 6. DEMAND PRIORITY (East-West vs North-South) ──────────────────────
        current_score = scores[self._last_phase]
        other_score   = scores[other]

        if other_score > (current_score * t.demand_switch_threshold):
            self.last_reason = f"demand_priority_switch_to_{other}"
            return {
                "phase": other,
                "duration": self._adaptive_duration(other_score),
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # Maintain green on current phase if traffic demand is satisfied
        self.last_reason = f"traffic_flow_steady_phase_{self._last_phase}"
        return {
            "phase": self._last_phase,
            "duration": self._adaptive_duration(current_score),
            "yellow_dur": t.yellow_dur,
            "reason": self.last_reason
        }

    def notify_phase_started(self, phase: str, duration: Optional[int] = None):
        self._last_phase = phase
        self._phase_start = time.time()
        self._last_green[phase] = time.time()
        self._active_phase_allocated_dur = duration if duration is not None else self.manual_durations.get(phase, 30)

    def _adaptive_duration(self, score: float) -> int:
        t = self.settings.timing
        raw = t.min_green + score * 1.5
        return int(min(max(t.min_green, raw), t.max_green))
