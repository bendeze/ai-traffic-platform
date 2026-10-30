import asyncio, json, time, os
from contextlib import asynccontextmanager
from typing import Optional, List
import cv2, numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn

from config.settings import load_settings, save_settings
from vision.pipeline import VisionPipeline, Detection
from traffic.state_estimator import TrafficStateEstimator
from traffic.decision_engine import DecisionEngine
from controller.safety_manager import SafetyManager
from controller.serial_manager import SerialManager
from simulation.sumo.manager import sumo_mgr

# ── Globals ────────────────────────────────────────────────────────────────────
settings   = load_settings()
vision     = VisionPipeline(settings)
estimator  = TrafficStateEstimator(settings)
engine     = DecisionEngine(settings)
safety     = SafetyManager(settings, on_phase_started=engine.notify_phase_started)
engine.safety_ref = safety
serial_mgr = SerialManager(settings)

# Attach master SUMO simulation manager to authoritative traffic controllers
sumo_mgr.attach_traffic_controllers(engine, safety, estimator)

ws_clients:   list[WebSocket]    = []
current_frame: Optional[np.ndarray] = None
processing  = False
video_source: Optional[str] = None
active_source: Optional[str] = None
active_environment: str = "video"  # "video" or "sumo"
ped_requests = {a.name: False for a in settings.approaches}
active_ambulance: Optional[str] = None

# Cached detections for photo snapshot mode
cached_snapshot_detections: List[Detection] = []
last_snapshot_time: float = 0.0

# Hardware serial synchronization tracking
last_sent_serial_states: dict = {}
last_serial_sync_time: float = 0.0

# ── Background tasks ───────────────────────────────────────────────────────────
async def processing_loop():
    global current_frame, processing, video_source, active_source, active_ambulance
    global cached_snapshot_detections, last_snapshot_time, last_sent_serial_states, last_serial_sync_time
    cap = None

    while True:
        if not processing or video_source is None:
            if cap is not None:
                cap.release()
                cap = None
                active_source = None
            await asyncio.sleep(0.1)
            continue

        # If source has switched, release old capture and open new one
        if active_source != video_source or cap is None or not cap.isOpened():
            if cap is not None:
                cap.release()
            src = 0 if video_source == "webcam" else os.path.abspath(video_source)
            print(f"[Vision] Opening video source: {src}")
            cap = cv2.VideoCapture(src)
            active_source = video_source
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
        is_snapshot_mode = (settings.vision_mode == "snapshot")
        is_snapshot_frame = False

        if is_snapshot_mode:
            if (now - last_snapshot_time) >= settings.snapshot_interval or last_snapshot_time == 0.0:
                is_snapshot_frame = True
                last_snapshot_time = now

        loop = asyncio.get_event_loop()
        safety.update(now)
        approach_states = safety.get_approach_states()
        approach_timers = safety.get_approach_timers()
        vision.active_ambulance_approach = active_ambulance

        # Real-time frame synchronization to physical Arduino LEDs
        if (approach_states != last_sent_serial_states) or ((now - last_serial_sync_time) >= 1.0):
            if serial_mgr.is_connected():
                serial_mgr.send_signals(approach_states, safety.current_phase, int(safety.remaining_green))
            last_sent_serial_states = dict(approach_states)
            last_serial_sync_time = now

        # Run inference (or draw cached detections with live timers on top of lights)
        annotated, detections = await loop.run_in_executor(
            None,
            vision.process_frame,
            frame,
            approach_states,
            cached_snapshot_detections if is_snapshot_mode else None,
            is_snapshot_frame,
            approach_timers
        )

        current_frame = annotated

        if is_snapshot_mode:
            if is_snapshot_frame:
                cached_snapshot_detections = detections
                if active_environment != "sumo":
                    estimator.update(detections, manual_ambulance=active_ambulance)
                proposal = engine.decide(estimator.get_state(), ped_requests)
                safety.apply(proposal)
                if sumo_mgr.is_running:
                    sumo_mgr.traffic_adapter.apply_signals(safety.get_approach_states())
                if serial_mgr.is_connected():
                    serial_mgr.send_signals(safety.get_approach_states(), safety.current_phase, int(safety.remaining_green))
        else:
            if active_environment != "sumo":
                estimator.update(detections, manual_ambulance=active_ambulance)

        await asyncio.sleep(0.033)

async def decision_loop():
    while True:
        await asyncio.sleep(0.5)
        if not processing and not sumo_mgr.is_running:
            continue
        # In tracking mode, manual mode, or SUMO simulation mode, decision loop sets / cycles lights
        proposal = engine.decide(estimator.get_state(), ped_requests)
        safety.apply(proposal)
        approach_states = safety.get_approach_states()
        if sumo_mgr.is_running:
            sumo_mgr.traffic_adapter.apply_signals(approach_states)
        if serial_mgr.is_connected():
            serial_mgr.send_signals(approach_states, safety.current_phase, int(safety.remaining_green))

async def broadcast_loop():
    while True:
        await asyncio.sleep(0.3)
        if not ws_clients:
            continue
        payload = json.dumps(_build_payload())
        dead = []
        for ws in ws_clients:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            if ws in ws_clients:
                ws_clients.remove(ws)

def _build_payload():
    traffic_state = estimator.get_state()
    approach_signals = safety.get_approach_states()
    approach_timers = safety.get_approach_timers()
    time_to_next_snap = max(0.0, settings.snapshot_interval - (time.time() - last_snapshot_time))

    return {
        "signal": {
            "phase": safety.current_phase,
            "state": safety.signal_state.value,
            "remaining": round(safety.remaining_green, 1),
            "reason": engine.last_reason,
            "yellow_dur": round(safety._active_yellow_dur, 1),
            "manual_durations": engine.manual_durations,
            "mode": engine.mode,
            "manual_loop_running": engine.manual_loop_running,
            "is_pedestrian_active": safety.is_pedestrian_red_active(),
            "pedestrian_red_phase": safety.pedestrian_red_phase,
            "pedestrian_approach": engine.last_pedestrian_approach if safety.is_pedestrian_red_active() else None,
        },
        "approaches": {
            name: {
                "queue":         st.queue_estimate,
                "waiting_time":  round(st.waiting_time, 1),
                "vehicle_count": st.vehicle_count,
                "breakdown":     st.breakdown,
                "has_ambulance": st.has_ambulance,
                "signal":        approach_signals.get(name, "red"),
                "timer":         approach_timers.get(name, 0),
            }
            for name, st in traffic_state.items()
        },
        "vision": {
            "mode": settings.vision_mode,
            "snapshot_interval": settings.snapshot_interval,
            "snapshots_taken": vision.snapshot_count,
            "next_snapshot_in": round(time_to_next_snap, 1),
        },
        "pedestrian": ped_requests,
        "active_ambulance": active_ambulance,
        "active_environment": active_environment,
        "simulation": sumo_mgr.get_telemetry(),
        "pipeline":   vision.health(),
        "hardware":   serial_mgr.status(),
        "timestamp":  time.time(),
    }

# ── App ────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_event_loop()
    tasks = [loop.create_task(processing_loop()),
             loop.create_task(decision_loop()),
             loop.create_task(broadcast_loop())]
    yield
    for t in tasks:
        t.cancel()

app = FastAPI(title="Group Z Traffic API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.post("/video/source")
async def set_source(source: str):
    global video_source, processing
    video_source = source
    processing = True
    return {"status": "ok", "source": source}

@app.post("/video/upload")
async def upload_video(file: UploadFile = File(...)):
    global video_source, processing
    upload_dir = os.path.abspath("uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())
    video_source = file_path
    processing = True
    print(f"[Upload] Saved and active: {file_path}")
    return {"status": "ok", "path": file_path}

@app.post("/video/stop")
async def stop_video():
    global processing, active_source
    processing = False
    active_source = None
    return {"status": "stopped"}

@app.get("/video/stream")
async def video_stream():
    def generate():
        while True:
            frame = current_frame
            if frame is None:
                frame = np.zeros((720, 1280, 3), np.uint8)
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n"
            time.sleep(0.033)
    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/video/calibration_frame")
async def calibration_frame():
    frame = current_frame
    if frame is None:
        frame = np.zeros((720, 1280, 3), np.uint8)
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    from fastapi.responses import Response
    return Response(content=buf.tobytes(), media_type="image/jpeg")

@app.get("/state")
async def get_state():
    return _build_payload()

@app.post("/vision/mode/{mode}")
async def set_vision_mode(mode: str):
    if mode not in ("tracking", "snapshot"):
        raise HTTPException(400, "Vision mode must be 'tracking' or 'snapshot'")
    settings.vision_mode = mode
    save_settings(settings)
    return {"status": "ok", "vision_mode": mode}

@app.post("/vision/interval/{seconds}")
async def set_snapshot_interval(seconds: float):
    if seconds < 0.5 or seconds > 30.0:
        raise HTTPException(400, "Interval must be between 0.5s and 30s")
    settings.snapshot_interval = float(seconds)
    save_settings(settings)
    return {"status": "ok", "snapshot_interval": settings.snapshot_interval}

@app.post("/controller/phase/{phase}")
async def set_phase(phase: str, duration: Optional[int] = None):
    if phase not in ("A", "B"):
        raise HTTPException(400, "Phase must be A or B")
    dur = duration if duration is not None else engine.manual_durations.get(phase, 30)
    engine.manual_durations[phase] = dur
    engine.notify_phase_started(phase)
    safety.request_phase(phase, duration=dur, manual=True)
    return {"status": "ok", "phase": phase, "duration": dur}

@app.post("/controller/mode/{mode}")
async def set_mode(mode: str):
    if mode not in ("adaptive", "manual"):
        raise HTTPException(400, "Mode must be 'adaptive' or 'manual'")
    engine.mode = mode
    if mode == "adaptive":
        engine.manual_loop_running = False
    return {"status": "ok", "mode": mode, "manual_loop_running": engine.manual_loop_running}

@app.post("/controller/manual_loop/start")
async def start_manual_loop(body: dict):
    phase_a = max(5, int(body.get("phase_a", 30)))
    phase_b = max(5, int(body.get("phase_b", 30)))
    start_phase = body.get("start_phase", "A")
    if start_phase not in ("A", "B"):
        start_phase = "A"

    was_running = (engine.mode == "manual" and engine.manual_loop_running)

    engine.mode = "manual"
    engine.manual_loop_running = True
    engine.set_manual_durations(phase_a, phase_b)

    # If loop was not running, start initial phase with full duration
    # If loop was already running, WAIT for the active running timer to finish first!
    if not was_running:
        dur = phase_a if start_phase == "A" else phase_b
        engine.notify_phase_started(start_phase, duration=dur)
        safety.current_phase = start_phase
        from controller.safety_manager import SignalState
        safety.signal_state = SignalState.GREEN
        safety.remaining_green = float(dur)
        safety._phase_start = time.time()
        safety._in_transition = False
        safety._pending_phase = None

        if serial_mgr.is_connected():
            serial_mgr.send_signals(safety.get_approach_states(), start_phase, dur)

    return {
        "status": "ok",
        "manual_loop_running": True,
        "active_phase": safety.current_phase,
        "manual_durations": engine.manual_durations,
        "wait_current_timer": was_running
    }

@app.post("/controller/manual_loop/stop")
async def stop_manual_loop():
    engine.manual_loop_running = False
    return {"status": "ok", "manual_loop_running": False}

@app.post("/controller/manual_config")
async def set_manual_config(body: dict):
    phase_a = int(body.get("phase_a", 30))
    phase_b = int(body.get("phase_b", 30))
    engine.set_manual_durations(phase_a, phase_b)
    return {"status": "ok", "manual_durations": engine.manual_durations}

@app.post("/priority/pedestrian/{approach}")
async def ped_request(approach: str):
    if approach not in [a.name for a in settings.approaches]:
        raise HTTPException(400, "Unknown approach")
    ped_requests[approach] = True

    # Immediately force all roads on this approach's phase to RED for 10 seconds!
    safety.trigger_pedestrian_red(approach, duration=10.0)
    engine.notify_phase_started(safety.current_phase)
    engine.last_pedestrian_approach = approach
    engine.last_reason = f"pedestrian_crossing_{approach.upper()}_10s_RED"

    if serial_mgr.is_connected():
        serial_mgr.send_signals(safety.get_approach_states(), safety.current_phase, 10)

    return {
        "status": "ok",
        "requested": approach,
        "phase_on_red": safety.pedestrian_red_phase,
        "duration": 10
    }

@app.post("/priority/ambulance/{approach}")
async def trigger_ambulance(approach: str):
    global active_ambulance
    if approach not in [a.name for a in settings.approaches]:
        raise HTTPException(400, "Unknown approach")
    active_ambulance = approach
    return {"status": "ok", "ambulance_on": approach}

@app.post("/priority/ambulance_clear")
async def clear_ambulance():
    global active_ambulance
    active_ambulance = None
    vision.active_ambulance_approach = None
    return {"status": "ok", "ambulance_cleared": True}

@app.get("/config")
async def get_config():
    return {
        "approaches": [{"name": a.name, "polygon": a.polygon} for a in settings.approaches],
        "timing": settings.timing.__dict__,
        "vision_mode": settings.vision_mode,
        "snapshot_interval": settings.snapshot_interval,
    }

@app.put("/config/approaches")
async def update_approaches(body: dict):
    from config.settings import ApproachRegion as AR, save_settings
    if "approaches" not in body:
        raise HTTPException(400, "Missing 'approaches' key")
    settings.approaches = [
        AR(a["name"], [tuple(p) for p in a["polygon"]])
        for a in body["approaches"]
    ]
    vision.settings.approaches = settings.approaches
    save_settings(settings)
    return {"status": "ok", "saved": len(settings.approaches)}

# ── SUMO Simulation Endpoints ──────────────────────────────────────────────────
@app.get("/simulation/sumo/diagnostics")
async def get_sumo_diagnostics():
    from simulation.sumo.environment import sumo_env
    return sumo_env.get_diagnostics()

@app.get("/simulation/sumo/status")
async def get_sumo_status():
    return {
        "active_environment": active_environment,
        "telemetry": sumo_mgr.get_telemetry()
    }

@app.post("/simulation/environment/{env}")
async def set_active_environment(env: str):
    global active_environment, processing
    if env not in ("video", "sumo"):
        raise HTTPException(400, "Environment must be 'video' or 'sumo'")
    active_environment = env
    if env == "sumo":
        # Ensure video loop is paused and start simulation if not running
        if not sumo_mgr.is_running:
            sumo_mgr.start_simulation(gui=False)
    else:
        # Stop SUMO simulation when switching back to video
        if sumo_mgr.is_running:
            sumo_mgr.stop_simulation()
    return {"status": "ok", "active_environment": active_environment}

@app.post("/simulation/sumo/start")
async def sumo_start(gui: bool = False, speed: float = 1.0):
    global active_environment
    active_environment = "sumo"
    ok = sumo_mgr.start_simulation(gui=gui, speed_factor=speed)
    if not ok:
        raise HTTPException(500, "Failed to start SUMO simulation. Check diagnostics.")
    return {"status": "ok", "telemetry": sumo_mgr.get_telemetry()}

@app.post("/simulation/sumo/stop")
async def sumo_stop():
    sumo_mgr.stop_simulation()
    return {"status": "ok", "telemetry": sumo_mgr.get_telemetry()}

@app.post("/simulation/sumo/pause")
async def sumo_pause():
    sumo_mgr.pause_simulation()
    return {"status": "ok", "telemetry": sumo_mgr.get_telemetry()}

@app.post("/simulation/sumo/resume")
async def sumo_resume():
    sumo_mgr.resume_simulation()
    return {"status": "ok", "telemetry": sumo_mgr.get_telemetry()}

@app.post("/simulation/sumo/reset")
async def sumo_reset():
    ok = sumo_mgr.reset_simulation()
    return {"status": "ok" if ok else "error", "telemetry": sumo_mgr.get_telemetry()}

@app.post("/simulation/sumo/speed/{factor}")
async def sumo_set_speed(factor: float):
    if factor < 0.1 or factor > 10.0:
        raise HTTPException(400, "Speed factor must be between 0.1 and 10.0")
    sumo_mgr.speed_factor = float(factor)
    return {"status": "ok", "speed_factor": sumo_mgr.speed_factor}

# ── Arduino Hardware Serial Endpoints ──────────────────────────────────────────
@app.get("/serial/status")
async def get_serial_status():
    return serial_mgr.status()

@app.get("/serial/ports")
async def get_serial_ports():
    return {"ports": serial_mgr.list_available_ports()}

@app.post("/serial/connect")
async def serial_connect(port: Optional[str] = None):
    success = serial_mgr.connect(port)
    if not success:
        return {"status": "error", "error": serial_mgr.last_error, "serial": serial_mgr.status()}
    return {"status": "ok", "serial": serial_mgr.status()}

@app.post("/serial/disconnect")
async def serial_disconnect():
    serial_mgr.disconnect()
    return {"status": "ok", "serial": serial_mgr.status()}

@app.post("/serial/test")
async def serial_test():
    ok = serial_mgr.send_test_pattern()
    if not ok:
        raise HTTPException(400, "Arduino not connected or write failed")
    return {"status": "ok", "message": "Diagnostic test sweep triggered on Arduino"}

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    ws_clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if ws in ws_clients:
            ws_clients.remove(ws)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
