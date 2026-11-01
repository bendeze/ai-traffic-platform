# AI Traffic Management Platform — Backend Engine

FastAPI backend service powering the **AI Traffic Management Platform**.

For full project documentation, architecture diagrams, and hardware guides, please refer to the main [Root README](../README.md).

---

## 🚀 Quick Start (Backend)

```bash
# 1. Activate virtual environment
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# 2. Install requirements
pip install -r requirements.txt

# 3. Start development server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation (Swagger) is available at:
`http://localhost:8000/docs`

---

## 🏛️ Architecture Overview

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
  - `scenario/`: 4-way intersection network, traffic demand routes, and viewsettings.

