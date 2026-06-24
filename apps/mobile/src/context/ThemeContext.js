import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext(null);

const themes = {
  light: {
    bg: '#ffffff',
    surface: '#f5f5f5',
    surfaceHover: '#eeeeee',
    border: '#e0e0e0',
    text: '#1a1a2e',
    textSecondary: '#666',
    primary: '#4f46e5',
    primaryText: '#ffffff',
    msgOther: '#f0f0f0',
    msgOtherText: '#1a1a2e',
    msgMine: '#4f46e5',
    msgMineText: '#ffffff',
    statusBar: 'dark-content',
  },
  dark: {
    bg: '#1a1a2e',
    surface: '#16213e',
    surfaceHover: '#1a2a4a',
    border: '#2a2a4a',
    text: '#e0e0e0',
    textSecondary: '#999',
    primary: '#4f46e5',
    primaryText: '#ffffff',
    msgOther: '#2a2a4a',
    msgOtherText: '#e0e0e0',
    msgMine: '#4f46e5',
    msgMineText: '#ffffff',
    statusBar: 'light-content',
  },
};

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState('dark');

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('theme');
      if (saved) setThemeId(saved);
    })();
  }, []);

  const toggleTheme = async () => {
    const next = themeId === 'dark' ? 'light' : 'dark';
    setThemeId(next);
    await AsyncStorage.setItem('theme', next);
  };

  const colors = themes[themeId] || themes.dark;

  return (
    <ThemeContext.Provider value={{ themeId, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
