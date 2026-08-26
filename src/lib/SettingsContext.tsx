'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { setSoundVolume as applySoundVolume } from './sound';
import { setMusicVolume as applyMusicVolume } from './music';

interface SettingsContextValue {
  soundVolume: number; // 0-100
  musicVolume: number; // 0-100
  setSoundVolume: (value: number) => void;
  setMusicVolume: (value: number) => void;
}

const SOUND_KEY = 'gameboard.soundVolume';
const MUSIC_KEY = 'gameboard.musicVolume';
const DEFAULT_VOLUME = 70;

const SettingsContext = createContext<SettingsContextValue | null>(null);

function readStoredVolume(key: string): number {
  if (typeof window === 'undefined') return DEFAULT_VOLUME;
  const raw = window.localStorage.getItem(key);
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : DEFAULT_VOLUME;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [soundVolume, setSoundVolumeState] = useState(DEFAULT_VOLUME);
  const [musicVolume, setMusicVolumeState] = useState(DEFAULT_VOLUME);

  // Hydrate from localStorage after mount (server and first client render
  // both use DEFAULT_VOLUME, so there's no hydration mismatch), and apply
  // the stored levels to the audio modules right away.
  useEffect(() => {
    const storedSound = readStoredVolume(SOUND_KEY);
    const storedMusic = readStoredVolume(MUSIC_KEY);
    setSoundVolumeState(storedSound);
    setMusicVolumeState(storedMusic);
    applySoundVolume(storedSound / 100);
    applyMusicVolume(storedMusic / 100);
  }, []);

  const setSoundVolume = useCallback((value: number) => {
    setSoundVolumeState(value);
    applySoundVolume(value / 100);
    window.localStorage.setItem(SOUND_KEY, String(value));
  }, []);

  const setMusicVolume = useCallback((value: number) => {
    setMusicVolumeState(value);
    applyMusicVolume(value / 100);
    window.localStorage.setItem(MUSIC_KEY, String(value));
  }, []);

  return (
    <SettingsContext.Provider value={{ soundVolume, musicVolume, setSoundVolume, setMusicVolume }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
