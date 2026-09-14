import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionClock } from "@modules/ui/session-clock.module";

describe("SessionClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T10:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports zero elapsed before it is started", () => {
    const clock = new SessionClock();

    expect(clock.elapsedSeconds()).toBe(0);
  });

  it("ticks the elapsed seconds once a second", () => {
    const ticks: number[] = [];
    const clock = new SessionClock({
      onTick: (elapsed) => ticks.push(elapsed),
    });

    clock.start();
    vi.advanceTimersByTime(3000);

    expect(ticks).toEqual([1, 2, 3]);
    clock.stop();
  });

  it("derives elapsed from the wall clock, so missed ticks do not lose time", () => {
    const ticks: number[] = [];
    const clock = new SessionClock({
      onTick: (elapsed) => ticks.push(elapsed),
    });

    clock.start();
    vi.setSystemTime(new Date("2026-09-14T10:01:59.000Z"));
    vi.advanceTimersByTime(1000);

    expect(ticks.at(-1)).toBe(120);
    clock.stop();
  });

  it("start() is idempotent — a second call does not add a second interval", () => {
    const ticks: number[] = [];
    const clock = new SessionClock({
      onTick: (elapsed) => ticks.push(elapsed),
    });

    clock.start();
    clock.start();
    vi.advanceTimersByTime(2000);

    expect(ticks).toEqual([1, 2]);
    clock.stop();
  });

  it("stop() halts the ticks", () => {
    const ticks: number[] = [];
    const clock = new SessionClock({
      onTick: (elapsed) => ticks.push(elapsed),
    });

    clock.start();
    vi.advanceTimersByTime(1000);
    clock.stop();
    vi.advanceTimersByTime(5000);

    expect(ticks).toEqual([1]);
  });
});
