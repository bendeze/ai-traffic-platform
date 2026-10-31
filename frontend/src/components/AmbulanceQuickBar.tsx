import React from 'react';
import { ApproachName } from '../types';

interface AmbulanceQuickBarProps {
  activeAmbulance?: string | null;
  triggerAmbulance: (approach: ApproachName) => void;
}

export default function AmbulanceQuickBar({ activeAmbulance, triggerAmbulance }: AmbulanceQuickBarProps) {
  const approaches: ApproachName[] = ['north', 'south', 'east', 'west'];

  return (
    <div className="p-3 px-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2.5 flex-wrap bg-white dark:bg-zinc-950">
      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
        TRIGGER AMBULANCE:
      </span>
      {approaches.map((app) => (
        <button
          key={app}
          onClick={() => triggerAmbulance(app)}
          className={`btn-minimal text-xs font-mono !py-1 !px-2.5 focus-visible:outline-2 focus-visible:outline-red-500 ${
            activeAmbulance === app
              ? '!border-red-500 !text-red-500'
              : 'border-zinc-300 dark:border-zinc-800'
          }`}
        >
          + {app.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
