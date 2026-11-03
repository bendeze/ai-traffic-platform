import time
from typing import Dict, Optional
from traffic.state_estimator import ApproachState

class DecisionEngine:
    """
    Traffic Decision Engine with Strict Priority Hierarchy & Proportional Green Allocation:

    1. EMERGENCY AMBULANCE PREEMPTION (Top Priority)
       - If ambulance on Phase A & light is B: switch immediately via standard yellow.
       - If ambulance on Phase B & light is A: switch immediately via standard yellow.
       - Overrides minimum green and fairness.

    2. PEDESTRIAN CROSSING (Safety Window)
       - When pedestrian request is triggered on an active moving green road:
         must put it on YELLOW first (warning cars to stop) then lock RED for 10s.

    3. GAP-OUT / EMPTY-GREEN EARLY TRUNCATION (Anti-Waste)
       - If current green phase has cleared its queue (0 waiting vehicles) and minimum
         green has elapsed, immediately truncate green and hand right-of-way to waiting roads.

    4. PROPORTIONAL DEMAND ALLOCATION
       - We give more time for the phase with many cars than the other.
       - As we control the traffic, we do not wait until ALL cars on a busy phase clear;
         instead, the busiest phase gets enough time to clear many cars, and the phase
         with fewer cars gets enough time to let most of them pass without starvation.

    5. NON-LINEAR WAIT PRESSURE (Anti-Starvation)
       - Quadratic wait time pressure (wait^1.6) aggressively breaks long queues.

    6. VEHICLE CLASSIFICATION WEIGHTING
       - Higher passenger & inertia weighting for buses (3.0x) and trucks (2.0x).
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

    def decide(self, state: Dict[str, ApproachState], ped_requests: dict, now: Optional[float] = None) -> dict:
        t = self.settings.timing
        if now is None:
            now = time.time()
        if (self._phase_start is None) or (now < self._phase_start) or (self._phase_start > 1e8 and now < 1e6):
            self._phase_start = now
            self._last_green = {"A": now, "B": now}
        elapsed = max(0.0, now - self._phase_start)
        other   = "B" if self._last_phase == "A" else "A"

        # ── ACTIVE PEDESTRIAN 10s RED OVERRIDE ────────────────────────────────
        if self.safety_ref and self.safety_ref.is_pedestrian_red_active(now):
            red_phase = self.safety_ref.pedestrian_red_phase
            for app in self.settings.phases.get(red_phase, []):
                ped_requests[app] = False
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
            self._was_ambulance_preempting = True
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
        else:
            if getattr(self, "_was_ambulance_preempting", False):
                self._was_ambulance_preempting = False
                self.last_ambulance_approach = None
                if self.safety_ref:
                    self.safety_ref.end_emergency_hold()

        # ── 2. PEDESTRIAN REQUEST: Yellow first, then 10s RED ─────────────────
        ped_needed = [a for a, req in ped_requests.items() if req]
        if ped_needed:
            app = ped_needed[0]
            for a in self.settings.phases.get("A", []) + self.settings.phases.get("B", []):
                ped_requests[a] = False
            if self.safety_ref:
                self.safety_ref.trigger_pedestrian_red(app, duration=10.0)
            self.last_pedestrian_approach = app
            self.last_reason = f"pedestrian_crossing_{app.upper()}_yellow_then_red"
            target_red_phase = "A" if app in self.settings.phases.get("A", []) else "B"
            active_green_phase = "B" if target_red_phase == "A" else "A"
            return {
                "phase": active_green_phase,
                "duration": 10,
                "yellow_dur": getattr(t, "pedestrian_yellow_dur", 3),
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

        # ── 4. VEHICLE CLASSIFICATION & QUEUE WEIGHTING ───────────────────────
        type_weights = {
            "bus": getattr(t, "weight_bus", 3.0),
            "truck": getattr(t, "weight_truck", 2.0),
            "car": getattr(t, "weight_car", 1.0),
            "motorcycle": getattr(t, "weight_motorcycle", 0.8),
            "bicycle": getattr(t, "weight_bicycle", 0.5),
        }
        raw_queues = {}
        weighted_queues = {}
        wait_times = {}
        approaching_demand = {}

        for phase, approaches in self.settings.phases.items():
            raw_q = sum(state[a].queue_estimate for a in approaches if a in state)
            raw_queues[phase] = raw_q
            appr_q = sum(getattr(state[a], "approaching_count", 0) for a in approaches if a in state)
            approaching_demand[phase] = appr_q

            # If raw_q is 0 (no vehicles stopped or queuing at the light), queue is strictly 0!
            # Never let far-away cruising cars falsely prevent gap-out!
            if raw_q <= getattr(t, "gap_out_threshold", 0.2):
                weighted_queues[phase] = 0.0
            else:
                w_factor = 1.0
                total_veh = sum(state[a].vehicle_count for a in approaches if a in state)
                if total_veh > 0:
                    w_sum = sum(
                        sum(type_weights.get(vtype, 1.0) * cnt for vtype, cnt in (getattr(state[a], "breakdown", {}) or {}).items())
                        for a in approaches if a in state
                    )
                    w_factor = max(1.0, w_sum / total_veh)
                weighted_queues[phase] = float(raw_q) * w_factor

            wait_times[phase] = max((state[a].waiting_time for a in approaches if a in state), default=0.0)

        # Active demand on green combines remaining queue + vehicles actively approaching/crossing within 50m
        curr_q = weighted_queues.get(self._last_phase, 0.0)
        curr_appr = approaching_demand.get(self._last_phase, 0.0)
        curr_demand = curr_q + curr_appr

        other_q = weighted_queues.get(other, 0.0)
        other_appr = approaching_demand.get(other, 0.0)
        other_demand = other_q + other_appr

        gap_thresh = getattr(t, "gap_out_threshold", 0.2)

        # Non-linear quadratic wait penalty:
        scores = {}
        for phase in self.settings.phases:
            q_part = (weighted_queues[phase] + approaching_demand.get(phase, 0.0)) * 2.5
            w_part = (wait_times[phase] ** 1.6) * 0.15
            scores[phase] = q_part + w_part

        curr_score = scores.get(self._last_phase, 0.0)
        other_score = scores.get(other, 0.0)

        # ── 5. PROPORTIONAL GREEN ALLOCATION ─────────────────────────────────
        allocated_green = self._calc_proportional_duration(curr_demand, other_demand)

        # ── 6. ZERO-CAR CONTINUATION: KEEP GREEN ON THE ROAD WITH CARS ────────
        # If the other road has NO cars (other_demand <= gap_thresh):
        # Continue prioritizing the active road with cars! Never switch to an empty road.
        if other_demand <= gap_thresh and curr_demand > gap_thresh:
            self.last_reason = f"priority_continuation_other_has_no_cars_phase_{self._last_phase}"
            return {
                "phase": self._last_phase,
                "duration": max(1, int(round(allocated_green - elapsed))),
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # ── 7. IMMEDIATE GAP-OUT: EMPTY GREEN EARLY TRUNCATION ────────────────
        # If the active green road has NO demand (neither queue nor moving cars, curr_demand <= gap_thresh)
        # and the opposing road HAS waiting vehicles (other_demand > gap_thresh):
        # Once minimum green has elapsed, IMMEDIATELY switch to the waiting road!
        if curr_demand <= gap_thresh and other_demand > gap_thresh and elapsed >= t.min_green:
            self.last_reason = f"gap_out_empty_green_switch_to_{other}"
            return {
                "phase": other,
                "duration": self._calc_proportional_duration(other_demand, curr_demand),
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # ── 8. CRITICAL QUEUE RELIEF (ANTI-GRIDLOCK HARD CAP) ─────────────────
        # If opposing queue reaches critical threshold (>= 8 cars), NEVER let it sit!
        # Switch immediately to drain it before a massive queue can form.
        if other_q >= 8.0 and elapsed >= t.min_green:
            self.last_reason = f"critical_queue_relief_switch_to_{other}"
            return {
                "phase": other,
                "duration": self._calc_proportional_duration(other_demand, curr_demand),
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # ── 9. HEAVY QUEUE IMBALANCE: GIVE PRIORITY TO LARGER QUEUE ───────────
        # When opposing phase has a bigger queue than current phase, switch after min_green!
        if other_q >= max(3.0, curr_q * 1.5) and elapsed >= t.min_green:
            self.last_reason = f"queue_priority_switch_to_larger_queue_{other}"
            return {
                "phase": other,
                "duration": self._calc_proportional_duration(other_demand, curr_demand),
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # ── 9. MINIMUM GREEN PROTECTION (FOR MOVING TRAFFIC) ───────────────────
        if elapsed < t.min_green:
            self.last_reason = "min_green_enforced"
            return {
                "phase": self._last_phase,
                "duration": int(round(allocated_green)),
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # ── 10. FAIRNESS CAP (Anti-Starvation Maximum Wait) ────────────────────
        other_waited = now - self._last_green.get(other, now)
        if other_waited >= t.max_wait_seconds and other_demand > gap_thresh and elapsed >= t.min_green:
            self.last_reason = f"fairness_cap_waited_{int(other_waited)}s"
            return {
                "phase": other,
                "duration": self._calc_proportional_duration(other_demand, curr_demand),
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # ── 11. PROPORTIONAL QUOTA EXPIRATION ─────────────────────────────────
        # Once the busy phase has been given its allocated time to pass many cars,
        # switch to the other phase so its waiting queue can clear.
        if elapsed >= allocated_green and other_demand > gap_thresh:
            self.last_reason = f"proportional_quota_reached_switch_to_{other}"
            return {
                "phase": other,
                "duration": self._calc_proportional_duration(other_demand, curr_demand),
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # ── 12. HEAVY DEMAND IMBALANCE SWITCH ─────────────────────────────────
        if other_score > (curr_score * t.demand_switch_threshold) and elapsed >= t.min_green:
            self.last_reason = f"demand_imbalance_switch_to_{other}"
            return {
                "phase": other,
                "duration": self._calc_proportional_duration(other_demand, curr_demand),
                "yellow_dur": t.yellow_dur,
                "reason": self.last_reason
            }

        # Maintain green on current phase
        rem_allocated = max(1, int(round(allocated_green - elapsed)))
        self.last_reason = f"proportional_flow_steady_phase_{self._last_phase}"
        return {
            "phase": self._last_phase,
            "duration": rem_allocated,
            "yellow_dur": t.yellow_dur,
            "reason": self.last_reason
        }

    def _calc_proportional_duration(self, target_q: float, opposing_q: float) -> int:
        t = self.settings.timing
        # Base clearing time: ~2.0s lost time + ~1.2s per queued vehicle
        needed = int(round(2.0 + target_q * 1.2))

        if target_q >= opposing_q:
            cap = min(t.max_green, max(t.min_green, needed + 3))
            return max(t.min_green, min(t.max_green, cap))
        else:
            # Lighter phase with fewer vehicles gets tightly bounded time
            return max(t.min_green, min(12, needed))

    def notify_phase_started(self, phase: str, duration: Optional[int] = None, now: Optional[float] = None):
        if now is None:
            now = time.time()
        self._last_phase = phase
        self._phase_start = now
        self._last_green[phase] = now
        self._active_phase_allocated_dur = duration if duration is not None else self.manual_durations.get(phase, 30)

    def _adaptive_duration(self, score: float) -> int:
        t = self.settings.timing
        raw = t.min_green + score * 1.5
        return int(min(max(t.min_green, raw), t.max_green))
