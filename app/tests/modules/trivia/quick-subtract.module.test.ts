import { describe, it, expect, vi, afterEach } from "vitest";
import { QuickSubtractGame } from "@modules/trivia/quick-subtract.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";

function countupTimer() {
  return new SegmentTimer({
    totalMinutes: 180,
    intervalMinutes: 0,
    direction: "countup",
  });
}

describe("QuickSubtractGame", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts a count-mode session and generates the first calculation deterministically", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = new QuickSubtractGame({
      mode: "count",
      count: 5,
      timer: countupTimer(),
    });
    game.start();
    expect(game.getStatus()).toBe("running");
    expect(game.getCurrent()).toEqual({
      start: 2,
      subtraction: 1,
      expression: "2 - 1",
    });
  });

  it("records a correct answer, advances to a new round, and reports the result", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = new QuickSubtractGame({
      mode: "count",
      count: 5,
      timer: countupTimer(),
    });
    game.start();
    const result = game.answer("1");
    expect(result).toEqual({
      valid: true,
      correct: true,
      expected: 1,
      calculation: { start: 2, subtraction: 1, expression: "2 - 1" },
    });
    expect(game.getCorrectAnswers()).toBe(1);
    expect(game.getAttempts()).toBe(1);
    expect(game.getIncorrectAnswers()).toBe(0);
    expect(game.getStatus()).toBe("running");
  });

  it("records an incorrect answer without finishing the session", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const game = new QuickSubtractGame({
      mode: "count",
      count: 5,
      timer: countupTimer(),
    });
    game.start();
    const result = game.answer("99");
    expect(result.valid).toBe(true);
    expect(result.correct).toBe(false);
    expect(game.getIncorrectAnswers()).toBe(1);
    expect(game.getStatus()).toBe("running");
  });

  it("rejects an empty answer without consuming an attempt", () => {
    const game = new QuickSubtractGame({
      mode: "count",
      count: 5,
      timer: countupTimer(),
    });
    game.start();
    const result = game.answer("");
    expect(result).toEqual({
      valid: false,
      correct: false,
      expected: null,
      calculation: null,
    });
    expect(game.getAttempts()).toBe(0);
  });

  it("finishes a count-mode session once correctAnswers reaches count, stopping the timer", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const timer = countupTimer();
    const stopSpy = vi.spyOn(timer, "stop");
    const game = new QuickSubtractGame({ mode: "count", count: 1, timer });
    game.start();
    game.answer("1");
    expect(game.getStatus()).toBe("finished");
    expect(stopSpy).toHaveBeenCalled();
  });

  it("returns 0 remaining time in count mode and the timer's remaining time in timer mode", () => {
    const countGame = new QuickSubtractGame({
      mode: "count",
      count: 5,
      timer: countupTimer(),
    });
    expect(countGame.getRemainingTime()).toBe(0);

    const timerGame = new QuickSubtractGame({
      mode: "timer",
      timer: new SegmentTimer({ totalMinutes: 5, intervalMinutes: 5 }),
    });
    expect(timerGame.getRemainingTime()).toBe(300);
  });

  it("destroy() stops the timer", () => {
    const timer = countupTimer();
    const stopSpy = vi.spyOn(timer, "stop");
    const game = new QuickSubtractGame({ mode: "count", count: 5, timer });
    game.destroy();
    expect(stopSpy).toHaveBeenCalled();
  });

  it("never throws across 1000 independently generated rounds regardless of the prior result (no chained dead end)", () => {
    const game = new QuickSubtractGame({
      mode: "count",
      count: 1000,
      timer: countupTimer(),
    });
    game.start();
    expect(() => {
      for (let i = 0; i < 1000; i++) {
        const current = game.getCurrent()!;
        game.answer(String(current.start - current.subtraction));
      }
    }).not.toThrow();
    expect(game.getStatus()).toBe("finished");
  });
});
