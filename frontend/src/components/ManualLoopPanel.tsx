import React from 'react';
import { SignalPhase } from '../types';

interface ManualLoopPanelProps {
  currentPhase: SignalPhase;
  isLoopRunning: boolean;
  manualA: number;
  setManualA: (val: number) => void;
  manualB: number;
  setManualB: (val: number) => void;
  startManualLoop: () => void;
  stopManualLoop: () => void;
}

export default function ManualLoopPanel({
  currentPhase,
  isLoopRunning,
  manualA,
  setManualA,
  manualB,
  setManualB,
  startManualLoop,
  stopManualLoop,
}: ManualLoopPanelProps) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {/* Phase A Control */}
        <div className={`bg-white dark:bg-black border p-2.5 flex flex-col gap-2 transition-colors ${
          currentPhase === 'A' && isLoopRunning
            ? 'border-zinc-900 dark:border-white'
            : 'border-zinc-300 dark:border-zinc-800'
        }`}>
          <div className="flex justify-between items-center">
            <span className="font-mono text-xs font-extrabold tracking-wide text-zinc-900 dark:text-white">
              PHASE A (N · S)
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="5"
                max="120"
                value={manualA}
                onChange={(e) => {
                  const val = Math.max(5, parseInt(e.target.value) || 5);
                  setManualA(val);
                }}
                className="w-14 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 p-1 text-xs font-mono font-bold text-center outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
              />
              <span className="font-mono text-xs text-zinc-400">s</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="grid grid-cols-4 gap-1">
            {[15, 30, 45, 60].map((sec) => (
              <button
                key={sec}
                onClick={() => setManualA(sec)}
                className={`py-1 text-[0.65rem] font-mono font-bold border transition-colors cursor-pointer focus-visible:outline-1 focus-visible:outline-zinc-900 dark:focus-visible:outline-white ${
                  manualA === sec
                    ? 'bg-zinc-200 border-zinc-400 text-zinc-900 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white'
                    : 'bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 dark:bg-black dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Phase B Control */}
        <div className={`bg-white dark:bg-black border p-2.5 flex flex-col gap-2 transition-colors ${
          currentPhase === 'B' && isLoopRunning
            ? 'border-zinc-900 dark:border-white'
            : 'border-zinc-300 dark:border-zinc-800'
        }`}>
          <div className="flex justify-between items-center">
            <span className="font-mono text-xs font-extrabold tracking-wide text-zinc-900 dark:text-white">
              PHASE B (E · W)
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="5"
                max="120"
                value={manualB}
                onChange={(e) => {
                  const val = Math.max(5, parseInt(e.target.value) || 5);
                  setManualB(val);
                }}
                className="w-14 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 p-1 text-xs font-mono font-bold text-center outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
              />
              <span className="font-mono text-xs text-zinc-400">s</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="grid grid-cols-4 gap-1">
            {[15, 30, 45, 60].map((sec) => (
              <button
                key={sec}
                onClick={() => setManualB(sec)}
                className={`py-1 text-[0.65rem] font-mono font-bold border transition-colors cursor-pointer focus-visible:outline-1 focus-visible:outline-zinc-900 dark:focus-visible:outline-white ${
                  manualB === sec
                    ? 'bg-zinc-200 border-zinc-400 text-zinc-900 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white'
                    : 'bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 dark:bg-black dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Control Actions */}
      <div>
        {!isLoopRunning ? (
          <button
            onClick={startManualLoop}
            className="w-full btn-action bg-zinc-900 text-white dark:bg-white dark:text-black font-extrabold tracking-wider py-1.5 shadow-sm focus-visible:outline-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-white"
          >
            ▶ VALIDATE & START MANUAL LOOP ({manualA}s ➔ {manualB}s)
          </button>
        ) : (
          <div className="grid grid-cols-[1.4fr_1fr] gap-1">
            <button
              onClick={startManualLoop}
              className="btn-action py-1 text-xs"
            >
              ↻ UPDATE LOOP ({manualA}s / {manualB}s)
            </button>
            <button
              onClick={stopManualLoop}
              className="btn-action py-1 text-xs bg-red-100 border-red-400 text-red-600 hover:bg-red-200 dark:bg-red-950/60 dark:border-red-600 dark:text-red-300"
            >
              ⏹ PAUSE LOOP
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

