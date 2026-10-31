import React from 'react';
import { useTheme } from '../context/ThemeContext';
import ManualLoopPanel from './ManualLoopPanel';

export default function PhaseStatusBox({
  currentPhase,
  signalState,
  remaining,
  reason,
  mode,
  switchMode,
  isLoopRunning,
  manualA,
  setManualA,
  manualB,
  setManualB,
  startManualLoop,
  stopManualLoop,
}) {
  const { isLight, t } = useTheme();

  const modeTabStyle = (active) => ({
    backgroundColor: active ? t.btnActiveBg : (isLight ? '#ffffff' : '#000000'),
    color: active ? t.btnActiveColor : t.textMuted,
    border: 'none',
    padding: '10px',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    fontFamily: 'JetBrains Mono, monospace',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  });

  return (
    <div style={{
      backgroundColor: t.bgPanel,
      border: `1px solid ${t.borderMain}`,
      padding: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div className="mono" style={{ fontSize: '0.7rem', color: t.textMuted, letterSpacing: '0.1em', marginBottom: '4px' }}>
            ACTIVE PHASE
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: t.textPrimary }}>
            PHASE {currentPhase}
          </div>
          <div className="mono" style={{ fontSize: '0.75rem', color: t.textMuted, marginTop: '6px' }}>
            {currentPhase === 'A' ? 'NORTH · SOUTH GREEN' : 'EAST · WEST GREEN'}
          </div>
          <div className="mono" style={{ fontSize: '0.68rem', color: t.blue, marginTop: '6px' }}>
            RULE: {reason.toUpperCase().replace(/_/g, ' ')}
          </div>
        </div>

        {/* Realistic 3-Bulb Horizontal Traffic Light Widget */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            background: t.trafficLightBox,
            padding: '8px 12px',
            border: `1px solid ${t.borderMuted}`,
            borderRadius: '4px'
          }}>
            {/* RED BULB */}
            <div style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: signalState === 'red' ? '#ef4444' : t.bulbUnlit,
              boxShadow: signalState === 'red' ? '0 0 10px #ef4444' : 'none',
              transition: 'all 0.2s ease'
            }} />
            {/* YELLOW BULB */}
            <div style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: signalState === 'yellow' ? '#f59e0b' : t.bulbUnlit,
              boxShadow: signalState === 'yellow' ? '0 0 10px #f59e0b' : 'none',
              transition: 'all 0.2s ease'
            }} />
            {/* GREEN BULB */}
            <div style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: signalState === 'green' ? '#22c55e' : t.bulbUnlit,
              boxShadow: signalState === 'green' ? '0 0 10px #22c55e' : 'none',
              transition: 'all 0.2s ease'
            }} />
          </div>

          <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: t.textPrimary }}>
            {String(remaining).padStart(2, '0')}s
          </div>
        </div>
      </div>

      {/* Signal Operating Mode Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1px',
        backgroundColor: t.borderMain,
        border: `1px solid ${t.borderMain}`
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
        <ManualLoopPanel
          currentPhase={currentPhase}
          isLoopRunning={isLoopRunning}
          manualA={manualA}
          setManualA={setManualA}
          manualB={manualB}
          setManualB={setManualB}
          startManualLoop={startManualLoop}
          stopManualLoop={stopManualLoop}
        />
      )}
    </div>
  );
}
