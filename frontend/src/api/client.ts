/**
 * Group Z API Client
 * Centralized, typed HTTP client for backend endpoints.
 */

import { SerialPortsResponse, EnvironmentType, OperatingMode, VisionMode, ApproachName } from '../types';

export const API_BASE = 'http://localhost:8000';
export const WS_URL = 'ws://localhost:8000/ws';

export const apiClient = {
  // Controller Endpoints
  async switchMode(newMode: OperatingMode) {
    const res = await fetch(`${API_BASE}/controller/mode/${newMode}`, { method: 'POST' });
    return res.json();
  },

  async startManualLoop(phaseA: number, phaseB: number, startPhase: 'A' | 'B' = 'A') {
    const res = await fetch(`${API_BASE}/controller/manual_loop/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase_a: phaseA, phase_b: phaseB, start_phase: startPhase }),
    });
    return res.json();
  },

  async stopManualLoop() {
    const res = await fetch(`${API_BASE}/controller/manual_loop/stop`, { method: 'POST' });
    return res.json();
  },

  async updateManualConfig(phaseA: number, phaseB: number) {
    const res = await fetch(`${API_BASE}/controller/manual_config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase_a: phaseA, phase_b: phaseB }),
    });
    return res.json();
  },

  // Priority Endpoints
  async requestPedestrian(approach: ApproachName) {
    const res = await fetch(`${API_BASE}/priority/pedestrian/${approach}`, { method: 'POST' });
    return res.json();
  },

  async triggerAmbulance(approach: ApproachName) {
    const res = await fetch(`${API_BASE}/priority/ambulance/${approach}`, { method: 'POST' });
    return res.json();
  },

  async clearAmbulance() {
    const res = await fetch(`${API_BASE}/priority/ambulance_clear`, { method: 'POST' });
    return res.json();
  },

  // Vision Endpoints
  async switchVisionMode(newMode: VisionMode) {
    const res = await fetch(`${API_BASE}/vision/mode/${newMode}`, { method: 'POST' });
    return res.json();
  },

  async setSource(source: string) {
    const res = await fetch(`${API_BASE}/video/source?source=${encodeURIComponent(source)}`, { method: 'POST' });
    return res.json();
  },

  async stopFeed() {
    const res = await fetch(`${API_BASE}/video/stop`, { method: 'POST' });
    return res.json();
  },

  async uploadVideo(file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/video/upload`, { method: 'POST', body: form });
    return res.json();
  },

  // Hardware Serial Endpoints
  async fetchSerialPorts(): Promise<SerialPortsResponse> {
    const res = await fetch(`${API_BASE}/serial/ports`);
    return res.json();
  },

  async connectArduino(port: string) {
    const res = await fetch(`${API_BASE}/serial/connect?port=${encodeURIComponent(port)}`, { method: 'POST' });
    return res.json();
  },

  async disconnectArduino() {
    const res = await fetch(`${API_BASE}/serial/disconnect`, { method: 'POST' });
    return res.json();
  },

  async testArduinoLeds() {
    const res = await fetch(`${API_BASE}/serial/test`, { method: 'POST' });
    return res.json();
  },

  // SUMO Simulation Endpoints
  async switchEnvironment(env: EnvironmentType) {
    const res = await fetch(`${API_BASE}/simulation/environment/${env}`, { method: 'POST' });
    return res.json();
  },

  async startSumo(gui: boolean = false, speed: number = 1.0) {
    const res = await fetch(`${API_BASE}/simulation/sumo/start?gui=${gui}&speed=${speed}`, { method: 'POST' });
    return res.json();
  },

  async stopSumo() {
    const res = await fetch(`${API_BASE}/simulation/sumo/stop`, { method: 'POST' });
    return res.json();
  },

  async pauseSumo() {
    const res = await fetch(`${API_BASE}/simulation/sumo/pause`, { method: 'POST' });
    return res.json();
  },

  async resumeSumo() {
    const res = await fetch(`${API_BASE}/simulation/sumo/resume`, { method: 'POST' });
    return res.json();
  },

  async resetSumo() {
    const res = await fetch(`${API_BASE}/simulation/sumo/reset`, { method: 'POST' });
    return res.json();
  },

  async updateSumoSpeed(factor: number) {
    const res = await fetch(`${API_BASE}/simulation/sumo/speed/${factor}`, { method: 'POST' });
    return res.json();
  },
};
