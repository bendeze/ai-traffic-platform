import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function SumoTelemetryGrid({
  sumoApproaches,
  data,
  isSumoRunning,
  sumoGui,
  sumoVehicleCount,
}) {
  const { isLight, t } = useTheme();

  return (
    <div style={{
      width: '100%',
      height: '100%',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxSizing: 'border-box'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${t.borderMain}`,
        paddingBottom: '10px'
      }}>
        <span className="mono" style={{ fontSize: '0.75rem', color: t.textSecondary }}>
          APPROACH TELEMETRY — 4-WAY MICROSCOPIC FLOW
        </span>
        <span className="mono" style={{ fontSize: '0.7rem', color: isLight ? '#166534' : '#22c55e', fontWeight: 700 }}>
          ● TRACI LIVE SYNCHRONIZED
        </span>
      </div>

      {/* 2x2 Grid of Approaches */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        margin: '16px 0'
      }}>
        {['north', 'south', 'east', 'west'].map((app) => {
          const appData = sumoApproaches[app] || data?.approaches?.[app] || {};
          const sigColor = appData.signal || data?.approaches?.[app]?.signal || 'red';
          const sigColorHex = sigColor === 'green' ? '#22c55e' : (sigColor === 'yellow' ? '#f59e0b' : '#ef4444');
          const timerVal = appData.timer ?? data?.approaches?.[app]?.timer ?? 0;
          const bd = appData.breakdown || {};

          return (
            <div
              key={app}
              style={{
                backgroundColor: t.bgPanel,
                border: '1px solid',
                borderColor: sigColor === 'green' ? (isLight ? '#86efac' : '#166534') : (sigColor === 'yellow' ? (isLight ? '#fcd34d' : '#854d0e') : t.borderMain),
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'border-color 0.2s ease',
                boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                  {app.toUpperCase()} APPROACH
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="mono" style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: sigColor === 'green' ? (isLight ? '#166534' : '#ffffff') : (sigColor === 'yellow' ? '#f59e0b' : t.textMuted)
                  }}>
                    {timerVal}s
                  </span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    color: sigColorHex,
                    border: `1px solid ${sigColorHex}`,
                    padding: '2px 6px',
                    borderRadius: '2px',
                    backgroundColor: `${sigColorHex}15`
                  }}>
                    {sigColor.toUpperCase()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                <div>
                  <div className="mono" style={{ fontSize: '0.62rem', color: t.textSubtle }}>VEHICLES</div>
                  <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                    {appData.vehicle_count ?? 0}
                  </div>
                </div>
                <div>
                  <div className="mono" style={{ fontSize: '0.62rem', color: t.textSubtle }}>QUEUE</div>
                  <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: (appData.queue_length ?? 0) > 3 ? '#f59e0b' : t.textPrimary }}>
                    {appData.queue_length ?? appData.queue ?? 0}
                  </div>
                </div>
                <div>
                  <div className="mono" style={{ fontSize: '0.62rem', color: t.textSubtle }}>MEAN SPEED</div>
                  <div className="mono" style={{ fontSize: '0.85rem', color: t.textSecondary }}>
                    {appData.mean_speed ? `${appData.mean_speed} m/s` : '—'}
                  </div>
                </div>
                <div>
                  <div className="mono" style={{ fontSize: '0.62rem', color: t.textSubtle }}>WAIT TIME</div>
                  <div className="mono" style={{ fontSize: '0.85rem', color: t.textSecondary }}>
                    {appData.waiting_time ? `${appData.waiting_time}s` : '0.0s'}
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="mono" style={{ fontSize: '0.62rem', color: t.textMuted, marginTop: '6px', borderTop: `1px solid ${t.borderMain}`, paddingTop: '4px' }}>
                Cars: {bd.car ?? 0} | Buses: {bd.bus ?? 0} | Trucks: {bd.truck ?? 0} | Moto: {bd.motorcycle ?? 0}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        padding: '8px 12px',
        backgroundColor: t.bgSubtle,
        border: `1px solid ${t.borderMain}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span className="mono" style={{ fontSize: '0.68rem', color: t.textMuted }}>
          {sumoGui ? 'SUMO-GUI ACTIVE: Simulation window running on desktop' : 'HEADLESS SUMO: TraCI active at 10 Hz (step=0.1s)'}
        </span>
        <span className="mono" style={{ fontSize: '0.68rem', color: t.textSecondary }}>
          {isSumoRunning ? `TOTAL ACTIVE: ${sumoVehicleCount}` : 'STOPPED'}
        </span>
      </div>
    </div>
  );
}
