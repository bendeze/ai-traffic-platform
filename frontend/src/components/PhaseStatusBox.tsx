import React from 'react';
import ManualLoopPanel from './ManualLoopPanel';
import { SignalPhase, SignalColor, OperatingMode } from '../types';

interface PhaseStatusBoxProps {
  currentPhase: SignalPhase;
  signalState: SignalColor;
  remaining: number;
  reason: string;
  mode: OperatingMode;
  switchMode: (mode: OperatingMode) => void;
  isLoopRunning: boolean;
  manualA: number;
  setManualA: (val: number) => void;
  manualB: number;
  setManualB: (val: number) => void;
  startManualLoop: () => void;
  stopManualLoop: () => void;
}

export default function PhaseStatusBox({
  currentPhase,
  signalState,
  remaining,
  reason,
  mode,
  switchMode,
  isLoopRunning,
  manualA,
  setManualA,
  manualB,
  setManualB,
  startManualLoop,
  stopManualLoop,
}: PhaseStatusBoxProps) {
  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tracking-wider mb-1">
            ACTIVE PHASE
          </div>
          <div className="text-5xl font-extrabold leading-none tracking-tight text-zinc-900 dark:text-white">
            PHASE {currentPhase}
          </div>
          <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
            {currentPhase === 'A' ? 'NORTH · SOUTH GREEN' : 'EAST · WEST GREEN'}
          </div>
          <div className="font-mono text-[0.68rem] text-sky-600 dark:text-sky-400 mt-1.5 font-bold">
            RULE: {reason.toUpperCase().replace(/_/g, ' ')}
          </div>
        </div>

        {/* 3-Bulb Horizontal Traffic Light Widget */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2 bg-zinc-100 dark:bg-zinc-900 p-2 px-3 border border-zinc-300 dark:border-zinc-800 rounded">
            {/* RED BULB */}
            <div className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
              signalState === 'red'
                ? 'bg-red-500 shadow-[0_0_10px_#ef4444]'
                : 'bg-zinc-300 dark:bg-zinc-800'
            }`} />
            {/* YELLOW BULB */}
            <div className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
              signalState === 'yellow'
                ? 'bg-amber-500 shadow-[0_0_10px_#f59e0b]'
                : 'bg-zinc-300 dark:bg-zinc-800'
            }`} />
            {/* GREEN BULB */}
            <div className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
              signalState === 'green'
                ? 'bg-emerald-500 shadow-[0_0_10px_#22c55e]'
                : 'bg-zinc-300 dark:bg-zinc-800'
            }`} />
          </div>

          <div className="font-mono text-2xl font-extrabold text-zinc-900 dark:text-white">
            {String(remaining).padStart(2, '0')}s
          </div>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-2 gap-px bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => switchMode('adaptive')}
          className={`py-2.5 font-mono text-xs font-bold tracking-wider cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-white ${
            mode === 'adaptive'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
              : 'bg-white text-zinc-500 hover:text-zinc-900 dark:bg-black dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          ADAPTIVE
        </button>
        <button
          onClick={() => switchMode('manual')}
          className={`py-2.5 font-mono text-xs font-bold tracking-wider cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-white ${
            mode === 'manual'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
              : 'bg-white text-zinc-500 hover:text-zinc-900 dark:bg-black dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          MANUAL
        </button>
      </div>

      {mode === 'manual' && (
        <ManualLoopPanel
          currentPhase={currentPhase}
          isLoopRunning={isLoopRunning}
          manualA={manualA}
          setManualA={setManualA}
          manualB={manualB}
          setManualB={setManualB}
          startManualLoop={startManualLoop}
          stopManualLoop={stopManualLoop}
        />
      )}
    </div>
  );
}

