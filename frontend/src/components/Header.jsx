import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function Header({
  isSumoMode,
  isSumoRunning,
  startSumo,
  switchEnvironment,
  setSource,
  handleFileUpload,
  stopFeed,
  setShowCalibrate,
  wsConnected,
  isArduinoConnected,
  arduinoPort,
  testArduinoLeds,
  disconnectArduino,
  selectedPort,
  setSelectedPort,
  serialPorts,
  connectArduino,
  fetchSerialPorts,
}) {
  const { isLight, toggleTheme, t, btnMinimal } = useTheme();

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: `1px solid ${t.borderMain}`,
      paddingBottom: '20px',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{
          fontSize: '1.05rem',
          fontWeight: 800,
          letterSpacing: '0.15em',
          border: `1px solid ${t.borderHighlight}`,
          color: t.textPrimary,
          padding: '3px 8px'
        }}>
          GROUP Z
        </span>
        <span className="mono" style={{ fontSize: '0.75rem', color: t.textSubtle, letterSpacing: '0.1em' }}>
          AI TRAFFIC MANAGEMENT PLATFORM
        </span>
      </div>

      {/* Operating Environment & Source Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Primary SUMO Simulation Environment */}
        <button
          onClick={() => { switchEnvironment('sumo'); if (!isSumoRunning) startSumo(); }}
          style={{
            ...btnMinimal,
            backgroundColor: isSumoMode ? t.btnActiveBg : 'transparent',
            color: isSumoMode ? t.btnActiveColor : t.textPrimary,
            borderColor: t.borderHighlight,
            fontWeight: 800,
            letterSpacing: '0.05em'
          }}
        >
          SUMO SIMULATION
        </button>

        {/* Physical Camera / Webcam */}
        <button
          onClick={() => { switchEnvironment('video'); setSource('webcam'); }}
          style={{
            ...btnMinimal,
            backgroundColor: (!isSumoMode) ? (isLight ? '#e4e4e7' : '#222222') : 'transparent',
            borderColor: (!isSumoMode) ? t.borderHighlight : t.borderMuted,
            color: (!isSumoMode) ? t.textPrimary : t.textMuted
          }}
        >
          CAMERA
        </button>

        {/* Upload Custom Video Footage */}
        <label style={{ ...btnMinimal, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
          UPLOAD
          <input
            type="file"
            accept="video/*"
            onChange={(e) => { switchEnvironment('video'); handleFileUpload(e); }}
            style={{ display: 'none' }}
          />
        </label>

        {!isSumoMode && (
          <>
            <button onClick={stopFeed} style={btnMinimal}>
              HALT
            </button>
            <button onClick={() => setShowCalibrate(true)} style={{ ...btnMinimal, borderColor: '#555' }}>
              CALIBRATE REGIONS
            </button>
          </>
        )}

        {/* WebSocket Connection Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginLeft: '14px',
          paddingLeft: '14px',
          borderLeft: `1px solid ${t.borderMain}`
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: wsConnected ? (isLight ? '#16a34a' : '#ffffff') : t.borderStrong,
            boxShadow: wsConnected ? (isLight ? '0 0 8px #16a34a' : '0 0 8px #ffffff') : 'none'
          }} />
          <span className="mono" style={{ fontSize: '0.7rem', color: t.textMuted, letterSpacing: '0.05em' }}>
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
          borderLeft: `1px solid ${t.borderMain}`
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: isArduinoConnected ? '#22c55e' : t.borderStrong,
            boxShadow: isArduinoConnected ? '0 0 8px #22c55e' : 'none'
          }} />

          {/* TEST LEDS button */}
          <button
            onClick={testArduinoLeds}
            title="Test all 12 physical LEDs on breadboard (Pins 2 to 13)"
            style={{
              ...btnMinimal,
              fontSize: '0.65rem',
              padding: '4px 9px',
              borderColor: t.borderHighlight,
              color: t.textPrimary,
              fontWeight: 700,
              letterSpacing: '0.05em'
            }}
          >
            TEST LEDS
          </button>
          
          {isArduinoConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="mono" style={{ fontSize: '0.72rem', color: isLight ? '#166534' : '#86efac', fontWeight: 700, letterSpacing: '0.05em' }}>
                {arduinoPort} CONNECTED
              </span>
              <button onClick={disconnectArduino} title="Disconnect USB serial" style={{ ...btnMinimal, fontSize: '0.62rem', padding: '3px 8px', borderColor: '#ef4444', color: '#fca5a5' }}>
                DISCONNECT
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="mono" style={{ fontSize: '0.68rem', color: t.textMuted }}>
                ARDUINO:
              </span>
              <select
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                style={{
                  backgroundColor: t.bgInput,
                  color: t.textPrimary,
                  border: `1px solid ${t.borderStrong}`,
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
                style={{ ...btnMinimal, fontSize: '0.65rem', padding: '3px 8px', borderColor: '#22c55e', color: isLight ? '#166534' : '#86efac', fontWeight: 700 }}
              >
                CONNECT
              </button>

              <button
                onClick={fetchSerialPorts}
                title="Scan for connected serial ports"
                style={{ ...btnMinimal, fontSize: '0.65rem', padding: '3px 6px', borderColor: t.borderStrong }}
              >
                ↻
              </button>
            </div>
          )}
        </div>

        {/* Theme Toggle Button (Light / Dark) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginLeft: '14px',
          paddingLeft: '14px',
          borderLeft: `1px solid ${t.borderMain}`
        }}>
          <button
            onClick={toggleTheme}
            title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
            style={{
              ...btnMinimal,
              backgroundColor: isLight ? '#09090b' : '#ffffff',
              color: isLight ? '#ffffff' : '#000000',
              borderColor: isLight ? '#09090b' : '#ffffff',
              fontWeight: 800,
              fontSize: '0.68rem',
              padding: '4px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{isLight ? '☾ DARK' : '☀ LIGHT'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
