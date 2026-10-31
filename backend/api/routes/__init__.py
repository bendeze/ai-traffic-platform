from .video import router as video_router
from .simulation import router as simulation_router
from .controller import router as controller_router
from .priority import router as priority_router
from .serial import router as serial_router
from .config import router as config_router
from .websocket import router as websocket_router

__all__ = [
    "video_router",
    "simulation_router",
    "controller_router",
    "priority_router",
    "serial_router",
    "config_router",
    "websocket_router",
]
