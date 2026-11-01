import { SegmentTimer } from "@modules/ui/segment-timer.module";
import type { CountdownConfig, CountdownGame, ExpirableEngine } from "./types";

/** `mm:ss` for a whole number of seconds. */
export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatRemaining(ms: number | null | undefined): string {
  return formatSeconds(Math.max(0, Math.floor((ms ?? 0) / 1000)));
}

/**
 * Starts the MINUTES countdown, resuming from the persisted remaining time
 * when a prior session left one and starting a fresh segment otherwise.
 * `timerRemainingMs` is set synchronously so the label never renders 00:00
 * while waiting for the timer's first onTick (which fires 1s after start()).
 * Expiry is written to both authorities it governs: the persisted store flag
 * that survives a reload, and the engine, which owns session completion.
 */
export function startCountdown<
  TGame extends CountdownGame,
  TEngine extends ExpirableEngine,
>(game: TGame, durationValue: number, engine: TEngine): SegmentTimer {
  const resumedRemainingMs = game.timerRemainingMs;
  const durationMinutes =
    resumedRemainingMs != null ? resumedRemainingMs / 60000 : durationValue;

  game.timerRemainingMs = durationMinutes * 60000;
  if (resumedRemainingMs == null) {
    game.timerStartedAt = new Date().toISOString();
  }

  const timer = new SegmentTimer({
    totalMinutes: durationMinutes,
    intervalMinutes: durationMinutes,
    onTick: (secondsRemaining) => {
      game.timerRemainingMs = secondsRemaining * 1000;
    },
    onComplete: () => {
      game.timerExpired = true;
      engine.expireTimer();
    },
  });
  timer.unlockAudio();
  timer.start();
  return timer;
}

/**
 * `init()`'s MINUTES branch: resume the countdown, mark an already-expired
 * session's engine expired, or do nothing (no MINUTES mode, or no duration).
 */
export function maybeResumeCountdown<
  TGame extends CountdownGame,
  TEngine extends ExpirableEngine,
>(game: TGame, config: CountdownConfig, engine: TEngine): SegmentTimer | null {
  if (config.durationType !== "MINUTES") return null;
  if (game.timerExpired) {
    engine.expireTimer();
    return null;
  }
  if (config.durationValue == null) return null;
  const timer = startCountdown(game, config.durationValue, engine);
  if (game.timerPaused) {
    timer.stop();
  }
  return timer;
}

/**
 * `playAgain()`'s MINUTES branch: stops the page's countdown and starts a new
 * one from the store's timer fields, which the replay's reset has cleared.
 * Leaves the timer alone without a MINUTES config and duration.
 */
export function restartCountdown<TEngine extends ExpirableEngine>(
  context: { timer: SegmentTimer | null; $store: { game: CountdownGame } },
  config: CountdownConfig | null,
  engine: TEngine,
): void {
  if (config?.durationType !== "MINUTES" || config.durationValue == null) {
    return;
  }
  context.timer?.stop();
  context.timer = startCountdown(
    context.$store.game,
    config.durationValue,
    engine,
  );
}
