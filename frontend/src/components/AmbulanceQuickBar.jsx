import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function AmbulanceQuickBar({ activeAmbulance, triggerAmbulance }) {
  const { t, btnMinimal } = useTheme();

  return (
    <div style={{
      padding: '12px 16px',
      borderTop: `1px solid ${t.borderMain}`,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
      backgroundColor: t.bgPanel
    }}>
      <span className="mono" style={{ fontSize: '0.65rem', color: t.textMuted }}>
        TRIGGER AMBULANCE:
      </span>
      {['north', 'south', 'east', 'west'].map((app) => (
        <button
          key={app}
          onClick={() => triggerAmbulance(app)}
          style={{
            ...btnMinimal,
            fontSize: '0.65rem',
            padding: '4px 8px',
            borderColor: activeAmbulance === app ? '#ef4444' : t.borderMuted,
            color: activeAmbulance === app ? '#ef4444' : t.textPrimary
          }}
        >
          + {app.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
