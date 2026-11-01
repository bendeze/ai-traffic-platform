# AI Traffic Management Platform

<div align="center">

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.x-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Eclipse SUMO](https://img.shields.io/badge/Eclipse_SUMO-1.20+-blue.svg)](https://eclipse.dev/sumo/)
[![YOLOv8](https://img.shields.io/badge/Ultralytics-YOLOv8-FF5722.svg)](https://github.com/ultralytics/ultralytics)
[![Arduino](https://img.shields.io/badge/Arduino-Nano_33_BLE-00979D.svg?logo=arduino&logoColor=white)](https://www.arduino.cc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**An intelligent, multi-modal adaptive traffic signal control system combining real-time computer vision, closed-loop microscopic simulation, emergency vehicle preemption, and physical hardware actuation.**

*Developed as part of the **Carnegie Mellon University - Bridge Program** by **Group 5**.*

</div>

---

## 📸 Visual Showcase

### 1. Eclipse SUMO Microscopic Simulation Network
High-fidelity 4-way intersection topology modeled in Eclipse SUMO with multi-lane approaches, dedicated turn bays, pedestrian crossings, and vehicle routing.

<div align="center">
  <img src="docs/images/sumo_intersection.png" alt="Eclipse SUMO 4-Way Intersection Network" width="85%" />
</div>

---

### 2. Live Dashboard in SUMO Simulation Mode
Real-time TraCI closed-loop synchronization at 10 Hz with approach queue telemetry, waiting times, dynamic phase scheduling, and interactive docking viewport.

<div align="center">
  <img src="docs/images/system_sumo_simulation.png" alt="AI Traffic Management Platform — SUMO Simulation Mode" width="100%" />
</div>

---

### 3. Live Dashboard with Video Upload & YOLOv8 Perception
Overhead camera footage processed with YOLOv8 object detection, multi-class vehicle classification, approach polygon ROI spatial zoning, and anti-starvation wait-time metrics.

<div align="center">
  <img src="docs/images/system_video_uploaded.png" alt="AI Traffic Management Platform — Video Upload & Detection" width="100%" />
</div>

---

### 4. Multi-Approach Telemetry & Emergency Vehicle Preemption
Approach telemetry showing live vehicle counters, classification breakdown (Cars, Buses, Trucks, Motorcycles, Bicycles, Ambulances), signal states, and pedestrian demand triggers.

<div align="center">
  <img src="docs/images/approach_telemetry.png" alt="Approach Telemetry and Vehicle Classification Cards" width="85%" />
</div>

---

### 5. Physical Arduino Hardware Breadboard Actuation
Physical breadboard setup with 12 external LEDs (Red, Yellow, Green for North, South, East, West) synchronized in real-time with the AI controller.

<div align="center">
  <img src="docs/images/hardware_breadboard.jpg" alt="Physical Arduino 12-LED Hardware Actuation" width="85%" />
</div>

---

## 🚀 Key Features

- **Multi-Modal Perception Engine:**
  - **YOLOv8 Vision**: Real-time object detection and classification for cars, trucks, buses, motorcycles, bicycles, and emergency vehicles.
  - **Overhead Video & Camera Streams**: Supports live webcams, recorded footage upload (`.mp4`), and snapshot-sampling modes.
  - **Polygon ROI Spatial Tracking**: Calibrated bounding zones per approach (North, South, East, West) with sub-second occupancy and queue estimation.

- **Closed-Loop Microscopic Simulation (Eclipse SUMO):**
  - **TraCI Integration**: Bidirectional synchronous simulation step loop (10 Hz).
  - **Dynamic Emergency Preemption**: Auto-detects ambulances, overrides standard cycle to clear conflicting traffic, and automatically resumes normal flow once cleared.
  - **Pedestrian Safety Phase**: 10-second synchronized pedestrian crosswalk lock with all-red vehicular clearance.
  - **Instant Reset**: Hot in-process simulation reset via `traci.load` without restarting the engine.

- **Adaptive Traffic Optimization & Safety Manager:**
  - **Dual-Phase Actuation**: Phase A (North & South) and Phase B (East & West).
  - **Anti-Starvation Fair Caps**: Upper-bound wait time limits prevent lower-volume approaches from experiencing starvation.
  - **Dynamic Green Extension**: Adjusts green time based on real-time vehicle density and queue pressure.

- **Cross-Platform Physical Hardware Actuation:**
  - **Arduino Nano 33 BLE / Uno / Nano**: Controls 12 physical LEDs representing 4 intersection approaches.
  - **Zero-Config Auto-Detect**: Dynamically queries the host OS (`serial.tools.list_ports`) on Windows (`COM*`), Linux (`/dev/tty*`), and macOS (`/dev/cu.*`).
  - **Watchdog Failsafe**: Microcontroller automatically triggers yellow-blinking fail-safe if the software host loses connection for >6 seconds.

- **Modern Minimalist UI (React + TypeScript):**
  - **High-Contrast Design**: High-contrast Dark and Light themes with animated Radix UI toggles.
  - **Accessible shadcn/ui Primitives**: Accessible dropdowns for serial ports, environment toggles, and modal controls.
  - **Real-Time Telemetry**: Sub-second WebSocket telemetry pushes data at ~3.3 Hz.

---

## 🏗️ System Architecture

```
┌─────────────────────────┐       ┌────────────────────────┐
│  Physical Camera / Video │       │  Eclipse SUMO Engine   │
│  Upload (YOLOv8 Vision)  │       │  (TraCI Microscopic)   │
└───────────┬─────────────┘       └───────────┬────────────┘
            │                                 │
            ▼                                 ▼
    [Perception Layer]               [Simulation Adapter]
   (Vehicles, Queues,               (Vehicles, Speeds,
    Emergency Detection)             Emergency Preemption)
            │                                 │
            └────────────────┬────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │   Adaptive Decision Engine  │
              │  - Demand-responsive timing │
              │  - Anti-starvation caps     │
              │  - Emergency preemption     │
              │  - Pedestrian hold phases   │
              └──────────────┬──────────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
            ▼                                 ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│   FastAPI WebSocket Stream    │ │   Hardware Serial Manager     │
│  - Real-time React Dashboard  │ │  - Arduino Nano 33 BLE        │
│  - Dark/Light Theme Telemetry │ │  - 12-LED Physical Breadboard │
└───────────────────────────────┘ └───────────────────────────────┘
```

---

## 📁 Repository Structure

```
ai-traffic-platform/
├── backend/
│   ├── api/
│   │   ├── routes/             # REST endpoints (video, simulation, controller, serial)
│   │   └── dependencies.py     # FastAPI application state injection
│   ├── config/                 # Pydantic & dataclass system settings (.env support)
│   ├── controller/             # Safety manager, signal FSM, and serial manager
│   ├── core/                   # Shared application state singleton & models
│   ├── services/               # Vision service, decision loop, telemetry broadcaster
│   ├── simulation/sumo/        # Eclipse SUMO scenario, TraCI manager, and metrics
│   ├── traffic/                # Estimation, queue calculation, and timing engine
│   ├── vision/                 # YOLOv8 inference, ROI spatial tracker, camera pipeline
│   ├── main.py                 # FastAPI application entry point
│   └── requirements.txt        # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios API client wrapper
│   │   ├── components/         # Modular React UI components (Header, Grid, Monitor)
│   │   ├── components/ui/      # shadcn/ui accessible primitives (Select, DropdownMenu)
│   │   ├── context/            # ThemeContext (Dark / Light mode provider)
│   │   ├── hooks/              # WebSocket telemetry subscription hook
│   │   ├── types/              # Comprehensive TypeScript interfaces
│   │   ├── App.tsx             # Main dashboard view
│   │   └── index.css           # Tailwind CSS styling and theme tokens
│   └── package.json            # Node.js dependencies & scripts
├── firmware/
│   └── arduino/traffic_signal/ # Arduino C++ sketch for 12-LED hardware controller
├── docs/
│   ├── HARDWARE.md             # Pin mapping, wiring diagrams, and serial protocol
│   └── images/                 # Architecture, simulation, and UI screenshots
├── CONTRIBUTING.md              # Open source contribution guidelines
├── LICENSE                      # MIT Open Source License
└── README.md                   # Project documentation
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**
- **Eclipse SUMO 1.20+** (ensure `SUMO_HOME` environment variable is set)
- *(Optional)* **Arduino IDE** (for physical 12-LED breadboard actuation)

---

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/bendeze/ai-traffic-platform.git
cd ai-traffic-platform/backend

# Create and activate Python virtual environment
python -m venv .venv

# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API and Swagger docs will be live at `http://localhost:8000/docs`.

---

### 3. Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open `http://localhost:3000` in your browser.

---

### 4. Hardware Actuation (Optional)
1. Open [`firmware/arduino/traffic_signal/traffic_signal.ino`](firmware/arduino/traffic_signal/traffic_signal.ino) in Arduino IDE.
2. Select your board (**Arduino Nano 33 BLE**, **Nano**, or **Uno**) and upload the sketch.
3. Plug the board into USB.
4. On the web dashboard, the serial dropdown will automatically detect your Arduino with `⚡ AUTO-DETECT`. Click **CONNECT** or **TEST LEDS** to trigger a hardware diagnostic sweep!
5. For full circuit schematics, see [docs/HARDWARE.md](docs/HARDWARE.md).

---

## API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/telemetry` | Current state snapshot (signals, queues, simulation, hardware) |
| `POST` | `/controller/mode/{mode}` | Switch between `adaptive` and `manual` modes |
| `POST` | `/priority/pedestrian/{app}` | Trigger 10s pedestrian hold phase for an approach |
| `POST` | `/priority/ambulance/{app}` | Dispatch emergency vehicle preemption |
| `POST` | `/simulation/start` | Launch Eclipse SUMO microscopic simulation |
| `POST` | `/simulation/reset` | Instant in-process reset of the SUMO intersection |
| `GET` | `/serial/ports` | Query OS for connected USB/Serial microcontrollers |
| `POST` | `/serial/connect` | Connect to specified port or auto-detect Arduino |
| `POST` | `/serial/test` | Trigger 12-LED diagnostic hardware test sweep |
| `WS` | `/ws/telemetry` | Real-time bi-directional telemetry broadcast socket |

---

## Contributing

Contributions, feedback, and pull requests are warmly welcomed! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on code style, branch naming, and pull request procedures.

---

## License & Attribution

This project is open-source software licensed under the **[MIT License](LICENSE)**.

Developed by **Group 5** for the **Carnegie Mellon University - Bridge Program**.
Copyright &copy; 2026 Group 5 · CMU - Bridge Program Project.
