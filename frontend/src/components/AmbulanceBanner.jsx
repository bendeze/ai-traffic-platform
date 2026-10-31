import React from 'react';

export default function AmbulanceBanner({ activeAmbulance, clearAmbulance }) {
  if (!activeAmbulance) return null;

  return (
    <div style={{
      backgroundColor: '#3b0707',
      border: '1px solid #ef4444',
      padding: '10px 18px',
      borderRadius: '4px',
      marginBottom: '18px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          display: 'inline-block',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: '#ef4444',
          boxShadow: '0 0 10px #ef4444'
        }} />
        <span className="mono" style={{ fontWeight: 800, fontSize: '0.8rem', color: '#fca5a5' }}>
          EMERGENCY VEHICLE PREEMPTION ACTIVE — APPROACH: {activeAmbulance.toUpperCase()}
        </span>
      </div>
      <button
        onClick={clearAmbulance}
        style={{
          background: '#ef4444',
          color: '#ffffff',
          border: 'none',
          padding: '4px 12px',
          fontSize: '0.7rem',
          fontWeight: 800,
          fontFamily: 'JetBrains Mono, monospace',
          cursor: 'pointer'
        }}
      >
        DISMISS AMBULANCE
      </button>
    </div>
  );
}
