// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatRemaining, startCountdown } from "@lib/game/play-countdown";
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
