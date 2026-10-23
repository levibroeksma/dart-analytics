// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@client/api/training-sessions", () => ({
  startTraining: vi.fn(),
  startTrainingStep: vi.fn(),
  completeTraining: vi.fn(),
  abandonTraining: vi.fn(),
  resumeTraining: vi.fn(),
}));
vi.mock("@client/api/sessions", () => ({
  completeSession: vi.fn(),
  appendBatch: vi.fn(),
}));
vi.mock("@modules/ui/audio-cue.module", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@modules/ui/audio-cue.module")>()),
  playAudioCue: vi.fn(),
}));

import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { routinePlay } from "@lib/training/routines/routine-play.data";
import { trainingSessionStore } from "@stores/training-session.store";
import type { RoutinePlayContext } from "@lib/types";

function makeStore(): RoutinePlayContext {
  return {
    ...routinePlay(),
    $store: {
      game: {
        loading: false,
        reset: vi.fn(),
        startSession: vi.fn(),
        contextRow: vi.fn(() => null),
        timerPaused: false,
        configSnapshot: null,
      },
      trainingSession: trainingSessionStore(),
    },
  } as unknown as RoutinePlayContext;
}

function gameStepStub(store: RoutinePlayContext) {
  const game = {
    hasActiveSession: true,
    finished: false,
    remainingLabel: () => "04:30",
    togglePause: vi.fn(() => {
      store.$store.game.timerPaused = !store.$store.game.timerPaused;
    }),
  };
  store.game = game as unknown as RoutinePlayContext["game"];
  store.$store.game.configSnapshot = { durationType: "MINUTES" };
  return game;
}

describe("routinePlay — pause", () => {
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

  it("is not pausable without a running step timer", () => {
    const store = makeStore();

    expect(store.pausable()).toBe(false);
    store.togglePause();
    expect(store.paused()).toBe(false);
  });

  it("freezes the step countdown and session clock, and resumes both", () => {
    const store = makeStore();
    store.startStepTimer(60);
    vi.advanceTimersByTime(10000);
    expect(store.pausable()).toBe(true);

    store.togglePause();
    vi.advanceTimersByTime(30000);
    expect(store.paused()).toBe(true);
    expect(store.stepRemainingSeconds).toBe(50);
    expect(store.sessionClock?.elapsedSeconds()).toBe(10);

    store.togglePause();
    vi.advanceTimersByTime(5000);
    expect(store.paused()).toBe(false);
    expect(store.stepRemainingSeconds).toBe(45);
    expect(store.sessionClock?.elapsedSeconds()).toBe(15);
    store.stopSessionClock();
    store.stepTimer?.stop();
  });

  it("pauses the warm-up count-up without re-advancing its phases on resume", () => {
    const store = makeStore();
    const advance = vi.fn();
    store.warmUpEngine = {
      advance,
    } as unknown as RoutinePlayContext["warmUpEngine"];
    store.startWarmUpTimer({
      stepDurationSeconds: 10,
      phases: [
        { name: "A", targets: [20], weight: 1 },
        { name: "B", targets: [19], weight: 1 },
      ],
    });
    vi.advanceTimersByTime(7000);
    const advancedBefore = advance.mock.calls.length;

    store.togglePause();
    vi.advanceTimersByTime(20000);
    expect(store.warmUpElapsedSeconds).toBe(7);
    store.togglePause();
    vi.advanceTimersByTime(1000);

    expect(store.warmUpElapsedSeconds).toBe(8);
    expect(advance.mock.calls.length).toBe(advancedBefore);
    store.warmUpTimer?.stop();
    store.stopSessionClock();
  });

  it("ignores darts while paused", () => {
    const store = makeStore();
    const record = vi.fn();
    store.switchingEngine = {
      record,
      isComplete: () => false,
    } as unknown as RoutinePlayContext["switchingEngine"];
    store.startStepTimer(60);
    store.togglePause();

    store.recordSwitchingDart({} as never);
    expect(record).not.toHaveBeenCalled();

    store.togglePause();
    store.recordSwitchingDart({} as never);
    expect(record).toHaveBeenCalledTimes(1);
    store.stopSessionClock();
    store.stepTimer?.stop();
  });

  it("delegates a game step to its own pause and mirrors it on the session clock", () => {
    const store = makeStore();
    const game = gameStepStub(store);
    store.startSessionClock();
    vi.advanceTimersByTime(4000);
    expect(store.pausable()).toBe(true);
    expect(store.pauseLabel()).toBe("04:30");

    store.togglePause();
    vi.advanceTimersByTime(9000);
    expect(game.togglePause).toHaveBeenCalledTimes(1);
    expect(store.paused()).toBe(true);
    expect(store.sessionClock?.elapsedSeconds()).toBe(4);

    store.togglePause();
    vi.advanceTimersByTime(2000);
    expect(store.paused()).toBe(false);
    expect(store.sessionClock?.elapsedSeconds()).toBe(6);
    store.stopSessionClock();
  });

  it("is not pausable for an untimed game step", () => {
    const store = makeStore();
    gameStepStub(store);
    store.$store.game.configSnapshot = { durationType: "ROUNDS" };

    expect(store.pausable()).toBe(false);
  });

  it("labels an exercise pause with the header clock", () => {
    const store = makeStore();
    store.startStepTimer(90);

    expect(store.pauseLabel()).toBe(store.headerClock());
    store.stopSessionClock();
    store.stepTimer?.stop();
  });

  it("starting the next step timer clears a leftover pause and resumes the session clock", () => {
    const store = makeStore();
    store.startStepTimer(60);
    store.togglePause();
    store.stepTimer?.stop();
    store.stepTimer = null;

    store.startStepTimer(30);
    vi.advanceTimersByTime(2000);

    expect(store.paused()).toBe(false);
    expect(store.stepRemainingSeconds).toBe(28);
    store.stopSessionClock();
    (store.stepTimer as SegmentTimer | null)?.stop();
  });
});
