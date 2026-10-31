/**
 * Design Tokens for Group Z High-Contrast Minimalist Interface
 * Supports both high-contrast Dark Mode (#000000) and Light Mode (#ffffff/#f4f4f5).
 */

export function getThemeTokens(isLight) {
  return {
    bgApp: isLight ? '#f4f4f5' : '#000000',
    bgPanel: isLight ? '#ffffff' : '#050505',
    bgCard: isLight ? '#ffffff' : '#000000',
    bgSubtle: isLight ? '#f9fafb' : '#050505',
    bgInset: isLight ? '#f4f4f5' : '#0a0a0a',
    bgTag: isLight ? '#e4e4e7' : '#111111',
    bgInput: isLight ? '#ffffff' : '#000000',

    borderMain: isLight ? '#e4e4e7' : '#1a1a1a',
    borderMuted: isLight ? '#d4d4d8' : '#222222',
    borderStrong: isLight ? '#a1a1aa' : '#333333',
    borderHighlight: isLight ? '#09090b' : '#ffffff',

    textPrimary: isLight ? '#09090b' : '#ffffff',
    textSecondary: isLight ? '#52525b' : '#a1a1aa',
    textMuted: isLight ? '#71717a' : '#737373',
    textSubtle: isLight ? '#a1a1aa' : '#555555',
    textDim: isLight ? '#cbd5e1' : '#333333',

    btnBg: isLight ? '#ffffff' : '#000000',
    btnColor: isLight ? '#09090b' : '#ffffff',
    btnBorder: isLight ? '#d4d4d8' : '#222222',

    btnActiveBg: isLight ? '#09090b' : '#ffffff',
    btnActiveColor: isLight ? '#ffffff' : '#000000',
    btnActiveBorder: isLight ? '#09090b' : '#ffffff',

    cornerMarker: isLight ? '#a1a1aa' : '#333333',
    trafficLightBox: isLight ? '#f4f4f5' : '#090909',
    bulbUnlit: isLight ? '#d4d4d8' : '#222222',
    inputBg: isLight ? '#ffffff' : '#000000',
    inputBorder: isLight ? '#cbd5e1' : '#333333',

    blue: isLight ? '#0284c7' : '#38bdf8',
  };
}

export function getCommonStyles(t, isLight) {
  return {
    btnMinimal: {
      backgroundColor: t.btnBg,
      color: t.btnColor,
      border: `1px solid ${t.btnBorder}`,
      padding: '6px 12px',
      fontSize: '0.7rem',
      fontWeight: 600,
      letterSpacing: '0.05em',
      fontFamily: 'JetBrains Mono, monospace',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    },
    btnAction: {
      backgroundColor: isLight ? '#f4f4f5' : '#111111',
      color: t.textPrimary,
      border: `1px solid ${t.borderMuted}`,
      padding: '10px',
      fontSize: '0.7rem',
      fontWeight: 700,
      fontFamily: 'JetBrains Mono, monospace',
      cursor: 'pointer',
      letterSpacing: '0.05em',
      transition: 'all 0.15s ease',
    },
    cornerTL: {
      position: 'absolute',
      top: '12px',
      left: '12px',
      width: '12px',
      height: '12px',
      borderTop: `2px solid ${t.cornerMarker}`,
      borderLeft: `2px solid ${t.cornerMarker}`,
      pointerEvents: 'none',
    },
    cornerTR: {
      position: 'absolute',
      top: '12px',
      right: '12px',
      width: '12px',
      height: '12px',
      borderTop: `2px solid ${t.cornerMarker}`,
      borderRight: `2px solid ${t.cornerMarker}`,
      pointerEvents: 'none',
    },
    cornerBL: {
      position: 'absolute',
      bottom: '12px',
      left: '12px',
      width: '12px',
      height: '12px',
      borderBottom: `2px solid ${t.cornerMarker}`,
      borderLeft: `2px solid ${t.cornerMarker}`,
      pointerEvents: 'none',
    },
    cornerBR: {
      position: 'absolute',
      bottom: '12px',
      right: '12px',
      width: '12px',
      height: '12px',
      borderBottom: `2px solid ${t.cornerMarker}`,
      borderRight: `2px solid ${t.cornerMarker}`,
      pointerEvents: 'none',
    },
  };
}

