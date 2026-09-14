// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  playAudioCue,
  resetAudioCues,
  unlockAudioCues,
} from "@modules/ui/audio-cue.module";

let resumeMock: ReturnType<typeof vi.fn>;
let constructorMock: ReturnType<typeof vi.fn>;

function stubAudioContext(state: "suspended" | "running" = "suspended"): void {
  resumeMock = vi.fn();
  constructorMock = vi.fn().mockImplementation(function () {
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
      state,
      resume: resumeMock,
    };
  });
  vi.stubGlobal("AudioContext", constructorMock);
}

describe("audio cues", () => {
  beforeEach(() => {
    resetAudioCues();
    stubAudioContext();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAudioCues();
  });

  it("unlockAudioCues() creates the context and resumes it when suspended", () => {
    unlockAudioCues();

    expect(constructorMock).toHaveBeenCalledOnce();
    expect(resumeMock).toHaveBeenCalled();
  });

  it("reuses one context across every cue, so a single unlock covers later cues", () => {
    unlockAudioCues();
    playAudioCue();
    playAudioCue(440, 0.6);

    expect(constructorMock).toHaveBeenCalledOnce();
  });

  it("leaves a running context alone rather than resuming it again", () => {
    resetAudioCues();
    stubAudioContext("running");

    playAudioCue();

    expect(resumeMock).not.toHaveBeenCalled();
  });

  it("resetAudioCues() drops the context so the next cue builds a fresh one", () => {
    playAudioCue();
    resetAudioCues();
    playAudioCue();

    expect(constructorMock).toHaveBeenCalledTimes(2);
  });
});
