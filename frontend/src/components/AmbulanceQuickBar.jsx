import React from 'react';

export default function AmbulanceQuickBar({ activeAmbulance, triggerAmbulance }) {
  return (
    <div className="p-3 px-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2.5 flex-wrap bg-white dark:bg-zinc-950">
      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
        TRIGGER AMBULANCE:
      </span>
      {['north', 'south', 'east', 'west'].map((app) => (
        <button
          key={app}
          onClick={() => triggerAmbulance(app)}
          className={`btn-minimal text-xs font-mono !py-1 !px-2.5 ${
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
