import React from 'react';
import { API_BASE } from '../api/client';
import { TelemetryPayload } from '../types';

interface VisionFeedMonitorProps {
  isSumoMode: boolean;
  isSnapshotMode: boolean;
  fps: string;
  sumoTime: number;
  data: TelemetryPayload | null;
  isSumoRunning: boolean;
  sumoGui: boolean;
  sumoVehicleCount: number;
  sumoApproaches?: any;
}

export default function VisionFeedMonitor({
  isSumoMode,
  isSnapshotMode,
  fps,
  sumoTime,
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

      {/* Screen Monitor / Docking Viewport Container */}
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
          /* Minimalist Docking Viewport for SUMO-GUI Desktop Window */
          <div className="w-full h-full p-8 flex flex-col justify-between items-center text-center select-none box-border">
            {/* Top Subheader Status */}
            <div className="w-full flex justify-between items-center border-b border-zinc-200 dark:border-zinc-900 pb-2">
              <span className="font-mono text-[0.68rem] text-zinc-400 tracking-wider">
                MICROSCOPIC SIMULATION VIEWPORT
              </span>
              <span className={`font-mono text-[0.68rem] font-bold ${
                isSumoRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'
              }`}>
                {isSumoRunning ? '● TRACI LIVE SYNCHRONIZED' : '○ ENGINE STANDBY'}
              </span>
            </div>

            {/* Center Docking Guide */}
            <div className="flex flex-col items-center justify-center my-auto p-6 max-w-md">
              <div className="font-mono text-xs font-extrabold tracking-widest text-zinc-900 dark:text-white mb-2 border border-zinc-900 dark:border-white px-3 py-1">
                {isSumoRunning ? 'SUMO SIMULATION ACTIVE' : 'SUMO SIMULATION ENGINE'}
              </div>

              <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                {isSumoRunning
                  ? 'DOCK EXTERNAL SUMO-GUI WINDOW OVER THIS VIEWPORT FOR REAL-TIME SIDE-BY-SIDE SIMULATION'
                  : 'CLICK ▶ START ABOVE TO LAUNCH MICROSCOPIC TRAFFIC FLOW & EXTERNAL SUMO-GUI WINDOW'}
              </p>

              <div className="flex items-center gap-3 font-mono text-[0.7rem] text-zinc-400 border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 px-3 py-1.5 rounded-sm">
                <span>SIM TIME: <strong className="text-zinc-900 dark:text-white">{sumoTime.toFixed(1)}s</strong></span>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <span>VEHICLES: <strong className="text-emerald-600 dark:text-emerald-400">{sumoVehicleCount}</strong></span>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <span>STEP: <strong>0.1s (10 Hz)</strong></span>
              </div>
            </div>

            {/* Bottom TraCI Engine Info */}
            <div className="w-full p-2 px-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-left">
              <span className="font-mono text-[0.68rem] text-zinc-500 dark:text-zinc-400">
                {sumoGui ? 'SUMO-GUI ACTIVE: Resize and place external window directly on this canvas' : 'HEADLESS MODE: TraCI active at 10 Hz'}
              </span>
              <span className="font-mono text-[0.68rem] text-zinc-600 dark:text-zinc-300 font-semibold">
                {isSumoRunning ? `TOTAL ACTIVE: ${sumoVehicleCount}` : 'STOPPED'}
              </span>
            </div>
          </div>
        )}

        {/* Viewfinder Targeting Focus Brackets */}
        <div className="corner-bracket-tl" title="Camera / Viewport Focus Bracket (Top-Left)" />
        <div className="corner-bracket-tr" title="Camera / Viewport Focus Bracket (Top-Right)" />
        <div className="corner-bracket-bl" title="Camera / Viewport Focus Bracket (Bottom-Left)" />
        <div className="corner-bracket-br" title="Camera / Viewport Focus Bracket (Bottom-Right)" />
      </div>
    </section>
  );
}
