// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@client/api/training-sessions", () => ({
  startTraining: vi.fn(),
  startTrainingStep: vi.fn(),
  completeTraining: vi.fn(),
  abandonTraining: vi.fn(),
}));
vi.mock("@client/api/sessions", () => ({
  completeSession: vi.fn(),
  appendBatch: vi.fn(),
}));
vi.mock("@modules/ui/audio-cue.module", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@modules/ui/audio-cue.module")>()),
  playAudioCue: vi.fn(),
}));
vi.mock("@lib/game/play-lifecycle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@lib/game/play-lifecycle")>()),
  playAbandonAndExit: vi.fn(),
}));

import * as trainingApi from "@client/api/training-sessions";
import { balancedTrainingPlay } from "@lib/training/balanced-training-play.data";
import { trainingSessionStore } from "@stores/training-session.store";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { playAbandonAndExit } from "@lib/game/play-lifecycle";
import { playAudioCue } from "@modules/ui/audio-cue.module";
import { foldTuodState } from "@modules/game/tuod.engine.module";
import type {
  BalancedTrainingPlayContext,
  Seated,
  TuodSnapshot,
} from "@lib/types";

function makeStore(): BalancedTrainingPlayContext {
  return {
    ...balancedTrainingPlay(),
    $store: {
      game: { loading: false, reset: vi.fn(), startSession: vi.fn() },
      trainingSession: trainingSessionStore(),
    },
  };
}

const STEPS = [
  {
    sequenceNumber: 1,
    exerciseTypeKey: "WARM_UP",
    exerciseRulesetVersionKey: "WARM_UP_V1",
    gameTypeKey: null,
    durationSeconds: 600,
    configuration: {
      stepDurationSeconds: 600,
      phases: [{ name: "Upper", targets: [5], weight: 1 }],
    },
  },
];

describe("balancedTrainingPlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("init() starts the routine and builds the training engine from the returned steps", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    const store = makeStore();
    await store.init();
    expect(store.activityId).toBe("act-1");
    expect(store.currentStep()?.exerciseTypeKey).toBe("WARM_UP");
  });

  it("startCurrentStep() calls startTrainingStep with the current sequenceNumber and builds the Warm-Up engine", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(trainingApi.startTrainingStep).toHaveBeenCalledWith("act-1", 1);
    expect(store.warmUpEngine).not.toBeNull();
    expect(store.warmUpEngine!.state().phaseIndex).toBe(0);
  });

  it("startCurrentStep() for WARM_UP does not start the timer until confirmWarmUpReady() runs", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.warmUpReady).toBe(false);
    expect(store.warmUpTimer).toBeNull();

    store.confirmWarmUpReady();
    expect(store.warmUpReady).toBe(true);
    expect(store.warmUpTimer).not.toBeNull();
  });

  it("confirmWarmUpReady() unlocks the timer's audio synchronously, before any tick fires", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const unlockSpy = vi.spyOn(SegmentTimer.prototype, "unlockAudio");
    const store = makeStore();
    await store.init();
    store.confirmWarmUpReady();
    expect(unlockSpy).toHaveBeenCalledOnce();
  });

  it("buildWarmUpEngine() builds the Warm-Up engine directly from a configuration object", () => {
    const store = makeStore();
    store.buildWarmUpEngine(STEPS[0].configuration);
    expect(store.warmUpEngine).not.toBeNull();
    expect(store.warmUpEngine!.state().phaseIndex).toBe(0);
  });

  it("the Warm-Up timer advances the engine through its phase and completes the step at the end", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-12T12:00:00.000Z",
    });
    const store = makeStore();
    await store.init();
    expect(store.warmUpEngine!.state().phaseIndex).toBe(0);
    store.confirmWarmUpReady();
    expect(store.warmUpTimer).not.toBeNull();

    vi.advanceTimersByTime(600_000);
    await vi.runAllTimersAsync();

    expect(globalThis.location.href).toBe("");
    expect(store.routineFinished).toBe(true);
    expect(store.warmUpTimer).toBeNull();
  });

  it("formattedWarmUpElapsed() reports mm:ss as the timer ticks", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    store.confirmWarmUpReady();
    vi.advanceTimersByTime(65_000);
    expect(store.formattedWarmUpElapsed()).toBe("1:05");
  });

  it("warmUpHighlightPath() reflects the current phase's targets and is empty once there is no engine", () => {
    const store = makeStore();
    expect(store.warmUpHighlightPath()).toBe("");
    store.buildWarmUpEngine(STEPS[0].configuration);
    expect(store.warmUpHighlightPath()).not.toBe("");
  });

  it("the Warm-Up timer completing advances a multi-step routine into the next step's engine", async () => {
    const nextStep = {
      sequenceNumber: 2,
      exerciseTypeKey: "SWITCHING",
      exerciseRulesetVersionKey: "SWITCHING_V1",
      gameTypeKey: null,
      durationSeconds: 300,
      configuration: {
        targets: [20, 19, 18],
        scoring: { single: 1, double: 2, treble: 3 },
      },
    };
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [STEPS[0], nextStep] as never,
    });
    vi.mocked(trainingApi.startTrainingStep)
      .mockResolvedValueOnce({
        sessionId: "s1",
        exerciseTypeKey: "WARM_UP",
        configuration: STEPS[0].configuration,
        participant: { ref: "pt1", displayName: "Levi" },
      })
      .mockResolvedValueOnce({
        sessionId: "s2",
        exerciseTypeKey: "SWITCHING",
        configuration: nextStep.configuration,
        participant: { ref: "pt2", displayName: "Levi" },
      });
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(sessionApi.completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const store = makeStore();
    await store.init();
    store.confirmWarmUpReady();

    await vi.advanceTimersByTimeAsync(600_000);

    expect(trainingApi.startTrainingStep).toHaveBeenCalledWith("act-1", 2);
    expect(store.currentStep()?.exerciseTypeKey).toBe("SWITCHING");
    expect(store.switchingEngine).not.toBeNull();
    expect(store.warmUpEngine).toBeNull();
    expect(store.error).toBe("");
  });

  it("the routine clock starts with the Warm-Up and reports the running step in the header", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.$store.trainingSession.headerLabel).toBe("00:00 - warm up");
    expect(store.sessionClock).toBeNull();

    store.confirmWarmUpReady();
    vi.advanceTimersByTime(38_000);

    expect(store.sessionClock).not.toBeNull();
    expect(store.$store.trainingSession.headerLabel).toBe("00:38 - warm up");
  });

  it("the routine clock keeps running across a step change, and the header names the new step", async () => {
    const nextStep = {
      sequenceNumber: 2,
      exerciseTypeKey: "SWITCHING",
      exerciseRulesetVersionKey: "SWITCHING_V1",
      gameTypeKey: null,
      durationSeconds: 300,
      configuration: {
        targets: [20, 19, 18],
        scoring: { single: 1, double: 2, treble: 3 },
      },
    };
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [STEPS[0], nextStep] as never,
    });
    vi.mocked(trainingApi.startTrainingStep)
      .mockResolvedValueOnce({
        sessionId: "s1",
        exerciseTypeKey: "WARM_UP",
        configuration: STEPS[0].configuration,
        participant: { ref: "pt1", displayName: "Levi" },
      })
      .mockResolvedValueOnce({
        sessionId: "s2",
        exerciseTypeKey: "SWITCHING",
        configuration: nextStep.configuration,
        participant: { ref: "pt2", displayName: "Levi" },
      });
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(sessionApi.completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const store = makeStore();
    await store.init();
    store.confirmWarmUpReady();

    await vi.advanceTimersByTimeAsync(601_000);

    expect(store.$store.trainingSession.headerLabel).toBe("10:01 - switching");
    store.stopSessionClock();
  });

  it("plays a cue on every step change, and none when the first step opens", async () => {
    const nextStep = {
      sequenceNumber: 2,
      exerciseTypeKey: "SWITCHING",
      exerciseRulesetVersionKey: "SWITCHING_V1",
      gameTypeKey: null,
      durationSeconds: 300,
      configuration: {
        targets: [20, 19, 18],
        scoring: { single: 1, double: 2, treble: 3 },
      },
    };
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [STEPS[0], nextStep] as never,
    });
    vi.mocked(trainingApi.startTrainingStep)
      .mockResolvedValueOnce({
        sessionId: "s1",
        exerciseTypeKey: "WARM_UP",
        configuration: STEPS[0].configuration,
        participant: { ref: "pt1", displayName: "Levi" },
      })
      .mockResolvedValueOnce({
        sessionId: "s2",
        exerciseTypeKey: "SWITCHING",
        configuration: nextStep.configuration,
        participant: { ref: "pt2", displayName: "Levi" },
      });
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(sessionApi.completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const store = makeStore();
    await store.init();
    expect(playAudioCue).not.toHaveBeenCalled();

    store.confirmWarmUpReady();
    await vi.advanceTimersByTimeAsync(600_000);

    const stepChangeCues = vi
      .mocked(playAudioCue)
      .mock.calls.filter(([frequency]) => frequency === 660);
    expect(stepChangeCues).toHaveLength(1);
    store.stopSessionClock();
  });

  it("stops the routine clock and marks the header complete once the last step completes", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(sessionApi.completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-12T12:00:00.000Z",
    });
    const store = makeStore();
    await store.init();
    store.confirmWarmUpReady();

    await vi.advanceTimersByTimeAsync(600_000);

    expect(store.sessionClock).toBeNull();
    expect(store.$store.trainingSession.headerLabel).toBe("09:59 - complete");
  });

  it("surfaces an error instead of freezing on the Warm-Up screen when advancing to the next step fails", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValueOnce({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(sessionApi.completeSession).mockRejectedValue(
      new Error("network down"),
    );
    const store = makeStore();
    await store.init();
    store.confirmWarmUpReady();

    await vi.advanceTimersByTimeAsync(600_000);

    expect(store.error).not.toBe("");
  });
});

const SWITCHING_STEP = {
  sequenceNumber: 2,
  exerciseTypeKey: "SWITCHING",
  exerciseRulesetVersionKey: "SWITCHING_V1",
  gameTypeKey: null,
  durationSeconds: 300,
  configuration: {
    targets: [20, 19, 18],
    scoring: { single: 1, double: 2, treble: 3 },
  },
};

function stubAudioContext(): void {
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
}

describe("balancedTrainingPlay — Switching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    stubAudioContext();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("startCurrentStep() for SWITCHING builds the dart engine and starts the countdown", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.switchingEngine).not.toBeNull();
    expect(store.switchingEngine!.state().currentTargetNumber).toBe(20);
  });

  it("recordSwitchingDart() folds the dart into the engine", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    store.recordSwitchingDart({
      hitTargetNumber: 20,
      hitZoneKey: "SINGLE",
      locationX: 0,
      locationY: 0,
    });
    expect(store.switchingEngine!.state().dartsThrown).toBe(1);
  });

  it("startCurrentStep() for SWITCHING starts a countdown that ticks stepRemainingSeconds", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.stepRemainingSeconds).toBe(300);
    vi.advanceTimersByTime(5_000);
    expect(store.stepRemainingSeconds).toBe(295);
  });

  it("formattedStepRemaining() renders m:ss", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    vi.advanceTimersByTime(19_000);
    expect(store.formattedStepRemaining()).toBe("4:41");
    vi.advanceTimersByTime(281_000);
    expect(store.formattedStepRemaining()).toBe("0:00");
  });

  it("completeCurrentStep() stops the step timer", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-14T12:00:00.000Z",
    });
    const store = makeStore();
    await store.init();
    await store.completeCurrentStep();
    expect(store.stepTimer).toBeNull();
    const afterStop = store.stepRemainingSeconds;
    vi.advanceTimersByTime(10_000);
    expect(store.stepRemainingSeconds).toBe(afterStop);
  });

  it("the armed deadline expires the engine and completes the step", async () => {
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-12T12:00:00.000Z",
    });
    const store = makeStore();
    await store.init();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(sessionApi.appendBatch).toHaveBeenCalled();
  });

  it("names the API error code when the step's upload fails", async () => {
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    vi.mocked(sessionApi.appendBatch).mockRejectedValueOnce(
      Object.assign(new Error("Batch rejected"), { code: "INTERNAL_ERROR" }),
    );
    store.recordSwitchingDart({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: -103,
    });
    await store.completeCurrentStep();
    expect(store.error).toBe(
      "Could not continue to the next step (INTERNAL_ERROR). Try again.",
    );
  });

  it("switchingPoints() and switchingTargetLabel() read the engine's derived state", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.switchingPoints()).toBe(0);
    expect(store.switchingTargetLabel()).toBe("20");
    store.recordSwitchingDart({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: -103,
    });
    expect(store.switchingPoints()).toBe(3);
    expect(store.switchingTargetLabel()).toBe("19");
    expect(store.dartsThrown()).toBe(1);
  });

  it("previewSegments() marks an on-target dart hit and an off-target dart miss", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.previewSegments()).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
    store.recordSwitchingDart({
      hitTargetNumber: 20,
      hitZoneKey: "SINGLE",
      locationX: 0,
      locationY: -120,
    });
    store.recordSwitchingDart({
      hitTargetNumber: 7,
      hitZoneKey: "SINGLE",
      locationX: 0,
      locationY: 120,
    });
    expect(store.previewSegments()).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });
});

const DOUBLE_PATTERN_STEP = {
  sequenceNumber: 3,
  exerciseTypeKey: "DOUBLE_PATTERN",
  exerciseRulesetVersionKey: "DOUBLE_PATTERN_V1",
  gameTypeKey: null,
  durationSeconds: 300,
  configuration: { patterns: [[20, 10, 5]] },
};

describe("balancedTrainingPlay — Double Pattern", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    stubAudioContext();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("startCurrentStep() for DOUBLE_PATTERN builds the dart engine and starts the countdown", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [DOUBLE_PATTERN_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "DOUBLE_PATTERN",
      configuration: DOUBLE_PATTERN_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.doublePatternEngine).not.toBeNull();
    expect(store.doublePatternEngine).toBeDefined();
    expect(store.doublePatternEngine!.state().currentDoubleNumber).toBe(20);
  });

  it("visitMarkers() reads from doublePatternEngine when that is the active step", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [DOUBLE_PATTERN_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "DOUBLE_PATTERN",
      configuration: DOUBLE_PATTERN_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    store.recordDoublePatternDart({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: 0,
    });
    expect(store.visitMarkers()).toHaveLength(1);
    expect(store.doublePatternEngine!.state().totalPoints).toBe(1);
  });

  it("doublePatternPoints() and doublePatternLabel() read the engine's derived state", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [DOUBLE_PATTERN_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "DOUBLE_PATTERN",
      configuration: DOUBLE_PATTERN_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.doublePatternLabel()).toBe("D20");
    expect(store.doublePatternPoints()).toBe(0);
    store.recordDoublePatternDart({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });
    expect(store.doublePatternPoints()).toBe(1);
    expect(store.doublePatternLabel()).toBe("D10");
    expect(store.dartsThrown()).toBe(1);
  });

  it("previewSegments() counts only the double as a hit", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [DOUBLE_PATTERN_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "DOUBLE_PATTERN",
      configuration: DOUBLE_PATTERN_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    store.recordDoublePatternDart({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });
    store.recordDoublePatternDart({
      hitTargetNumber: 10,
      hitZoneKey: "SINGLE",
      locationX: 120,
      locationY: 40,
    });
    expect(store.previewSegments()).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });
});

const GAME_STEP = {
  sequenceNumber: 4,
  exerciseTypeKey: "GAME",
  exerciseRulesetVersionKey: null,
  gameTypeKey: "TUOD",
  durationSeconds: 600,
  configuration: {
    starting_target: 41,
    finish_bonus: 10,
    miss_penalty: 1,
    duration_type: "MINUTES",
    duration_value: 10,
    max_darts_per_turn: 3,
  },
};

describe("balancedTrainingPlay — Finishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("startCurrentStep() for GAME populates the global game store and builds finishingStep", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [GAME_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "GAME",
      configuration: GAME_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
      gameTypeKey: "TUOD",
      rulesetVersionKey: "TUOD_V1",
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    const store = makeStore();
    await store.init();
    expect(store.$store.game.reset).toHaveBeenCalledOnce();
    expect(store.$store.game.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        sessionId: "s1",
      }),
    );
    expect(store.finishing).not.toBeNull();
  });

  it("hands TUOD a camelCase snapshot seated on the step's own participant, so the play screen can derive its state", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [GAME_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "GAME",
      configuration: GAME_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
      gameTypeKey: "TUOD",
      rulesetVersionKey: "TUOD_V1",
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    const store = makeStore();
    await store.init();

    const input = vi.mocked(store.$store.game.startSession).mock
      .calls[0]![0] as {
      configSnapshot: Seated<TuodSnapshot>;
    };
    expect(input.configSnapshot).toMatchObject({
      startingTarget: 41,
      finishBonus: 10,
      missPenalty: 1,
      durationType: "MINUTES",
      durationValue: 10,
      maxDartsPerTurn: 3,
    });
    expect(input.configSnapshot.seats).toEqual([
      {
        participantRef: "pt1",
        displayName: "Levi",
        sideKey: "A",
        participantTypeKey: "PLAYER",
      },
    ]);
  });

  it("the seated snapshot folds into a live TUOD state instead of throwing", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [GAME_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "GAME",
      configuration: GAME_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
      gameTypeKey: "TUOD",
      rulesetVersionKey: "TUOD_V1",
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    const store = makeStore();
    await store.init();

    const input = vi.mocked(store.$store.game.startSession).mock
      .calls[0]![0] as {
      configSnapshot: Seated<TuodSnapshot>;
    };
    const state = foldTuodState(
      { stages: [], turns: [] },
      input.configSnapshot,
      false,
    );
    expect(state.seats).toHaveLength(1);
    expect(state.seats[0]!.currentTarget).toBe(41);
    expect(state.activeParticipantRef).toBe("pt1");
  });
});

describe("balancedTrainingPlay — abandonAndExit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("during a non-GAME step: abandons the current step's session and the routine, then redirects to /training", async () => {
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    vi.mocked(sessionApi.completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "ABANDONED",
      completedAt: "now",
    });
    vi.mocked(trainingApi.abandonTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-13T00:00:00.000Z",
    });
    const store = makeStore();
    await store.init();

    await store.abandonAndExit();

    expect(sessionApi.completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
    expect(trainingApi.abandonTraining).toHaveBeenCalledWith("act-1");
    expect(globalThis.location.href).toBe("/training");
    expect(playAbandonAndExit).not.toHaveBeenCalled();
  });

  it("surfaces an error and clears the loading flag when abandoning the step session fails", async () => {
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    vi.mocked(sessionApi.completeSession).mockRejectedValue(
      new Error("network down"),
    );
    const store = makeStore();
    await store.init();

    await store.abandonAndExit();

    expect(store.error).toBe("Could not leave. Try again.");
    expect(store.$store.game.loading).toBe(false);
    expect(globalThis.location.href).toBe("");
  });

  it("is a no-op re-entrant call while a previous abandon is already in flight", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    store.$store.game.loading = true;

    await store.abandonAndExit();

    const sessionApi = await import("@client/api/sessions");
    expect(sessionApi.completeSession).not.toHaveBeenCalled();
  });

  it("during the GAME step: delegates to playAbandonAndExit on the finishing controller, redirecting to /training and abandoning the routine", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [GAME_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "GAME",
      configuration: GAME_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
      gameTypeKey: "TUOD",
      rulesetVersionKey: "TUOD_V1",
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    vi.mocked(trainingApi.abandonTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-13T00:00:00.000Z",
    });
    const store = makeStore();
    await store.init();

    await store.abandonAndExit();

    expect(playAbandonAndExit).toHaveBeenCalledWith(
      store.finishing,
      expect.any(Function),
      "/training",
    );
    const onAbandoned = vi.mocked(playAbandonAndExit).mock.calls[0]![1]!;
    await onAbandoned();
    expect(trainingApi.abandonTraining).toHaveBeenCalledWith("act-1");
  });
});

describe("balancedTrainingPlay — routine summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    stubAudioContext();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function runSwitchingRoutine(): Promise<BalancedTrainingPlayContext> {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(sessionApi.appendBatch).mockResolvedValue({
      accepted: 1,
    } as never);
    vi.mocked(sessionApi.completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const store = makeStore();
    await store.init();
    store.recordSwitchingDart({
      hitTargetNumber: 20,
      hitZoneKey: "SINGLE",
      locationX: 0,
      locationY: 0,
    });
    store.recordSwitchingDart({
      hitTargetNumber: 5,
      hitZoneKey: "SINGLE",
      locationX: 0,
      locationY: 0,
    });
    await store.completeCurrentStep();
    return store;
  }

  it("captures one summary card for the exercise that just finished", async () => {
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-14T12:00:00.000Z",
    });

    const store = await runSwitchingRoutine();

    expect(store.stepSummaries).toEqual([
      {
        stepKey: "SWITCHING",
        label: "Switching",
        rows: [
          { label: "Points", value: "1" },
          { label: "Darts", value: "2" },
          { label: "Hit rate", value: "50.00%" },
        ],
      },
    ]);
  });

  it("captures nothing for the Warm-Up", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(sessionApi.completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-14T12:00:00.000Z",
    });
    const store = makeStore();
    await store.init();
    store.confirmWarmUpReady();

    await vi.advanceTimersByTimeAsync(600_000);

    expect(store.stepSummaries).toEqual([]);
    expect(store.routineFinished).toBe(true);
  });

  it("marks the routine saved once completeTraining resolves", async () => {
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-14T12:00:00.000Z",
    });

    const store = await runSwitchingRoutine();

    expect(trainingApi.completeTraining).toHaveBeenCalledWith("act-1");
    expect(store.completionStatus).toBe("succeeded");
    expect(store.completionError).toBe("");
  });

  it("shows the summary with a retryable error when completeTraining fails, and clears it on a successful retry", async () => {
    vi.mocked(trainingApi.completeTraining).mockRejectedValueOnce(
      new Error("offline"),
    );

    const store = await runSwitchingRoutine();

    expect(store.routineFinished).toBe(true);
    expect(store.completionStatus).toBe("failed");
    expect(store.completionError).not.toBe("");
    expect(globalThis.location.href).toBe("");

    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-14T12:00:00.000Z",
    });
    await store.completeRoutine();

    expect(store.completionStatus).toBe("succeeded");
    expect(store.completionError).toBe("");
  });

  it("dismissSummary() clears the header store and leaves for the training page", async () => {
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-14T12:00:00.000Z",
    });
    const store = await runSwitchingRoutine();

    store.dismissSummary();

    expect(store.$store.trainingSession.headerLabel).toBe("");
    expect(globalThis.location.href).toBe("/training");
  });
});
