import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Gauge,
  Car,
  Activity,
  Download,
  CheckCircle2,
  AlertCircle,
  Cpu,
} from 'lucide-react';
import EvaluationHeader from './EvaluationHeader';
import { apiClient } from '../api/client';
import { EvaluationResult, EvaluationHistoryItem, EvaluationMetric } from '../types';

interface EvaluationPageProps {
  initialEvaluationId?: string | null;
  onBackToSimulation: () => void;
}

// Minimalist Dark/Light tooltip for Recharts
const MinimalistTooltip = ({ active, payload, label, unit = '' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900/95 dark:bg-zinc-950/95 text-zinc-100 border border-zinc-800 px-3 py-2 rounded shadow-sm font-mono text-xs backdrop-blur-sm">
        <div className="text-zinc-400 font-bold mb-1 border-b border-zinc-800 pb-0.5 text-[0.68rem]">
          {label}
        </div>
        <div className="space-y-1">
          {payload.map((entry: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-4 text-[0.68rem]">
              <span className="flex items-center gap-1.5" style={{ color: entry.color || entry.stroke || entry.fill }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: entry.color || entry.stroke || entry.fill }} />
                {entry.name}:
              </span>
              <strong className="text-zinc-100 font-mono">
                {entry.value} {unit}
              </strong>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function EvaluationPage({
  initialEvaluationId,
  onBackToSimulation,
}: EvaluationPageProps) {
  const [evaluationId, setEvaluationId] = useState<string | null>(initialEvaluationId || null);
  const [data, setData] = useState<EvaluationResult | null>(null);
  const [history, setHistory] = useState<EvaluationHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load available evaluation history
  useEffect(() => {
    apiClient
      .getEvaluationHistory()
      .then((res) => {
        if (res.evaluations && res.evaluations.length > 0) {
          setHistory(res.evaluations);
          if (!evaluationId || evaluationId === 'latest') {
            setEvaluationId(res.evaluations[0].evaluationId);
          }
        }
      })
      .catch((err) => console.error('Failed to load evaluation history:', err));
  }, []);

  // Fetch evaluation results whenever evaluationId changes
  useEffect(() => {
    if (!evaluationId || evaluationId === 'latest') {
      return;
    }
    window.history.replaceState({}, '', `/evaluation/${evaluationId}`);
    setLoading(true);
    setError(null);
    apiClient
      .getEvaluationResults(evaluationId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load evaluation results');
        setLoading(false);
      });
  }, [evaluationId]);

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.metadata.evaluationId}_results.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Find individual metrics helper
  const getMetric = (name: string): EvaluationMetric | undefined => {
    return data?.metrics.find((m) => m.name === name);
  };

  const waitMetric = getMetric('avg_waiting_time');
  const travelMetric = getMetric('avg_travel_time');
  const speedMetric = getMetric('avg_speed');
  const queueMetric = getMetric('max_queue_length');

  // Format grouped bar comparison chart data
  const coreBenchmarksData = [
    {
      metric: 'Avg Wait (s)',
      Manual: waitMetric?.manual ?? 0,
      Adaptive: waitMetric?.adaptive ?? 0,
    },
    {
      metric: 'Avg Travel (s)',
      Manual: travelMetric?.manual ?? 0,
      Adaptive: travelMetric?.adaptive ?? 0,
    },
    {
      metric: 'Max Queue (veh)',
      Manual: queueMetric?.manual ?? 0,
      Adaptive: queueMetric?.adaptive ?? 0,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 flex flex-col font-sans transition-colors">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* HEADER                                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <EvaluationHeader
        currentEvaluationId={evaluationId}
        history={history}
        onSelectEvaluation={(id) => setEvaluationId(id)}
        onBackToSimulation={onBackToSimulation}
      />

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="font-mono text-xs text-zinc-400">LOADING METRICS...</span>
        </div>
      ) : error || !data ? (
        <div className="p-4 border border-red-500/30 bg-red-500/10 rounded font-mono text-xs text-red-500 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error || 'Unable to display evaluation analytics for this session.'}</span>
        </div>
      ) : (
        <div className="space-y-5 flex-1 flex flex-col">
          {/* ───────────────────────────────────────────────────────────────── */}
          {/* MINIMALIST TOP STATUS BAR                                         */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/70 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 px-4 py-2.5 rounded-md">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                {data.narrative?.verdict || 'Evaluation Complete'}
              </span>
              <span className="h-3 w-px bg-zinc-200 dark:bg-zinc-800" />
              <span className="font-mono text-[0.65rem] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
                Adaptive AI Optimization
              </span>
              {data.metadata?.scaleLabel && (
                <>
                  <span className="h-3 w-px bg-zinc-200 dark:bg-zinc-800" />
                  <span className="font-mono text-[0.65rem] text-zinc-500 dark:text-zinc-400">
                    Scale: {data.metadata.scaleLabel}
                  </span>
                </>
              )}
            </div>

            <button
              onClick={handleExportJson}
              className="btn-minimal !text-[0.68rem] !py-1 !px-2.5 flex items-center gap-1.5 self-end sm:self-auto"
              title="Download results as JSON"
            >
              <Download className="w-3.5 h-3.5" /> EXPORT JSON
            </button>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 4 CORE KPI CARDS                                                  */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* KPI 1: Average Waiting Time */}
            <div className="bg-white/70 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-md">
              <div className="flex justify-between items-start">
                <span className="font-mono text-[0.68rem] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Avg Waiting Time
                </span>
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-mono text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
                  {waitMetric?.adaptive ?? 0}s
                </span>
                <span className="font-mono text-[0.68rem] text-zinc-400">
                  vs {waitMetric?.manual ?? 0}s
                </span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-[0.68rem] font-mono">
                <TrendingDown className="w-3 h-3 text-emerald-500" />
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.abs(waitMetric?.improvement ?? 0).toFixed(1)}% reduction
                </span>
              </div>
            </div>

            {/* KPI 2: Average Travel Time */}
            <div className="bg-white/70 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-md">
              <div className="flex justify-between items-start">
                <span className="font-mono text-[0.68rem] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Avg Travel Time
                </span>
                <Activity className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-mono text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
                  {travelMetric?.adaptive ?? 0}s
                </span>
                <span className="font-mono text-[0.68rem] text-zinc-400">
                  vs {travelMetric?.manual ?? 0}s
                </span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-[0.68rem] font-mono">
                <TrendingDown className="w-3 h-3 text-emerald-500" />
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.abs(travelMetric?.improvement ?? 0).toFixed(1)}% faster
                </span>
              </div>
            </div>

            {/* KPI 3: Mean Vehicle Speed */}
            <div className="bg-white/70 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-md">
              <div className="flex justify-between items-start">
                <span className="font-mono text-[0.68rem] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Average Speed
                </span>
                <Gauge className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-mono text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
                  {speedMetric?.adaptive ?? 0} <span className="text-xs font-normal text-zinc-400">km/h</span>
                </span>
                <span className="font-mono text-[0.68rem] text-zinc-400">
                  vs {speedMetric?.manual ?? 0} km/h
                </span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-[0.68rem] font-mono">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  +{speedMetric?.improvement ?? 0}% faster
                </span>
              </div>
            </div>

            {/* KPI 4: Maximum Intersection Queue */}
            <div className="bg-white/70 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-md">
              <div className="flex justify-between items-start">
                <span className="font-mono text-[0.68rem] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Max Queue Length
                </span>
                <Car className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-mono text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
                  {queueMetric?.adaptive ?? 0} <span className="text-xs font-normal text-zinc-400">veh</span>
                </span>
                <span className="font-mono text-[0.68rem] text-zinc-400">
                  vs {queueMetric?.manual ?? 0} veh
                </span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-[0.68rem] font-mono">
                <TrendingDown className="w-3 h-3 text-emerald-500" />
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.abs(queueMetric?.improvement ?? 0).toFixed(1)}% queue reduction
                </span>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* CHARTS GRID                                                       */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chart 1: Queue Dynamics */}
            <div className="bg-white/70 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-md">
              <div className="mb-3">
                <h3 className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Queue Dynamics Over Time
                </h3>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.charts.queueOverTime}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="manualQueueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="adaptiveQueueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#71717a15" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false}
                    />
                    <Tooltip content={<MinimalistTooltip unit="veh" />} />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '8px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="manualQueue"
                      name="Manual Fixed"
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      fillOpacity={1}
                      fill="url(#manualQueueGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="adaptiveQueue"
                      name="Adaptive AI"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#adaptiveQueueGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Cumulative Throughput */}
            <div className="bg-white/70 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-md">
              <div className="mb-3">
                <h3 className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Cumulative Throughput
                </h3>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.charts.throughputOverTime}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#71717a15" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false}
                    />
                    <Tooltip content={<MinimalistTooltip unit="veh" />} />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '8px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="manualThroughput"
                      name="Manual Fixed"
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="adaptiveThroughput"
                      name="Adaptive AI"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Wait Time Distribution */}
            <div className="bg-white/70 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-md">
              <div className="mb-3">
                <h3 className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Wait Time Distribution
                </h3>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.charts.waitingDistribution}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#71717a15" />
                    <XAxis
                      dataKey="range"
                      tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false}
                    />
                    <Tooltip content={<MinimalistTooltip unit="veh" />} />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '8px' }}
                    />
                    <Bar
                      dataKey="manualCount"
                      name="Manual Fixed"
                      fill="#ef4444"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="adaptiveCount"
                      name="Adaptive AI"
                      fill="#10b981"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Core Comparison */}
            <div className="bg-white/70 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-md">
              <div className="mb-3">
                <h3 className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Core Metrics Comparison
                </h3>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={coreBenchmarksData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#71717a15" />
                    <XAxis
                      dataKey="metric"
                      tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false}
                    />
                    <Tooltip content={<MinimalistTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '8px' }}
                    />
                    <Bar
                      dataKey="Manual"
                      name="Manual Fixed"
                      fill="#ef4444"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="Adaptive"
                      name="Adaptive AI"
                      fill="#10b981"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* PERFORMANCE METRICS TABLE                                         */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="bg-white/70 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Performance Metrics
              </h3>
              <span className="font-mono text-[0.62rem] text-zinc-400">
                Network: {data.metadata.networkName}
              </span>
            </div>

            <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded">
              <table className="w-full font-mono text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100/60 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-[0.65rem] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    <th className="py-2 px-3 font-semibold">Metric</th>
                    <th className="py-2 px-3 font-semibold text-right">Manual</th>
                    <th className="py-2 px-3 font-semibold text-right">Adaptive AI</th>
                    <th className="py-2 px-3 font-semibold text-right">Delta</th>
                    <th className="py-2 px-3 font-semibold text-right">Gain</th>
                    <th className="py-2 px-3 font-semibold text-center">Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {data.metrics
                    .filter((m) => m.category !== 'benchmark' && m.name !== 'execution_time' && m.name !== 'simulation_duration')
                    .map((m) => {
                      const isPositive = m.better === 'adaptive';
                      const isManual = m.better === 'manual';

                      return (
                        <tr
                          key={m.name}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-2 px-3 font-bold text-zinc-800 dark:text-zinc-200">
                            {m.label}
                          </td>
                          <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                            {m.manual} <span className="text-[0.65rem] text-zinc-500">{m.unit}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {m.adaptive} <span className="text-[0.65rem] text-zinc-500">{m.unit}</span>
                          </td>
                          <td className="py-2 px-3 text-right text-zinc-500 dark:text-zinc-400">
                            {m.diff > 0 ? `+${m.diff}` : m.diff} {m.unit}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded text-[0.65rem] ${
                                isPositive
                                  ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20'
                                  : isManual
                                  ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-500/20'
                                  : 'text-zinc-500 dark:text-zinc-400'
                              }`}
                            >
                              {m.improvement > 0 ? `+${m.improvement}%` : `${m.improvement}%`}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {isPositive ? (
                              <span className="inline-flex items-center gap-1 font-bold text-[0.62rem] text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" /> ADAPTIVE
                              </span>
                            ) : isManual ? (
                              <span className="inline-flex items-center gap-1 font-bold text-[0.62rem] text-zinc-500 dark:text-zinc-400">
                                MANUAL
                              </span>
                            ) : (
                              <span className="text-[0.62rem] text-zinc-400 font-bold">
                                EQUAL
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Simulation & Compute Benchmark Telemetry */}
            {(() => {
              const benchmarks = data.metrics.filter(
                (m) => m.category === 'benchmark' || m.name === 'execution_time' || m.name === 'simulation_duration'
              );
              if (benchmarks.length === 0) return null;

              const simDuration = data.metadata?.simulationDuration || 3600;
              const execMetric = benchmarks.find((m) => m.name === 'execution_time');
              const adaptiveSpeedup = execMetric && execMetric.adaptive > 0
                ? (simDuration / execMetric.adaptive).toFixed(1)
                : null;
              const manualSpeedup = execMetric && execMetric.manual > 0
                ? (simDuration / execMetric.manual).toFixed(1)
                : null;

              return (
                <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-zinc-500 dark:text-zinc-400 font-mono text-[0.68rem]">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Horizon: <strong className="text-zinc-800 dark:text-zinc-200">{simDuration}s</strong> ({Math.round(simDuration / 3600)}h simulated)</span>
                  </div>
                  {execMetric && (
                    <div className="flex items-center gap-3">
                      <span>Throughput: <strong className="text-emerald-600 dark:text-emerald-400">{adaptiveSpeedup}x speedup</strong> ({execMetric.adaptive}s)</span>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <span>Manual: {execMetric.manual}s ({manualSpeedup}x)</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
