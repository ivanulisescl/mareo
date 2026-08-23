import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  text: string;
  muted: string;
  accent: string;
  wind: string;
  sea: string;
  temp: string;
  moon: string;
  card: string;
  border: string;
  chip: string;
  gradient: [string, string, string];
  statusBar: 'light' | 'dark';
  overlay: string;
  sheet: string;
  tabBar: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  retryBg: string;
  retryText: string;
  tideNextBg: string;
};

export const DARK_COLORS: ThemeColors = {
  text: '#E8F4FC',
  muted: '#8BA3B8',
  accent: '#38BDF8',
  wind: '#67E8F9',
  sea: '#2DD4BF',
  temp: '#FBBF24',
  moon: '#C7D2FE',
  card: 'rgba(14, 36, 58, 0.82)',
  border: 'rgba(56, 189, 248, 0.18)',
  chip: 'rgba(56, 189, 248, 0.12)',
  gradient: ['#04101C', '#0B1F33', '#06303A'],
  statusBar: 'light',
  overlay: 'rgba(4, 16, 28, 0.72)',
  sheet: '#0B1F33',
  tabBar: 'rgba(4, 16, 28, 0.96)',
  errorBg: 'rgba(239, 68, 68, 0.15)',
  errorBorder: 'rgba(239, 68, 68, 0.35)',
  errorText: '#FCA5A5',
  retryBg: 'rgba(239, 68, 68, 0.25)',
  retryText: '#FECACA',
  tideNextBg: 'rgba(45, 212, 191, 0.12)',
};

export const LIGHT_COLORS: ThemeColors = {
  text: '#0B2538',
  muted: '#5B7388',
  accent: '#0369A1',
  wind: '#0E7490',
  sea: '#0F766E',
  temp: '#B45309',
  moon: '#4F46E5',
  card: 'rgba(255, 255, 255, 0.86)',
  border: 'rgba(3, 105, 161, 0.18)',
  chip: 'rgba(3, 105, 161, 0.08)',
  gradient: ['#E8F4FC', '#D7EEF6', '#C5E8E4'],
  statusBar: 'dark',
  overlay: 'rgba(11, 37, 56, 0.45)',
  sheet: '#F3F9FC',
  tabBar: 'rgba(232, 244, 252, 0.96)',
  errorBg: 'rgba(185, 28, 28, 0.1)',
  errorBorder: 'rgba(185, 28, 28, 0.28)',
  errorText: '#B91C1C',
  retryBg: 'rgba(185, 28, 28, 0.14)',
  retryText: '#991B1B',
  tideNextBg: 'rgba(15, 118, 110, 0.12)',
};

const STORAGE_KEY = 'climareo-theme';

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyNativeScheme(mode: ThemeMode) {
  Appearance.setColorScheme(mode);
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.style.colorScheme = mode;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark') {
          setMode(stored);
          applyNativeScheme(stored);
          return;
        }
        applyNativeScheme('dark');
      })
      .catch(() => {
        applyNativeScheme('dark');
      });
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      applyNativeScheme(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      mode,
      colors: mode === 'dark' ? DARK_COLORS : LIGHT_COLORS,
      toggleTheme,
    }),
    [mode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }
  return ctx;
}
