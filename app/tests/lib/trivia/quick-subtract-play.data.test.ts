// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { quickSubtractPlay } from "@lib/trivia/quick-subtract-play.data";

describe("quickSubtractPlay", () => {
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
        };
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts idle with no active game", () => {
    const ctx = quickSubtractPlay();
    expect(ctx.status).toBe("idle");
    expect(ctx.game).toBeNull();
  });

  it("startCount() builds a running count-mode game and seeds the first calculation", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = quickSubtractPlay();
    ctx.startCount(5);
    expect(ctx.status).toBe("running");
    expect(ctx.current).toEqual({
      start: 2,
      subtraction: 1,
      expression: "2 - 1",
    });
  });

  it("startTimer() builds a running timer-mode game", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = quickSubtractPlay();
    ctx.startTimer(5);
    expect(ctx.status).toBe("running");
    expect(ctx.current).not.toBeNull();
  });

  it("submit() records the answer, syncs stats, and clears the score input", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = quickSubtractPlay();
    ctx.startCount(5);
    ctx.scoreInput.setValue("1");
    ctx.submit();
    expect(ctx.scoreInput.value).toBe("");
    expect(ctx.correctAnswers).toBe(1);
    expect(ctx.attempts).toBe(1);
    expect(ctx.lastAnswer?.correct).toBe(true);
  });

  it("formattedElapsed()/formattedRemaining() render as mm:ss", () => {
    const ctx = quickSubtractPlay();
    ctx.elapsedTime = 65;
    ctx.remainingTime = 9;
    expect(ctx.formattedElapsed()).toBe("01:05");
    expect(ctx.formattedRemaining()).toBe("00:09");
  });

  it("timer mode's onComplete syncs status to finished, not just the underlying game", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = quickSubtractPlay();
    ctx.startTimer(1);
    vi.advanceTimersByTime(60_000);
    expect(ctx.game!.getStatus()).toBe("finished");
    expect(ctx.status).toBe("finished");
  });

  it("reset() tears down the game and returns to idle", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ctx = quickSubtractPlay();
    ctx.startCount(5);
    ctx.reset();
    expect(ctx.status).toBe("idle");
    expect(ctx.game).toBeNull();
    expect(ctx.correctAnswers).toBe(0);
    expect(ctx.current).toBeNull();
  });

  it("destroy() stops the underlying game's timer", () => {
    const ctx = quickSubtractPlay();
    ctx.startCount(5);
    const destroySpy = vi.spyOn(ctx.game!, "destroy");
    ctx.destroy();
    expect(destroySpy).toHaveBeenCalled();
  });
});
