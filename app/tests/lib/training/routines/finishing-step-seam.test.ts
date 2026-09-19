// @vitest-environment jsdom
/**
 * The Finishing step over the REAL `tuodPlay()` store — the seam issue #370
 * names. `finishing-step.data.test.ts` mocks `tuodPlay` wholesale, which pins
 * the wrapper's own contract but never executes the path the step actually
 * takes to completion: `recordDart` -> `wouldComplete()` -> `showFinishConfirm`
 * -> `confirmFinish()` -> `uploadAndCompleteSession()` -> the routine's
 * `onStepComplete`. Every Finishing-step dead-end so far (#216, #357, #370) has
 * lived in that seam, and a suite that doubles the store cannot tell "the
 * routine advances" apart from "the routine can be reached at all".
 *
 * Only the network and the countdown are mocked here. The store, the engine
 * and the wrapper are real, and the `$store` stub is the same shape
 * `tuod-play.data.test.ts` drives the standalone game with.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/sessions", () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("@modules/ui/segment-timer.module", () => ({
  SegmentTimer: vi.fn().mockImplementation(function (
    options: Record<string, unknown>,
  ) {
    return { options, start: vi.fn(), stop: vi.fn() };
  }),
}));

import {
  appendBatch,
  completeSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { finishingStep } from "@lib/training/routines/finishing-step.data";
import type { TuodPlayContext, TuodSnapshot, Seated } from "@lib/types";
import type { DartObservation, EngineFacts, StageFact } from "@modules/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const BLOCK: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

/**
 * The Finishing step's own shape: solo, MINUTES, started from a target that
 * is directly finishable on a double. `startingTarget: 40` makes D20 a
 * checkout and T20 a same-segment bust, which is what lets one dart resolve
 * the visit.
 */
function minutes(): Seated<TuodSnapshot> {
  return {
    startingTarget: 40,
    finishBonus: 10,
    missPenalty: 1,
    durationType: "MINUTES",
    durationValue: 5,
    maxDartsPerTurn: 3,
    seats: SEATS,
  };
}

/** D20 — checks out a 40 target. */
const DOUBLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "DOUBLE",
  locationX: 0,
  locationY: -166,
};

type GameStub = TuodPlayContext["$store"]["game"];
type SettingsStub = TuodPlayContext["$store"]["settings"];

function settingsStub(): SettingsStub {
  return { captureModeKey: "RECREATIONAL", inputModeKey: "VISUAL_BOARD" };
}

/**
 * `timerExpired: true` stands in for a countdown that already elapsed —
 * `maybeResumeCountdown` reads it at `init()` and calls `engine.expireTimer()`
 * instead of starting a timer. Under MINUTES that makes the next dart which
 * resolves a visit the session's last one (`durationSeatComplete`), which is
 * exactly the state the routine's Finishing step hangs in.
 */
function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "TUOD_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: minutes(),
    captureModeKey: "RECREATIONAL",
    inputModeKey: "VISUAL_BOARD",
    stages: [BLOCK],
    turns: [],
    timerRemainingMs: null,
    timerStartedAt: null,
    timerExpired: true,
    timerPaused: false,
    idempotencyKey: null,
    loading: false,
    setSessionModes: vi.fn(function (
      this: GameStub,
      modes: { captureModeKey: string; inputModeKey: string },
    ) {
      this.captureModeKey = modes.captureModeKey;
      this.inputModeKey = modes.inputModeKey;
    }),
    recordFacts: vi.fn(function (this: GameStub, facts: EngineFacts) {
      this.stages = [...facts.stages];
      this.turns = [...facts.turns];
    }),
    reset: vi.fn(function (this: GameStub) {
      this.loading = false;
    }),
    ...overrides,
  };
}

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "TUOD",
  gameTypeName: "Ten Up One Down",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "VISUAL_BOARD",
  rulesetVersionKey: "TUOD_V1",
  startedAt: "now",
} as const;

type Harness = {
  component: TuodPlayContext;
  store: GameStub;
  onStepComplete: ReturnType<typeof vi.fn>;
  onAbandon: ReturnType<typeof vi.fn>;
};

async function startFinishingStep(): Promise<Harness> {
  const store = gameStub();
  const onStepComplete = vi.fn().mockResolvedValue(undefined);
  const onAbandon = vi.fn().mockResolvedValue(undefined);
  const component = {
    ...finishingStep(onStepComplete, onAbandon),
    $store: { game: store, settings: settingsStub() },
  } as unknown as TuodPlayContext;
  await component.init();
  return { component, store, onStepComplete, onAbandon };
}

describe("Finishing step over the real TUOD store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
  });

  it("raises the finish confirm instead of advancing the routine, so the step cannot complete behind the player's back", async () => {
    const { component, store, onStepComplete } = await startFinishingStep();

    await component.recordDart(DOUBLE_20);

    expect(component.showFinishConfirm).toBe(true);
    expect(component.pendingDartObservation).toEqual(DOUBLE_20);
    expect(component.finished).toBe(false);
    expect(store.turns).toHaveLength(0);
    expect(appendBatch).not.toHaveBeenCalled();
    expect(onStepComplete).not.toHaveBeenCalled();
  });

  it("advances the routine exactly once when the player confirms the finish", async () => {
    const { component, store, onStepComplete } = await startFinishingStep();
    await component.recordDart(DOUBLE_20);

    await component.confirmFinish();

    expect(store.turns).toHaveLength(1);
    expect(store.turns[0].totalScore).toBe(40);
    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(component.completionStatus).toBe("succeeded");
    expect(onStepComplete).toHaveBeenCalledOnce();
  });

  it("holds the routine on the Finishing step when the real upload fails, so the darts can be retried", async () => {
    vi.mocked(appendBatch).mockRejectedValue(new Error("network down"));
    const { component, onStepComplete } = await startFinishingStep();
    await component.recordDart(DOUBLE_20);

    await component.confirmFinish();

    expect(component.completionStatus).toBe("failed");
    expect(onStepComplete).not.toHaveBeenCalled();
  });

  it("cancelling the finish leaves the step playable rather than stranding the routine", async () => {
    const { component, store, onStepComplete } = await startFinishingStep();
    await component.recordDart(DOUBLE_20);

    component.cancelFinish();

    expect(component.showFinishConfirm).toBe(false);
    expect(component.pendingDartObservation).toBeNull();
    expect(component.finished).toBe(false);
    expect(store.turns).toHaveLength(0);
    expect(onStepComplete).not.toHaveBeenCalled();
  });

  it("populates the results snapshot the routine summary reads for its Finishing rows", async () => {
    const { component } = await startFinishingStep();
    await component.recordDart(DOUBLE_20);

    await component.confirmFinish();

    // `routine-play.data.ts`'s captureStepSummary reads
    // `finishing.resultsSnapshot?.seats[0]` and pushes nothing when it is
    // null — a summary with no Finishing rows is the visible symptom.
    const seat = component.resultsSnapshot?.seats[0];
    expect(seat).toBeDefined();
    expect(seat!.target).toBe(50);
  });
});
