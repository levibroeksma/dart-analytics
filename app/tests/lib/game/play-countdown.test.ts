// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  formatRemaining,
  formatSeconds,
  maybeResumeCountdown,
  restartCountdown,
  startCountdown,
} from "@lib/game/play-countdown";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import type { CountdownGame, ExpirableEngine } from "@lib/types";

function makeEngine(): ExpirableEngine {
  return { expireTimer: vi.fn() };
}

describe("formatRemaining", () => {
  it("formats whole minutes as mm:ss", () => {
    expect(formatRemaining(180000)).toBe("03:00");
  });

  it("floors partial seconds", () => {
    expect(formatRemaining(61999)).toBe("01:01");
  });

  it("clamps a negative remainder to 00:00", () => {
    expect(formatRemaining(-5000)).toBe("00:00");
  });

  it("treats null and undefined as 00:00", () => {
    expect(formatRemaining(null)).toBe("00:00");
    expect(formatRemaining(undefined)).toBe("00:00");
  });
});

function freshGame(overrides: Partial<CountdownGame> = {}): CountdownGame {
  return {
    timerRemainingMs: null,
    timerStartedAt: null,
    timerExpired: false,
    timerPaused: false,
    ...overrides,
  };
}

describe("formatSeconds", () => {
  it("formats whole seconds as mm:ss", () => {
    expect(formatSeconds(0)).toBe("00:00");
    expect(formatSeconds(61)).toBe("01:01");
    expect(formatSeconds(600)).toBe("10:00");
  });
});

describe("startCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "AudioContext",
      vi.fn().mockImplementation(function () {
        return {
          createOscillator: () => ({
            connect: vi.fn(),
            frequency: {},
            start: vi.fn(),
            stop: vi.fn(),
          }),
          createGain: () => ({
            connect: vi.fn(),
            gain: {
              setValueAtTime: vi.fn(),
              exponentialRampToValueAtTime: vi.fn(),
            },
          }),
          destination: {},
          currentTime: 0,
          state: "suspended",
          resume: vi.fn(),
        };
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * `startCountdown` is reached both from a genuine click (`playAgain()`)
   * and from `init()`'s automatic session-resume path, which has no
   * preceding gesture of its own (#307). Unlocking here at least covers the
   * click-driven call sites for free — a no-op when no gesture preceded it.
   */
  it("unlocks the timer's audio synchronously on construction, before any tick fires", () => {
    const unlockSpy = vi.spyOn(SegmentTimer.prototype, "unlockAudio");
    const game: CountdownGame = {
      timerRemainingMs: null,
      timerStartedAt: null,
      timerExpired: false,
      timerPaused: false,
    };
    startCountdown(game, 5, makeEngine());
    expect(unlockSpy).toHaveBeenCalledOnce();
  });
});

describe("maybeResumeCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(SegmentTimer.prototype, "unlockAudio").mockImplementation(
      () => {},
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does nothing outside MINUTES mode", () => {
    const engine = makeEngine();
    const game = freshGame({ timerExpired: true });
    expect(
      maybeResumeCountdown(
        game,
        { durationType: "TARGET", durationValue: 5 },
        engine,
      ),
    ).toBeNull();
    expect(engine.expireTimer).not.toHaveBeenCalled();
  });

  it("expires the engine for an already-expired session, even with no duration value", () => {
    const engine = makeEngine();
    expect(
      maybeResumeCountdown(
        freshGame({ timerExpired: true }),
        { durationType: "MINUTES", durationValue: null },
        engine,
      ),
    ).toBeNull();
    expect(engine.expireTimer).toHaveBeenCalledOnce();
  });

  it("starts no countdown for a MINUTES config with no duration value", () => {
    const game = freshGame();
    expect(
      maybeResumeCountdown(
        game,
        { durationType: "MINUTES", durationValue: null },
        makeEngine(),
      ),
    ).toBeNull();
    expect(game.timerRemainingMs).toBeNull();
  });

  it("resumes a running countdown, stopped again when the session was paused", () => {
    const game = freshGame({ timerRemainingMs: 120000, timerPaused: true });
    const stop = vi.spyOn(SegmentTimer.prototype, "stop");
    const timer = maybeResumeCountdown(
      game,
      { durationType: "MINUTES", durationValue: 5 },
      makeEngine(),
    );
    expect(timer).toBeInstanceOf(SegmentTimer);
    expect(game.timerRemainingMs).toBe(120000);
    expect(stop).toHaveBeenCalledOnce();
  });
});

describe("restartCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(SegmentTimer.prototype, "unlockAudio").mockImplementation(
      () => {},
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function context(timer: SegmentTimer | null = null) {
    return { timer, $store: { game: freshGame() } };
  }

  it("swaps in a fresh full-length segment and stops the old one", () => {
    const old = { stop: vi.fn() } as unknown as SegmentTimer;
    const ctx = context(old);
    restartCountdown(
      ctx,
      { durationType: "MINUTES", durationValue: 3 },
      makeEngine(),
    );
    expect(old.stop).toHaveBeenCalledOnce();
    expect(ctx.timer).toBeInstanceOf(SegmentTimer);
    expect(ctx.timer).not.toBe(old);
    expect(ctx.$store.game.timerRemainingMs).toBe(180000);
  });

  it("keeps the current timer for a missing config, a non-MINUTES config or no duration value", () => {
    const old = { stop: vi.fn() } as unknown as SegmentTimer;
    const ctx = context(old);
    restartCountdown(ctx, null, makeEngine());
    restartCountdown(
      ctx,
      { durationType: "TARGET", durationValue: 3 },
      makeEngine(),
    );
    restartCountdown(
      ctx,
      { durationType: "MINUTES", durationValue: null },
      makeEngine(),
    );
    expect(old.stop).not.toHaveBeenCalled();
    expect(ctx.timer).toBe(old);
    expect(ctx.$store.game.timerRemainingMs).toBeNull();
  });
});
