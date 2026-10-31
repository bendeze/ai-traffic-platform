import React from 'react';
import { API_BASE } from '../api/client';
import SumoTelemetryGrid from './SumoTelemetryGrid';
import { TelemetryPayload, ApproachData } from '../types';

interface VisionFeedMonitorProps {
  isSumoMode: boolean;
  isSnapshotMode: boolean;
  fps: string;
  sumoTime: number;
  sumoApproaches: Record<string, ApproachData>;
  data: TelemetryPayload | null;
  isSumoRunning: boolean;
  sumoGui: boolean;
  sumoVehicleCount: number;
}

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
}: VisionFeedMonitorProps) {
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

      {/* Screen Monitor Container with Viewfinder Focus Markers */}
      <div className="relative flex-1 bg-slate-50 dark:bg-black flex items-center justify-center overflow-hidden min-h-[480px]">
        {!isSumoMode ? (
          <img
            src={`${API_BASE}/video/stream`}
            alt="Telemetry Stream"
            className="w-full h-full object-contain block transition-opacity duration-200"
            onError={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
            onLoad={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
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

        {/* Viewfinder Targeting Focus Brackets */}
        <div className="corner-bracket-tl" title="Camera Viewfinder Focus Bracket (Top-Left)" />
        <div className="corner-bracket-tr" title="Camera Viewfinder Focus Bracket (Top-Right)" />
        <div className="corner-bracket-bl" title="Camera Viewfinder Focus Bracket (Bottom-Left)" />
        <div className="corner-bracket-br" title="Camera Viewfinder Focus Bracket (Bottom-Right)" />
      </div>
    </section>
  );
}
