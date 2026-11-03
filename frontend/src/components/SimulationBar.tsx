import React from 'react';
import { VisionMode } from '../types';
import { Play, Pause, RotateCcw, Square, TrendingUp, BarChart2 } from 'lucide-react';

// Use BarChart2 from lucide-react as TrendingUpDown icon alias for report metrics
const TrendingUpDown = BarChart2;

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
  // Evaluation Props
  isEvaluating?: boolean;
  evalProgress?: number;
  evalMessage?: string;
  evalScale?: string;
  setEvalScale?: (scale: string) => void;
  startEvaluation?: () => void;
  stopEvaluation?: () => void;
  hasEvaluationResult?: boolean;
  latestEvaluationId?: string | null;
  onViewLatestEvaluation?: () => void;
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
  setLog,
  isEvaluating = false,
  evalProgress = 0,
  evalMessage = '',
  evalScale = 'standard',
  setEvalScale,
  startEvaluation,
  stopEvaluation,
  onViewLatestEvaluation,
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
          <span className={`font-mono text-xs font-bold ${
            isEvaluating
              ? 'text-emerald-600 dark:text-emerald-400'
              : isSumoRunning 
              ? (isSumoPaused ? 'text-amber-500' : 'text-emerald-700 dark:text-emerald-400') 
              : 'text-zinc-500 dark:text-zinc-400'
          }`}>
            {isEvaluating
              ? 'EVALUATING'
              : isSumoRunning 
              ? (isSumoPaused ? 'PAUSED' : 'RUNNING') 
              : 'STOPPED'}
          </span>
        </div>

        {/* Action Controls: [ Start ] [ Evaluate ] */}
        {!isSumoRunning ? (
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => startSumo(sumoGui)}
              disabled={isEvaluating}
              className="btn-minimal border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5 disabled:opacity-40"
              title="Start real-time interactive SUMO simulation"
            >
              <Play className="w-3.5 h-3.5" /> START
            </button>

            {startEvaluation && (
              <button
                onClick={startEvaluation}
                disabled={isEvaluating}
                className={`btn-minimal border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 disabled:opacity-40 ${
                  isEvaluating ? 'bg-emerald-500/10 animate-pulse' : ''
                }`}
                title="Run automated comparative evaluation between Manual and Adaptive modes"
              >
                <TrendingUp className="w-3.5 h-3.5" /> EVALUATE
              </button>
            )}
          </div>
        ) : (
          <>
            {isSumoPaused ? (
              <button
                onClick={resumeSumo}
                className="btn-minimal border-emerald-500 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" /> RESUME
              </button>
            ) : (
              <button
                onClick={pauseSumo}
                className="btn-minimal border-amber-500 text-amber-600 dark:text-amber-300 flex items-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5" /> PAUSE
              </button>
            )}
            <button onClick={resetSumo} className="btn-minimal flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> RESET
            </button>
            <button
              onClick={stopSumo}
              className="btn-minimal border-red-500 text-red-600 dark:text-red-300 flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" /> STOP
            </button>
            {startEvaluation && (
              <button
                onClick={startEvaluation}
                disabled={isEvaluating}
                className="btn-minimal border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 disabled:opacity-40"
                title="Stop current simulation and run automated evaluation"
              >
                <TrendingUp className="w-3.5 h-3.5" /> EVALUATE
              </button>
            )}
          </>
        )}

        {/* Traffic Scale Preset Selector */}
        {setEvalScale && (
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs text-zinc-400">Scale:</span>
            <select
              value={evalScale}
              onChange={(e) => setEvalScale(e.target.value)}
              disabled={isEvaluating}
              className="font-mono text-[0.68rem] bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 px-1.5 py-0.5 rounded cursor-pointer disabled:opacity-40"
              title="Traffic inflow scale preset for evaluation"
            >
              <option value="off_peak">Off-Peak (0.5x ~950 veh/h)</option>
              <option value="standard">Standard (1.0x ~1,905 veh/h)</option>
              <option value="rush_hour">Rush Hour (1.5x ~2,850 veh/h)</option>
            </select>
          </div>
        )}

        {/* Evaluation Active Progress Indicator */}
        {isEvaluating && (
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 font-mono text-xs rounded-sm">
            <div className="w-2.5 h-2.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="font-bold">{evalMessage || `EVALUATING (${Math.round(evalProgress)}%)`}</span>
            {stopEvaluation && (
              <button
                onClick={stopEvaluation}
                className="ml-1 text-[0.65rem] underline text-red-500 hover:text-red-400"
                title="Cancel evaluation"
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* View Latest Report shortcut button */}
        <button
          onClick={onViewLatestEvaluation}
          className="btn-minimal !text-[0.65rem] border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1.5"
          title="Open latest comparative evaluation report"
        >
          <TrendingUpDown className='w-4 h-4' /> VIEW REPORTS
        </button>

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
          <span className="font-mono text-xs text-zinc-400">Speed:</span>
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
        <span>Sim Time: <strong className="text-zinc-900 dark:text-white">{sumoTime.toFixed(1)}s</strong></span>
        <span className="text-zinc-400 dark:text-zinc-600">/</span>
        <span>Sim Vehicles: <strong className="text-emerald-700 dark:text-emerald-400">{sumoVehicleCount}</strong></span>
      </div>
    </div>
  );}