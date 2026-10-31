import React from 'react';

interface FooterProps {
  log: string;
  isSnapshotMode: boolean;
  snapshotInterval: number;
}

export default function Footer({ log, isSnapshotMode, snapshotInterval }: FooterProps) {
  return (
    <footer className="mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2.5">
      {/* Lower Row: Copyright & Academic Project Attribution */}
      <div className="pt-2 flex justify-between items-center flex-wrap gap-2 text-[0.7rem] font-mono text-zinc-400 dark:text-zinc-500">
        <div>
          © {new Date().getFullYear()} Group 5 · CMU – Bridge Program Project
        </div>
        <div>
          Intelligent Traffic Management Platform
        </div>
      </div>
    </footer>
  );
}