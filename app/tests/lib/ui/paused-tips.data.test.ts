import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TIP_FADE_MS, pausedTipsData } from "@lib/ui/paused-tips.data";
import { GENERAL_TIPS } from "@lib/training/tips/tips";
import { tipDisplayMs, tipsFor } from "@lib/training/tips/tip-pick";

const KEY = "TUOD_V1";

function setup(reduced = false) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  return pausedTipsData(() => KEY);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pausedTipsData", () => {
  it("start shows a tip", () => {
    const tips = setup();
    tips.start();
    expect([...tipsFor(KEY), ...GENERAL_TIPS]).toContain(tips.tip);
    expect(tips.visible).toBe(true);
  });

  it("rotates after the display time", () => {
    const tips = setup();
    tips.start();
    const first = tips.tip;
    vi.advanceTimersByTime(tipDisplayMs(first) + TIP_FADE_MS);
    expect(tips.tip).not.toBe(first);
    expect(tips.visible).toBe(true);
  });

  it("does not rotate early", () => {
    const tips = setup();
    tips.start();
    const first = tips.tip;
    vi.advanceTimersByTime(tipDisplayMs(first) - 1);
    expect(tips.tip).toBe(first);
    expect(tips.visible).toBe(true);
  });

  it("fades out before the change", () => {
    const tips = setup();
    tips.start();
    const first = tips.tip;
    vi.advanceTimersByTime(tipDisplayMs(first));
    expect(tips.visible).toBe(false);
    expect(tips.tip).toBe(first);
  });

  it("stop clears the timer", () => {
    const tips = setup();
    tips.start();
    const first = tips.tip;
    tips.stop();
    vi.advanceTimersByTime(60_000);
    expect(tips.tip).toBe(first);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("start twice keeps one timer", () => {
    const tips = setup();
    tips.start();
    tips.start();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("start does not repeat the last tip", () => {
    const tips = setup();
    tips.start();
    const first = tips.tip;
    tips.stop();
    tips.start();
    expect(tips.tip).not.toBe(first);
  });

  it("reduced motion swaps without fading", () => {
    const tips = setup(true);
    tips.start();
    const first = tips.tip;
    vi.advanceTimersByTime(tipDisplayMs(first));
    expect(tips.visible).toBe(true);
    expect(tips.tip).not.toBe(first);
  });

  it("destroy stops the rotation", () => {
    const tips = setup();
    tips.start();
    tips.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
