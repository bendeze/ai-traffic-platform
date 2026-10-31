import React from 'react';
import { VisionMode } from '../types';

interface SimulationBarProps {
  isSumoMode: boolean;
  isSnapshotMode: boolean;
  switchVisionMode: (mode: VisionMode) => void;
  snapshotInterval: number;
  nextSnapIn: number;
  snapCount: number;
  fps: string;
  isSumoRunning: boolean;
  isSumoPaused: boolean;
  sumoGui: boolean;
  setSumoGui: (gui: boolean) => void;
  sumoSpeed: number;
  sumoTime: number;
  sumoVehicleCount: number;
  startSumo: (gui?: boolean) => void;
  stopSumo: () => void;
  pauseSumo: () => void;
  resumeSumo: () => void;
  resetSumo: () => void;
  updateSumoSpeed: (spd: number) => void;
  setLog: (msg: string) => void;
}

export default function SimulationBar({
  isSumoMode,
  isSnapshotMode,
  switchVisionMode,
  snapshotInterval,
  nextSnapIn,
  snapCount,
  fps,
  isSumoRunning,
  isSumoPaused,
  sumoGui,
  setSumoGui,
  sumoSpeed,
  sumoTime,
  sumoVehicleCount,
  startSumo,
  stopSumo,
  pauseSumo,
  resumeSumo,
  resetSumo,
  updateSumoSpeed,
  setLog
}: SimulationBarProps) {
  if (!isSumoMode) {
    return (
      <div className="flex justify-between items-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3.5 py-2 mb-5">
        <div className="flex items-center gap-3.5">
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tracking-wider">
            VISION ENGINE:
          </span>
          <div className="inline-flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-0.5">
            <button
              onClick={() => switchVisionMode('tracking')}
              className={`font-mono text-xs font-bold tracking-wider px-4 py-1.5 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-white ${
                !isSnapshotMode
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              CONTINUOUS TRACKING
            </button>
            <button
              onClick={() => switchVisionMode('snapshot')}
              className={`font-mono text-xs font-bold tracking-wider px-4 py-1.5 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-white ${
                isSnapshotMode
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              SNAPSHOT {snapshotInterval}s
            </button>
          </div>
        </div>

        {/* Telemetry Indicator */}
        <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-3">
          {isSnapshotMode ? (
            <>
              <span>NEXT: <strong className="text-zinc-900 dark:text-white">{nextSnapIn}s</strong></span>
              <span className="text-zinc-400 dark:text-zinc-600">/</span>
              <span>CAPTURED: <strong className="text-zinc-900 dark:text-white">#{snapCount}</strong></span>
            </>
          ) : (
            <span>RATE: <strong className="text-zinc-900 dark:text-white">{fps} FPS</strong></span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3.5 py-2 mb-5 flex-wrap gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tracking-wider">
          SUMO ENGINE:
        </span>
        
        {/* State Badge */}
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-zinc-300 dark:border-zinc-700 rounded-sm bg-zinc-50 dark:bg-zinc-900/60">
          <span className={`w-1.5 h-1.5 rounded-full ${
            isSumoRunning ? (isSumoPaused ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-zinc-400 dark:bg-zinc-600'
          }`} />
          <span className={`font-mono text-xs font-bold ${
            isSumoRunning 
              ? (isSumoPaused ? 'text-amber-500' : 'text-emerald-700 dark:text-emerald-400') 
              : 'text-zinc-500 dark:text-zinc-400'
          }`}>
            {isSumoRunning ? (isSumoPaused ? 'PAUSED' : 'RUNNING') : 'STOPPED'}
          </span>
        </div>

        {/* Action Controls */}
        {!isSumoRunning ? (
          <button
            onClick={() => startSumo(sumoGui)}
            className="btn-minimal border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold"
          >
            ▶ START
          </button>
        ) : (
          <>
            {isSumoPaused ? (
              <button
                onClick={resumeSumo}
                className="btn-minimal border-emerald-500 text-emerald-700 dark:text-emerald-400"
              >
                ▶ RESUME
              </button>
            ) : (
              <button
                onClick={pauseSumo}
                className="btn-minimal border-amber-500 text-amber-600 dark:text-amber-300"
              >
                ⏸ PAUSE
              </button>
            )}
            <button onClick={resetSumo} className="btn-minimal">
              ↺ RESET
            </button>
            <button
              onClick={stopSumo}
              className="btn-minimal border-red-500 text-red-600 dark:text-red-300"
            >
              ⏹ STOP
            </button>
          </>
        )}

        {/* GUI Toggle */}
        <button
          onClick={() => {
            const nextGui = !sumoGui;
            setSumoGui(nextGui);
            setLog(`SUMO GUI PREFERENCE: ${nextGui ? 'ENABLED' : 'HEADLESS'}`);
            if (isSumoRunning) {
              stopSumo();
              startSumo(nextGui);
            }
          }}
          className={sumoGui ? 'btn-minimal-active !text-[0.65rem]' : 'btn-minimal !text-[0.65rem]'}
          title="Launch external SUMO-GUI window on desktop"
        >
          GUI: {sumoGui ? 'ON' : 'OFF'}
        </button>

        {/* Speed Factor */}
        <div className="flex items-center gap-1 ml-1.5">
          <span className="font-mono text-xs text-zinc-400">SPEED:</span>
          {[0.5, 1.0, 2.0, 3.0].map((spd) => (
            <button
              key={spd}
              onClick={() => updateSumoSpeed(spd)}
              className={`font-mono text-[0.65rem] px-2 py-0.5 border cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-white ${
                sumoSpeed === spd
                  ? 'border-zinc-900 text-zinc-900 font-bold dark:border-white dark:text-white'
                  : 'border-zinc-300 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Telemetry Stats */}
      <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-3">
        <span>SIM TIME: <strong className="text-zinc-900 dark:text-white">{sumoTime.toFixed(1)}s</strong></span>
        <span className="text-zinc-400 dark:text-zinc-600">/</span>
        <span>SIM VEHICLES: <strong className="text-emerald-700 dark:text-emerald-400">{sumoVehicleCount}</strong></span>
      </div>
    </div>
  );
}
