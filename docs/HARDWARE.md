# Hardware Integration & Circuit Reference

The **AI Traffic Management Platform** features direct physical actuation through an **Arduino Nano 33 BLE** (or standard Arduino Nano / Uno). The controller drives 12 external LEDs across a 4-way intersection (3 LEDs per approach: Red, Yellow, Green) using non-blocking serial communication and hardware failsafe watchdogs.

---

## Circuit Interconnect Architecture

```mermaid
flowchart TD
    HOST["Host PC (FastAPI Backend)"] -->|USB Serial @ 9600 baud\nJSON Commands| MCU["Arduino Nano 33 BLE / Uno"]
    
    subgraph PINS ["Microcontroller GPIO Outputs"]
        direction TB
        N_GRP["North Approach:\n• Red: Pin A5\n• Yellow: Pin A6\n• Green: Pin A7"]
        S_GRP["South Approach:\n• Red: Pin 5\n• Yellow: Pin 6\n• Green: Pin 7"]
        E_GRP["East Approach:\n• Red: Pin 8\n• Yellow: Pin 9\n• Green: Pin 10"]
        W_GRP["West Approach:\n• Red: Pin 11\n• Yellow: Pin 12\n• Green: Pin A4"]
    end
    
    MCU --> N_GRP
    MCU --> S_GRP
    MCU --> E_GRP
    MCU --> W_GRP
    
    N_GRP --> RES["220Ω - 330Ω Current-Limiting Resistors"]
    S_GRP --> RES
    E_GRP --> RES
    W_GRP --> RES
    
    RES --> LEDS["12 External LEDs on Breadboard"]
    LEDS --> GND["Common Ground (GND)"]
```

---

## Pinout & Wiring Specifications

| Approach | Signal Color | Microcontroller Pin | Resistor | Function |
| :--- | :--- | :--- | :--- | :--- |
| **North** | **RED** | `Pin A5` | 220Ω – 330Ω | North stop indication |
| **North** | **YELLOW** | `Pin A6` | 220Ω – 330Ω | North transition warning |
| **North** | **GREEN** | `Pin A7` | 220Ω – 330Ω | North proceed indication |
| **South** | **RED** | `Pin 5` | 220Ω – 330Ω | South stop indication |
| **South** | **YELLOW** | `Pin 6` | 220Ω – 330Ω | South transition warning |
| **South** | **GREEN** | `Pin 7` | 220Ω – 330Ω | South proceed indication |
| **East** | **RED** | `Pin 8` | 220Ω – 330Ω | East stop indication |
| **East** | **YELLOW** | `Pin 9` | 220Ω – 330Ω | East transition warning |
| **East** | **GREEN** | `Pin 10` | 220Ω – 330Ω | East proceed indication |
| **West** | **RED** | `Pin 11` | 220Ω – 330Ω | West stop indication |
| **West** | **YELLOW** | `Pin 12` | 220Ω – 330Ω | West transition warning |
| **West** | **GREEN** | `Pin A4` | 220Ω – 330Ω | West proceed indication |

> **Wiring Note:** Anode (+) connects to the specified pin. Cathode (-) connects through a 220Ω–330Ω current-limiting resistor to common `GND`.

---

## Serial Communication Protocol

Baud rate: **`9600 baud`**, 8-N-1. Data is sent as single-line JSON terminating with `\n`.

### 1. Frame-Accurate Direct State Sync
Dispatched every time a phase changes or a countdown state updates:
```json
{"seq": 142, "phase": "A", "dur": 15, "n": "G", "s": "G", "e": "R", "w": "R"}
```
- `n`, `s`, `e`, `w`: `'G'` (Green), `'Y'` (Yellow), `'R'` (Red).
- Non-blocking: dispatched via dedicated background Python worker thread.

### 2. Hardware Self-Test Diagnostic Sweep
Initiates sequential 12-LED diagnostic hardware test across all approaches:
```json
{"cmd": "test"}
```

### 3. Failsafe Watchdog
If the Arduino loses connection with the backend for more than **6.0 seconds**, it automatically transitions into **`FAIL_SAFE`** mode (flashing all yellow signals at 1 Hz) to prevent intersection gridlock.

```mermaid
stateDiagram-v2
    [*] --> Standby: Power On
    Standby --> Normal_Actuation: Receives valid JSON frame from Host
    Normal_Actuation --> Normal_Actuation: Heartbeat frame reset watchdog (< 6s)
    Normal_Actuation --> Failsafe_Mode: No packet received for > 6.0 seconds
    Failsafe_Mode --> Normal_Actuation: Host reconnects and resumes packets
    
    state Failsafe_Mode {
        Yellow_Blink: All 4 Yellow LEDs flash synchronously at 1 Hz
    }
```

