import React from 'react';
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
  return (
    <section className="flex flex-col bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
      {/* Feed / Simulation Subheader */}
      <div className="flex justify-between items-center p-3 px-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold tracking-wider text-zinc-900 dark:text-white">
            {isSumoMode ? 'SUMO ENGINE' : 'FEED 01'}
          </span>
          <span className="text-xs text-zinc-300 dark:text-zinc-700">/</span>
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {isSumoMode
              ? 'TRACI CLOSED-LOOP 4-WAY INTERSECTION'
              : (isSnapshotMode ? 'PHOTO SNAPSHOT INSPECTION' : 'CONTINUOUS VEHICLE TRACKING')}
          </span>
        </div>
        <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {isSumoMode
            ? `TIME: ${sumoTime.toFixed(1)}s`
            : (isSnapshotMode ? 'INTERVAL: 2.0s' : `${fps} FPS`)}
        </div>
      </div>

      {/* Screen Monitor Container */}
      <div className="relative flex-1 bg-slate-50 dark:bg-black flex items-center justify-center overflow-hidden min-h-[480px]">
        {!isSumoMode ? (
          <img
            src={`${API_BASE}/video/stream`}
            alt="Telemetry Stream"
            className="w-full h-full object-contain block transition-opacity duration-200"
            onError={(e) => { e.currentTarget.style.opacity = '0'; }}
            onLoad={(e) => { e.currentTarget.style.opacity = '1'; }}
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
        <div className="corner-bracket-tl" />
        <div className="corner-bracket-tr" />
        <div className="corner-bracket-bl" />
        <div className="corner-bracket-br" />
      </div>
    </section>
  );
}
