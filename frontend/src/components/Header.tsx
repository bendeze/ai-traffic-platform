import React, { ChangeEvent } from 'react';
import { useTheme } from '../context/ThemeContext';
import { SerialPortInfo, EnvironmentType } from '../types';

interface HeaderProps {
  isSumoMode: boolean;
  isSumoRunning: boolean;
  startSumo: () => void;
  switchEnvironment: (env: EnvironmentType) => void;
  setSource: (source: string) => void;
  handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  stopFeed: () => void;
  setShowCalibrate: (show: boolean) => void;
  wsConnected: boolean;
  isArduinoConnected: boolean;
  arduinoPort: string;
  testArduinoLeds: () => void;
  disconnectArduino: () => void;
  selectedPort: string;
  setSelectedPort: (port: string) => void;
  serialPorts: SerialPortInfo[];
  connectArduino: (port: string) => void;
  fetchSerialPorts: () => void;
}

export default function Header({
  isSumoMode,
  isSumoRunning,
  startSumo,
  switchEnvironment,
  setSource,
  handleFileUpload,
  stopFeed,
  setShowCalibrate,
  wsConnected,
  isArduinoConnected,
  arduinoPort,
  testArduinoLeds,
  disconnectArduino,
  selectedPort,
  setSelectedPort,
  serialPorts,
  connectArduino,
  fetchSerialPorts,
}: HeaderProps) {
  const { isLight, toggleTheme } = useTheme();

  return (
    <header className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-5 mb-5 flex-wrap gap-4">
      {/* Brand & Platform Identity */}
      <div className="flex items-center gap-4">
        <span className="text-base font-extrabold tracking-widest border border-zinc-900 dark:border-white text-zinc-900 dark:text-white px-2 py-0.5">
          GROUP Z
        </span>
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tracking-wider hidden sm:inline">
          AI TRAFFIC MANAGEMENT PLATFORM
        </span>
      </div>

      {/* Operating Environment & Hardware Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* SUMO Simulation Environment Toggle */}
        <button
          onClick={() => { switchEnvironment('sumo'); if (!isSumoRunning) startSumo(); }}
          className={isSumoMode ? 'btn-minimal-active' : 'btn-minimal'}
        >
          SUMO SIMULATION
        </button>

        {/* Physical Camera Feed */}
        <button
          onClick={() => { switchEnvironment('video'); setSource('webcam'); }}
          className={!isSumoMode ? 'btn-minimal-active' : 'btn-minimal'}
        >
          CAMERA
        </button>

        {/* Upload Custom Video Footage */}
        <label className="btn-minimal cursor-pointer inline-flex items-center">
          UPLOAD
          <input
            type="file"
            accept="video/*"
            onChange={(e) => { switchEnvironment('video'); handleFileUpload(e); }}
            className="hidden"
          />
        </label>

        {!isSumoMode && (
          <>
            <button onClick={stopFeed} className="btn-minimal">
              HALT
            </button>
            <button onClick={() => setShowCalibrate(true)} className="btn-minimal border-zinc-500">
              CALIBRATE REGIONS
            </button>
          </>
        )}

        {/* WebSocket Connection Status */}
        <div className="flex items-center gap-2 ml-3.5 pl-3.5 border-l border-zinc-200 dark:border-zinc-800">
          <span className={`w-1.5 h-1.5 rounded-full ${
            wsConnected 
              ? 'bg-emerald-600 dark:bg-white shadow-[0_0_8px_#16a34a] dark:shadow-[0_0_8px_#ffffff]' 
              : 'bg-zinc-400 dark:bg-zinc-600'
          }`} />
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        {/* Arduino Serial Hardware Controls */}
        <div className="flex items-center gap-2 ml-3.5 pl-3.5 border-l border-zinc-200 dark:border-zinc-800">
          <span className={`w-1.5 h-1.5 rounded-full ${
            isArduinoConnected ? 'bg-emerald-500 shadow-[0_0_8px_#22c55e]' : 'bg-zinc-400 dark:bg-zinc-600'
          }`} />

          <button
            onClick={testArduinoLeds}
            title="Test all 12 physical LEDs on breadboard (Pins 2 to 13)"
            className="btn-minimal font-bold border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
          >
            TEST LEDS
          </button>
          
          {isArduinoConnected ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                {arduinoPort} CONNECTED
              </span>
              <button
                onClick={disconnectArduino}
                className="btn-minimal !px-2 !py-0.5 border-red-500 text-red-500 hover:border-red-400"
              >
                DISCONNECT
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                ARDUINO:
              </span>
              <select
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                className="bg-white dark:bg-black text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 text-xs font-mono px-1.5 py-1 outline-none cursor-pointer focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
              >
                {serialPorts.length > 0 ? (
                  serialPorts.map((p) => (
                    <option key={p.port} value={p.port}>
                      {p.port} {p.is_arduino ? '★ (Nano 33 BLE)' : p.is_usb ? '(USB)' : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="COM6">COM6 (Nano 33 BLE)</option>
                    <option value="COM3">COM3</option>
                    <option value="COM4">COM4</option>
                    <option value="COM5">COM5</option>
                  </>
                )}
              </select>

              <button
                onClick={() => connectArduino(selectedPort)}
                className="btn-minimal border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold"
              >
                CONNECT
              </button>

              <button
                onClick={fetchSerialPorts}
                title="Scan for connected serial ports"
                className="btn-minimal px-2"
              >
                ↻
              </button>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <div className="flex items-center ml-3.5 pl-3.5 border-l border-zinc-200 dark:border-zinc-800">
          <button
            onClick={toggleTheme}
            title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
            className="btn-minimal-active flex items-center gap-1.5 !px-3"
          >
            <span>{isLight ? '☾ DARK' : '☀ LIGHT'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
