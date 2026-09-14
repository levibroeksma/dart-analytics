// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { resetAudioCues } from "@modules/ui/audio-cue.module";

let resumeMock: ReturnType<typeof vi.fn>;

describe("SegmentTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAudioCues();
    resumeMock = vi.fn();
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
          resume: resumeMock,
        };
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetAudioCues();
  });

  it("counts down and calls onComplete at zero without firing onSegmentChange (interval === total)", () => {
    const onTick = vi.fn();
    const onSegmentChange = vi.fn();
    const onComplete = vi.fn();
    const timer = new SegmentTimer({
      totalMinutes: 1 / 60,
      intervalMinutes: 1 / 60,
      onTick,
      onSegmentChange,
      onComplete,
    });
    timer.start();
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledWith(0);
    expect(onSegmentChange).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("stop() prevents further ticks", () => {
    const onTick = vi.fn();
    const timer = new SegmentTimer({
      totalMinutes: 1,
      intervalMinutes: 1,
      onTick,
    });
    timer.start();
    timer.stop();
    vi.advanceTimersByTime(5000);
    expect(onTick).not.toHaveBeenCalled();
  });

  it("counts up and calls onComplete when remaining reaches totalSeconds (countup)", () => {
    const onTick = vi.fn();
    const onComplete = vi.fn();
    const timer = new SegmentTimer({
      totalMinutes: 2 / 60,
      intervalMinutes: 1 / 60,
      direction: "countup",
      onTick,
      onComplete,
    });
    timer.start();
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledWith(1);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledWith(2);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("countup direction never fires onSegmentChange", () => {
    const onSegmentChange = vi.fn();
    const timer = new SegmentTimer({
      totalMinutes: 5 / 60,
      intervalMinutes: 1 / 60,
      direction: "countup",
      onSegmentChange,
    });
    timer.start();
    vi.advanceTimersByTime(4000);
    expect(onSegmentChange).not.toHaveBeenCalled();
    timer.stop();
  });

  it("stop() prevents further ticks in the countup direction too", () => {
    const onTick = vi.fn();
    const timer = new SegmentTimer({
      totalMinutes: 1,
      intervalMinutes: 1,
      direction: "countup",
      onTick,
    });
    timer.start();
    timer.stop();
    vi.advanceTimersByTime(5000);
    expect(onTick).not.toHaveBeenCalled();
  });

  it("getElapsed() reports elapsed seconds for both directions", () => {
    const countdown = new SegmentTimer({ totalMinutes: 1, intervalMinutes: 1 });
    expect(countdown.getElapsed()).toBe(0);
    countdown.start();
    vi.advanceTimersByTime(3000);
    expect(countdown.getElapsed()).toBe(3);
    countdown.stop();

    const countup = new SegmentTimer({
      totalMinutes: 1,
      intervalMinutes: 1,
      direction: "countup",
    });
    expect(countup.getElapsed()).toBe(0);
    countup.start();
    vi.advanceTimersByTime(3000);
    expect(countup.getElapsed()).toBe(3);
    countup.stop();
  });

  it("countup with segmentDurationsSeconds fires onSegmentChange at each cumulative boundary", () => {
    const onSegmentChange = vi.fn();
    const onComplete = vi.fn();
    const timer = new SegmentTimer({
      direction: "countup",
      segmentDurationsSeconds: [2, 3],
      onSegmentChange,
      onComplete,
    });
    timer.start();
    vi.advanceTimersByTime(2000);
    expect(onSegmentChange).toHaveBeenCalledTimes(1);
    expect(onSegmentChange).toHaveBeenCalledWith(1);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(onSegmentChange).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("countup with a single segmentDurationsSeconds entry never fires onSegmentChange", () => {
    const onSegmentChange = vi.fn();
    const onComplete = vi.fn();
    const timer = new SegmentTimer({
      direction: "countup",
      segmentDurationsSeconds: [3],
      onSegmentChange,
      onComplete,
    });
    timer.start();
    vi.advanceTimersByTime(3000);
    expect(onSegmentChange).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("throws when constructed with neither totalMinutes nor segmentDurationsSeconds", () => {
    expect(() => new SegmentTimer({})).toThrow();
  });

  it("resumes a suspended audio context before playing a beep", () => {
    const timer = new SegmentTimer({
      totalMinutes: 1,
      intervalMinutes: 1 / 60,
    });
    timer.start();
    vi.advanceTimersByTime(1000);
    expect(resumeMock).toHaveBeenCalled();
  });

  it("unlockAudio() unlocks the shared audio context, with no tick required", () => {
    const timer = new SegmentTimer({ totalMinutes: 1, intervalMinutes: 1 });
    timer.unlockAudio();
    expect(resumeMock).toHaveBeenCalled();
  });
});
