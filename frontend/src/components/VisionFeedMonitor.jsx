import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { API_BASE } from '../api/client';
import SumoTelemetryGrid from './SumoTelemetryGrid';

export default function VisionFeedMonitor({
  isSumoMode,
  isSnapshotMode,
  fps,
  sumoTime,
  sumoApproaches,
  data,
  isSumoRunning,
  sumoGui,
  sumoVehicleCount,
}) {
  const { isLight, t, cornerTL, cornerTR, cornerBL, cornerBR } = useTheme();

  return (
    <section style={{
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: t.bgPanel,
      border: `1px solid ${t.borderMain}`
    }}>
      {/* Feed / Simulation Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: `1px solid ${t.borderMain}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>
            {isSumoMode ? 'SUMO ENGINE' : 'FEED 01'}
          </span>
          <span style={{ fontSize: '0.75rem', color: t.textDim }}>/</span>
          <span className="mono" style={{ fontSize: '0.7rem', color: t.textMuted }}>
            {isSumoMode
              ? 'TRACI CLOSED-LOOP 4-WAY INTERSECTION'
              : (isSnapshotMode ? 'PHOTO SNAPSHOT INSPECTION' : 'CONTINUOUS VEHICLE TRACKING')}
          </span>
        </div>
        <div className="mono" style={{ fontSize: '0.75rem', color: t.textMuted }}>
          {isSumoMode
            ? `TIME: ${sumoTime.toFixed(1)}s`
            : (isSnapshotMode ? `INTERVAL: 2.0s` : `${fps} FPS`)}
        </div>
      </div>

      {/* Screen Monitor */}
      <div style={{
        position: 'relative',
        flex: 1,
        backgroundColor: isLight ? '#f8fafc' : '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        minHeight: '480px'
      }}>
        {!isSumoMode ? (
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
        ) : (
          <SumoTelemetryGrid
            sumoApproaches={sumoApproaches}
            data={data}
            isSumoRunning={isSumoRunning}
            sumoGui={sumoGui}
            sumoVehicleCount={sumoVehicleCount}
          />
        )}

        {/* Minimalist Tech Corner Markers */}
        <div style={cornerTL} />
        <div style={cornerTR} />
        <div style={cornerBL} />
        <div style={cornerBR} />
      </div>
    </section>
  );
}
