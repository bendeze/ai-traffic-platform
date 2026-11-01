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
} from './components';

export default function App() {
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
  const [sumoGui, setSumoGui] = useState<boolean>(false);
  const [sumoSpeed, setSumoSpeed] = useState<number>(1.0);

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
      setLog(`SIGNAL MODE: ${newMode.toUpperCase()}`);
    } catch {
      setLog('MODE SWITCH FAILED');
    }
  };

  const requestPedestrian = async (approach: ApproachName) => {
    setActivePedestrian(approach);
    try {
      await apiClient.requestPedestrian(approach);
      const phaseName = (approach === 'north' || approach === 'south') ? 'NORTH & SOUTH' : 'EAST & WEST';
      setLog(`PEDESTRIAN ACTIVE: ${phaseName} LOCKED ON RED FOR 10s`);
      setTimeout(() => setActivePedestrian(null), 10000);
    } catch {
      setActivePedestrian(null);
      setLog('REQUEST REJECTED');
    }
  };

  const triggerAmbulance = async (approach: ApproachName) => {
    try {
      await apiClient.triggerAmbulance(approach);
      setLog(`EMERGENCY: AMBULANCE DISPATCHED ON ${approach.toUpperCase()}!`);
    } catch {
      setLog('AMBULANCE TRIGGER ERROR');
    }
  };

  const clearAmbulance = async () => {
    try {
      await apiClient.clearAmbulance();
      setLog('AMBULANCE CLEARED — RESUMING ADAPTIVE FLOW');
    } catch {
      setLog('ERROR CLEARING AMBULANCE');
    }
  };

  const setSource = async (source: string) => {
    setActiveEnvironment('video');
    setVideoSource(source === 'webcam' ? 'webcam' : 'upload');
    try {
      await apiClient.setSource(source);
      setLog(`FEED INPUT: ${source.toUpperCase()}`);
    } catch {
      setLog('FEED SELECTION FAILED');
    }
  };

  const stopFeed = async () => {
    try {
      await apiClient.stopFeed();
      setLog('FEED PAUSED');
    } catch {
      setLog('FEED HALT ERROR');
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActiveEnvironment('video');
    setVideoSource('upload');
    setLog(`UPLOADING ${file.name.toUpperCase()}...`);
    try {
      await apiClient.uploadVideo(file);
      setLog(`PLAYBACK STARTED: ${file.name.toUpperCase()}`);
    } catch {
      setLog('UPLOAD FAILED');
    } finally {
      e.target.value = '';
    }
  };

  const connectArduino = async (portToConnect: string) => {
    const port = portToConnect && portToConnect !== 'none' ? portToConnect : 'auto';
    try {
      setLog(`CONNECTING TO ARDUINO (${port === 'auto' ? 'AUTO-DETECT' : port})...`);
      const d = await apiClient.connectArduino(port);
      if (d.status === 'ok') {
        const detectedPort = d.serial?.port || port;
        setLog(`ARDUINO CONNECTED ON ${detectedPort}`);
        fetchSerialPorts();
      } else {
        setLog(`CONNECT FAILED: ${d.error || 'COULD NOT OPEN SERIAL'}`);
      }
    } catch {
      setLog('SERIAL CONNECT FAILED');
    }
  };

  const disconnectArduino = async () => {
    try {
      await apiClient.disconnectArduino();
      setLog('ARDUINO DISCONNECTED');
      fetchSerialPorts();
    } catch {
      setLog('DISCONNECT FAILED');
    }
  };

  const testArduinoLeds = async () => {
    try {
      if (!isArduinoConnected) {
        const port = selectedPort && selectedPort !== 'none' ? selectedPort : 'auto';
        setLog(`CONNECTING TO ARDUINO (${port === 'auto' ? 'AUTO-DETECT' : port}) FIRST...`);
        const connData = await apiClient.connectArduino(port);
        if (connData.status !== 'ok') {
          setLog(`CONNECT FAILED: ${connData.error || 'COULD NOT OPEN SERIAL'}`);
          return;
        }
        setLog(`ARDUINO CONNECTED ON ${connData.serial?.port || port}! TRIGGERING 12-LED HARDWARE DIAGNOSTIC SWEEP...`);
        fetchSerialPorts();
        await new Promise((r) => setTimeout(r, 1200));
      } else {
        setLog('TRIGGERING 12-LED HARDWARE DIAGNOSTIC SWEEP ON ARDUINO...');
      }

      await apiClient.testArduinoLeds();
      setLog('ARDUINO DIAGNOSTIC SWEEP ACTIVE (PINS 2 TO 13)');
    } catch (err: any) {
      setLog(`TEST COMMAND ERROR: ${err.message || 'FAILED'}`);
    }
  };

  const switchEnvironment = async (env: EnvironmentType) => {
    setActiveEnvironment(env);
    try {
      await apiClient.switchEnvironment(env);
      setLog(`ENVIRONMENT SWITCHED: ${env.toUpperCase()}`);
    } catch {
      setLog('ENVIRONMENT SWITCH FAILED');
    }
  };

  const startSumo = async (gui: boolean = sumoGui) => {
    try {
      setLog(`STARTING SUMO SIMULATION (${gui ? 'GUI' : 'HEADLESS'})...`);
      const res = await apiClient.startSumo(gui, sumoSpeed);
      if (res?.status === 'ok' || !res?.detail) {
        setLog(`SUMO SIMULATION ACTIVE (${gui ? 'GUI WINDOW' : 'HEADLESS ENGINE'})`);
      } else {
        setLog(`SUMO START FAILED: ${res.detail || 'ERROR'}`);
      }
    } catch {
      setLog('SUMO START REQUEST FAILED');
    }
  };

  const stopSumo = async () => {
    try {
      await apiClient.stopSumo();
      setLog('SUMO SIMULATION STOPPED');
    } catch {
      setLog('SUMO STOP FAILED');
    }
  };

  const pauseSumo = async () => {
    try {
      await apiClient.pauseSumo();
      setLog('SUMO SIMULATION PAUSED');
    } catch {
      setLog('SUMO PAUSE FAILED');
    }
  };

  const resumeSumo = async () => {
    try {
      await apiClient.resumeSumo();
      setLog('SUMO SIMULATION RESUMED');
    } catch {
      setLog('SUMO RESUME FAILED');
    }
  };

  const resetSumo = async () => {
    try {
      setLog('RESETTING SUMO SIMULATION...');
      await apiClient.resetSumo();
      setLog('SUMO SIMULATION RESET (T=0.0s)');
    } catch {
      setLog('SUMO RESET FAILED');
    }
  };

  const updateSumoSpeed = async (factor: number) => {
    setSumoSpeed(factor);
    try {
      await apiClient.updateSumoSpeed(factor);
      setLog(`SUMO SIMULATION SPEED SET TO ${factor}x`);
    } catch {
      setLog('SPEED UPDATE FAILED');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-black text-zinc-950 dark:text-white flex flex-col p-6 md:p-8 transition-colors duration-200">
      {showCalibrate && <Calibrate onClose={() => setShowCalibrate(false)} />}

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

