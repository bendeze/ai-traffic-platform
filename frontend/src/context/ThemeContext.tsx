import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getThemeTokens, ThemeTokens } from '../tokens/themeTokens';

interface ThemeContextType {
  theme: 'dark' | 'light';
  isLight: boolean;
  toggleTheme: () => void;
  t: ThemeTokens;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('group_z_theme') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const isLight = theme === 'light';
  const t = getThemeTokens(isLight);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('group_z_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const value: ThemeContextType = {
    theme,
    isLight,
    toggleTheme,
    t,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

