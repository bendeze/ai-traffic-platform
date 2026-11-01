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

function SumoTrafficLight({
  name,
  signal,
  timer,
}: {
  name: string;
  signal?: string;
  timer?: number;
}) {
  const isRed = signal === 'red';
  const isYellow = signal === 'yellow';
  const isGreen = signal === 'green';

  return (
    <div className="flex flex-col items-center gap-1 bg-zinc-900/90 dark:bg-zinc-950/90 border border-zinc-700/80 dark:border-zinc-800 shadow-lg px-2.5 py-1.5 rounded backdrop-blur-sm z-10 pointer-events-none">
      <div className="flex items-center justify-between w-full gap-2">
        <span className="font-mono text-[9px] font-bold tracking-wider text-zinc-200 uppercase">
          {name}
        </span>
        <span className="font-mono text-[10px] font-extrabold text-amber-400 bg-black/60 px-1 rounded">
          {timer ?? 0}s
        </span>
      </div>
      <div className="flex items-center gap-1.5 bg-black/80 px-2 py-1 rounded border border-zinc-800">
        <div
          title={`${name} Red`}
          className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
            isRed
              ? 'bg-red-500 ring-1 ring-red-400'
              : 'bg-red-950/40 opacity-30'
          }`}
        />
        <div
          title={`${name} Yellow`}
          className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
            isYellow
              ? 'bg-amber-400 ring-1 ring-amber-300'
              : 'bg-amber-950/40 opacity-30'
          }`}
        />
        <div
          title={`${name} Green`}
          className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
            isGreen
              ? 'bg-emerald-500 ring-1 ring-emerald-400'
              : 'bg-emerald-950/40 opacity-30'
          }`}
        />
      </div>
    </div>
  );
}

export default function VisionFeedMonitor({
  isSumoMode,
  isSnapshotMode,
  fps,
  sumoTime,
  data,
  isSumoRunning,
  sumoGui,
  sumoVehicleCount,
  sumoApproaches,
}: VisionFeedMonitorProps) {
  const getApp = (name: string) => {
    if (sumoApproaches && sumoApproaches[name]) return sumoApproaches[name];
    if (data?.approaches && data.approaches[name]) return data.approaches[name];
    return { signal: 'red', timer: 0 };
  };

  const north = getApp('north');
  const south = getApp('south');
  const east = getApp('east');
  const west = getApp('west');

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
          /* Docking Viewport with Live 4-Way Traffic Lights */
          <div className="relative w-full h-full p-4 flex flex-col justify-between items-center text-center select-none box-border min-h-[460px]">
            {/* Top Traffic Light: North Approach */}
            <div className="w-full flex justify-center pt-1">
              <SumoTrafficLight name="North" signal={north.signal} timer={north.timer} />
            </div>

            {/* Middle Row: West on Left, Center Docking Guide, East on Right */}
            <div className="w-full flex justify-between items-center px-2 my-auto">
              <div className="w-28 flex justify-start">
                <SumoTrafficLight name="West" signal={west.signal} timer={west.timer} />
              </div>

              {/* Center Docking Guide (Preserved) */}
              <div className="flex flex-col items-center justify-center p-4 max-w-sm mx-auto">
                <div className="font-mono text-xs font-extrabold tracking-widest text-zinc-900 dark:text-white mb-2 border border-zinc-900 dark:border-white px-3 py-1">
                  {isSumoRunning ? 'SUMO SIMULATION ACTIVE' : 'SUMO SIMULATION ENGINE'}
                </div>

                <p className="capitalize font-mono text-[9px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                  {isSumoRunning
                    ? 'Dock External SUMO-GUI Window Over This Viewport For Real-Time Side-by-Side Simulation'
                    : 'Click ▶ Start Above To Launch The Traffic Flow & External SUMO-GUI Window'}
                </p>

                <div className="flex items-center gap-3 font-mono text-[0.7rem] text-zinc-400 border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 px-3 py-1.5 rounded-sm">
                  <span>Sim Time: <strong className="text-zinc-900 dark:text-white">{sumoTime.toFixed(1)}s</strong></span>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span>Vehicles: <strong className="text-emerald-600 dark:text-emerald-400">{sumoVehicleCount}</strong></span>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span>Step: <strong className='text-[8px]'>10 Hz</strong></span>
                </div>
              </div>

              <div className="w-28 flex justify-end">
                <SumoTrafficLight name="East" signal={east.signal} timer={east.timer} />
              </div>
            </div>

            {/* Bottom Traffic Light: South Approach */}
            <div className="w-full flex justify-center pb-1">
              <SumoTrafficLight name="South" signal={south.signal} timer={south.timer} />
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
