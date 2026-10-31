from core.app_state import AppState, app_state

def get_app_state() -> AppState:
    """Dependency provider returning the centralized application state."""
    return app_state
