import React from 'react';

export default function ApproachTelemetryGrid({
  data,
  activePedestrian,
  requestPedestrian,
}) {
  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-5 flex-1">
      <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tracking-wider mb-3.5">
        APPROACH TELEMETRY & VEHICLE CLASSIFICATION
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div
              key={app}
              className={`bg-white dark:bg-black border ${
                hasAmb ? 'border-red-500 animate-pulse' : 'border-zinc-200 dark:border-zinc-800'
              } p-3 flex flex-col justify-between min-h-[145px] shadow-sm dark:shadow-none`}
            >
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-bold tracking-wide text-zinc-900 dark:text-white">
                  {app.toUpperCase()} {hasAmb && '🚑'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`font-mono text-xs font-extrabold ${
                    isGreen ? 'text-emerald-600 dark:text-emerald-400' : (info.signal === 'yellow' ? 'text-amber-500' : 'text-zinc-400')
                  }`}>
                    {timerVal}s
                  </span>
                  <span className={`font-mono text-[0.65rem] px-1.5 py-0.5 border ${
                    isGreen
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'border-zinc-300 dark:border-zinc-700 text-zinc-400'
                  }`}>
                    {info.signal.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="my-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-extrabold text-zinc-900 dark:text-white">
                    {String(info.queue).padStart(2, '0')}
                  </span>
                  <span className="text-[0.68rem] text-zinc-400">VEHICLES</span>
                </div>
                
                {/* Detailed counts */}
                <div className="font-mono text-[0.65rem] text-zinc-500 dark:text-zinc-400 mt-1 leading-tight">
                  CARS:{bd.car || 0} · TRUCKS:{bd.truck || 0} · BIKES:{bd.motorcycle || 0} · BUS:{bd.bus || 0}
                </div>

                <div className="font-mono text-[0.65rem] text-zinc-400 mt-0.5">
                  WAIT {Math.round(info.waiting_time)}s (CAP: 30s)
                </div>
              </div>

              <button
                onClick={() => requestPedestrian(app)}
                className={`w-full py-1.5 text-xs font-mono font-bold tracking-wider cursor-pointer border transition-colors ${
                  isPedActive
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-white'
                }`}
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
