import React from 'react';

interface AmbulanceBannerProps {
  activeAmbulance?: string | null;
  clearAmbulance: () => void;
}

export default function AmbulanceBanner({ activeAmbulance, clearAmbulance }: AmbulanceBannerProps) {
  if (!activeAmbulance) return null;

  return (
    <div className="bg-red-950/80 border border-red-500 p-2.5 px-4 rounded mb-4 flex justify-between items-center animate-pulse">
      <div className="flex items-center gap-2.5">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" />
        <span className="font-mono font-extrabold text-xs text-red-200 tracking-wide">
          EMERGENCY VEHICLE PREEMPTION ACTIVE — APPROACH: {activeAmbulance.toUpperCase()}
        </span>
      </div>
      <button
        onClick={clearAmbulance}
        className="bg-red-600 hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-white text-white font-mono text-xs font-extrabold px-3 py-1 cursor-pointer transition-colors"
      >
        DISMISS AMBULANCE
      </button>
    </div>
  );
}
