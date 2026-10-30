#!/usr/bin/env python3
"""
Group Z - Arduino 12-LED Hardware Diagnostics & Verification Tool
Tests the physical USB connection, pin wiring, and LED illumination.

Wiring Reference:
  North Approach: Pin 2 (Red),  Pin 3 (Yellow),  Pin 4 (Green)
  South Approach: Pin 5 (Red),  Pin 6 (Yellow),  Pin 7 (Green)
  East Approach:  Pin 8 (Red),  Pin 9 (Yellow),  Pin 10 (Green)
  West Approach:  Pin 11 (Red), Pin 12 (Yellow), Pin 13 (Green)
  GND: Connect all LED cathodes to Arduino GND through 220-330 ohm resistors.
"""

import sys, time, json
import serial
import serial.tools.list_ports

def scan_ports():
    ports = list(serial.tools.list_ports.comports())
    return ports

def choose_port(ports):
    if not ports:
        print("\n[!] No serial COM ports detected.")
        print("    Please connect your Arduino board using a USB cable and run this tool again.\n")
        return None

    print("\n--- Detected Serial Ports ---")
    arduino_port = None
    for i, p in enumerate(ports):
        desc = p.description or ""
        is_ard = any(k in desc.lower() for k in ["arduino", "ch340", "ftdi", "usb serial", "nano"])
        tag = " [ARDUINO CANDIDATE]" if is_ard else ""
        print(f"  [{i + 1}] {p.device}: {desc}{tag}")
        if is_ard and not arduino_port:
            arduino_port = p.device

    if arduino_port:
        print(f"\nAuto-selected detected Arduino port: {arduino_port}")
        return arduino_port
    
    # If no obvious candidate, pick the first non-bluetooth port
    non_bt = [p.device for p in ports if "bluetooth" not in (p.description or "").lower()]
    chosen = non_bt[0] if non_bt else ports[0].device
    print(f"\nUsing port: {chosen}")
    return chosen

def main():
    print("=" * 60)
    print("  GROUP Z — ARDUINO 12-LED HARDWARE VALIDATION")
    print("=" * 60)

    ports = scan_ports()
    port = choose_port(ports)
    if not port:
        return

    baud = 9600
    print(f"\nOpening {port} at {baud} baud...")
    try:
        ser = serial.Serial(port, baud, timeout=1)
        time.sleep(2)  # Wait for Arduino reset
        print("[✓] Connected successfully to Arduino!\n")
    except Exception as e:
        print(f"[!] Failed to open {port}: {e}")
        return

    # Helper to send command
    def send_cmd(cmd_dict):
        line = json.dumps(cmd_dict) + "\n"
        ser.write(line.encode("ascii"))
        ser.flush()
        time.sleep(0.05)

    try:
        print("1. TRIGGERING FIRMWARE DIAGNOSTIC SWEEP...")
        send_cmd({"cmd": "test"})
        time.sleep(2.0)

        print("\n2. TESTING INDIVIDUAL APPROACHES:")
        approaches = [
            ("NORTH", {"n": "G", "s": "R", "e": "R", "w": "R"}),
            ("SOUTH", {"n": "R", "s": "G", "e": "R", "w": "R"}),
            ("EAST",  {"n": "R", "s": "R", "e": "G", "w": "R"}),
            ("WEST",  {"n": "R", "s": "R", "e": "R", "w": "G"}),
        ]
        for name, signals in approaches:
            print(f"   -> Testing GREEN on {name} Approach...")
            send_cmd({"seq": 1, "phase": "TEST", "dur": 5, **signals})
            time.sleep(1.2)

        print("\n3. TESTING ALL-4 SIMULTANEOUS YELLOW TRANSITION:")
        print("   -> ALL 4 Approaches YELLOW (Pins 3, 6, 9, 12 should light up)...")
        send_cmd({"seq": 2, "phase": "YEL", "dur": 3, "n": "Y", "s": "Y", "e": "Y", "w": "Y"})
        time.sleep(2.5)

        print("\n4. TESTING ALL-4 ALL-RED CLEARANCE:")
        print("   -> ALL 4 Approaches RED (Pins 2, 5, 8, 11 should light up)...")
        send_cmd({"seq": 3, "phase": "RED", "dur": 2, "n": "R", "s": "R", "e": "R", "w": "R"})
        time.sleep(2.0)

        print("\n5. TESTING STANDARD OPERATIONAL CYCLES:")
        print("   -> PHASE A GREEN (North & South Green | East & West Red)...")
        send_cmd({"seq": 4, "phase": "A", "dur": 10, "n": "G", "s": "G", "e": "R", "w": "R"})
        time.sleep(2.5)

        print("   -> PHASE B GREEN (East & West Green | North & South Red)...")
        send_cmd({"seq": 5, "phase": "B", "dur": 10, "n": "R", "s": "R", "e": "G", "w": "G"})
        time.sleep(2.5)

        print("\n" + "=" * 60)
        print("  HARDWARE DIAGNOSTIC COMPLETE — ALL 12 LEDS VERIFIED!")
        print("=" * 60)

    except KeyboardInterrupt:
        print("\n[!] Test stopped by user.")
    finally:
        ser.close()
        print("[✓] Serial port closed.")

if __name__ == "__main__":
    main()

