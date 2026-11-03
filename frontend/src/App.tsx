import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import Calibrate from './Calibrate';
import { apiClient } from './api/client';
import { useTrafficSocket } from './hooks/useTrafficSocket';
import {
  OperatingMode,
  VisionMode,
  ApproachName,
  EnvironmentType,
  SerialPortInfo,
} from './types';
import {
  Header,
  AmbulanceBanner,
  SimulationBar,
  VisionFeedMonitor,
  AmbulanceQuickBar,
  PhaseStatusBox,
  ApproachTelemetryGrid,
  Footer,
  EvaluationPage,
} from './components';

export default function App() {
  // Path-based URL routing for /evaluation/:evaluationId
  const getInitialEvaluationId = (): string | null => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/evaluation/')) {
      const parts = window.location.pathname.split('/');
      return parts[2] || null;
    }
    return null;
  };

  const [activeEvaluationId, setActiveEvaluationId] = useState<string | null>(getInitialEvaluationId());

  // Listen to browser popstate (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      setActiveEvaluationId(getInitialEvaluationId());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Runtime operational state
  const [log, setLog] = useState<string>('SYSTEM INITIALIZED');
  const handleLog = useCallback((msg: string) => setLog(msg), []);

  // Telemetry stream via WebSocket
  const { data, wsConnected } = useTrafficSocket(handleLog);

  // Controller & Vision Modes
  const [mode, setMode] = useState<OperatingMode>('adaptive');
  const [visionMode, setVisionMode] = useState<VisionMode>('tracking');
  const [activeEnvironment, setActiveEnvironment] = useState<EnvironmentType>('sumo');
  const [videoSource, setVideoSource] = useState<'webcam' | 'upload'>('webcam');
  const [manualA, setManualA] = useState<number>(30);
  const [manualB, setManualB] = useState<number>(30);
  const [activePedestrian, setActivePedestrian] = useState<string | null>(null);

  // Hardware Serial State
  const [serialPorts, setSerialPorts] = useState<SerialPortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('auto');

  // Modal & Simulation Settings
  const [showCalibrate, setShowCalibrate] = useState<boolean>(false);
  const [sumoGui, setSumoGui] = useState<boolean>(true); // Default SUMO GUI enabled as requested
  const [sumoSpeed, setSumoSpeed] = useState<number>(1.0);

  // Automated Simulation Evaluation State
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalProgress, setEvalProgress] = useState<number>(0);
  const [evalMessage, setEvalMessage] = useState<string>('');
  const [evalScale, setEvalScale] = useState<string>('standard');
  const [hasEvaluationResult, setHasEvaluationResult] = useState<boolean>(false);
  const [latestEvaluationId, setLatestEvaluationId] = useState<string | null>(null);

  // Check initial evaluation status on startup
  useEffect(() => {
    apiClient
      .getEvaluationStatus()
      .then((st) => {
        setIsEvaluating(st.isRunning);
        setEvalProgress(st.progress);
        setEvalMessage(st.message);
        setHasEvaluationResult(st.hasResult);
        if (st.latestEvaluationId) {
          setLatestEvaluationId(st.latestEvaluationId);
        }
      })
      .catch(() => {});
  }, []);

  // Polling loop while evaluation is running
  useEffect(() => {
    if (!isEvaluating) return;

    const interval = setInterval(async () => {
      try {
        const st = await apiClient.getEvaluationStatus();
        setIsEvaluating(st.isRunning);
        setEvalProgress(st.progress);
        setEvalMessage(st.message);
        setHasEvaluationResult(st.hasResult);

        if (st.phase === 'completed') {
          const targetId = st.evaluationId || st.latestEvaluationId;
          if (targetId) {
            setLatestEvaluationId(targetId);
            setLog(`EVALUATION ${targetId} COMPLETED: NAVIGATING TO REPORT...`);
            window.history.pushState({}, '', `/evaluation/${targetId}`);
            setActiveEvaluationId(targetId);
          }
          setIsEvaluating(false);
        } else if (st.phase === 'failed') {
          setLog(`EVALUATION FAILED: ${st.error || 'Unknown error'}`);
          setIsEvaluating(false);
        }
      } catch (err) {
        console.error('Failed to poll evaluation status:', err);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [isEvaluating]);

  // Sync state from server telemetry updates
  useEffect(() => {
    if (data?.vision?.mode) {
      setVisionMode(data.vision.mode);
    }
    if (data?.signal?.mode && !mode) {
      setMode(data.signal.mode);
    }
    if (data?.active_environment) {
      setActiveEnvironment(data.active_environment);
    }
    if (data?.video_source !== undefined) {
      if (data.video_source === 'webcam') {
        setVideoSource('webcam');
      } else if (data.video_source) {
        setVideoSource('upload');
      }
    }
  }, [data, mode]);

  // Serial Ports Discovery
  const fetchSerialPorts = useCallback(async () => {
    try {
      const d = await apiClient.fetchSerialPorts();
      if (d?.ports) {
        setSerialPorts(d.ports);
        const ard = d.ports.find((p) => p.is_arduino);
        if (ard && selectedPort === 'auto') {
          setSelectedPort(ard.port);
        } else if (d.ports.length === 0) {
          setSelectedPort('auto');
        }
      }
    } catch (e) {
      console.error('[Serial] Port discovery error:', e);
    }
  }, [selectedPort]);

  useEffect(() => {
    fetchSerialPorts();
  }, [fetchSerialPorts]);

  // Derived state values
  const isLoopRunning = Boolean(data?.signal?.manual_loop_running);
  const isSumoMode = activeEnvironment === 'sumo';
  const sumoData = data?.simulation || {};
  const isSumoRunning = Boolean(sumoData?.is_running);
  const isSumoPaused = Boolean(sumoData?.is_paused);
  const sumoTime = sumoData?.sim_time ?? 0.0;
  const sumoVehicleCount = sumoData?.active_vehicle_count ?? 0;
  const sumoApproaches = sumoData?.approaches ?? {};
  const currentPhase = data?.signal?.phase || 'A';
  const signalState = data?.signal?.state || 'green';
  const remaining = Math.round(data?.signal?.remaining ?? 0);
  const fps = data?.pipeline?.fps ? data.pipeline.fps.toFixed(1) : '0.0';
  const reason = data?.signal?.reason || '—';
  const activeAmbulance = data?.active_ambulance;
  const isSnapshotMode = visionMode === 'snapshot';
  const snapshotInterval = data?.vision?.snapshot_interval ?? 5.0;
  const nextSnapIn = data?.vision?.next_snapshot_in ?? 0;
  const snapCount = data?.vision?.snapshots_taken ?? 0;
  const isArduinoConnected = Boolean(data?.hardware?.connected);
  const arduinoPort = data?.hardware?.port || 'USB';

  // ── Actions & Handlers ─────────────────────────────────────────────────────

  const handleStartEvaluation = async () => {
    if (isEvaluating) return;
    try {
      if (isSumoRunning) {
        setLog('STOPPING REGULAR SIMULATION TO BEGIN EVALUATION RUN...');
        try {
          await apiClient.stopSumo();
          await new Promise((r) => setTimeout(r, 600));
        } catch {}
      }
      setLog(`LAUNCHING AUTOMATED SIMULATION EVALUATION (SCALE: ${evalScale.toUpperCase()})...`);
      const res = await apiClient.startEvaluation(3600.0, sumoGui, 42, evalScale);
      setIsEvaluating(true);
      setEvalProgress(5.0);
      setEvalMessage(`Preparing evaluation session ${res.evaluationId}...`);
      setLog(`EVALUATION SESSION ${res.evaluationId} STARTED.`);
    } catch (err: any) {
      setLog(`EVALUATION ERROR: ${err.message || 'Failed to start'}`);
      alert(`Could not start evaluation: ${err.message}`);
    }
  };

  const handleStopEvaluation = async () => {
    try {
      await apiClient.stopEvaluation();
      setLog('EVALUATION CANCELLATION REQUESTED');
    } catch {
      setLog('FAILED TO CANCEL EVALUATION');
    }
  };

  const handleViewLatestEvaluation = () => {
    const targetId = latestEvaluationId || 'evaluation_001';
    window.history.pushState({}, '', `/evaluation/${targetId}`);
    setActiveEvaluationId(targetId);
  };

  const handleBackToSimulation = () => {
    window.history.pushState({}, '', '/');
    setActiveEvaluationId(null);
  };

  const startManualLoop = async () => {
    try {
      const res = await apiClient.startManualLoop(manualA, manualB, 'A');
      if (res?.wait_current_timer) {
        setLog(`TIMERS UPDATED: PHASE A (${manualA}s) / PHASE B (${manualB}s) — CURRENT TIMER WILL FINISH FIRST`);
      } else {
        setLog(`MANUAL LOOP STARTED: PHASE A (${manualA}s) ➔ PHASE B (${manualB}s)`);
      }
    } catch {
      setLog('FAILED TO START MANUAL LOOP');
    }
  };

  const stopManualLoop = async () => {
    try {
      await apiClient.stopManualLoop();
      setLog('MANUAL LOOP PAUSED');
    } catch {
      setLog('FAILED TO PAUSE MANUAL LOOP');
    }
  };

  const switchVisionMode = async (newMode: VisionMode) => {
    setVisionMode(newMode);
    try {
      await apiClient.switchVisionMode(newMode);
      setLog(`SWITCHED VISION MODE: ${newMode.toUpperCase()}`);
    } catch {
      setLog('VISION MODE SWITCH FAILED');
    }
  };

  const switchMode = async (newMode: OperatingMode) => {
    setMode(newMode);
    try {
      await apiClient.switchMode(newMode);
      setLog(`SWITCHED MODE: ${newMode.toUpperCase()}`);
    } catch {
      setLog('MODE SWITCH FAILED');
    }
  };

  const switchEnvironment = async (env: EnvironmentType) => {
    try {
      await apiClient.switchEnvironment(env);
      setActiveEnvironment(env);
      setLog(`ENVIRONMENT SWITCHED: ${env.toUpperCase()}`);
    } catch {
      setLog('ENVIRONMENT SWITCH FAILED');
    }
  };

  const setSource = async (source: string) => {
    setVideoSource('webcam');
    try {
      await apiClient.setSource(source);
      setLog('WEBCAM SOURCE SELECTED');
    } catch {
      setLog('FAILED TO SET WEBCAM');
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoSource('upload');
    setLog(`UPLOADING: ${file.name}...`);
    try {
      const d = await apiClient.uploadVideo(file);
      if (d.status === 'ok') {
        setLog(`PLAYING: ${file.name}`);
      } else {
        setLog(`UPLOAD ERROR: ${d.message}`);
      }
    } catch {
      setLog('UPLOAD FAILED');
    }
  };

  const stopFeed = async () => {
    try {
      await apiClient.stopFeed();
      setLog('FEED HALTED');
    } catch {
      setLog('FAILED TO HALT FEED');
    }
  };

  const connectArduino = async (port: string) => {
    setLog(`CONNECTING ARDUINO ON ${port.toUpperCase()}...`);
    try {
      const d = await apiClient.connectArduino(port);
      if (d.status === 'connected') {
        setLog(`ARDUINO CONNECTED ON ${d.port}`);
      } else {
        setLog(`CONNECT FAILED: ${d.message}`);
      }
    } catch {
      setLog('ARDUINO CONNECTION ERROR');
    }
  };

  const disconnectArduino = async () => {
    try {
      await apiClient.disconnectArduino();
      setLog('ARDUINO DISCONNECTED');
    } catch {
      setLog('DISCONNECT FAILED');
    }
  };

  const testArduinoLeds = async () => {
    setLog('TESTING 12-LED HARDWARE SEQUENCE...');
    try {
      const d = await apiClient.testArduinoLeds();
      setLog(`LED TEST: ${d.message.toUpperCase()}`);
    } catch {
      setLog('LED TEST FAILED');
    }
  };

  const triggerAmbulance = async (approach: ApproachName) => {
    try {
      await apiClient.triggerAmbulance(approach);
      setLog(`AMBULANCE PREEMPTION: ${approach.toUpperCase()} PRIORITY GREEN ACTIVATED`);
    } catch {
      setLog('AMBULANCE TRIGGER FAILED');
    }
  };

  const clearAmbulance = async () => {
    try {
      await apiClient.clearAmbulance();
      setLog('AMBULANCE CLEARED — AUTONOMOUS FSM RESUMED');
    } catch {
      setLog('CLEAR AMBULANCE FAILED');
    }
  };

  const requestPedestrian = async (approach: ApproachName) => {
    setActivePedestrian(approach);
    try {
      await apiClient.requestPedestrian(approach);
      setLog(`PEDESTRIAN CROSSWALK REQUESTED: ${approach.toUpperCase()} (WAITING GREEN CLEARANCE)`);
    } catch {
      setLog('PEDESTRIAN REQUEST FAILED');
    } finally {
      setTimeout(() => setActivePedestrian(null), 3000);
    }
  };

  const startSumo = async (gui: boolean = false) => {
    try {
      await apiClient.startSumo(gui, sumoSpeed);
      setLog(`SUMO SIMULATION STARTED (GUI: ${gui ? 'ON' : 'OFF'})`);
    } catch {
      setLog('FAILED TO START SUMO');
    }
  };

  const stopSumo = async () => {
    try {
      await apiClient.stopSumo();
      setLog('SUMO SIMULATION TERMINATED');
    } catch {
      setLog('FAILED TO STOP SUMO');
    }
  };

  const pauseSumo = async () => {
    try {
      await apiClient.pauseSumo();
      setLog('SUMO SIMULATION PAUSED');
    } catch {
      setLog('FAILED TO PAUSE SUMO');
    }
  };

  const resumeSumo = async () => {
    try {
      await apiClient.resumeSumo();
      setLog('SUMO SIMULATION RESUMED');
    } catch {
      setLog('FAILED TO RESUME SUMO');
    }
  };

  const resetSumo = async () => {
    try {
      await apiClient.resetSumo();
      setLog('SUMO SIMULATION RELOADED (t=0.0s)');
    } catch {
      setLog('FAILED TO RESET SUMO');
    }
  };

  const updateSumoSpeed = async (spd: number) => {
    setSumoSpeed(spd);
    try {
      await apiClient.updateSumoSpeed(spd);
      setLog(`SUMO SPEED FACTOR: ${spd}x`);
    } catch {
      setLog('FAILED TO UPDATE SUMO SPEED');
    }
  };

  // If navigating directly to or active on /evaluation/:id
  if (activeEvaluationId) {
    return (
      <EvaluationPage
        initialEvaluationId={activeEvaluationId}
        onBackToSimulation={handleBackToSimulation}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 flex flex-col font-sans transition-colors">
      {/* Calibration Modal */}
      {showCalibrate && (
        <Calibrate
          onClose={() => setShowCalibrate(false)}
          setLog={setLog}
        />
      )}

      {/* Top Navigation & Settings Bar */}
      <Header
        isSumoMode={isSumoMode}
        isSumoRunning={isSumoRunning}
        startSumo={startSumo}
        switchEnvironment={switchEnvironment}
        setSource={setSource}
        videoSource={videoSource}
        handleFileUpload={handleFileUpload}
        stopFeed={stopFeed}
        setShowCalibrate={setShowCalibrate}
        wsConnected={wsConnected}
        isArduinoConnected={isArduinoConnected}
        arduinoPort={arduinoPort}
        testArduinoLeds={testArduinoLeds}
        disconnectArduino={disconnectArduino}
        selectedPort={selectedPort}
        setSelectedPort={setSelectedPort}
        serialPorts={serialPorts}
        connectArduino={connectArduino}
        fetchSerialPorts={fetchSerialPorts}
      />

      {/* Emergency Ambulance Preemption Alert Banner */}
      <AmbulanceBanner
        activeAmbulance={activeAmbulance}
        clearAmbulance={clearAmbulance}
      />

      {/* Mode Control & Telemetry Strip */}
      <SimulationBar
        isSumoMode={isSumoMode}
        isSnapshotMode={isSnapshotMode}
        switchVisionMode={switchVisionMode}
        snapshotInterval={snapshotInterval}
        nextSnapIn={nextSnapIn}
        snapCount={snapCount}
        fps={fps}
        isSumoRunning={isSumoRunning}
        isSumoPaused={isSumoPaused}
        sumoGui={sumoGui}
        setSumoGui={setSumoGui}
        sumoSpeed={sumoSpeed}
        sumoTime={sumoTime}
        sumoVehicleCount={sumoVehicleCount}
        startSumo={startSumo}
        stopSumo={stopSumo}
        pauseSumo={pauseSumo}
        resumeSumo={resumeSumo}
        resetSumo={resetSumo}
        updateSumoSpeed={updateSumoSpeed}
        setLog={setLog}
        isEvaluating={isEvaluating}
        evalProgress={evalProgress}
        evalMessage={evalMessage}
        evalScale={evalScale}
        setEvalScale={setEvalScale}
        startEvaluation={handleStartEvaluation}
        stopEvaluation={handleStopEvaluation}
        hasEvaluationResult={hasEvaluationResult}
        latestEvaluationId={latestEvaluationId}
        onViewLatestEvaluation={handleViewLatestEvaluation}
      />

      {/* Main Grid: Left Monitor vs Right Telemetry */}
      <main className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 flex-1">
        {/* Left: Monitor (Stream or SUMO 4-Way Board) + Quick Ambulance Action Bar */}
        <div className="flex flex-col">
          <VisionFeedMonitor
            isSumoMode={isSumoMode}
            isSnapshotMode={isSnapshotMode}
            fps={fps}
            sumoTime={sumoTime}
            sumoApproaches={sumoApproaches}
            data={data}
            isSumoRunning={isSumoRunning}
            sumoGui={sumoGui}
            sumoVehicleCount={sumoVehicleCount}
          />
          <AmbulanceQuickBar
            activeAmbulance={activeAmbulance}
            triggerAmbulance={triggerAmbulance}
          />
        </div>

        {/* Right: Controller Phase Status & Approach Telemetry */}
        <section className="flex flex-col gap-5">
          <PhaseStatusBox
            currentPhase={currentPhase}
            signalState={signalState}
            remaining={remaining}
            reason={reason}
            mode={mode}
            switchMode={switchMode}
            isLoopRunning={isLoopRunning}
            manualA={manualA}
            setManualA={setManualA}
            manualB={manualB}
            setManualB={setManualB}
            startManualLoop={startManualLoop}
            stopManualLoop={stopManualLoop}
          />

          <ApproachTelemetryGrid
            data={data}
            activePedestrian={activePedestrian}
            requestPedestrian={requestPedestrian}
          />
        </section>
      </main>

      {/* Terminal Log Footer */}
      <Footer
        log={log}
        isSnapshotMode={isSnapshotMode}
        snapshotInterval={snapshotInterval}
      />
    </div>
  );
}
