# System Architecture & Technical Design

The **AI Traffic Management Platform** is designed to be simple, reliable, and modular. It manages a 4-way intersection by combining real-time camera vision, traffic simulation, an authoritative safety controller, and physical LED hardware.

---

## 1. High-Level System Architecture

Both the camera and the simulation count vehicles in real time. These vehicle counts are sent to the AI Decision Engine to calculate the smartest green light timings.

```mermaid
flowchart TD
    subgraph INGESTION ["Step 1: Input Sources (Vehicle Counting & Detection)"]
        direction TB
        CAM["Live Camera Stream or Uploaded Video"] --> YOLO["YOLOv8 Computer Vision\n• Detects cars, buses, trucks, motorcycles, bicycles\n• Identifies emergency ambulances"]
        YOLO --> ROI["Camera Approach Counter\n• Counts vehicles waiting in North, South, East, West\n• Measures waiting times"]
        
        SUMO["Eclipse SUMO Traffic Simulation\n• Real-world microscopic traffic engine\n• Spawns virtual traffic & ambulances"] --> TRACI["TraCI Simulation Sensor Adapter\n• Counts every simulated vehicle per road\n• Measures exact queue lengths & waiting times\n• Ingests simulated emergency vehicles"]
    end

    subgraph CORE ["Step 2: AI Brain & Safety Interlock (FastAPI Backend)"]
        direction TB
        EST["Traffic State Estimator\n• Collects live vehicle counts from Camera or SUMO\n• Calculates total queue pressure per road"]
        
        DEC["AI Decision Engine\n• Gives more green time to roads with more vehicles\n• Anti-Starvation: Guarantees green time to waiting roads\n• Instantly prioritizes emergency ambulances\n• Activates on-demand pedestrian crossing locks"]
        
        SAFE["Safety Manager (Hardware Interlock)\n• Rule 1: Conflicting greens are mathematically impossible\n• Rule 2: Always gives 3 seconds Yellow warning\n• Rule 3: Always gives 1 second All-Red Clearance\n• Rule 4: Holds 10 seconds Red when pedestrian requests"]
        
        ROI -->|"Live real-world vehicle counts"| EST
        TRACI -->|"Live simulated vehicle counts"| EST
        EST --> DEC
        DEC --> SAFE
    end

    subgraph ACTUATION ["Step 3: Outputs & Controls"]
        direction TB
        SAFE --> SIM_ADAPT["SUMO Traffic Adapter\n• Controls 20 traffic light links in simulation\n• Controls 4 pedestrian walk signals"]
        SAFE --> SERIAL["Serial Manager\n• Sends JSON packets to Arduino USB"]
        SAFE --> WS["WebSocket Broadcaster\n• Pushes real-time data to dashboard (3.3 Hz)"]
        
        SIM_ADAPT --> SUMO_NET["SUMO Simulated Vehicles & Pedestrian Signals"]
        SERIAL --> ARDUINO["Arduino Nano 33 BLE\n• Lights up 12 physical LEDs\n• Built-in 6-second safety watchdog"]
        WS --> UI["Web Dashboard (React + TypeScript)\n• Live camera & simulation monitor\n• 4-way traffic lights with countdown timers\n• Emergency & pedestrian control buttons"]
    end

    classDef coreStyle fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef ingestStyle fill:#0f172a,stroke:#34d399,stroke-width:2px,color:#f8fafc;
    classDef actStyle fill:#0f172a,stroke:#fbbf24,stroke-width:2px,color:#f8fafc;

    class CAM,YOLO,ROI,SUMO,TRACI ingestStyle;
    class EST,DEC,SAFE coreStyle;
    class SIM_ADAPT,SERIAL,WS,SUMO_NET,ARDUINO,UI actStyle;
```

---

## 2. Finite State Machine (FSM) Safety Interlock

The traffic light state machine is strictly controlled by [`SafetyManager`](../backend/controller/safety_manager.py). Green lights for conflicting roads can never happen at the same time. The signals always move through a mandatory yellow and all-red clearance interval before switching.

```mermaid
flowchart TD
    START([System Startup]) --> PHASE_A

    subgraph PHASE_A ["PHASE A: North & South Moving"]
        direction TB
        A1["North & South: GREEN (Proceed)"]
        A2["East & West: RED (Stopped)"]
        A3["Pedestrian Crossings: RED (Don't Walk)"]
    end

    subgraph YELLOW_TRANS ["YELLOW WARNING (3.0 Seconds)"]
        direction TB
        Y1["Moving Approaches: YELLOW (Prepare to stop)"]
        Y2["Non-moving Approaches: RED (Remain stopped)"]
    end

    subgraph CLEARANCE ["ALL-RED CLEARANCE (1.0 Second)"]
        direction TB
        C1["ALL 4 Approaches: RED (Intersection box clears)"]
    end

    subgraph PHASE_B ["PHASE B: East & West Moving"]
        direction TB
        B1["East & West: GREEN (Proceed)"]
        B2["North & South: RED (Stopped)"]
        B3["Pedestrian Crossings: RED (Don't Walk)"]
    end

    subgraph PED_LOCK ["PEDESTRIAN CROSSING (10.0 Seconds)"]
        direction TB
        P1["Requested Road: RED (Vehicles stop ~2m before zebra line)"]
        P2["Pedestrian Walk Signal: GREEN (Walk)"]
    end

    subgraph AMB_LOCK ["AMBULANCE PREEMPTION"]
        direction TB
        E1["Ambulance Road: LOCKED ON GREEN"]
        E2["Conflicting Roads: LOCKED ON RED"]
        E3["Holds until ambulance passes intersection"]
    end

    PHASE_A -->|"Normal Timer Expired or Demand on B"| YELLOW_TRANS
    YELLOW_TRANS -->|"3 seconds done"| CLEARANCE
    CLEARANCE -->|"1 second done"| PHASE_B

    PHASE_B -->|"Normal Timer Expired or Demand on A"| YELLOW_TRANS
    YELLOW_TRANS -->|"3 seconds done"| CLEARANCE
    CLEARANCE -->|"1 second done"| PHASE_A

    PHASE_A -->|"Pedestrian Button Clicked (North or South)"| PED_LOCK
    PHASE_B -->|"Pedestrian Button Clicked (East or West)"| PED_LOCK
    PED_LOCK -->|"10 seconds done (Auto-Resume)"| YELLOW_TRANS

    PHASE_A -->|"Ambulance Detected on East or West"| AMB_LOCK
    PHASE_B -->|"Ambulance Detected on North or South"| AMB_LOCK
    AMB_LOCK -->|"Ambulance leaves intersection"| CLEARANCE
```

---

## 3. How Simulation Works (TraCI Closed-Loop Sequence)

In simulation mode, the system communicates with Eclipse SUMO every 100 milliseconds (10 times per second):

```mermaid
sequenceDiagram
    autonumber
    participant UI as Web Dashboard
    participant Backend as FastAPI Server
    participant Safety as Safety Manager
    participant SUMO as Eclipse SUMO Engine

    UI->>Backend: User clicks "Start Simulation"
    Backend->>SUMO: Launch intersection scenario via TraCI

    loop Every 100ms (10 times per second)
        Backend->>SUMO: Advance simulation by 0.1s
        SUMO-->>Backend: Return vehicle positions, counts, and speeds
        Note over Backend: Count vehicles and queues on North, South, East, West
        Backend->>Safety: Calculate demand scores & update light states
        Safety-->>SUMO: Apply 20-link traffic light states (Green, Yellow, Red)
        
        alt Pedestrian Button Clicked
            Backend->>SUMO: Command approaching cars to stop ~2m before zebra line
            Note over SUMO: Cars smoothly slow down and stop at 175.5m
        end

        Backend-->>UI: Send live telemetry snapshot over WebSocket
    end

    alt Pedestrian 10s Timer Finishes
        Backend->>SUMO: Release stopped vehicles (setSpeed -1.0)
        Note over SUMO: Cars automatically resume normal speed limit
    end
```

---

## 4. Hardware Communication & Failsafe Watchdog

The backend communicates with the physical Arduino controller over a USB serial connection at 9600 baud:

```mermaid
sequenceDiagram
    autonumber
    participant Backend as AI Traffic Controller
    participant Serial as Serial Worker Thread
    participant Arduino as Arduino Nano 33 BLE
    participant LEDs as 12 Physical LEDs

    Backend->>Serial: New signal state or timer tick
    Serial->>Arduino: Send JSON line: {"phase":"A", "dur":15, "n":"G", "s":"G", "e":"R", "w":"R"}
    Arduino->>Arduino: Reset 6-second watchdog timer
    Arduino->>LEDs: Update digital pins for 12 LEDs (Red, Yellow, Green)

    alt Host Computer Disconnects (> 6 seconds)
        Note over Arduino: Watchdog Timer Expires!
        Arduino->>LEDs: Enter Failsafe Mode (All Yellow LEDs blink at 1 Hz)
    end
```

---

## 5. 20-Link Traffic Light Mapping for the 4-Way Intersection

The intersection traffic light controller (`center`) coordinates 20 distinct links:

- **Links 0 to 3:** North incoming vehicles (Left turn, Straight lanes, Right turn)
- **Links 4 to 7:** East incoming vehicles (Left turn, Straight lanes, Right turn)
- **Links 8 to 11:** South incoming vehicles (Left turn, Straight lanes, Right turn)
- **Links 12 to 15:** West incoming vehicles (Left turn, Straight lanes, Right turn)
- **Link 16:** North pedestrian zebra crossing (`:center_c0`)
- **Link 17:** East pedestrian zebra crossing (`:center_c1`)
- **Link 18:** South pedestrian zebra crossing (`:center_c2`)
- **Link 19:** West pedestrian zebra crossing (`:center_c3`)


---

## 6. Automated Simulation Evaluation Architecture (A/B Benchmark)

The evaluation system uses an automated dual-phase pipeline to generate quantifiable, non-destructive performance comparisons:

```mermaid
flowchart TD
    START["User clicks 'Evaluate'"] --> PREP["Phase 1: Validation & Session Init\n- Validate SUMO & scenario files\n- Generate evaluation_XXX session folder\n- Lock seed (42), route demand, and network"]
    
    PREP --> RUN_MANUAL["Phase 2: Manual Mode Simulation\n- Launch SUMO-GUI with programID=0\n- Predefined fixed-time phase switching\n- Output statistics.xml, tripinfo.xml, summary.xml"]
    
    RUN_MANUAL --> RUN_ADAPTIVE["Phase 3: Adaptive AI Simulation\n- Launch SUMO-GUI with identical demand & seed\n- AI Decision Engine + Safety Manager active\n- Output statistics.xml, tripinfo.xml, summary.xml"]
    
    RUN_ADAPTIVE --> PROCESS["Phase 4: XML Parsing & Analytics Processing\n- Parse trip duration, waiting time, speed, queue lengths\n- Calculate diffs and % improvement\n- Generate 6 Recharts datasets + narrative verdict\n- Save evaluations/evaluation_XXX/results.json"]
    
    PROCESS --> NAV["Phase 5: Auto-Navigation to Web Dashboard\n- Redirect to /evaluation/:evaluationId\n- Display KPI cards, comparative tables, and Recharts graphs"]
```

### Key Analytical Guarantees:
1. **Deterministic Traffic Demand:** Both simulations use identical random seeds (`42`), vehicle routes (`intersection.rou.xml`), and network topology (`intersection.net.xml`), ensuring fair and mathematically sound comparison.
2. **Scientific Metric Tracking:** Never substitutes zeroes for missing metrics without explicit flags; extracts raw completed trip files directly from SUMO engine outputs.
3. **Non-Destructive Persistence:** Historical runs are archived sequentially (`evaluation_001`, `evaluation_002`, ...) without overwriting past data.
