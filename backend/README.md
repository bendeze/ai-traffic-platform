# AI Traffic Management Platform — Backend Engine

FastAPI backend service powering the **AI Traffic Management Platform**.

For full project documentation, system design principles, and hardware wiring, see:
- 📖 [Main Project README](../README.md)
- 🚀 [Getting Started Guide](../docs/GETTING_STARTED.md)
- 🏛️ [System Architecture & Design](../docs/ARCHITECTURE.md)
- 🧠 [Working Principles & Theory](../docs/WORKING_PRINCIPLE.md)
- 🕹️ [Operator & User Guide](../docs/USER_GUIDE.md)

---

## 🚀 Quick Start (Backend)

You can run the backend using either **`uv`** (fast, modern) or standard **Python `venv` + `pip`**.

### Option A: Using `uv` (Recommended)

```bash
# 1. Create virtual environment
uv venv

# 2. Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# 3. Install dependencies
uv pip install -r requirements.txt

# 4. Start development server
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Option B: Using Standard Python `venv`

```bash
# 1. Create and activate virtual environment
python -m venv .venv

# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start development server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive OpenAPI documentation (Swagger) is available at:
`http://localhost:8000/docs`

---

## 🧪 Running Automated Tests with `uv`

The backend includes a comprehensive unit test suite covering safety clearance, pedestrian crosswalk deceleration, TraCI adapters, and core state models.

```bash
# Run all tests using uv
# On Windows (PowerShell):
$env:PYTHONPATH="backend"
uv run python -m unittest discover -s tests

# On Linux/macOS:
PYTHONPATH=backend uv run python -m unittest discover -s tests
```

### Testing Specific Modules

```bash
# Pedestrian crossing stopping, deceleration & auto-resumption:
uv run python -m unittest tests/test_pedestrian_crossing_stop.py

# FSM safety intervals, 3s yellow, 1s all-red clearance:
uv run python -m unittest tests/test_baseline.py

# SUMO 20-link traffic light state translations:
uv run python -m unittest tests/test_sumo_traffic_adapter.py

# Core state container & telemetry serialization:
uv run python -m unittest tests/test_core_state.py
```

---

## 🏛️ Directory Layout

- **`api/routes/`**: REST API endpoints for video streams, controller modes, priority preemption, Eclipse SUMO simulation, and Arduino serial management.
- **`services/`**:
  - `vision_service.py`: YOLOv8 inference, multi-class classification, spatial ROI counting.
  - `decision_service.py`: 2 Hz adaptive optimization loop with dynamic green extension and anti-starvation logic.
  - `broadcast_service.py`: ~3.3 Hz WebSocket push stream to frontend clients.
- **`controller/`**:
  - `safety_manager.py`: FSM enforcing safety clearance intervals, minimum/maximum green bounds, and pedestrian locks.
  - `serial_manager.py`: Asynchronous background serial worker for Arduino USB communication.
- **`simulation/sumo/`**:
  - `manager.py`: Closed-loop TraCI simulation manager with synchronous stepping and auto-preemption.
  - `traffic_adapter.py`: Translates FSM signal states into 20-link SUMO traffic light states.
  - `scenario/`: 4-way intersection network, traffic demand routes, and viewsettings.
- **`traffic/`**:
  - `decision_engine.py`: Dynamic queue demand scoring and anti-starvation logic.
  - `state_estimator.py`: Approach queue accumulation and vehicle categorization.
