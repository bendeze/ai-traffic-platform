import React from 'react';
import { TelemetryPayload, ApproachData } from '../types';

interface SumoTelemetryGridProps {
  sumoApproaches: Record<string, ApproachData>;
  data: TelemetryPayload | null;
  isSumoRunning: boolean;
  sumoGui: boolean;
  sumoVehicleCount: number;
}

export default function SumoTelemetryGrid({
  sumoApproaches,
  data,
  isSumoRunning,
  sumoGui,
  sumoVehicleCount,
}: SumoTelemetryGridProps) {
  return (
    <div className="w-full h-full p-6 flex flex-col justify-between box-border">
      {/* Grid Subheader */}
      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          APPROACH TELEMETRY — 4-WAY MICROSCOPIC FLOW
        </span>
        <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
          ● TRACI LIVE SYNCHRONIZED
        </span>
      </div>

      {/* 2x2 Grid of Approaches */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
        {['north', 'south', 'east', 'west'].map((app) => {
          const appData = sumoApproaches[app] || data?.approaches?.[app] || {};
          const sigColor = appData.signal || data?.approaches?.[app]?.signal || 'red';
          const timerVal = appData.timer ?? data?.approaches?.[app]?.timer ?? 0;
          const bd = appData.breakdown || {};

          // Dynamic border & badge color classes
          const borderClass = sigColor === 'green'
            ? 'border-emerald-500/80 shadow-[0_0_10px_rgba(34,197,94,0.15)]'
            : sigColor === 'yellow'
            ? 'border-amber-500/80'
            : 'border-zinc-200 dark:border-zinc-800';

          const badgeClass = sigColor === 'green'
            ? 'text-emerald-700 bg-emerald-100 border-emerald-500 dark:text-emerald-400 dark:bg-emerald-950/40'
            : sigColor === 'yellow'
            ? 'text-amber-700 bg-amber-100 border-amber-500 dark:text-amber-400 dark:bg-amber-950/40'
            : 'text-red-700 bg-red-100 border-red-500 dark:text-red-400 dark:bg-red-950/40';

          return (
            <div
              key={app}
              className={`bg-white dark:bg-zinc-950 border ${borderClass} p-3.5 flex flex-col gap-2 transition-colors duration-200 shadow-sm dark:shadow-none`}
            >
              <div className="flex justify-between items-center">
                <span className="font-mono text-sm font-extrabold tracking-wide text-zinc-900 dark:text-white">
                  {app.toUpperCase()} APPROACH
                </span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-extrabold ${
                    sigColor === 'green' ? 'text-emerald-600 dark:text-emerald-400' : (sigColor === 'yellow' ? 'text-amber-500' : 'text-zinc-400')
                  }`}>
                    {timerVal}s
                  </span>
                  <span className={`text-[0.65rem] font-bold px-1.5 py-0.5 border rounded-sm ${badgeClass}`}>
                    {sigColor.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Approach Metrics */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <div className="font-mono text-[0.65rem] text-zinc-400">VEHICLES</div>
                  <div className="font-mono text-lg font-extrabold text-zinc-900 dark:text-white">
                    {appData.vehicle_count ?? 0}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[0.65rem] text-zinc-400">QUEUE</div>
                  <div className={`font-mono text-lg font-extrabold ${
                    (appData.queue_length ?? 0) > 3 ? 'text-amber-500' : 'text-zinc-900 dark:text-white'
                  }`}>
                    {appData.queue_length ?? appData.queue ?? 0}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[0.65rem] text-zinc-400">MEAN SPEED</div>
                  <div className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                    {appData.mean_speed ? `${appData.mean_speed} m/s` : '—'}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[0.65rem] text-zinc-400">WAIT TIME</div>
                  <div className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                    {appData.waiting_time ? `${appData.waiting_time}s` : '0.0s'}
                  </div>
                </div>
              </div>

              {/* Classification Breakdown */}
              <div className="font-mono text-[0.65rem] text-zinc-400 mt-1 border-t border-zinc-100 dark:border-zinc-900 pt-1">
                Cars: {bd.car ?? 0} | Buses: {bd.bus ?? 0} | Trucks: {bd.truck ?? 0} | Moto: {bd.motorcycle ?? 0}
              </div>
            </div>
          );
        })}
      </div>

      {/* TraCI Status Strip */}
      <div className="p-2 px-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {sumoGui ? 'SUMO-GUI ACTIVE: Simulation window running on desktop' : 'HEADLESS SUMO: TraCI active at 10 Hz (step=0.1s)'}
        </span>
        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300 font-semibold">
          {isSumoRunning ? `TOTAL ACTIVE: ${sumoVehicleCount}` : 'STOPPED'}
        </span>
      </div>
    </div>
  );
}

