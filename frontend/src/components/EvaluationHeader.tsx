import React from 'react';
import { ArrowLeft, History, BarChart3 } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { EvaluationHistoryItem } from '../types';

interface EvaluationHeaderProps {
  currentEvaluationId?: string | null;
  history: EvaluationHistoryItem[];
  onSelectEvaluation: (evalId: string) => void;
  onBackToSimulation: () => void;
}

export default function EvaluationHeader({
  currentEvaluationId,
  history,
  onSelectEvaluation,
  onBackToSimulation,
}: EvaluationHeaderProps) {
  return (
    <header className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4 flex-wrap gap-3">
      {/* Brand & Page Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBackToSimulation}
          className="btn-minimal !text-[0.68rem] !py-1 !px-2.5 flex items-center gap-1.5"
          title="Return to live simulation"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> SIMULATION
        </button>

        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-800 hidden sm:block" />

        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-mono text-[0.68rem] font-bold text-zinc-800 dark:text-zinc-200 tracking-wider">
            EVALUATION DASHBOARD
          </span>
          {currentEvaluationId && (
            <span className="font-mono text-[0.65rem] px-2 py-0.5 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-sm">
              {currentEvaluationId}
            </span>
          )}
        </div>
      </div>

      {/* Right Controls: Evaluation Session Selector & Theme */}
      <div className="flex items-center gap-2 flex-wrap">
        {history.length > 0 && (
          <div className="flex items-center border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1">
            <History className="w-3.5 h-3.5 text-zinc-400 mr-1.5" />
            <span className="font-mono text-[0.65rem] text-zinc-400 mr-2">SESSION:</span>
            <select
              value={currentEvaluationId || ''}
              onChange={(e) => onSelectEvaluation(e.target.value)}
              className="bg-transparent border-0 font-mono text-[0.68rem] text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
            >
              {history.map((h) => (
                <option key={h.evaluationId} value={h.evaluationId} className="bg-white dark:bg-zinc-900">
                  {h.evaluationId} ({h.scaleLabel ? h.scaleLabel.split(' ')[0] : 'Standard'} · {h.timestamp})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ml-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

