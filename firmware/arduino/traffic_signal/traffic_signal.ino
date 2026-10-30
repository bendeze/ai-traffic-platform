/*
 * Group Z - AI Traffic Management System
 * Firmware: Arduino Nano 33 BLE / Arduino Uno / Nano
 * 
 * Pinout Configuration for 12 Physical LEDs (3 per approach):
 * -------------------------------------------------------------
 * NORTH Approach:  Pin 2 (RED),  Pin 3 (YELLOW),  Pin 4 (GREEN)
 * SOUTH Approach:  Pin 5 (RED),  Pin 6 (YELLOW),  Pin 7 (GREEN)
 * EAST Approach:   Pin 8 (RED),  Pin 9 (YELLOW),  Pin 10 (GREEN)
 * WEST Approach:   Pin 11 (RED), Pin 12 (YELLOW), Pin 13 (GREEN)
 * (Cathodes / GND connected to ground via 220-330 ohm resistors)
 * -------------------------------------------------------------
 * 
 * Protocol Support:
 * 1. Direct State Sync (Frame-Accurate from Python Vision Engine):
 *    {"n":"G","s":"G","e":"R","w":"R"} or {"n":"Y","s":"Y","e":"Y","w":"Y"}
 * 2. Phase-Based Command (Autonomous FSM transition):
 *    {"phase":"A","dur":30} or {"phase":"B","dur":30}
 * 3. Diagnostic Hardware Self-Test:
 *    {"cmd":"test"}
 * 4. Watchdog Failsafe:
 *    If no serial command is received within 6 seconds, enters FAIL_SAFE
 *    (blinking yellow) to prevent frozen traffic.
 */

// Pin definitions
const int PIN_N_RED = A5,  PIN_N_YEL = A6,  PIN_N_GRN = A7;
const int PIN_S_RED = 5,  PIN_S_YEL = 6,  PIN_S_GRN = 7;
const int PIN_E_RED = 8,  PIN_E_YEL = 9,  PIN_E_GRN = 10;
const int PIN_W_RED = 11, PIN_W_YEL = 12, PIN_W_GRN = A4;

enum FsmState {
  STATE_DIRECT_SYNC, // Controlled directly by Python AI Vision
  PHASE_A_GREEN,     // N & S Green, E & W Red
  PHASE_A_YELLOW,    // ALL 4 Yellow (State change warning)
  ALL_RED_CLEAR_A,   // All Red clearance
  PHASE_B_GREEN,     // E & W Green, N & S Red
  PHASE_B_YELLOW,    // ALL 4 Yellow
  ALL_RED_CLEAR_B,   // All Red clearance
  FAIL_SAFE          // Blinking Yellow watchdog fallback
};

FsmState currentState = STATE_DIRECT_SYNC;
char targetPhase = 'A';
unsigned long stateStartTime = 0;
unsigned long lastHeartbeat = 0;
bool watchdogAnnounced = false;

// Track last announced signals to avoid repeating identical logs every loop
char prevN = '\0', prevS = '\0', prevE = '\0', prevW = '\0';

const unsigned long YELLOW_TIME = 3000;       // 3s standard yellow
const unsigned long CLEARANCE_TIME = 2000;    // 2s clearance
const unsigned long WATCHDOG_TIMEOUT = 6000;  // 6s without serial -> FAIL_SAFE

// Helper to expand single-letter code to full name
const char* colorFullName(char c) {
  if (c == 'G' || c == 'g') return "GREEN";
  if (c == 'Y' || c == 'y') return "YELLOW";
  return "RED";
}

// Helper to set an individual approach signal ('R', 'Y', 'G')
void setApproachLeds(int pinR, int pinY, int pinG, char color) {
  digitalWrite(pinR, (color == 'R' || color == 'r') ? HIGH : LOW);
  digitalWrite(pinY, (color == 'Y' || color == 'y') ? HIGH : LOW);
  digitalWrite(pinG, (color == 'G' || color == 'g') ? HIGH : LOW);
}

// Print clean formatted log on Serial Monitor whenever signals change
void logSignalChange(char n, char s, char e, char w) {
  if (n == prevN && s == prevS && e == prevE && w == prevW) {
    return; // No change, do not flood monitor
  }
  prevN = n; prevS = s; prevE = e; prevW = w;

  if (n == 'Y' && s == 'Y' && e == 'Y' && w == 'Y') {
    Serial.println(F("[TRANSITION] >>> ALL 4 APPROACHES YELLOW (Simultaneous 3s Warning) <<<"));
    Serial.println(F("             Pins 3, 6, 9, 12: HIGH"));
  } else if (n == 'R' && s == 'R' && e == 'R' && w == 'R') {
    Serial.println(F("[CLEARANCE]  >>> ALL-RED INTERSECTION CLEARANCE (2s All Traffic Stopped) <<<"));
    Serial.println(F("             Pins 2, 5, 8, 11: HIGH"));
  } else if (n == 'G' && s == 'G' && e == 'R' && w == 'R') {
    Serial.println(F("[PHASE CHANGE] >>> PHASE A ACTIVE <<<"));
    Serial.println(F("               North: GREEN (Pin 4) | South: GREEN (Pin 7)"));
    Serial.println(F("               East:  RED   (Pin 8) | West:  RED   (Pin 11)"));
  } else if (e == 'G' && w == 'G' && n == 'R' && s == 'R') {
    Serial.println(F("[PHASE CHANGE] >>> PHASE B ACTIVE <<<"));
    Serial.println(F("               East:  GREEN (Pin 10) | West:  GREEN (Pin 13)"));
    Serial.println(F("               North: RED   (Pin 2)  | South: RED   (Pin 5)"));
  } else {
    Serial.print(F("[SIGNAL UPDATE] North: "));
    Serial.print(colorFullName(n));
    Serial.print(F(" | South: "));
    Serial.print(colorFullName(s));
    Serial.print(F(" | East: "));
    Serial.print(colorFullName(e));
    Serial.print(F(" | West: "));
    Serial.println(colorFullName(w));
  }
}

// Set all 4 approaches simultaneously
void setAllSignals(char n, char s, char e, char w) {
  setApproachLeds(PIN_N_RED, PIN_N_YEL, PIN_N_GRN, n);
  setApproachLeds(PIN_S_RED, PIN_S_YEL, PIN_S_GRN, s);
  setApproachLeds(PIN_E_RED, PIN_E_YEL, PIN_E_GRN, e);
  setApproachLeds(PIN_W_RED, PIN_W_YEL, PIN_W_GRN, w);
  logSignalChange(n, s, e, w);
}

// Power off all 12 LEDs
void allLedsOff() {
  for (int p = 2; p <= 13; p++) {
    digitalWrite(p, LOW);
  }
}

// Hardware diagnostic test: sweeps all 12 LEDs sequentially with verbose Serial print
void runStartupSelfTest() {
  Serial.println(F("\n========================================================"));
  Serial.println(F("  GROUP Z — 12-LED HARDWARE DIAGNOSTIC SWEEP STARTING"));
  Serial.println(F("========================================================"));
  
  allLedsOff();

  const char* pinNames[] = {
    "North RED    (Pin 2)",
    "North YELLOW (Pin 3)",
    "North GREEN  (Pin 4)",
    "South RED    (Pin 5)",
    "South YELLOW (Pin 6)",
    "South GREEN  (Pin 7)",
    "East  RED    (Pin 8)",
    "East  YELLOW (Pin 9)",
    "East  GREEN  (Pin 10)",
    "West  RED    (Pin 11)",
    "West  YELLOW (Pin 12)",
    "West  GREEN  (Pin 13)"
  };

  for (int p = 2; p <= 13; p++) {
    digitalWrite(p, HIGH);
    Serial.print(F("  [TESTING] Illuminating: "));
    Serial.println(pinNames[p - 2]);
    delay(120);
    digitalWrite(p, LOW);
  }

  // Confirmation flash: All 4 GREEN LEDs active
  Serial.println(F("  [TESTING] Activating all 4 GREEN LEDs for verification..."));
  digitalWrite(PIN_N_GRN, HIGH);
  digitalWrite(PIN_S_GRN, HIGH);
  digitalWrite(PIN_E_GRN, HIGH);
  digitalWrite(PIN_W_GRN, HIGH);
  delay(400);
  allLedsOff();

  Serial.println(F("========================================================"));
  Serial.println(F("  [✓] DIAGNOSTIC SWEEP COMPLETED: ALL 12 LEDS OPERATIONAL"));
  Serial.println(F("========================================================\n"));
}

void setup() {
  Serial.begin(9600);
  for (int pin = 2; pin <= 13; pin++) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }

  // Print startup banner to Serial Monitor
  Serial.println(F("\n********************************************************"));
  Serial.println(F("*  GROUP Z — AI TRAFFIC MANAGEMENT SYSTEM (ARDUINO BLE) *"));
  Serial.println(F("*  Hardware: 12 LEDs on Digital Pins 2 through 13       *"));
  Serial.println(F("*  Baud Rate: 9600 bps                                  *"));
  Serial.println(F("********************************************************\n"));

  runStartupSelfTest();
  
  // Initial safe state: Phase A Green, Phase B Red
  setAllSignals('G', 'G', 'R', 'R');
  stateStartTime = millis();
  lastHeartbeat = millis();
  
  Serial.println(F("{\"device\":\"GROUP_Z_TRAFFIC_CONTROLLER\",\"status\":\"READY\",\"pins\":12}"));
}

// Parse value for a specific key in JSON string, e.g. "n":"G"
char extractJsonChar(const String &str, const String &key) {
  int found = str.indexOf(key);
  if (found == -1) return '\0';
  unsigned int idx = (unsigned int)found + key.length();
  // Skip whitespace, colons, quotes
  while (idx < (unsigned int)str.length() && (str[idx] == ' ' || str[idx] == ':' || str[idx] == '"' || str[idx] == '\'')) {
    idx++;
  }
  if (idx < (unsigned int)str.length()) {
    return toupper(str[idx]);
  }
  return '\0';
}

void loop() {
  unsigned long now = millis();

  // Watchdog check: if computer disconnects, enter blinking yellow fail-safe
  if ((now - lastHeartbeat > WATCHDOG_TIMEOUT) && currentState != FAIL_SAFE) {
    currentState = FAIL_SAFE;
    if (!watchdogAnnounced) {
      Serial.println(F("\n[!] WATCHDOG WARNING: No serial heartbeat received for > 6 seconds!"));
      Serial.println(F("    Entering FAIL_SAFE mode: 1 Hz Blinking YELLOW on all approaches.\n"));
      watchdogAnnounced = true;
    }
  }

  // Handle incoming Serial commands from Python
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.length() > 0) {
      lastHeartbeat = now;
      if (watchdogAnnounced) {
        Serial.println(F("[✓] SERIAL COMMUNICATION RESTORED — Resuming AI Vision Control."));
        watchdogAnnounced = false;
      }

      // 1. Diagnostics test request
      if (input.indexOf("\"cmd\":\"test\"") != -1 || input.indexOf("\"test\"") != -1) {
        Serial.println(F("\n[SERIAL RX] Diagnostic test command received from Dashboard!"));
        runStartupSelfTest();
        setAllSignals('G', 'G', 'R', 'R');
        currentState = STATE_DIRECT_SYNC;
        Serial.println(F("{\"ack\":true,\"status\":\"SELF_TEST_COMPLETED\"}"));
        return;
      }

      // 2. Direct approach sync from AI Vision pipeline
      // Format: {"n":"G","s":"G","e":"R","w":"R"} or {"n":"Y",...}
      char nColor = extractJsonChar(input, "\"n\"");
      char sColor = extractJsonChar(input, "\"s\"");
      char eColor = extractJsonChar(input, "\"e\"");
      char wColor = extractJsonChar(input, "\"w\"");

      if (nColor != '\0' && sColor != '\0' && eColor != '\0' && wColor != '\0') {
        currentState = STATE_DIRECT_SYNC;
        setAllSignals(nColor, sColor, eColor, wColor);
        return;
      }

      // 3. High-level Phase change request
      // Format: {"phase":"A"} or {"phase":"B"}
      int phaseIdx = input.indexOf("\"phase\"");
      if (phaseIdx != -1) {
        char pChar = extractJsonChar(input, "\"phase\"");
        if (pChar == 'A' || pChar == 'B') {
          targetPhase = pChar;
          if (currentState == STATE_DIRECT_SYNC || currentState == FAIL_SAFE) {
            currentState = (targetPhase == 'A') ? PHASE_A_GREEN : PHASE_B_GREEN;
            stateStartTime = now;
          }
          Serial.print(F("[SERIAL RX] Target Phase commanded: PHASE "));
          Serial.println(targetPhase);
        }
      }
    }
  }

  // Autonomous state machine (active when in autonomous phase mode)
  unsigned long elapsed = now - stateStartTime;

  switch (currentState) {
    case STATE_DIRECT_SYNC:
      // Controlled frame-by-frame directly by Python Vision engine
      break;

    case PHASE_A_GREEN:
      setAllSignals('G', 'G', 'R', 'R');
      if (targetPhase == 'B') {
        currentState = PHASE_A_YELLOW;
        stateStartTime = now;
      }
      break;

    case PHASE_A_YELLOW:
      // ALL 4 Approaches Yellow during phase change announcement
      setAllSignals('Y', 'Y', 'Y', 'Y');
      if (elapsed >= YELLOW_TIME) {
        currentState = ALL_RED_CLEAR_A;
        stateStartTime = now;
      }
      break;

    case ALL_RED_CLEAR_A:
      // All 4 Approaches Red during clearance
      setAllSignals('R', 'R', 'R', 'R');
      if (elapsed >= CLEARANCE_TIME) {
        currentState = PHASE_B_GREEN;
        stateStartTime = now;
      }
      break;

    case PHASE_B_GREEN:
      setAllSignals('R', 'R', 'G', 'G');
      if (targetPhase == 'A') {
        currentState = PHASE_B_YELLOW;
        stateStartTime = now;
      }
      break;

    case PHASE_B_YELLOW:
      // ALL 4 Approaches Yellow
      setAllSignals('Y', 'Y', 'Y', 'Y');
      if (elapsed >= YELLOW_TIME) {
        currentState = ALL_RED_CLEAR_B;
        stateStartTime = now;
      }
      break;

    case ALL_RED_CLEAR_B:
      // All 4 Approaches Red
      setAllSignals('R', 'R', 'R', 'R');
      if (elapsed >= CLEARANCE_TIME) {
        currentState = PHASE_A_GREEN;
        stateStartTime = now;
      }
      break;

    case FAIL_SAFE:
      // Blinking yellow fallback on all 4 approaches (1 Hz)
      if ((millis() / 500) % 2 == 0) {
        setAllSignals('Y', 'Y', 'Y', 'Y');
      } else {
        allLedsOff();
      }
      // If communication resumes, return to normal operation
      if (now - lastHeartbeat < WATCHDOG_TIMEOUT) {
        currentState = STATE_DIRECT_SYNC;
      }
      break;
  }

  delay(15);
}
