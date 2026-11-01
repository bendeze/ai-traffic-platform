# System Architecture & Technical Design

The **AI Traffic Management Platform** is engineered as a robust, low-latency, modular distributed system designed for intersection control. It combines edge computer vision, microscopic simulation feedback, state-machine safety interlocks, and physical microcontroller actuation.

---

## High-Level System Architecture

```mermaid
flowchart TD
    subgraph INGESTION ["Perception & Simulation Sources"]
        direction TB
        CAM["Live Video Stream / MP4 Upload"] --> YOLO["YOLOv8 Perception Pipeline"]
        YOLO --> ROI["Spatial ROI Polygon Assigner\n(North, South, East, West)"]
        SUMO["Eclipse SUMO Simulation\n(Microscopic Traffic Engine)"] --> TRACI["TraCI Perception Adapter\n(10 Hz Sync Loop)"]
    end

    subgraph CORE ["Authoritative Core Controller (FastAPI Backend)"]
        direction TB
        EST["Traffic State Estimator\n- Queue length integration\n- Waiting time accumulation\n- Multi-class breakdown"]
        DEC["Adaptive Decision Engine\n- Vehicle demand scoring\n- Anti-starvation fair caps\n- Emergency vehicle priority\n- Actuated pedestrian logic"]
        SAFE["Safety Manager (FSM Hardware Interlock)\n- Invariant: Conflicting greens impossible\n- 4-way yellow transition (3s)\n- All-red clearance (1s)\n- Pedestrian 10s RED hold\n- Ambulance green extension"]
        
        ROI --> EST
        TRACI --> EST
        EST --> DEC
        DEC --> SAFE
    end

    subgraph ACTUATION ["Actuation & Output Targets"]
        direction TB
        SAFE --> SIM_ADAPT["SUMO Traffic Adapter\n(20-Link Verified Junction Map)"]
        SAFE --> SERIAL["Serial Manager\n(Non-blocking background thread)"]
        SAFE --> WS["WebSocket Telemetry Broadcaster\n(~3.3 Hz Push Stream)"]
        
        SIM_ADAPT --> SUMO_NET["SUMO Simulated Vehicles & Crossing Signals"]
        SERIAL --> ARDUINO["Arduino Nano 33 BLE\n(12 Physical LEDs + Watchdog)"]
        WS --> UI["React + TypeScript Web Dashboard\n(Real-Time Analytics & Controls)"]
    end

    classDef coreStyle fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef ingestStyle fill:#0f172a,stroke:#34d399,stroke-width:2px,color:#f8fafc;
    classDef actStyle fill:#0f172a,stroke:#fbbf24,stroke-width:2px,color:#f8fafc;

    class CAM,YOLO,ROI,SUMO,TRACI ingestStyle;
    class EST,DEC,SAFE coreStyle;
    class SIM_ADAPT,SERIAL,WS,SUMO_NET,ARDUINO,UI actStyle;
```

---

## 🛡️ Finite State Machine (FSM) Safety Interlock

The traffic signal lifecycle is strictly governed by [`SafetyManager`](../backend/controller/safety_manager.py). No transition between conflicting phases is ever permitted without traversing the mandatory clearance sequence.

```mermaid
stateDiagram-v2
    [*] --> Phase_A_Green: Initialization

    state Phase_A_Green {
        North_South: GREEN (Moving)
        East_West: RED (Waiting)
        Crossings: RED (Don't Walk)
    }

    state Phase_B_Green {
        East_West: GREEN (Moving)
        North_South: RED (Waiting)
        Crossings: RED (Don't Walk)
    }

    state Yellow_Transition {
        Standard: All 4 approaches YELLOW (3s)
        Pedestrian_Req: Active phase YELLOW (3s)
    }

    state All_Red_Clearance {
        All_Approaches: RED (1s)
        Intersection_Cleared: Vehicles vacate junction box
    }

    state Pedestrian_Lock {
        Requested_Road: LOCKED ON RED (10s)
        Conflicting_Phase: GREEN (or Clearance)
        Crosswalk: GREEN (Walk signal active)
        Vehicles: Halt ~2m before zebra crossing (175.5m)
    }

    state Emergency_Preemption {
        Ambulance_Approach: IMMEDIATE GREEN
        Other_Approaches: RED
        Crossings: RED
        Hold_Active: Stays green until ambulance clears road
    }

    Phase_A_Green --> Yellow_Transition: Timer expired or dynamic transition
    Yellow_Transition --> All_Red_Clearance: Yellow elapsed (3s)
    All_Red_Clearance --> Phase_B_Green: Clearance elapsed (1s)

    Phase_B_Green --> Yellow_Transition: Timer expired or dynamic transition
    Yellow_Transition --> All_Red_Clearance: Yellow elapsed (3s)
    All_Red_Clearance --> Phase_A_Green: Clearance elapsed (1s)

    Phase_A_Green --> Pedestrian_Lock: Pedestrian button clicked on North or South
    Phase_B_Green --> Pedestrian_Lock: Pedestrian button clicked on East or West
    Pedestrian_Lock --> Yellow_Transition: 10s timer expires (Auto-resumes traffic)

    Phase_A_Green --> Emergency_Preemption: Ambulance detected on East or West
    Phase_B_Green --> Emergency_Preemption: Ambulance detected on North or South
    Emergency_Preemption --> All_Red_Clearance: Ambulance clears junction
```

---

## 🔄 Closed-Loop SUMO Microscopic Simulation Sequence

In Simulation Mode, the backend interacts synchronously with Eclipse SUMO via the TraCI socket protocol:

```mermaid
sequenceDiagram
    autonumber
    participant UI as React Web Dashboard
    participant Backend as FastAPI Server
    participant Safety as SafetyManager (FSM)
    participant Manager as SUMOManager
    participant TraCI as TraCI Interface
    participant SUMO as Eclipse SUMO Engine

    UI->>Backend: POST /simulation/sumo/start
    Backend->>Manager: start_simulation(gui=False, speed=1.0)
    Manager->>TraCI: traci.start(sumoConfig, stepLength=0.1)
    TraCI->>SUMO: Spawn intersection scenario

    loop Every 100ms (10 Hz Step Loop)
        Manager->>TraCI: traci.simulationStep()
        SUMO-->>TraCI: Returns vehicle positions, speeds, queues
        Manager->>Backend: Ingest approach vehicle counts & ambulances
        Backend->>Safety: Evaluate demand & update FSM
        Safety-->>Manager: Authoritative approach signals
        Manager->>TraCI: traci.trafficlight.setRedYellowGreenState(20-link state)
        
        alt Pedestrian Button Clicked
            Manager->>TraCI: traci.vehicle.slowDown(vid, 0.0, 0.8) at stop_pos=175.5m
            Note over TraCI,SUMO: Vehicles decelerate & halt ~2m before zebra crossing
        end

        Manager->>Backend: Sample metrics & telemetry snapshot
        Backend-->>UI: WebSocket broadcast (telemetry JSON)
    end

    alt 10-Second Pedestrian Phase Finished
        Manager->>TraCI: traci.vehicle.setSpeed(vid, -1.0)
        Note over TraCI,SUMO: Stopped vehicles released to resume autonomous flow
    end
```

---

## ⚡ Hardware Microcontroller Serial Communication Loop

The backend communicates with the physical Arduino controller over an asynchronous non-blocking serial channel:

```mermaid
sequenceDiagram
    autonumber
    participant Engine as Decision Engine / FSM
    participant Worker as SerialManager Thread
    participant OS as OS Serial Port (COM / tty)
    participant Arduino as Arduino Nano 33 BLE
    participant LEDs as 12 Physical LEDs

    Engine->>Worker: send_signals(states, phase, duration)
    Note over Worker: Rate-limit and state-diff check
    Worker->>OS: Write JSON payload ("seq", "n", "s", "e", "w")\n
    OS->>Arduino: Serial.readStringUntil('\n')
    Arduino->>Arduino: Reset 6.0s watchdog timer
    Arduino->>LEDs: Update digitalWrite(HIGH / LOW) across 12 pins
    
    alt Software Host Disconnects (> 6.0 seconds)
        Note over Arduino: Watchdog Timer Expires!
        Arduino->>LEDs: Trigger FAIL_SAFE Mode (All Yellow Blinking @ 1 Hz)
    end
```

---

## 🚦 Verified 20-Link SUMO Junction Mapping

The intersection junction is mapped into 20 link indices for comprehensive vehicular and pedestrian control:

```mermaid
flowchart LR
    subgraph Junction_center ["20-Link Traffic Light Matrix ('center')"]
        direction TB
        V1["0..3: North Inflow (Lanes 1 & 2)"]
        V2["4..7: East Inflow (Lanes 1 & 2)"]
        V3["8..11: South Inflow (Lanes 1 & 2)"]
        V4["12..15: West Inflow (Lanes 1 & 2)"]
        P1["16: North Pedestrian Crossing (:center_c0)"]
        P2["17: East Pedestrian Crossing (:center_c1)"]
        P3["18: South Pedestrian Crossing (:center_c2)"]
        P4["19: West Pedestrian Crossing (:center_c3)"]
    end
```

