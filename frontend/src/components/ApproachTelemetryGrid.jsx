import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ApproachTelemetryGrid({
  data,
  activePedestrian,
  requestPedestrian,
}) {
  const { isLight, t } = useTheme();

  return (
    <div style={{
      backgroundColor: t.bgPanel,
      border: `1px solid ${t.borderMain}`,
      padding: '20px',
      flex: 1
    }}>
      <div className="mono" style={{ fontSize: '0.7rem', color: t.textMuted, letterSpacing: '0.1em', marginBottom: '14px' }}>
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
              backgroundColor: t.bgCard,
              border: '1px solid',
              borderColor: hasAmb ? '#ef4444' : t.borderMain,
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '145px',
              boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.04)' : 'none'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: t.textPrimary }}>
                  {app.toUpperCase()} {hasAmb && '🚑'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Approach Countdown Timer */}
                  <span className="mono" style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: isGreen ? (isLight ? '#166534' : '#ffffff') : (info.signal === 'yellow' ? '#f59e0b' : t.textMuted)
                  }}>
                    {timerVal}s
                  </span>
                  <span className="mono" style={{
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    border: '1px solid',
                    borderColor: isGreen ? '#22c55e' : t.borderStrong,
                    color: isGreen ? '#22c55e' : t.textMuted
                  }}>
                    {info.signal.toUpperCase()}
                  </span>
                </div>
              </div>

              <div style={{ margin: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span className="mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: t.textPrimary }}>
                    {String(info.queue).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: t.textMuted }}>VEHICLES</span>
                </div>
                
                {/* Detailed vehicle counts */}
                <div className="mono" style={{ fontSize: '0.62rem', color: t.textMuted, marginTop: '4px', lineHeight: 1.4 }}>
                  CARS:{bd.car || 0} · TRUCKS:{bd.truck || 0} · BIKES:{bd.motorcycle || 0} · BUS:{bd.bus || 0}
                </div>

                <div className="mono" style={{ fontSize: '0.65rem', color: t.textSubtle, marginTop: '2px' }}>
                  WAIT {Math.round(info.waiting_time)}s (CAP: 30s)
                </div>
              </div>

              <button
                onClick={() => requestPedestrian(app)}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: isPedActive ? '#ef4444' : (isLight ? '#f1f5f9' : 'transparent'),
                  color: isPedActive ? '#ffffff' : t.textMuted,
                  border: '1px solid',
                  borderColor: isPedActive ? '#ef4444' : t.borderMuted,
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
  );
}
