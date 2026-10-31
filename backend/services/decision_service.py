import time
import asyncio
from core.app_state import AppState

async def run_decision_loop(state: AppState):
    """
    Periodic FSM decision cycle worker (2 Hz).
    Evaluates approach queues, prioritizes demands, applies safety constraints,
    and forwards phase signals to hardware serial and SUMO TraCI.
    """
    while True:
        await asyncio.sleep(0.5)
        now = time.time()
        state.safety.update(now)

        if not state.processing and not state.sumo_mgr.is_running:
            continue

        # In continuous tracking mode, manual mode, or SUMO simulation mode,
        # decision loop calculates optimal timings and cycles phases
        proposal = state.engine.decide(state.estimator.get_state(), state.ped_requests)
        state.safety.apply(proposal)
        approach_states = state.safety.get_approach_states()

        if state.sumo_mgr.is_running:
            state.sumo_mgr.traffic_adapter.apply_signals(approach_states)

        if state.serial_mgr.is_connected():
            state.serial_mgr.send_signals(approach_states, state.safety.current_phase, int(state.safety.remaining_green))

