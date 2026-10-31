import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from core.app_state import app_state, AppState
from services import (
    run_vision_processing_loop,
    run_decision_loop,
    run_broadcast_loop,
)
from api.routes import (
    video_router,
    simulation_router,
    controller_router,
    priority_router,
    serial_router,
    config_router,
    websocket_router,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager orchestrating background workers."""
    loop = asyncio.get_event_loop()
    tasks = [
        loop.create_task(run_vision_processing_loop(app_state)),
        loop.create_task(run_decision_loop(app_state)),
        loop.create_task(run_broadcast_loop(app_state)),
    ]
    yield
    for t in tasks:
        t.cancel()

def create_app() -> FastAPI:
    """Factory function for FastAPI application instance."""
    app = FastAPI(
        title="Group Z Intelligent Traffic Management API",
        version="1.1.0",
        description="Autonomous adaptive AI traffic control with YOLOv8 perception, hardware Arduino 12-LED, and TraCI SUMO simulation.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register modular routers
    app.include_router(video_router)
    app.include_router(simulation_router)
    app.include_router(controller_router)
    app.include_router(priority_router)
    app.include_router(serial_router)
    app.include_router(config_router)
    app.include_router(websocket_router)

    return app

# Application instance for uvicorn
app = create_app()

# Backward-compatibility aliases for legacy tests and external callers
sumo_mgr = app_state.sumo_mgr
engine = app_state.engine
safety = app_state.safety
estimator = app_state.estimator
serial_mgr = app_state.serial_mgr
vision = app_state.vision
_build_payload = app_state.build_telemetry_payload

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
