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
          onClick={() => { switchEnvironment('sumo'); if (!isSumoRunning) startSumo(); }}
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

        {/* Arduino Serial Hardware Controls */}
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-zinc-200 dark:border-zinc-800">
          <button
            onClick={testArduinoLeds}
            title="Test all 12 physical LEDs on breadboard (Pins 2 to 13)"
            className="btn-minimal !text-[0.68rem] !py-1 !px-2.5 font-bold border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
          >
            TEST LEDS
          </button>
          
          {isArduinoConnected ? (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[0.68rem] font-bold text-emerald-700 dark:text-emerald-400">
                {arduinoPort} CONNECTED
              </span>
              <button
                onClick={disconnectArduino}
                className="btn-minimal !text-[0.65rem] !px-2 !py-0.5 border-red-500 text-red-500 hover:border-red-400"
              >
                DISCONNECT
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[0.68rem] text-zinc-500 dark:text-zinc-400">
                ARDUINO:
              </span>
              
              <div className="w-[175px]">
                <Select value={selectedPort} onValueChange={setSelectedPort}>
                  <SelectTrigger className="h-7 text-[0.68rem] font-mono px-2 py-0.5">
                    <SelectValue placeholder="Select Port" />
                  </SelectTrigger>
                  <SelectContent className="font-mono text-xs">
                    <SelectItem value="auto" className="text-[0.68rem] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ⚡ AUTO-DETECT
                    </SelectItem>
                    {serialPorts.length > 0 ? (
                      serialPorts.map((p) => (
                        <SelectItem key={p.port} value={p.port} className="text-[0.68rem] font-mono">
                          {p.port} {p.is_arduino ? '★ (Nano 33 BLE)' : p.is_usb ? '(USB)' : ''}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled className="text-[0.68rem] font-mono text-zinc-400">
                        No ports found (Click ↻)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <button
                onClick={() => connectArduino(selectedPort)}
                className="btn-minimal !text-[0.68rem] !py-1 !px-2.5 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold"
              >
                CONNECT
              </button>

              <button
                onClick={fetchSerialPorts}
                title="Scan for connected serial ports"
                className="btn-minimal !text-[0.68rem] !py-1 !px-2"
              >
                ↻
              </button>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <div className="flex items-center ml-2 pl-2 border-l border-zinc-200 dark:border-zinc-800">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
