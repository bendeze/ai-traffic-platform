import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function Footer({ log, isSnapshotMode, snapshotInterval }) {
  const { t } = useTheme();

  return (
    <footer style={{
      marginTop: '20px',
      paddingTop: '14px',
      borderTop: `1px solid ${t.borderMain}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="mono" style={{ fontSize: '0.7rem', color: t.textSubtle }}>STATUS:</span>
        <span className="mono" style={{ fontSize: '0.7rem', color: t.textSecondary }}>{log}</span>
      </div>
      <div className="mono" style={{ fontSize: '0.7rem', color: t.textSubtle }}>
        SAMPLING: {isSnapshotMode ? `PHOTO (${snapshotInterval}s)` : 'CONTINUOUS'} · MAX WAIT: 30s · ALL-YELLOW: 3s
      </div>
    </footer>
  );
}
