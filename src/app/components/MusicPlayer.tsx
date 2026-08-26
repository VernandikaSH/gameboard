'use client';

import { useEffect } from 'react';
import { startMusic } from '@/lib/music';

// Renders nothing - it just starts the background music loop on the user's
// first interaction with the site (browsers block audio before a gesture).
// Mounted once in the root layout, so it never remounts (and the music
// never restarts or pauses) when navigating between games.
export default function MusicPlayer() {
  useEffect(() => {
    const GESTURE_EVENTS = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'] as const;
    let started = false;

    const tryStart = () => {
      if (started) return;
      started = true;
      startMusic();
      GESTURE_EVENTS.forEach(event => window.removeEventListener(event, tryStart));
    };

    GESTURE_EVENTS.forEach(event => window.addEventListener(event, tryStart));

    return () => {
      GESTURE_EVENTS.forEach(event => window.removeEventListener(event, tryStart));
    };
  }, []);

  return null;
}
