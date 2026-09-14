/**
 * The page's single `AudioContext`, shared by every cue the session plays.
 *
 * Browser autoplay policy only lifts a suspended context from inside a real
 * user-gesture call stack, and a gesture unlocks the context — not the object
 * that asked for it. One context per page therefore means one unlock covers
 * every later cue, including cues from timers created long after the gesture
 * (a routine's second and third exercise); a context per timer leaves every
 * timer built without a gesture of its own permanently silent.
 */
let sharedContext: AudioContext | null = null;

function audioContext(): AudioContext {
  if (!sharedContext) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    sharedContext = new AudioContextClass();
  }
  return sharedContext;
}

function resumeIfSuspended(ctx: AudioContext): void {
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
}

/**
 * Creates (or reuses) the shared context and resumes it. Must be called
 * synchronously from within a real user-gesture handler (e.g. a click) — a
 * later `setInterval` tick can never satisfy autoplay policy on its own.
 */
export function unlockAudioCues(): void {
  resumeIfSuspended(audioContext());
}

export function playAudioCue(
  frequency: number = 880,
  duration: number = 0.3,
): void {
  const ctx = audioContext();
  resumeIfSuspended(ctx);
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

/** Drops the shared context so the next cue builds a fresh one. */
export function resetAudioCues(): void {
  sharedContext = null;
}
