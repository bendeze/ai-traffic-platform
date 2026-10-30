import React, { useState, useEffect } from 'react';
import Calibrate from './Calibrate';

const API_BASE = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

export default function App() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('adaptive');
  const [visionMode, setVisionMode] = useState('tracking');
  const [manualA, setManualA] = useState(30);
  const [manualB, setManualB] = useState(30);
  const [activePedestrian, setActivePedestrian] = useState(null);
  const [serialPorts, setSerialPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('COM6');
  const [wsConnected, setWsConnected] = useState(false);
  const [log, setLog] = useState('SYSTEM INITIALIZED');
  const [showCalibrate, setShowCalibrate] = useState(false);

  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        setWsConnected(true);
        setLog('TELEMETRY LINK ACTIVE');
      };
      ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          setData(payload);
          if (payload?.vision?.mode) {
            setVisionMode(payload.vision.mode);
          }
          if (payload?.signal?.mode && !mode) {
            setMode(payload.signal.mode);
          }
        } catch (err) {
          console.error(err);
        }
      };
      ws.onclose = () => {
        setWsConnected(false);
        setLog('LINK INTERRUPTED — RETRYING');
        reconnectTimeout = setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  const isLoopRunning = Boolean(data?.signal?.manual_loop_running);

  const startManualLoop = async () => {
    try {
      const res = await fetch(`${API_BASE}/controller/manual_loop/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase_a: manualA, phase_b: manualB, start_phase: 'A' })
      });
      const resData = await res.json();
      if (resData?.wait_current_timer) {
        setLog(`TIMERS UPDATED: PHASE A (${manualA}s) / PHASE B (${manualB}s) — CURRENT TIMER WILL FINISH FIRST`);
      } else {
        setLog(`MANUAL LOOP STARTED: PHASE A (${manualA}s) ➔ PHASE B (${manualB}s)`);
      }
    } catch {
      setLog('FAILED TO START MANUAL LOOP');
    }
  };

  const stopManualLoop = async () => {
    try {
      await fetch(`${API_BASE}/controller/manual_loop/stop`, { method: 'POST' });
      setLog('MANUAL LOOP PAUSED');
    } catch {
      setLog('FAILED TO PAUSE MANUAL LOOP');
    }
  };

  const switchVisionMode = async (newMode) => {
    setVisionMode(newMode);
    try {
      await fetch(`${API_BASE}/vision/mode/${newMode}`, { method: 'POST' });
      setLog(`SWITCHED VISION MODE: ${newMode.toUpperCase()}`);
    } catch {
      setLog('VISION MODE SWITCH FAILED');
    }
  };

  const updateManualDurations = async (durA, durB) => {
    try {
      await fetch(`${API_BASE}/controller/manual_config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase_a: durA, phase_b: durB })
      });
      setLog(`CONFIGURED MANUAL DURATIONS: PHASE A (${durA}s) ↔ PHASE B (${durB}s)`);
    } catch {
      setLog('CONFIG UPDATE FAILED');
    }
  };

  const switchMode = async (newMode) => {
    setMode(newMode);
    try {
      await fetch(`${API_BASE}/controller/mode/${newMode}`, { method: 'POST' });
      setLog(`SIGNAL MODE: ${newMode.toUpperCase()}`);
    } catch {
      setLog('MODE SWITCH FAILED');
    }
  };

  const requestPedestrian = async (approach) => {
    setActivePedestrian(approach);
    try {
      await fetch(`${API_BASE}/priority/pedestrian/${approach}`, { method: 'POST' });
      const phaseName = (approach === 'north' || approach === 'south') ? 'NORTH & SOUTH' : 'EAST & WEST';
      setLog(`PEDESTRIAN ACTIVE: ${phaseName} LOCKED ON RED FOR 10s`);
      setTimeout(() => setActivePedestrian(null), 10000);
    } catch {
      setActivePedestrian(null);
      setLog('REQUEST REJECTED');
    }
  };

  const triggerAmbulance = async (approach) => {
    try {
      await fetch(`${API_BASE}/priority/ambulance/${approach}`, { method: 'POST' });
      setLog(`EMERGENCY: AMBULANCE DISPATCHED ON ${approach.toUpperCase()}!`);
    } catch {
      setLog('AMBULANCE TRIGGER ERROR');
    }
  };

  const clearAmbulance = async () => {
    try {
      await fetch(`${API_BASE}/priority/ambulance_clear`, { method: 'POST' });
      setLog('AMBULANCE CLEARED — RESUMING ADAPTIVE FLOW');
    } catch {
      setLog('ERROR CLEARING AMBULANCE');
    }
  };

  const setSource = async (source) => {
    try {
      await fetch(`${API_BASE}/video/source?source=${encodeURIComponent(source)}`, { method: 'POST' });
      setLog(`FEED INPUT: ${source.toUpperCase()}`);
    } catch {
      setLog('FEED SELECTION FAILED');
    }
  };

  const stopFeed = async () => {
    try {
      await fetch(`${API_BASE}/video/stop`, { method: 'POST' });
      setLog('FEED PAUSED');
    } catch {
      setLog('FEED HALT ERROR');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setLog(`UPLOADING ${file.name.toUpperCase()}...`);
    try {
      await fetch(`${API_BASE}/video/upload`, { method: 'POST', body: form });
      setLog(`PLAYBACK STARTED: ${file.name.toUpperCase()}`);
    } catch {
      setLog('UPLOAD FAILED');
    }
  };

  const fetchSerialPorts = async () => {
    try {
      const res = await fetch(`${API_BASE}/serial/ports`);
      const d = await res.json();
      if (d?.ports) {
        setSerialPorts(d.ports);
        const ard = d.ports.find((p) => p.is_arduino);
        if (ard) {
          setSelectedPort(ard.port);
        } else if (d.ports.length > 0 && !selectedPort) {
          setSelectedPort(d.ports[0].port);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSerialPorts();
  }, []);

  const connectArduino = async (portToConnect) => {
    const port = portToConnect || selectedPort || 'COM6';
    try {
      setLog(`CONNECTING TO ARDUINO ON ${port}...`);
      const res = await fetch(`${API_BASE}/serial/connect?port=${encodeURIComponent(port)}`, { method: 'POST' });
      const d = await res.json();
      if (d.status === 'ok') {
        setLog(`ARDUINO CONNECTED ON ${d.serial?.port || port}`);
        fetchSerialPorts();
      } else {
        setLog(`CONNECT FAILED: ${d.error || 'COULD NOT OPEN ' + port}`);
      }
    } catch {
      setLog('SERIAL CONNECT FAILED');
    }
  };

  const disconnectArduino = async () => {
    try {
      await fetch(`${API_BASE}/serial/disconnect`, { method: 'POST' });
      setLog('ARDUINO DISCONNECTED');
      fetchSerialPorts();
    } catch {
      setLog('DISCONNECT FAILED');
    }
  };

  const testArduinoLeds = async () => {
    try {
      if (!isArduinoConnected) {
        const port = selectedPort || 'COM6';
        setLog(`CONNECTING TO ARDUINO ON ${port} FIRST...`);
        const connRes = await fetch(`${API_BASE}/serial/connect?port=${encodeURIComponent(port)}`, { method: 'POST' });
        const connData = await connRes.json();
        if (connData.status !== 'ok') {
          setLog(`CONNECT FAILED: ${connData.error || 'COULD NOT OPEN ' + port}`);
          return;
        }
        setLog(`ARDUINO CONNECTED ON ${port}! TRIGGERING 12-LED HARDWARE DIAGNOSTIC SWEEP...`);
        fetchSerialPorts();
        await new Promise(r => setTimeout(r, 1200));
      } else {
        setLog('TRIGGERING 12-LED HARDWARE DIAGNOSTIC SWEEP ON ARDUINO...');
      }

      const res = await fetch(`${API_BASE}/serial/test`, { method: 'POST' });
      if (res.ok) {
        setLog('ARDUINO DIAGNOSTIC SWEEP ACTIVE (PINS 2 TO 13)');
      } else {
        const err = await res.json().catch(() => ({}));
        setLog(`TEST FAILED: ${err.detail || 'CHECK ARDUINO CONNECTION'}`);
      }
    } catch (err) {
      setLog(`TEST COMMAND ERROR: ${err.message || 'FAILED'}`);
    }
  };

  const currentPhase = data?.signal?.phase || 'A';
  const signalState = data?.signal?.state || 'green';
  const remaining = Math.round(data?.signal?.remaining ?? 0);
  const fps = data?.pipeline?.fps ? data.pipeline.fps.toFixed(1) : '0.0';
  const reason = data?.signal?.reason || '—';
  const activeAmbulance = data?.active_ambulance;
  const isSnapshotMode = visionMode === 'snapshot';
  const snapshotInterval = data?.vision?.snapshot_interval ?? 5.0;
  const nextSnapIn = data?.vision?.next_snapshot_in ?? 0;
  const snapCount = data?.vision?.snapshots_taken ?? 0;
  const isArduinoConnected = Boolean(data?.hardware?.connected);
  const arduinoPort = data?.hardware?.port || 'USB';

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000000',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 32px'
    }}>
      {showCalibrate && <Calibrate onClose={() => setShowCalibrate(false)} />}

      {/* Top Navigation Bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #1a1a1a',
        paddingBottom: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            letterSpacing: '0.15em',
            border: '1px solid #ffffff',
            padding: '3px 8px'
          }}>
            GROUP Z
          </span>
          <span className="mono" style={{ fontSize: '0.75rem', color: '#555555', letterSpacing: '0.1em' }}>
            AI TRAFFIC MANAGEMENT PLATFORM
          </span>
        </div>

        {/* Video Source Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setSource('test_intersection.mp4')} style={btnMinimal}>
            SIMULATION
          </button>
          <button onClick={() => setSource('webcam')} style={btnMinimal}>
            CAMERA
          </button>
          <button onClick={stopFeed} style={btnMinimal}>
            HALT
          </button>

          <label style={{ ...btnMinimal, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
            UPLOAD
            <input
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>

          <button onClick={() => setShowCalibrate(true)} style={{ ...btnMinimal, borderColor: '#555' }}>
            CALIBRATE REGIONS
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: '14px',
            paddingLeft: '14px',
            borderLeft: '1px solid #1a1a1a'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: wsConnected ? '#ffffff' : '#333333',
              boxShadow: wsConnected ? '0 0 8px #ffffff' : 'none'
            }} />
            <span className="mono" style={{ fontSize: '0.7rem', color: '#737373', letterSpacing: '0.05em' }}>
              {wsConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          {/* Physical Arduino Hardware Serial Controls with Port Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: '14px',
            paddingLeft: '14px',
            borderLeft: '1px solid #1a1a1a'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isArduinoConnected ? '#22c55e' : '#555555',
              boxShadow: isArduinoConnected ? '0 0 8px #22c55e' : 'none'
            }} />

            {/* Unconditionally visible TEST LEDS button */}
            <button
              onClick={testArduinoLeds}
              title="Test all 12 physical LEDs on breadboard (Pins 2 to 13)"
              style={{
                ...btnMinimal,
                fontSize: '0.65rem',
                padding: '4px 9px',
                borderColor: '#ffffff',
                color: '#ffffff',
                fontWeight: 700,
                letterSpacing: '0.05em'
              }}
            >
              TEST LEDS
            </button>
            
            {isArduinoConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="mono" style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 700, letterSpacing: '0.05em' }}>
                  {arduinoPort} CONNECTED
                </span>
                <button onClick={disconnectArduino} title="Disconnect USB serial" style={{ ...btnMinimal, fontSize: '0.62rem', padding: '3px 8px', borderColor: '#ef4444', color: '#fca5a5' }}>
                  DISCONNECT
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="mono" style={{ fontSize: '0.68rem', color: '#737373' }}>
                  ARDUINO:
                </span>
                <select
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(e.target.value)}
                  style={{
                    backgroundColor: '#0a0a0a',
                    color: '#ffffff',
                    border: '1px solid #333333',
                    fontSize: '0.68rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    padding: '3px 6px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {serialPorts.length > 0 ? (
                    serialPorts.map((p) => (
                      <option key={p.port} value={p.port}>
                        {p.port} {p.is_arduino ? '★ (Nano 33 BLE)' : p.is_usb ? '(USB)' : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="COM6">COM6 (Nano 33 BLE)</option>
                      <option value="COM3">COM3</option>
                      <option value="COM4">COM4</option>
                      <option value="COM5">COM5</option>
                    </>
                  )}
                </select>

                <button
                  onClick={() => connectArduino(selectedPort)}
                  title="Connect to selected COM port"
                  style={{ ...btnMinimal, fontSize: '0.65rem', padding: '3px 8px', borderColor: '#22c55e', color: '#86efac', fontWeight: 700 }}
                >
                  CONNECT
                </button>

                <button
                  onClick={fetchSerialPorts}
                  title="Scan for connected serial ports"
                  style={{ ...btnMinimal, fontSize: '0.65rem', padding: '3px 6px', borderColor: '#444' }}
                >
                  ↻
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Emergency Ambulance Alert Banner */}
      {activeAmbulance && (
        <div style={{
          backgroundColor: '#3b0707',
          border: '1px solid #ef4444',
          padding: '10px 18px',
          borderRadius: '4px',
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              boxShadow: '0 0 10px #ef4444'
            }} />
            <span className="mono" style={{ fontWeight: 800, fontSize: '0.8rem', color: '#fca5a5' }}>
              EMERGENCY VEHICLE PREEMPTION ACTIVE — APPROACH: {activeAmbulance.toUpperCase()}
            </span>
          </div>
          <button
            onClick={clearAmbulance}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              padding: '4px 12px',
              fontSize: '0.7rem',
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer'
            }}
          >
            DISMISS AMBULANCE
          </button>
        </div>
      )}

      {/* Minimalist Vision Analysis Mode Segmented Control */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#050505',
        border: '1px solid #1a1a1a',
        padding: '6px 14px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span className="mono" style={{ fontSize: '0.68rem', color: '#555555', letterSpacing: '0.1em' }}>
            VISION ENGINE:
          </span>
          <div style={{
            display: 'inline-flex',
            backgroundColor: '#000000',
            border: '1px solid #222222',
            padding: '2px'
          }}>
            <button
              onClick={() => switchVisionMode('tracking')}
              style={{
                backgroundColor: !isSnapshotMode ? '#ffffff' : 'transparent',
                color: !isSnapshotMode ? '#000000' : '#737373',
                border: 'none',
                padding: '6px 16px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              CONTINUOUS TRACKING
            </button>
            <button
              onClick={() => switchVisionMode('snapshot')}
              style={{
                backgroundColor: isSnapshotMode ? '#ffffff' : 'transparent',
                color: isSnapshotMode ? '#000000' : '#737373',
                border: 'none',
                padding: '6px 16px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              SNAPSHOT {snapshotInterval}s
            </button>
          </div>
        </div>

        {/* Minimalist Inline Telemetry */}
        <div className="mono" style={{ fontSize: '0.7rem', color: '#737373', display: 'flex', gap: '14px' }}>
          {isSnapshotMode ? (
            <>
              <span>NEXT: <strong style={{ color: '#ffffff' }}>{nextSnapIn}s</strong></span>
              <span style={{ color: '#262626' }}>/</span>
              <span>CAPTURED: <strong style={{ color: '#ffffff' }}>#{snapCount}</strong></span>
            </>
          ) : (
            <span>RATE: <strong style={{ color: '#ffffff' }}>{fps} FPS</strong></span>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr',
        gap: '24px',
        flex: 1
      }}>
        
        {/* Left: Video Feed Monitor */}
        <section style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#050505',
          border: '1px solid #1a1a1a'
        }}>
          {/* Feed Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #1a1a1a'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                FEED 01
              </span>
              <span style={{ fontSize: '0.75rem', color: '#404040' }}>/</span>
              <span className="mono" style={{ fontSize: '0.7rem', color: '#737373' }}>
                {isSnapshotMode ? 'PHOTO SNAPSHOT INSPECTION' : 'CONTINUOUS VEHICLE TRACKING'}
              </span>
            </div>
            <div className="mono" style={{ fontSize: '0.75rem', color: '#737373' }}>
              {isSnapshotMode ? `INTERVAL: 2.0s` : `${fps} FPS`}
            </div>
          </div>

          {/* Screen */}
          <div style={{
            position: 'relative',
            flex: 1,
            backgroundColor: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            minHeight: '480px'
          }}>
            <img
              src={`${API_BASE}/video/stream`}
              alt="Telemetry Stream"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={(e) => { e.target.style.opacity = '0'; }}
              onLoad={(e) => { e.target.style.opacity = '1'; }}
            />

            {/* Corner Markers */}
            <div style={cornerTL} />
            <div style={cornerTR} />
            <div style={cornerBL} />
            <div style={cornerBR} />
          </div>

          {/* Quick Simulation Bar */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #1a1a1a',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            <span className="mono" style={{ fontSize: '0.65rem', color: '#666' }}>
              TRIGGER AMBULANCE:
            </span>
            {['north', 'south', 'east', 'west'].map((app) => (
              <button
                key={app}
                onClick={() => triggerAmbulance(app)}
                style={{
                  ...btnMinimal,
                  fontSize: '0.65rem',
                  padding: '4px 8px',
                  borderColor: activeAmbulance === app ? '#ef4444' : '#222',
                  color: activeAmbulance === app ? '#ef4444' : '#fff'
                }}
              >
                + {app.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        {/* Right: Telemetry & Controls */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Phase Status Box with 3-bulb light box */}
          <div style={{
            backgroundColor: '#050505',
            border: '1px solid #1a1a1a',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div className="mono" style={{ fontSize: '0.7rem', color: '#737373', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  ACTIVE PHASE
                </div>
                <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  PHASE {currentPhase}
                </div>
                <div className="mono" style={{ fontSize: '0.75rem', color: '#737373', marginTop: '6px' }}>
                  {currentPhase === 'A' ? 'NORTH · SOUTH GREEN' : 'EAST · WEST GREEN'}
                </div>
                <div className="mono" style={{ fontSize: '0.68rem', color: '#38bdf8', marginTop: '6px' }}>
                  RULE: {reason.toUpperCase().replace(/_/g, ' ')}
                </div>
              </div>

              {/* Realistic 3-Bulb Horizontal Traffic Light Widget */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  background: '#090909',
                  padding: '8px 12px',
                  border: '1px solid #222222',
                  borderRadius: '4px'
                }}>
                  {/* RED BULB */}
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: signalState === 'red' ? '#ffffff' : '#222222',
                    boxShadow: signalState === 'red' ? '0 0 10px #ffffff' : 'none'
                  }} />
                  {/* YELLOW BULB */}
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: signalState === 'yellow' ? '#ffffff' : '#222222',
                    boxShadow: signalState === 'yellow' ? '0 0 10px #ffffff' : 'none'
                  }} />
                  {/* GREEN BULB */}
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: signalState === 'green' ? '#ffffff' : '#222222',
                    boxShadow: signalState === 'green' ? '0 0 10px #ffffff' : 'none'
                  }} />
                </div>

                <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                  {String(remaining).padStart(2, '0')}s
                </div>
              </div>
            </div>

            {/* Signal Operating Mode Controls */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #1a1a1a'
            }}>
              <button
                onClick={() => switchMode('adaptive')}
                style={modeTabStyle(mode === 'adaptive')}
              >
                ADAPTIVE
              </button>
              <button
                onClick={() => switchMode('manual')}
                style={modeTabStyle(mode === 'manual')}
              >
                MANUAL
              </button>
            </div>

            {mode === 'manual' && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px'
                }}>
                  {/* ── Section 1: Phase A ────────────────── */}
                  <div style={{
                    backgroundColor: '#000000',
                    border: '1px solid',
                    borderColor: currentPhase === 'A' && isLoopRunning ? '#ffffff' : '#222222',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                        PHASE A (N · S)
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <input
                          type="number"
                          min="5"
                          max="120"
                          value={manualA}
                          onChange={(e) => {
                            const val = Math.max(5, parseInt(e.target.value) || 5);
                            setManualA(val);
                          }}
                          style={inputDurationStyle}
                        />
                        <span className="mono" style={{ fontSize: '0.65rem', color: '#666666' }}>s</span>
                      </div>
                    </div>

                    {/* Quick Select Presets */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                      {[15, 30, 45, 60].map((sec) => (
                        <button
                          key={sec}
                          onClick={() => setManualA(sec)}
                          style={presetBtnStyle(manualA === sec)}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Section 2: Phase B ────────────────── */}
                  <div style={{
                    backgroundColor: '#000000',
                    border: '1px solid',
                    borderColor: currentPhase === 'B' && isLoopRunning ? '#ffffff' : '#222222',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                        PHASE B (E · W)
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <input
                          type="number"
                          min="5"
                          max="120"
                          value={manualB}
                          onChange={(e) => {
                            const val = Math.max(5, parseInt(e.target.value) || 5);
                            setManualB(val);
                          }}
                          style={inputDurationStyle}
                        />
                        <span className="mono" style={{ fontSize: '0.65rem', color: '#666666' }}>s</span>
                      </div>
                    </div>

                    {/* Quick Select Presets */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                      {[15, 30, 45, 60].map((sec) => (
                        <button
                          key={sec}
                          onClick={() => setManualB(sec)}
                          style={presetBtnStyle(manualB === sec)}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Validation & Loop Control Bar ─────── */}
                <div>
                  {!isLoopRunning ? (
                    <button
                      onClick={startManualLoop}
                      style={{
                        ...btnAction,
                        width: '100%',
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        fontWeight: 800,
                        fontSize: '0.72rem',
                        padding: '10px',
                        letterSpacing: '0.06em',
                        boxShadow: '0 0 12px rgba(255, 255, 255, 0.15)'
                      }}
                    >
                      ▶ VALIDATE & START MANUAL LOOP ({manualA}s ➔ {manualB}s)
                    </button>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
                      <button
                        onClick={startManualLoop}
                        style={{
                          ...btnAction,
                          backgroundColor: '#111111',
                          borderColor: '#444444',
                          color: '#ffffff',
                          fontSize: '0.68rem',
                          padding: '8px'
                        }}
                      >
                        ↻ UPDATE LOOP ({manualA}s / {manualB}s)
                      </button>
                      <button
                        onClick={stopManualLoop}
                        style={{
                          ...btnAction,
                          backgroundColor: '#2a0909',
                          borderColor: '#ef4444',
                          color: '#fca5a5',
                          fontSize: '0.68rem',
                          padding: '8px'
                        }}
                      >
                        ⏹ PAUSE LOOP
                      </button>
                    </div>
                  )}
                </div>

                <div className="mono" style={{
                  fontSize: '0.64rem',
                  padding: '6px 10px',
                  backgroundColor: '#050505',
                  border: '1px solid #1a1a1a',
                  color: isLoopRunning ? '#ffffff' : '#737373',
                  textAlign: 'center'
                }}>
                  {isLoopRunning
                    ? `● MANUAL LOOP RUNNING (A: ${manualA}s / B: ${manualB}s) — ACTIVE TIMER WILL FINISH BEFORE NEW DURATIONS APPLY`
                    : `SET SECONDS FOR PHASE A AND B ABOVE, THEN CLICK VALIDATE TO START THE LOOP`}
                </div>
              </div>
            )}
          </div>

          {/* Approaches 2x2 Grid with Vehicle Breakdown */}
          <div style={{
            backgroundColor: '#050505',
            border: '1px solid #1a1a1a',
            padding: '20px',
            flex: 1
          }}>
            <div className="mono" style={{ fontSize: '0.7rem', color: '#737373', letterSpacing: '0.1em', marginBottom: '14px' }}>
              APPROACH TELEMETRY & VEHICLE CLASSIFICATION
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {['north', 'south', 'east', 'west'].map((app) => {
                const info = data?.approaches?.[app] || { queue: 0, waiting_time: 0, signal: 'red', timer: 0, breakdown: {} };
                const appPhase = (app === 'north' || app === 'south') ? 'A' : 'B';
                const isPedActive = activePedestrian === app || 
                  (Boolean(data?.signal?.is_pedestrian_active) && data?.signal?.pedestrian_red_phase === appPhase);
                const isGreen = info.signal === 'green';
                const hasAmb = info.has_ambulance;
                const bd = info.breakdown || {};
                const timerVal = info.timer ?? 0;

                return (
                  <div key={app} style={{
                    backgroundColor: '#000000',
                    border: '1px solid',
                    borderColor: hasAmb ? '#ef4444' : '#1a1a1a',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '145px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                        {app.toUpperCase()} {hasAmb && '🚑'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {/* Approach Countdown Timer */}
                        <span className="mono" style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: isGreen ? '#ffffff' : (info.signal === 'yellow' ? '#fde047' : '#737373')
                        }}>
                          {timerVal}s
                        </span>
                        <span className="mono" style={{
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          border: '1px solid',
                          borderColor: isGreen ? '#ffffff' : '#333333',
                          color: isGreen ? '#ffffff' : '#737373'
                        }}>
                          {info.signal.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div style={{ margin: '8px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span className="mono" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                          {String(info.queue).padStart(2, '0')}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#737373' }}>VEHICLES</span>
                      </div>
                      
                      {/* Detailed vehicle counts */}
                      <div className="mono" style={{ fontSize: '0.62rem', color: '#888', marginTop: '4px', lineHeight: 1.4 }}>
                        CARS:{bd.car || 0} · TRUCKS:{bd.truck || 0} · BIKES:{bd.motorcycle || 0} · BUS:{bd.bus || 0}
                      </div>

                      <div className="mono" style={{ fontSize: '0.65rem', color: '#555555', marginTop: '2px' }}>
                        WAIT {Math.round(info.waiting_time)}s (CAP: 30s)
                      </div>
                    </div>

                    <button
                      onClick={() => requestPedestrian(app)}
                      style={{
                        width: '100%',
                        padding: '6px',
                        backgroundColor: isPedActive ? '#ef4444' : 'transparent',
                        color: isPedActive ? '#ffffff' : '#737373',
                        border: '1px solid',
                        borderColor: isPedActive ? '#ef4444' : '#222222',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isPedActive ? '🚶 LOCKED ON RED (10s CROSSING)' : '+ PEDESTRIAN REQUEST'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </section>
      </main>

      {/* Terminal Log Footer */}
      <footer style={{
        marginTop: '20px',
        paddingTop: '14px',
        borderTop: '1px solid #1a1a1a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="mono" style={{ fontSize: '0.7rem', color: '#444444' }}>STATUS:</span>
          <span className="mono" style={{ fontSize: '0.7rem', color: '#999999' }}>{log}</span>
        </div>
        <div className="mono" style={{ fontSize: '0.7rem', color: '#444444' }}>
          SAMPLING: {isSnapshotMode ? `PHOTO (${snapshotInterval}s)` : 'CONTINUOUS'} · MAX WAIT: 30s · ALL-YELLOW: 3s
        </div>
      </footer>
    </div>
  );
}

// ── Minimalist Styles ──────────────────────────────────────────────────────────

const btnMinimal = {
  backgroundColor: '#000000',
  color: '#ffffff',
  border: '1px solid #222222',
  padding: '6px 12px',
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.05em',
  fontFamily: 'JetBrains Mono, monospace',
  cursor: 'pointer',
  transition: 'border-color 0.2s',
};

const btnAction = {
  backgroundColor: '#111111',
  color: '#ffffff',
  border: '1px solid #222222',
  padding: '10px',
  fontSize: '0.7rem',
  fontWeight: 700,
  fontFamily: 'JetBrains Mono, monospace',
  cursor: 'pointer',
  letterSpacing: '0.05em',
};

function modeTabStyle(active) {
  return {
    backgroundColor: active ? '#ffffff' : '#000000',
    color: active ? '#000000' : '#737373',
    border: 'none',
    padding: '10px',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    fontFamily: 'JetBrains Mono, monospace',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  };
}

const cornerTL = {
  position: 'absolute',
  top: '12px',
  left: '12px',
  width: '12px',
  height: '12px',
  borderTop: '2px solid #333333',
  borderLeft: '2px solid #333333',
  pointerEvents: 'none'
};

const cornerTR = {
  position: 'absolute',
  top: '12px',
  right: '12px',
  width: '12px',
  height: '12px',
  borderTop: '2px solid #333333',
  borderRight: '2px solid #333333',
  pointerEvents: 'none'
};

const cornerBL = {
  position: 'absolute',
  bottom: '12px',
  left: '12px',
  width: '12px',
  height: '12px',
  borderBottom: '2px solid #333333',
  borderLeft: '2px solid #333333',
  pointerEvents: 'none'
};

const cornerBR = {
  position: 'absolute',
  bottom: '12px',
  right: '12px',
  width: '12px',
  height: '12px',
  borderBottom: '2px solid #333333',
  borderRight: '2px solid #333333',
  pointerEvents: 'none'
};

const inputDurationStyle = {
  width: '54px',
  backgroundColor: '#000000',
  color: '#ffffff',
  border: '1px solid #333333',
  padding: '4px 6px',
  fontSize: '0.8rem',
  fontWeight: 700,
  fontFamily: 'JetBrains Mono, monospace',
  textAlign: 'center',
  outline: 'none',
};

function presetBtnStyle(active) {
  return {
    flex: 1,
    padding: '4px 0',
    backgroundColor: active ? '#222222' : '#050505',
    color: active ? '#ffffff' : '#737373',
    border: '1px solid',
    borderColor: active ? '#555555' : '#1a1a1a',
    fontSize: '0.65rem',
    fontWeight: 600,
    fontFamily: 'JetBrains Mono, monospace',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  };
}
