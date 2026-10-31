import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function SimulationBar({
  isSumoMode,
  isSnapshotMode,
  switchVisionMode,
  snapshotInterval,
  nextSnapIn,
  snapCount,
  fps,
  isSumoRunning,
  isSumoPaused,
  sumoGui,
  setSumoGui,
  sumoSpeed,
  sumoTime,
  sumoVehicleCount,
  startSumo,
  stopSumo,
  pauseSumo,
  resumeSumo,
  resetSumo,
  updateSumoSpeed,
  setLog
}) {
  const { isLight, t, btnMinimal } = useTheme();

  if (!isSumoMode) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: t.bgPanel,
        border: `1px solid ${t.borderMain}`,
        padding: '6px 14px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span className="mono" style={{ fontSize: '0.68rem', color: t.textSubtle, letterSpacing: '0.1em' }}>
            VISION ENGINE:
          </span>
          <div style={{
            display: 'inline-flex',
            backgroundColor: t.bgInput,
            border: `1px solid ${t.borderMuted}`,
            padding: '2px'
          }}>
            <button
              onClick={() => switchVisionMode('tracking')}
              style={{
                backgroundColor: !isSnapshotMode ? t.btnActiveBg : 'transparent',
                color: !isSnapshotMode ? t.btnActiveColor : t.textMuted,
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
                backgroundColor: isSnapshotMode ? t.btnActiveBg : 'transparent',
                color: isSnapshotMode ? t.btnActiveColor : t.textMuted,
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
        <div className="mono" style={{ fontSize: '0.7rem', color: t.textMuted, display: 'flex', gap: '14px' }}>
          {isSnapshotMode ? (
            <>
              <span>NEXT: <strong style={{ color: t.textPrimary }}>{nextSnapIn}s</strong></span>
              <span style={{ color: t.borderStrong }}>/</span>
              <span>CAPTURED: <strong style={{ color: t.textPrimary }}>#{snapCount}</strong></span>
            </>
          ) : (
            <span>RATE: <strong style={{ color: t.textPrimary }}>{fps} FPS</strong></span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: t.bgPanel,
      border: `1px solid ${t.borderMain}`,
      padding: '8px 14px',
      marginBottom: '20px',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span className="mono" style={{ fontSize: '0.68rem', color: t.textSubtle, letterSpacing: '0.1em' }}>
          SUMO ENGINE:
        </span>
        
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 8px',
          border: `1px solid ${t.borderStrong}`,
          borderRadius: '2px',
          backgroundColor: t.bgSubtle
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isSumoRunning ? (isSumoPaused ? '#f59e0b' : '#22c55e') : t.borderStrong
          }} />
          <span className="mono" style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            color: isSumoRunning ? (isSumoPaused ? '#f59e0b' : (isLight ? '#166534' : '#86efac')) : t.textMuted
          }}>
            {isSumoRunning ? (isSumoPaused ? 'PAUSED' : 'RUNNING') : 'STOPPED'}
          </span>
        </div>

        {/* Simulation Lifecycle Action Buttons */}
        {!isSumoRunning ? (
          <button
            onClick={() => startSumo(sumoGui)}
            style={{ ...btnMinimal, borderColor: '#22c55e', color: isLight ? '#166534' : '#86efac', fontWeight: 700 }}
          >
            ▶ START
          </button>
        ) : (
          <>
            {isSumoPaused ? (
              <button onClick={resumeSumo} style={{ ...btnMinimal, borderColor: '#22c55e', color: isLight ? '#166534' : '#86efac' }}>
                ▶ RESUME
              </button>
            ) : (
              <button onClick={pauseSumo} style={{ ...btnMinimal, borderColor: '#f59e0b', color: isLight ? '#b45309' : '#fcd34d' }}>
                ⏸ PAUSE
              </button>
            )}
            <button onClick={resetSumo} style={btnMinimal}>
              ↺ RESET
            </button>
            <button onClick={stopSumo} style={{ ...btnMinimal, borderColor: '#ef4444', color: isLight ? '#dc2626' : '#fca5a5' }}>
              ⏹ STOP
            </button>
          </>
        )}

        {/* GUI Toggle */}
        <button
          onClick={() => {
            const nextGui = !sumoGui;
            setSumoGui(nextGui);
            setLog(`SUMO GUI PREFERENCE: ${nextGui ? 'ENABLED' : 'HEADLESS'}`);
            if (isSumoRunning) {
              stopSumo().then(() => startSumo(nextGui));
            }
          }}
          style={{
            ...btnMinimal,
            backgroundColor: sumoGui ? t.btnActiveBg : 'transparent',
            color: sumoGui ? t.btnActiveColor : t.textMuted,
            fontSize: '0.65rem'
          }}
          title="Launch external SUMO-GUI window on desktop"
        >
          GUI: {sumoGui ? 'ON' : 'OFF'}
        </button>

        {/* Speed Factor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
          <span className="mono" style={{ fontSize: '0.65rem', color: t.textSubtle }}>SPEED:</span>
          {[0.5, 1.0, 2.0, 3.0].map((spd) => (
            <button
              key={spd}
              onClick={() => updateSumoSpeed(spd)}
              style={{
                ...btnMinimal,
                fontSize: '0.62rem',
                padding: '2px 6px',
                borderColor: sumoSpeed === spd ? t.borderHighlight : t.borderStrong,
                color: sumoSpeed === spd ? t.textPrimary : t.textMuted
              }}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Telemetry Info */}
      <div className="mono" style={{ fontSize: '0.72rem', color: t.textMuted, display: 'flex', gap: '14px' }}>
        <span>SIM TIME: <strong style={{ color: t.textPrimary }}>{sumoTime.toFixed(1)}s</strong></span>
        <span style={{ color: t.borderStrong }}>/</span>
        <span>SIM VEHICLES: <strong style={{ color: isLight ? '#166534' : '#86efac' }}>{sumoVehicleCount}</strong></span>
      </div>
    </div>
  );
}
