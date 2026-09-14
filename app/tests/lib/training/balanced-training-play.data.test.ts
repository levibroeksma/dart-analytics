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
vi.mock("@lib/game/play-lifecycle", () => ({
  playAbandonAndExit: vi.fn(),
}));

import * as trainingApi from "@client/api/training-sessions";
import { balancedTrainingPlay } from "@lib/training/balanced-training-play.data";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { playAbandonAndExit } from "@lib/game/play-lifecycle";
import type { BalancedTrainingPlayContext } from "@lib/types";

function makeStore(): BalancedTrainingPlayContext {
  return {
    ...balancedTrainingPlay(),
    $store: {
      game: { loading: false, reset: vi.fn(), startSession: vi.fn() },
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

    expect(globalThis.location.href).toBe("/training");
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
    vi.advanceTimersByTime(300_000);
    await vi.runAllTimersAsync();
    expect(sessionApi.appendBatch).toHaveBeenCalled();
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
});

const GAME_STEP = {
  sequenceNumber: 4,
  exerciseTypeKey: "GAME",
  exerciseRulesetVersionKey: null,
  gameTypeKey: "TUOD",
  durationSeconds: 600,
  configuration: { starting_target: 41 },
};

describe("balancedTrainingPlay — Finishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
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
});

describe("balancedTrainingPlay — abandonAndExit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
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
