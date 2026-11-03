/**
 * TypeScript Type Definitions for Group Z Traffic Management Dashboard
 */

export type SignalPhase = 'A' | 'B';
export type SignalColor = 'red' | 'yellow' | 'green';
export type OperatingMode = 'adaptive' | 'manual';
export type VisionMode = 'tracking' | 'snapshot';
export type ApproachName = 'north' | 'south' | 'east' | 'west';
export type EnvironmentType = 'sumo' | 'video';

export interface VehicleBreakdown {
  car?: number;
  bus?: number;
  truck?: number;
  motorcycle?: number;
  ambulance?: number;
}

export interface ApproachData {
  queue?: number;
  queue_length?: number;
  vehicle_count?: number;
  mean_speed?: number;
  waiting_time?: number;
  signal?: SignalColor;
  timer?: number;
  breakdown?: VehicleBreakdown;
  has_ambulance?: boolean;
}

export interface SumoTelemetry {
  is_running?: boolean;
  is_paused?: boolean;
  sim_time?: number;
  active_vehicle_count?: number;
  approaches?: Record<string, ApproachData>;
}

export interface SignalInfo {
  phase: SignalPhase;
  state: SignalColor;
  remaining: number;
  reason?: string;
  mode?: OperatingMode;
  manual_loop_running?: boolean;
  is_pedestrian_active?: boolean;
  pedestrian_red_phase?: SignalPhase | null;
}

export interface VisionTelemetry {
  mode?: VisionMode;
  snapshot_interval?: number;
  snapshots_taken?: number;
  next_snapshot_in?: number;
}

export interface HardwareTelemetry {
  connected?: boolean;
  port?: string;
}

export interface PipelineTelemetry {
  fps?: number;
}

export interface TelemetryPayload {
  active_environment?: EnvironmentType;
  video_source?: string | null;
  signal?: SignalInfo;
  vision?: VisionTelemetry;
  simulation?: SumoTelemetry;
  approaches?: Record<string, ApproachData>;
  hardware?: HardwareTelemetry;
  pipeline?: PipelineTelemetry;
  active_ambulance?: string | null;
  timestamp?: number;
}

export interface SerialPortInfo {
  port: string;
  desc?: string;
  hwid?: string;
  is_arduino?: boolean;
  is_usb?: boolean;
}

export interface SerialPortsResponse {
  ports: SerialPortInfo[];
}

// ==========================================
// SUMO Simulation Evaluation Types
// ==========================================

export type EvaluationPhase =
  | 'idle'
  | 'preparing'
  | 'running_manual'
  | 'processing_manual'
  | 'running_adaptive'
  | 'processing_adaptive'
  | 'completed'
  | 'failed';

export interface EvaluationStatusResponse {
  isRunning: boolean;
  evaluationId: string | null;
  phase: EvaluationPhase;
  progress: number;
  message: string;
  error?: string | null;
  hasResult: boolean;
  latestEvaluationId?: string | null;
}

export interface EvaluationMetric {
  name: string;
  label: string;
  unit: string;
  manual: number;
  adaptive: number;
  diff: number;
  improvement: number;
  better: 'adaptive' | 'manual' | 'neutral' | string;
  lowerIsBetter: boolean;
  category?: 'traffic' | 'benchmark' | string;
}

export interface EvaluationQueueTimelinePoint {
  time: number;
  manualQueue: number;
  adaptiveQueue: number;
}

export interface EvaluationThroughputPoint {
  time: number;
  manualThroughput: number;
  adaptiveThroughput: number;
}

export interface EvaluationWaitingBucket {
  range: string;
  manualCount: number;
  adaptiveCount: number;
}

export interface EvaluationBarItem {
  mode: string;
  value: number;
  fill: string;
}

export interface EvaluationNarrative {
  verdict: string;
  summary: string;
  keyObservations: string[];
  conclusion: string;
}

export interface EvaluationResult {
  metadata: {
    evaluationId: string;
    timestamp: string;
    networkName: string;
    simulationDuration: number;
    randomSeed: number;
    trafficScale?: string;
    scaleFactor?: number;
    scaleLabel?: string;
    status: string;
  };
  metrics: EvaluationMetric[];
  charts: {
    barCharts: {
      waitingTime: EvaluationBarItem[];
      travelTime: EvaluationBarItem[];
      speed: EvaluationBarItem[];
    };
    queueOverTime: EvaluationQueueTimelinePoint[];
    throughputOverTime: EvaluationThroughputPoint[];
    waitingDistribution: EvaluationWaitingBucket[];
  };
  narrative: EvaluationNarrative;
}

export interface EvaluationHistoryItem {
  evaluationId: string;
  timestamp: string;
  networkName: string;
  simulationDuration: number;
  trafficScale?: string;
  scaleLabel?: string;
  status: string;
  verdict?: string;
  waitingImprovement?: number;
}
