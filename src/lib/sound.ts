// Small self-contained sound effects synthesized with the Web Audio API, so
// games don't depend on any external audio assets. Shared across games -
// reuse an existing sound where the effect fits rather than adding a new one.

import { getAudioContext } from './audioContext';

let volumeMultiplier = 1; // 0-1, set from the settings page

export function setSoundVolume(v: number) {
  volumeMultiplier = Math.max(0, Math.min(1, v));
}

function playTone(freq: number, duration: number, opts: { type?: OscillatorType; volume?: number; delay?: number } = {}) {
  const ctx = getAudioContext();
  if (!ctx || volumeMultiplier <= 0) return;

  const { type = 'sine', volume = 0.2, delay = 0 } = opts;
  const startTime = ctx.currentTime + delay;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume * volumeMultiplier, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

// A handful of quick clicky ticks - dice tumbling, or any other "drop/place
// something" moment (e.g. placing a disc on a board).
export function playDiceSound() {
  for (let i = 0; i < 5; i++) {
    const freq = 300 + Math.random() * 500;
    playTone(freq, 0.05, { type: 'square', volume: 0.08, delay: i * 0.045 });
  }
}

// A single crisp tick - one step of movement, or one piece turning over.
export function playStepSound() {
  playTone(520, 0.08, { type: 'triangle', volume: 0.15 });
}

export function playLadderSound() {
  // Rising arpeggio for climbing a ladder.
  [440, 554, 660, 880].forEach((f, i) => playTone(f, 0.15, { type: 'sine', volume: 0.18, delay: i * 0.08 }));
}

export function playSnakeSound() {
  // A descending hiss/slide for sliding down a snake.
  const ctx = getAudioContext();
  if (!ctx || volumeMultiplier <= 0) return;

  const startTime = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(500, startTime);
  osc.frequency.exponentialRampToValueAtTime(140, startTime + 0.6);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(0.15 * volumeMultiplier, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + 0.65);
}
