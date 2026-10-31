import os
import time
import asyncio
import cv2
from core.app_state import AppState

async def run_vision_processing_loop(state: AppState):
    """
    Background worker loop for camera capture, video streaming,
    YOLO inference, and serial hardware synchronization.
    """
    cap = None

    while True:
        if not state.processing or state.video_source is None:
            if cap is not None:
                cap.release()
                cap = None
                state.active_source = None
            await asyncio.sleep(0.1)
            continue

        # If source has switched, release old capture and open new one
        if state.active_source != state.video_source or cap is None or not cap.isOpened():
            if cap is not None:
                cap.release()
            src = 0 if state.video_source == "webcam" else os.path.abspath(state.video_source)
            print(f"[Vision] Opening video source: {src}")
            cap = cv2.VideoCapture(src)
            state.active_source = state.video_source
            if not cap.isOpened():
                print(f"[Vision] Error: could not open source {src}")
                await asyncio.sleep(1.0)
                continue

        ret, frame = cap.read()
        if not ret:
            # End of video: rewind to beginning for continuous loop
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            await asyncio.sleep(0.05)
            continue

        now = time.time()
        is_snapshot_mode = (state.settings.vision_mode == "snapshot")
        is_snapshot_frame = False

        if is_snapshot_mode:
            if (now - state.last_snapshot_time) >= state.settings.snapshot_interval or state.last_snapshot_time == 0.0:
                is_snapshot_frame = True
                state.last_snapshot_time = now

        loop = asyncio.get_event_loop()
        state.safety.update(now)
        approach_states = state.safety.get_approach_states()
        approach_timers = state.safety.get_approach_timers()
        state.vision.active_ambulance_approach = state.active_ambulance

        # Real-time frame synchronization to physical Arduino LEDs
        if (approach_states != state.last_sent_serial_states) or ((now - state.last_serial_sync_time) >= 1.0):
            if state.serial_mgr.is_connected():
                state.serial_mgr.send_signals(approach_states, state.safety.current_phase, int(state.safety.remaining_green))
            state.last_sent_serial_states = dict(approach_states)
            state.last_serial_sync_time = now

        # Run inference (or draw cached detections with live timers on top of lights)
        annotated, detections = await loop.run_in_executor(
            None,
            state.vision.process_frame,
            frame,
            approach_states,
            state.cached_snapshot_detections if is_snapshot_mode else None,
            is_snapshot_frame,
            approach_timers
        )

        state.current_frame = annotated

        if is_snapshot_mode:
            if is_snapshot_frame:
                state.cached_snapshot_detections = detections
                if state.active_environment != "sumo":
                    state.estimator.update(detections, manual_ambulance=state.active_ambulance)
                proposal = state.engine.decide(state.estimator.get_state(), state.ped_requests)
                state.safety.apply(proposal)
                if state.sumo_mgr.is_running:
                    state.sumo_mgr.traffic_adapter.apply_signals(state.safety.get_approach_states())
                if state.serial_mgr.is_connected():
                    state.serial_mgr.send_signals(state.safety.get_approach_states(), state.safety.current_phase, int(state.safety.remaining_green))
        else:
            if state.active_environment != "sumo":
                state.estimator.update(detections, manual_ambulance=state.active_ambulance)

        await asyncio.sleep(0.033)
