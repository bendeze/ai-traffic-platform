import React from 'react';

interface FooterProps {
  log: string;
  isSnapshotMode: boolean;
  snapshotInterval: number;
}

export default function Footer({ log, isSnapshotMode, snapshotInterval }: FooterProps) {
  return (
    <footer className="mt-5 pt-3.5 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center flex-wrap gap-2">
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-xs text-zinc-400">STATUS:</span>
        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300 font-semibold">{log}</span>
      </div>
      <div className="font-mono text-xs text-zinc-400">
        SAMPLING: {isSnapshotMode ? `PHOTO (${snapshotInterval}s)` : 'CONTINUOUS'} · MAX WAIT: 30s · ALL-YELLOW: 3s
      </div>
    </footer>
  );
}
