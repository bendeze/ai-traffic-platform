/**
 * Design Tokens for Group Z High-Contrast Minimalist Interface
 */

export interface ThemeTokens {
  bgApp: string;
  bgPanel: string;
  bgCard: string;
  bgSubtle: string;
  bgInset: string;
  bgTag: string;
  bgInput: string;
  borderMain: string;
  borderMuted: string;
  borderStrong: string;
  borderHighlight: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  textDim: string;
  btnBg: string;
  btnColor: string;
  btnBorder: string;
  btnActiveBg: string;
  btnActiveColor: string;
  btnActiveBorder: string;
  cornerMarker: string;
  trafficLightBox: string;
  bulbUnlit: string;
  inputBg: string;
  inputBorder: string;
  blue: string;
}

export function getThemeTokens(isLight: boolean): ThemeTokens {
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
