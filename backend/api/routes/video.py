import os
import time
import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, Response

from core.app_state import AppState
from api.dependencies import get_app_state
from config.settings import save_settings

router = APIRouter(tags=["Video & Perception"])

@router.post("/video/source")
async def set_source(source: str, state: AppState = Depends(get_app_state)):
    state.video_source = source
    state.processing = True
    return {"status": "ok", "source": source}

@router.post("/video/upload")
async def upload_video(file: UploadFile = File(...), state: AppState = Depends(get_app_state)):
    upload_dir = os.path.abspath("uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())
    state.video_source = file_path
    state.processing = True
    print(f"[Upload] Saved and active: {file_path}")
    return {"status": "ok", "path": file_path}

@router.post("/video/stop")
async def stop_video(state: AppState = Depends(get_app_state)):
    state.processing = False
    state.active_source = None
    return {"status": "stopped"}

@router.get("/video/stream")
async def video_stream(state: AppState = Depends(get_app_state)):
    def generate():
        while True:
            frame = state.current_frame
            if frame is None:
                frame = np.zeros((720, 1280, 3), np.uint8)
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n"
            time.sleep(0.033)
    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")

@router.get("/video/calibration_frame")
async def calibration_frame(state: AppState = Depends(get_app_state)):
    frame = state.current_frame
    if frame is None:
        frame = np.zeros((720, 1280, 3), np.uint8)
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return Response(content=buf.tobytes(), media_type="image/jpeg")

@router.post("/vision/mode/{mode}")
async def set_vision_mode(mode: str, state: AppState = Depends(get_app_state)):
    if mode not in ("tracking", "snapshot"):
        raise HTTPException(400, "Vision mode must be 'tracking' or 'snapshot'")
    state.settings.vision_mode = mode
    save_settings(state.settings)
    return {"status": "ok", "vision_mode": mode}

@router.post("/vision/interval/{seconds}")
async def set_snapshot_interval(seconds: float, state: AppState = Depends(get_app_state)):
    if seconds < 0.5 or seconds > 30.0:
        raise HTTPException(400, "Interval must be between 0.5s and 30s")
    state.settings.snapshot_interval = float(seconds)
    save_settings(state.settings)
    return {"status": "ok", "snapshot_interval": state.settings.snapshot_interval}
