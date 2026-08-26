// A small generative background-music loop, synthesized with the Web Audio
// API so the site doesn't depend on any external audio files. Uses the
// standard "lookahead" scheduler pattern to stay drift-free over long play
// sessions, and lives entirely in this module (not tied to any component),
// so navigating between pages never interrupts it - only the volume the
// settings page controls, and the MusicPlayer mounted once in the root
// layout, ever touch it.

import { getAudioContext } from './audioContext';

interface Chord {
  root: number;
  notes: [number, number, number];
}

// A calm i-VI-III-VII progression (Am - F - C - G), a common, pleasant loop.
const CHORDS: Chord[] = [
  { root: 110.0, notes: [220.0, 261.63, 329.63] }, // A minor
  { root: 87.31, notes: [174.61, 220.0, 261.63] }, // F major
  { root: 130.81, notes: [261.63, 329.63, 392.0] }, // C major
  { root: 98.0, notes: [196.0, 246.94, 293.66] }, // G major
];

const BPM = 78;
const BEAT_SEC = 60 / BPM;
const BEATS_PER_CHORD = 4;
const SUBDIVISIONS_PER_BEAT = 2; // eighth notes
const STEP_SEC = BEAT_SEC / SUBDIVISIONS_PER_BEAT;
const STEPS_PER_CHORD = BEATS_PER_CHORD * SUBDIVISIONS_PER_BEAT;

const LOOKAHEAD_MS = 40;
const SCHEDULE_AHEAD_SEC = 0.2;

let musicGain: GainNode | null = null;
let volume = 0.5; // 0-1, set from the settings page
let isPlaying = false;
let timerId: ReturnType<typeof setTimeout> | null = null;
let nextStepTime = 0;
let chordIndex = 0;
let stepInChord = 0;

function scheduleArpNote(ctx: AudioContext, time: number, freq: number) {
  if (!musicGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);

  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.22, time + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0005, time + STEP_SEC * 1.6);

  osc.connect(gain).connect(musicGain);
  osc.start(time);
  osc.stop(time + STEP_SEC * 1.8);
}

function scheduleBassNote(ctx: AudioContext, time: number, freq: number, duration: number) {
  if (!musicGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);

  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.18, time + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.0005, time + duration);

  osc.connect(gain).connect(musicGain);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}

function scheduleStep(ctx: AudioContext, time: number) {
  const chord = CHORDS[chordIndex];

  if (stepInChord === 0) {
    scheduleBassNote(ctx, time, chord.root, BEAT_SEC * BEATS_PER_CHORD * 0.92);
  }

  scheduleArpNote(ctx, time, chord.notes[stepInChord % chord.notes.length]);

  stepInChord += 1;
  if (stepInChord >= STEPS_PER_CHORD) {
    stepInChord = 0;
    chordIndex = (chordIndex + 1) % CHORDS.length;
  }
}

function schedulerTick() {
  const ctx = getAudioContext();
  if (!ctx || !isPlaying) return;

  while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
    scheduleStep(ctx, nextStepTime);
    nextStepTime += STEP_SEC;
  }

  timerId = setTimeout(schedulerTick, LOOKAHEAD_MS);
}

export function startMusic() {
  const ctx = getAudioContext();
  if (!ctx || isPlaying) return;

  isPlaying = true;
  musicGain = ctx.createGain();
  musicGain.gain.value = volume;
  musicGain.connect(ctx.destination);

  chordIndex = 0;
  stepInChord = 0;
  nextStepTime = ctx.currentTime + 0.1;
  schedulerTick();
}

export function stopMusic() {
  isPlaying = false;
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
  if (musicGain) {
    musicGain.disconnect();
    musicGain = null;
  }
}

export function setMusicVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (musicGain) musicGain.gain.value = volume;
}
