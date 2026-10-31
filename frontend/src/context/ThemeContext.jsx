import React, { createContext, useContext, useState, useEffect } from 'react';
import { getThemeTokens, getCommonStyles } from '../tokens/themeTokens';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('group_z_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const isLight = theme === 'light';
  const t = getThemeTokens(isLight);
  const common = getCommonStyles(t, isLight);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('group_z_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const value = {
    theme,
    isLight,
    toggleTheme,
    t,
    ...common,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
