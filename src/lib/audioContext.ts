// Shared Web Audio context, used by both sound.ts (effects) and music.ts
// (background music) so the whole site only ever opens one AudioContext.

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }

  // Browsers start the context suspended until a user gesture; callers only
  // ever run from a click/keydown handler, so resuming here is safe.
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}
