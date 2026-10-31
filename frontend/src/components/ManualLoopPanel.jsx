import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ManualLoopPanel({
  currentPhase,
  isLoopRunning,
  manualA,
  setManualA,
  manualB,
  setManualB,
  startManualLoop,
  stopManualLoop,
}) {
  const { isLight, t, btnAction } = useTheme();

  const inputDurationStyle = {
    width: '54px',
    backgroundColor: t.inputBg,
    color: t.textPrimary,
    border: `1px solid ${t.inputBorder}`,
    padding: '4px 6px',
    fontSize: '0.8rem',
    fontWeight: 700,
    fontFamily: 'JetBrains Mono, monospace',
    textAlign: 'center',
    outline: 'none',
  };

  const presetBtnStyle = (active) => ({
    flex: 1,
    padding: '4px 0',
    backgroundColor: active ? (isLight ? '#e4e4e7' : '#222222') : (isLight ? '#ffffff' : '#050505'),
    color: active ? t.textPrimary : t.textMuted,
    border: '1px solid',
    borderColor: active ? (isLight ? '#a1a1aa' : '#555555') : t.borderMain,
    fontSize: '0.65rem',
    fontWeight: 700,
    fontFamily: 'JetBrains Mono, monospace',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  });

  return (
    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px'
      }}>
        {/* ── Section 1: Phase A ────────────────── */}
        <div style={{
          backgroundColor: t.bgCard,
          border: '1px solid',
          borderColor: currentPhase === 'A' && isLoopRunning ? t.borderHighlight : t.borderMuted,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', color: t.textPrimary }}>
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
              <span className="mono" style={{ fontSize: '0.65rem', color: t.textMuted }}>s</span>
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
          backgroundColor: t.bgCard,
          border: '1px solid',
          borderColor: currentPhase === 'B' && isLoopRunning ? t.borderHighlight : t.borderMuted,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', color: t.textPrimary }}>
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
              <span className="mono" style={{ fontSize: '0.65rem', color: t.textMuted }}>s</span>
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
              backgroundColor: t.btnActiveBg,
              color: t.btnActiveColor,
              fontWeight: 800,
              fontSize: '0.72rem',
              padding: '10px',
              letterSpacing: '0.06em',
              boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.1)' : '0 0 12px rgba(255, 255, 255, 0.15)'
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
                backgroundColor: isLight ? '#f1f5f9' : '#111111',
                borderColor: t.borderStrong,
                color: t.textPrimary,
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
                backgroundColor: isLight ? '#fee2e2' : '#2a0909',
                borderColor: '#ef4444',
                color: isLight ? '#dc2626' : '#fca5a5',
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
        backgroundColor: t.bgSubtle,
        border: `1px solid ${t.borderMain}`,
        color: isLoopRunning ? t.textPrimary : t.textMuted,
        textAlign: 'center'
      }}>
        {isLoopRunning
          ? `● MANUAL LOOP RUNNING (A: ${manualA}s / B: ${manualB}s) — ACTIVE TIMER WILL FINISH BEFORE NEW DURATIONS APPLY`
          : `SET SECONDS FOR PHASE A AND B ABOVE, THEN CLICK VALIDATE TO START THE LOOP`}
      </div>
    </div>
  );
}
