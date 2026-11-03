import React, { ChangeEvent } from 'react';
import { SerialPortInfo, EnvironmentType } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ThemeToggle } from './ThemeToggle';
import { Zap } from 'lucide-react';

interface HeaderProps {
  isSumoMode: boolean;
  isSumoRunning: boolean;
  startSumo: () => void;
  switchEnvironment: (env: EnvironmentType) => void;
  setSource: (source: string) => void;
  videoSource: 'webcam' | 'upload';
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
  videoSource,
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
  return (
    <header className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4 flex-wrap gap-3">
      {/* Brand & Platform Identity */}
      <div className="flex items-center">
        <span className="font-mono text-[0.68rem] text-zinc-500 dark:text-zinc-400 tracking-wider hidden sm:inline">
          AI TRAFFIC MANAGEMENT PLATFORM
        </span>
      </div>

      {/* Operating Environment & Hardware Controls */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* SUMO Simulation Environment Toggle */}
        <button
          onClick={() => switchEnvironment('sumo')}
          className={`${isSumoMode ? 'btn-minimal-active' : 'btn-minimal'} !text-[0.68rem] !py-1 !px-2.5`}
        >
          SUMO SIMULATION
        </button>

        {/* Physical Camera Feed */}
        <button
          onClick={() => { switchEnvironment('video'); setSource('webcam'); }}
          className={`${!isSumoMode && videoSource === 'webcam' ? 'btn-minimal-active' : 'btn-minimal'} !text-[0.68rem] !py-1 !px-2.5`}
        >
          CAMERA
        </button>

        {/* Upload Custom Video Footage */}
        <label className={`${!isSumoMode && videoSource === 'upload' ? 'btn-minimal-active' : 'btn-minimal'} !text-[0.68rem] !py-1 !px-2.5 cursor-pointer inline-flex items-center`}>
          UPLOAD
          <input
            type="file"
            accept="video/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {!isSumoMode && (
          <>
            <button onClick={stopFeed} className="btn-minimal !text-[0.68rem] !py-1 !px-2.5">
              HALT
            </button>
            <button onClick={() => setShowCalibrate(true)} className="btn-minimal !text-[0.68rem] !py-1 !px-2.5 border-zinc-500">
              CALIBRATE REGIONS
            </button>
          </>
        )}

        {/* Hardware Serial Interface */}
        <div className="inline-flex items-center border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-0.5 ml-2">
          <Select
            value={selectedPort}
            onValueChange={(val: string) => setSelectedPort(val)}
          >
            <SelectTrigger className="w-[120px] h-[26px] bg-transparent border-0 text-[0.68rem] font-mono font-medium focus:ring-0 shadow-none text-zinc-800 dark:text-zinc-200">
              <SelectValue placeholder="PORT" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 font-mono text-[0.68rem]">
              <SelectItem value="auto">
                <span className="inline-flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> AUTO-DETECT
                </span>
              </SelectItem>
              {serialPorts.map((p) => (
                <SelectItem key={p.port} value={p.port}>
                  {p.port} {p.is_arduino ? '(ARDUINO)' : p.is_usb ? '(USB)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isArduinoConnected ? (
            <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-800 pl-1.5 ml-1">
              <span className="font-mono text-[0.65rem] font-bold text-emerald-700 dark:text-emerald-400 px-1.5">
                CONNECTED ({arduinoPort})
              </span>
              <button
                onClick={testArduinoLeds}
                className="btn-minimal !text-[0.65rem] !py-0.5 !px-2 border-zinc-400 hover:border-zinc-700 dark:border-zinc-600 dark:hover:border-zinc-300"
                title="Run 12-LED sequential hardware self-test"
              >
                TEST LEDS
              </button>
              <button
                onClick={disconnectArduino}
                className="btn-minimal !text-[0.65rem] !py-0.5 !px-2 border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                DISCONNECT
              </button>
            </div>
          ) : (
            <button
              onClick={() => connectArduino(selectedPort)}
              className="btn-minimal !text-[0.68rem] !py-0.5 !px-2.5 ml-1 border-zinc-400 hover:border-zinc-700 dark:border-zinc-600 dark:hover:border-zinc-300"
            >
              CONNECT
            </button>
          )}
        </div>

        {/* WebSocket Connection Diagnostic */}
        <div className="inline-flex items-center gap-1.5 px-2 py-1 border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 ml-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              wsConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
          <span className="font-mono text-[0.65rem] text-zinc-500 dark:text-zinc-400 tracking-wider">
            {wsConnected ? 'LIVE' : 'DISCONNECTED'}
          </span>
        </div>

        {/* Global Dark / Light Theme Toggle */}
        <div className="ml-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
