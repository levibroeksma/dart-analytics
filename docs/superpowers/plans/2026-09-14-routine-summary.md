# Routine Summary Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End a Balanced Training routine on a summary modal that reports every played exercise except the Warm-Up, and stop a failed Finishing upload from silently discarding that step's darts.

**Architecture:** Each non-Warm-Up step's result is captured the moment that step completes, while its engine is still in memory, by pure builders in a new `routine-summary.module.ts`. `balanced-training-play.data.ts` holds the captured list, stops redirecting on completion, and owns a save-status pair for the `completeTraining` call. A new `RoutineSummaryModal.astro` renders the list; `Done` is the only thing that navigates. `finishing-step.data.ts` advances the routine only when TUOD's upload actually succeeded, and the page grows a retry panel for when it did not.

**Tech Stack:** Astro, Alpine.js v3, TypeScript, Vitest (jsdom), Tailwind.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-09-14-routine-summary-design.md`. It wins over this plan on intent; this plan wins on mechanics.
- Branch: `claude/game-flow-bugs-session-timer-5ydi9v`, already checked out. Never commit to `main`. No worktrees.
- TDD is mandatory: the failing test is written and run before the implementation, every task.
- `scripts/check-test-coverage.sh` runs pre-commit: every changed `.ts` file under `app/src/` must have a covering test file changed in the same commit. Plan each commit so the source and its test land together.
- `scripts/check-type-barrels.sh` runs pre-commit: no exported `type`/`interface` may be declared inside a `*.module.ts` or `*.data.ts`. New shared types go in the domain's `types.ts` barrel (`app/src/modules/training/types.ts`, re-exported by `@modules/types`).
- `scripts/check-inline-comments.sh` runs pre-commit: no `//` or non-JSDoc `/* */` comments inside function bodies anywhere under `app/src`. Explanations go in a JSDoc block above the function.
- `scripts/check-astro-conventions.sh` runs pre-commit: every `x-show` needs `x-cloak`, no HTML comments in `.astro` templates, Alpine shorthand only (`:attr`, `@event`), no `x-init`.
- All commands run from `app/` unless stated otherwise. Run `npm install` in `app/` first if `npx vitest` reports a missing package.
- Commit message trailers, on every commit in this plan:

  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TPuyd9UXyTNJpBhb5XURme
  ```

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `app/src/modules/training/types.ts` (modify) | `RoutineStatRow`, `RoutineStepSummary` — the shapes the modal renders |
| `app/src/modules/training/routine-summary.module.ts` (create) | Pure builders: one completed exercise's state → one `RoutineStepSummary` |
| `app/src/stores/training-session.store.ts` (modify) | `markComplete()` — freeze the clock, relabel the header |
| `app/src/lib/training/balanced-training-play.data.ts` (modify) | Capture each step's summary; end the routine on the modal instead of a redirect; own the `completeTraining` save status |
| `app/src/lib/training/types.ts` (modify) | New context fields and method signatures |
| `app/src/lib/training/finishing-step.data.ts` (modify) | Advance the routine only on a successful TUOD upload |
| `app/src/components/layout/training/RoutineSummaryModal.astro` (create) | The summary overlay: rows, save status, `Done` |
| `app/src/pages/training/balanced-training/play/index.astro` (modify) | Mount the modal; replace the "Finishing complete." placeholder with a retry panel |

---

### Task 1: Routine summary builders

**Files:**
- Modify: `app/src/modules/training/types.ts`
- Create: `app/src/modules/training/routine-summary.module.ts`
- Test: `app/tests/modules/training/routine-summary.module.test.ts`

**Interfaces:**
- Consumes: `SwitchingState`, `DoublePatternState`, `EngineFacts` from `@modules/types`; `TuodSeatResult` from `@lib/types`; `accuracyDisplay(hits: number, darts: number): string` from `@lib/game/play-visit-stats`.
- Produces: `RoutineStatRow = { label: string; value: string }`; `RoutineStepSummary = { stepKey: "SWITCHING" | "DOUBLE_PATTERN" | "GAME"; label: string; rows: RoutineStatRow[] }`; `summariseSwitching(state, facts)`, `summariseDoublePattern(state)`, `summariseFinishing(seat)`, each returning `RoutineStepSummary`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/training/routine-summary.module.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  summariseSwitching,
  summariseDoublePattern,
  summariseFinishing,
} from "@modules/training/routine-summary.module";
import type {
  EngineFacts,
  SwitchingState,
  DoublePatternState,
} from "@modules/types";
import type { TuodSeatResult } from "@lib/types";

function dart(
  sequence: number,
  intended: number,
  hit: number | null,
  score: number,
) {
  return {
    sequence,
    intendedTargetNumber: intended,
    intendedZoneKey: null,
    hitTargetNumber: hit,
    hitZoneKey: "SINGLE" as const,
    score,
    locationX: null,
    locationY: null,
  };
}

function factsWith(darts: ReturnType<typeof dart>[]): EngineFacts {
  return {
    stages: [],
    turns: [
      {
        clientKey: "t1",
        sequence: 1,
        participantRef: "pt1",
        stageClientKey: "s1",
        totalScore: 0,
        completedAt: null,
        darts,
      },
    ],
  } as unknown as EngineFacts;
}

const SWITCHING_STATE: SwitchingState = {
  currentTargetNumber: 20,
  targetIndex: 0,
  totalPoints: 7,
  dartsThrown: 4,
  status: "COMPLETE",
};

describe("summariseSwitching", () => {
  it("reports points, darts and the share of darts that hit their intended target", () => {
    const facts = factsWith([
      dart(1, 20, 20, 1),
      dart(2, 19, 19, 3),
      dart(3, 18, 5, 0),
      dart(4, 20, 20, 3),
    ]);

    expect(summariseSwitching(SWITCHING_STATE, facts)).toEqual({
      stepKey: "SWITCHING",
      label: "Switching",
      rows: [
        { label: "Points", value: "7" },
        { label: "Darts", value: "4" },
        { label: "Hit rate", value: "75.00%" },
      ],
    });
  });

  it("reports an em dash rather than 0% when no dart was thrown", () => {
    const state: SwitchingState = {
      ...SWITCHING_STATE,
      totalPoints: 0,
      dartsThrown: 0,
    };

    expect(summariseSwitching(state, factsWith([])).rows[2]).toEqual({
      label: "Hit rate",
      value: "—",
    });
  });
});

describe("summariseDoublePattern", () => {
  it("reads the engine's points as the count of doubles hit", () => {
    const state: DoublePatternState = {
      patternIndex: 0,
      targetWithinPattern: 0,
      currentDoubleNumber: 20,
      totalPoints: 3,
      dartsThrown: 12,
      status: "COMPLETE",
    };

    expect(summariseDoublePattern(state)).toEqual({
      stepKey: "DOUBLE_PATTERN",
      label: "Doubles",
      rows: [
        { label: "Doubles hit", value: "3" },
        { label: "Darts", value: "12" },
        { label: "Hit rate", value: "25.00%" },
      ],
    });
  });

  it("reports an em dash rather than 0% when no dart was thrown", () => {
    const state: DoublePatternState = {
      patternIndex: 0,
      targetWithinPattern: 0,
      currentDoubleNumber: 20,
      totalPoints: 0,
      dartsThrown: 0,
      status: "COMPLETE",
    };

    expect(summariseDoublePattern(state).rows[2]).toEqual({
      label: "Hit rate",
      value: "—",
    });
  });
});

describe("summariseFinishing", () => {
  it("reports the target reached and TUOD's own double accuracy", () => {
    const seat: TuodSeatResult = {
      participantRef: "pt1",
      sideKey: "A",
      target: 47,
      doubleAccuracy: "31.25%",
    };

    expect(summariseFinishing(seat)).toEqual({
      stepKey: "GAME",
      label: "Finishing",
      rows: [
        { label: "Target reached", value: "47" },
        { label: "Double accuracy", value: "31.25%" },
      ],
    });
  });

  it("falls back to an em dash when the session recorded no double accuracy", () => {
    const seat: TuodSeatResult = {
      participantRef: "pt1",
      sideKey: "A",
      target: 41,
      doubleAccuracy: null,
    };

    expect(summariseFinishing(seat).rows[1]).toEqual({
      label: "Double accuracy",
      value: "—",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app && npx vitest run tests/modules/training/routine-summary.module.test.ts
```

Expected: FAIL — `Failed to resolve import "@modules/training/routine-summary.module"`.

- [ ] **Step 3: Add the shared types**

Append to `app/src/modules/training/types.ts`:

```ts
/**
 * One line of a routine summary card. `value` is already formatted for
 * display — the modal renders rows through `x-for` and formats nothing.
 */
export type RoutineStatRow = {
  label: string;
  value: string;
};

/**
 * One completed exercise's contribution to the routine summary. Warm-Up
 * throws no darts and produces none, which is why the key is narrower than
 * `TrainingStepKey`.
 */
export type RoutineStepSummary = {
  stepKey: "SWITCHING" | "DOUBLE_PATTERN" | "GAME";
  label: string;
  rows: RoutineStatRow[];
};
```

- [ ] **Step 4: Write the builders**

Create `app/src/modules/training/routine-summary.module.ts`:

```ts
import { accuracyDisplay } from "@lib/game/play-visit-stats";
import type {
  EngineFacts,
  SwitchingState,
  DoublePatternState,
  RoutineStatRow,
  RoutineStepSummary,
} from "@modules/types";
import type { TuodSeatResult } from "@lib/types";

const NO_VALUE = "—";

/**
 * A rate over no darts is not 0% — it is nothing to report, so an
 * untouched exercise reads as a dash rather than a failed one.
 */
function hitRateRow(hits: number, darts: number): RoutineStatRow {
  return {
    label: "Hit rate",
    value: darts === 0 ? NO_VALUE : accuracyDisplay(hits, darts),
  };
}

/**
 * Switching scores a dart only when it lands on the target that dart was
 * thrown at, and every `DartFact` carries both numbers, so the hit count
 * needs neither the config nor the ruleset's scoring table.
 */
export function summariseSwitching(
  state: SwitchingState,
  facts: EngineFacts,
): RoutineStepSummary {
  const hits = facts.turns
    .flatMap((turn) => turn.darts)
    .filter(
      (dart) =>
        dart.intendedTargetNumber !== null &&
        dart.hitTargetNumber === dart.intendedTargetNumber,
    ).length;
  return {
    stepKey: "SWITCHING",
    label: "Switching",
    rows: [
      { label: "Points", value: String(state.totalPoints) },
      { label: "Darts", value: String(state.dartsThrown) },
      hitRateRow(hits, state.dartsThrown),
    ],
  };
}

/**
 * Double Pattern awards exactly one point per double hit, so the engine's
 * `totalPoints` is the hit count and the rate needs no fact replay.
 */
export function summariseDoublePattern(
  state: DoublePatternState,
): RoutineStepSummary {
  return {
    stepKey: "DOUBLE_PATTERN",
    label: "Doubles",
    rows: [
      { label: "Doubles hit", value: String(state.totalPoints) },
      { label: "Darts", value: String(state.dartsThrown) },
      hitRateRow(state.totalPoints, state.dartsThrown),
    ],
  };
}

/**
 * Reuses TUOD's own results snapshot rather than recomputing it;
 * `doubleAccuracy` is null whenever the session was not played on the
 * visual board.
 */
export function summariseFinishing(seat: TuodSeatResult): RoutineStepSummary {
  return {
    stepKey: "GAME",
    label: "Finishing",
    rows: [
      { label: "Target reached", value: String(seat.target) },
      { label: "Double accuracy", value: seat.doubleAccuracy ?? NO_VALUE },
    ],
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd app && npx vitest run tests/modules/training/routine-summary.module.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics && git add app/src/modules/training/types.ts app/src/modules/training/routine-summary.module.ts app/tests/modules/training/routine-summary.module.test.ts && git commit -F - <<'MSG'
feat: build one summary card per completed routine exercise

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TPuyd9UXyTNJpBhb5XURme
MSG
```

---

### Task 2: Freeze the header clock at the end of the routine

**Files:**
- Modify: `app/src/stores/training-session.store.ts`
- Test: `app/tests/stores/training-session.store.test.ts`

**Interfaces:**
- Produces: `markComplete(): void` on the `trainingSession` store — leaves `elapsedSeconds` untouched and makes `headerLabel` read `"mm:ss - complete"`.

- [ ] **Step 1: Write the failing test**

Append inside the existing top-level `describe` in `app/tests/stores/training-session.store.test.ts`:

```ts
  it("markComplete() freezes the elapsed time and relabels the header", () => {
    const store = trainingSessionStore();
    store.startSession();
    store.setStep("GAME");
    store.tick(1934);

    store.markComplete();

    expect(store.elapsedSeconds).toBe(1934);
    expect(store.headerLabel).toBe("32:14 - complete");
  });

  it("reset() clears a completed session's header", () => {
    const store = trainingSessionStore();
    store.startSession();
    store.setStep("GAME");
    store.tick(1934);
    store.markComplete();

    store.reset();

    expect(store.headerLabel).toBe("");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app && npx vitest run tests/stores/training-session.store.test.ts
```

Expected: FAIL — `store.markComplete is not a function`.

- [ ] **Step 3: Implement `markComplete`**

In `app/src/stores/training-session.store.ts`, add the label constant below `STEP_LABELS`:

```ts
const COMPLETE_LABEL = "complete";
```

Change `stepKey` and `stepLabel` so a completed routine has a label of its own:

```ts
    stepKey: null as TrainingStepKey | null,
    complete: false,

    get stepLabel(): string {
      if (this.complete) return COMPLETE_LABEL;
      return this.stepKey ? STEP_LABELS[this.stepKey] : "";
    },

    get headerLabel(): string {
      if (!this.stepKey) return "";
      return `${formatElapsed(this.elapsedSeconds)} - ${this.stepLabel}`;
    },
```

Add the action next to `setStep`, and clear the flag in `startSession` and `reset`:

```ts
    startSession() {
      this.active = true;
      this.complete = false;
      this.elapsedSeconds = 0;
    },

    markComplete() {
      this.complete = true;
    },

    reset() {
      this.active = false;
      this.complete = false;
      this.elapsedSeconds = 0;
      this.stepKey = null;
    },
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd app && npx vitest run tests/stores/training-session.store.test.ts
```

Expected: PASS — all cases in the file, including the two new ones.

- [ ] **Step 5: Run the store-registration test, which asserts the store's shape**

```bash
cd app && npx vitest run tests/lib/client/alpine/register-stores.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics && git add app/src/stores/training-session.store.ts app/tests/stores/training-session.store.test.ts && git commit -F - <<'MSG'
feat: freeze the routine header clock once the routine completes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TPuyd9UXyTNJpBhb5XURme
MSG
```

---

### Task 3: Capture each step, and end the routine on the summary instead of a redirect

**Files:**
- Modify: `app/src/lib/training/balanced-training-play.data.ts`
- Modify: `app/src/lib/training/types.ts`
- Test: `app/tests/lib/training/balanced-training-play.data.test.ts`

**Interfaces:**
- Consumes: `summariseSwitching`, `summariseDoublePattern`, `summariseFinishing` from Task 1; `markComplete()` from Task 2.
- Produces, on `BalancedTrainingPlayContext`: `stepSummaries: RoutineStepSummary[]`, `routineFinished: boolean`, `completionStatus: "pending" | "saving" | "succeeded" | "failed"`, `completionError: string`, `captureStepSummary(): void`, `completeRoutine(): Promise<void>`, `dismissSummary(): void`.

**Behaviour change to existing tests:** two cases in this file assert the old redirect. Both are updated in Step 1, not deleted — they still cover the same guarantee (what the end of a routine does), repointed at the new ending.

- [ ] **Step 1: Update the two existing end-of-routine cases and add the new ones**

In `app/tests/lib/training/balanced-training-play.data.test.ts`, find the case ending with:

```ts
    expect(globalThis.location.href).toBe("/training");
    expect(store.warmUpTimer).toBeNull();
```

Replace those two lines with:

```ts
    expect(globalThis.location.href).toBe("");
    expect(store.routineFinished).toBe(true);
    expect(store.warmUpTimer).toBeNull();
```

Find the case ending with:

```ts
    expect(store.sessionClock).toBeNull();
    expect(store.$store.trainingSession.headerLabel).toBe("");
```

Replace those two lines with:

```ts
    expect(store.sessionClock).toBeNull();
    expect(store.$store.trainingSession.headerLabel).toBe("10:00 - complete");
```

Add a new `describe` at the end of the file:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts
```

Expected: FAIL — `store.routineFinished` is `undefined`, `store.completeRoutine is not a function`, and the two updated cases still see a redirect to `/training`.

- [ ] **Step 3: Widen the context type**

In `app/src/lib/training/types.ts`, add to the imports:

```ts
import type { RoutineStepSummary } from "@modules/types";
```

Add these fields to `BalancedTrainingPlayContext`, next to `sessionClock`:

```ts
  sessionClock: SessionClock | null;
  stepSummaries: RoutineStepSummary[];
  routineFinished: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
```

And these method signatures, next to `completeCurrentStep`:

```ts
  captureStepSummary(this: BalancedTrainingPlayContext): void;
  completeRoutine(this: BalancedTrainingPlayContext): Promise<void>;
  dismissSummary(this: BalancedTrainingPlayContext): void;
```

- [ ] **Step 4: Implement capture and the new ending**

In `app/src/lib/training/balanced-training-play.data.ts`, add to the imports:

```ts
import {
  summariseSwitching,
  summariseDoublePattern,
  summariseFinishing,
} from "@modules/training/routine-summary.module";
```

Add the new fields next to `sessionClock: null,` in the returned object:

```ts
    sessionClock: null,
    stepSummaries: [],
    routineFinished: false,
    completionStatus: "pending",
    completionError: "",
```

Add the three methods immediately after `uploadCurrentStepFacts`:

```ts
    /**
     * Snapshots the step that just finished while its engine is still in
     * memory — `advanceAfterStepCompletion` clears every engine field a few
     * lines later, and nothing re-reads them afterwards. Warm-Up throws no
     * darts, so it contributes nothing.
     */
    captureStepSummary(this: BalancedTrainingPlayContext) {
      if (this.switchingEngine) {
        this.stepSummaries.push(
          summariseSwitching(
            this.switchingEngine.state(),
            this.switchingEngine.facts(),
          ),
        );
        return;
      }
      if (this.doublePatternEngine) {
        this.stepSummaries.push(
          summariseDoublePattern(this.doublePatternEngine.state()),
        );
        return;
      }
      const seat = (this.finishing as unknown as TuodPlayContext | null)
        ?.resultsSnapshot?.seats[0];
      if (seat) this.stepSummaries.push(summariseFinishing(seat));
    },

    /**
     * Marks the routine complete server-side. Separate from the summary's
     * own visibility so a failed call leaves the player looking at their
     * results with a retry, rather than at a dead screen.
     */
    async completeRoutine(this: BalancedTrainingPlayContext) {
      if (!this.activityId) return;
      this.completionStatus = "saving";
      this.completionError = "";
      try {
        await apiCompleteTraining(this.activityId);
        this.completionStatus = "succeeded";
      } catch {
        this.completionError =
          "Could not save your session. Check your connection and retry.";
        this.completionStatus = "failed";
      }
    },

    dismissSummary(this: BalancedTrainingPlayContext) {
      this.$store.trainingSession.reset();
      globalThis.location.href = "/training";
    },
```

Add the `TuodPlayContext` type import if the file does not already carry it — it does, via `@lib/types`.

Rewrite the completion branch of `advanceAfterStepCompletion`:

```ts
async function advanceAfterStepCompletion(
  ctx: BalancedTrainingPlayContext,
  sessionId: string,
  activityId: string,
  training: TrainingEngine,
): Promise<void> {
  await ctx.uploadCurrentStepFacts();
  if (ctx.currentStep()?.exerciseTypeKey !== "GAME") {
    await completeSession(sessionId, "COMPLETED");
  }
  ctx.captureStepSummary();
  ctx.currentSessionId = null;
  ctx.currentParticipantRef = null;
  ctx.warmUpEngine = null;
  ctx.switchingEngine = null;
  ctx.doublePatternEngine = null;
  ctx.finishing = null;
  const state = training.completeStep();
  if (state.status === "COMPLETE") {
    ctx.stopSessionClock();
    ctx.$store.trainingSession.markComplete();
    ctx.routineFinished = true;
    await ctx.completeRoutine();
    return;
  }
  await ctx.startCurrentStep();
}
```

Note what moved: `ctx.captureStepSummary()` runs before the engine fields are nulled and before `ctx.finishing` is cleared; `apiCompleteTraining` and the redirect are gone from this function; `$store.trainingSession.reset()` now happens only in `dismissSummary()`.

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd app && npx vitest run tests/lib/training/balanced-training-play.data.test.ts
```

Expected: PASS — every case in the file, including the five new ones.

- [ ] **Step 6: Verify nothing else depended on the redirect**

```bash
cd app && npx vitest run
```

Expected: PASS, all files.

- [ ] **Step 7: Commit**

```bash
cd /home/user/dart-analytics && git add app/src/lib/training/balanced-training-play.data.ts app/src/lib/training/types.ts app/tests/lib/training/balanced-training-play.data.test.ts && git commit -F - <<'MSG'
feat: end a routine on its summary instead of an immediate redirect

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TPuyd9UXyTNJpBhb5XURme
MSG
```

---

### Task 4: Never advance the routine on a failed Finishing upload

**Files:**
- Modify: `app/src/lib/training/finishing-step.data.ts`
- Test: `app/tests/lib/training/finishing-step.data.test.ts` (create)

**Interfaces:**
- Consumes: `finishingStep(onStepComplete, onAbandon)` — unchanged signature.
- Produces: no new exports. Behaviour: `onStepComplete` fires only when the wrapped `uploadAndCompleteSession` leaves `completionStatus === "succeeded"`.

**Why:** `playUploadAndCompleteSession` does not throw on an upload failure — it sets `completionStatus = "failed"` and returns. Today's unconditional `await onStepComplete()` therefore completes the routine with the Finishing darts unsaved.

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/training/finishing-step.data.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@lib/game/tuod-play.data", () => ({
  tuodPlay: vi.fn(),
}));
vi.mock("@lib/game/play-lifecycle", () => ({
  playAbandonAndExit: vi.fn(),
}));

import { finishingStep } from "@lib/training/finishing-step.data";
import { tuodPlay } from "@lib/game/tuod-play.data";
import { playAbandonAndExit } from "@lib/game/play-lifecycle";
import type { TuodPlayContext } from "@lib/types";

function baseDouble(uploadOutcome: "succeeded" | "failed") {
  return {
    completionStatus: "pending" as string,
    timer: { stop: vi.fn() },
    async uploadAndCompleteSession(this: { completionStatus: string }) {
      this.completionStatus = uploadOutcome;
    },
    async abandonAndExit() {},
  };
}

describe("finishingStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("advances the routine once TUOD's own upload succeeded", async () => {
    vi.mocked(tuodPlay).mockReturnValue(baseDouble("succeeded") as never);
    const onStepComplete = vi.fn().mockResolvedValue(undefined);
    const store = finishingStep(onStepComplete, vi.fn());

    await (store as unknown as TuodPlayContext).uploadAndCompleteSession();

    expect(onStepComplete).toHaveBeenCalledOnce();
  });

  it("leaves the routine on the Finishing step when the upload failed, so the darts can still be retried", async () => {
    vi.mocked(tuodPlay).mockReturnValue(baseDouble("failed") as never);
    const onStepComplete = vi.fn().mockResolvedValue(undefined);
    const store = finishingStep(onStepComplete, vi.fn());

    await (store as unknown as TuodPlayContext).uploadAndCompleteSession();

    expect(onStepComplete).not.toHaveBeenCalled();
  });

  it("abandonAndExit() stops the timer and routes back to the training page", async () => {
    vi.mocked(tuodPlay).mockReturnValue(baseDouble("succeeded") as never);
    const onAbandon = vi.fn();
    const store = finishingStep(vi.fn(), onAbandon);

    await (store as unknown as TuodPlayContext).abandonAndExit();

    expect(playAbandonAndExit).toHaveBeenCalledWith(
      expect.anything(),
      onAbandon,
      "/training",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app && npx vitest run tests/lib/training/finishing-step.data.test.ts
```

Expected: FAIL — the second case reports `onStepComplete` called once, expected zero.

- [ ] **Step 3: Gate the advance**

In `app/src/lib/training/finishing-step.data.ts`, replace the override body:

```ts
  base.uploadAndCompleteSession = async function (this: TuodPlayContext) {
    await originalUpload.call(this);
    if (this.completionStatus !== "succeeded") return;
    await onStepComplete();
  };
```

Extend the file's existing block comment with a sentence explaining the gate:

```
 * The advance is gated on `completionStatus`: `playUploadAndCompleteSession`
 * reports an upload failure by setting `completionStatus = "failed"` and
 * returning rather than throwing, so an unconditional call here would
 * complete the routine with the Finishing step's darts never persisted.
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd app && npx vitest run tests/lib/training/finishing-step.data.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics && git add app/src/lib/training/finishing-step.data.ts app/tests/lib/training/finishing-step.data.test.ts && git commit -F - <<'MSG'
fix: keep a routine on its Finishing step when the upload failed

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TPuyd9UXyTNJpBhb5XURme
MSG
```

---

### Task 5: The summary modal and the Finishing retry panel

**Files:**
- Create: `app/src/components/layout/training/RoutineSummaryModal.astro`
- Modify: `app/src/pages/training/balanced-training/play/index.astro`

**Interfaces:**
- Consumes, from the page's own `x-data="balancedTrainingPlay()"` scope: `routineFinished`, `stepSummaries`, `completionStatus`, `completionError`, `completeRoutine()`, `dismissSummary()`, `$store.trainingSession.headerLabel`.
- Consumes, from the nested `x-data="finishing"` scope only: TUOD's own `completionStatus`, `completionError`, `uploadAndCompleteSession()`.

**Scope warning:** the modal must sit in the page's own `x-data`, outside the GAME branch's nested `x-data="finishing"`. Both scopes define `completionStatus`; a modal placed inside the nested scope would silently read TUOD's.

- [ ] **Step 1: Write the modal**

Create `app/src/components/layout/training/RoutineSummaryModal.astro`:

```astro
---
/**
 * End-of-routine results: one card per completed exercise, the routine's
 * total time, and the save status of the `completeTraining` call. Rows are
 * built at runtime by `routine-summary.module.ts`, so `StatRow.astro` —
 * which takes its label as a build-time prop — cannot render them.
 *
 * `ResultsModalShell` is deliberately not reused: its button row is bound
 * to a per-game `back()`/`playAgain()` pair and a per-game `finished`
 * flag, none of which a routine has.
 */

// Components
import Button from "@components/forms/Button.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
---

<div
  class="fixed inset-0 z-50 flex w-full items-center justify-center bg-black/50 p-4"
  x-show="routineFinished"
  x-cloak
>
  <div
    class="glass w-full max-w-sm rounded-lg border border-border bg-surface-raised p-6 shadow-lg"
  >
    <h2 class="font-display text-lg font-semibold text-foreground">
      Training complete
    </h2>
    <p
      class="font-mono text-sm tabular-nums text-muted-foreground"
      x-text="$store.trainingSession.headerLabel"
    >
    </p>

    <template
      x-for="step in stepSummaries"
      :key="step.stepKey"
    >
      <section class="mt-4">
        <h3
          class="font-display text-sm font-semibold text-foreground"
          x-text="step.label"
        >
        </h3>
        <dl class="mt-1 space-y-1">
          <template
            x-for="row in step.rows"
            :key="row.label"
          >
            <div class="flex items-center justify-between font-display-mono">
              <dt
                class="font-mono text-sm text-muted-foreground"
                x-text="row.label"
              >
              </dt>
              <dd
                class="font-mono text-sm font-bold tabular-nums text-foreground"
                x-text="row.value"
              >
              </dd>
            </div>
          </template>
        </dl>
      </section>
    </template>

    <p
      class="mt-4 text-sm text-muted-foreground"
      x-show="stepSummaries.length === 0"
      x-cloak
    >
      No exercise results to show.
    </p>

    <div
      class="mt-4"
      x-show="completionStatus === 'failed'"
      x-cloak
    >
      <ErrorAlert
        textExpr="completionError"
        alwaysVisible
      />
      <Button
        class="mt-2"
        @click="completeRoutine()"
        title="Retry"
      />
    </div>

    <div class="mt-6">
      <Button
        @click="dismissSummary()"
        :disabled="completionStatus !== 'succeeded'"
        loadingExpr="completionStatus === 'saving'"
        title="Done"
        grow
      />
    </div>
  </div>
</div>
```

- [ ] **Step 2: Mount the modal and replace the Finishing placeholder**

In `app/src/pages/training/balanced-training/play/index.astro`, add the import beside the other component imports:

```astro
import RoutineSummaryModal from "@components/layout/training/RoutineSummaryModal.astro";
```

Replace the whole GAME `template` block with:

```astro
    <template
      x-if="!loading && currentStep()?.exerciseTypeKey === 'GAME' && finishing"
    >
      <div x-data="finishing">
        <TenUpOneDown
          x-show="!finished"
          x-cloak
        />
        <div
          x-show="finished && completionStatus === 'failed'"
          x-cloak
          class="p-4"
        >
          <ErrorAlert
            textExpr="completionError"
            alwaysVisible
          />
          <Button
            class="mt-2"
            @click="uploadAndCompleteSession()"
            title="Retry"
          />
        </div>
        <div
          x-show="finished && completionStatus !== 'failed'"
          x-cloak
          class="p-4 text-center"
        >
          <p class="text-foreground">Saving your finishing session…</p>
        </div>
      </div>
    </template>
```

Add `Button` to the page's imports:

```astro
import Button from "@components/forms/Button.astro";
```

Mount the modal as the last child of the page's own `x-data` div, after that GAME `template`:

```astro
    <RoutineSummaryModal />
```

- [ ] **Step 3: Type-check the templates**

```bash
cd app && npm run check
```

Expected: `0 errors, 0 warnings, 0 hints`.

- [ ] **Step 4: Run the Astro convention gate**

```bash
cd /home/user/dart-analytics && bash scripts/check-astro-conventions.sh
```

Expected: `OK: Astro x-show/x-cloak pairing and no template HTML comments.`

- [ ] **Step 5: Format**

```bash
cd app && npx prettier --write src/components/layout/training/RoutineSummaryModal.astro src/pages/training/balanced-training/play/index.astro
```

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics && git add app/src/components/layout/training/RoutineSummaryModal.astro app/src/pages/training/balanced-training/play/index.astro && git commit -F - <<'MSG'
feat: show the routine summary and a Finishing upload retry

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TPuyd9UXyTNJpBhb5XURme
MSG
```

---

### Task 6: Context upkeep and full validation

**Files:**
- Modify: `decisions/frontend/alpine.md`
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md`

- [ ] **Step 1: Append the decision**

Append to `decisions/frontend/alpine.md`, after D279, using the next free id (`bash scripts/check-decision-ids.sh` reports a clash if D280 is taken):

```markdown
### D280 — The routine summary is derived client-side from in-memory engine state, and a failed Finishing upload no longer advances the routine
Status: Accepted · Date: 2026-09-14
Decision: `advanceAfterStepCompletion` captures one `RoutineStepSummary` per completed non-Warm-Up step (`modules/training/routine-summary.module.ts`: `summariseSwitching`, `summariseDoublePattern`, `summariseFinishing`) while that step's engine is still in memory, and the routine's last step now ends on `RoutineSummaryModal.astro` instead of redirecting to `/training`. `completeTraining` moves into its own `completeRoutine()` with a `completionStatus`/`completionError` pair, so a failed call leaves the player on their results with a retry; `Done` (`dismissSummary()`) is the only navigation and the only `$store.trainingSession.reset()`. The store gains `markComplete()`, which freezes the clock and relabels the header `"32:14 - complete"`. `finishing-step.data.ts` now calls `onStepComplete()` only when the wrapped upload left `completionStatus === "succeeded"`.
Reason: the routine discarded every number the player produced the moment it ended, and the one screen able to show them — TUOD's own results modal — is hidden inside a routine. A client-side derivation was chosen over a read model because every figure is already in memory at capture time and no other surface reads them today; a persisted training history remains a separate future feature. The Finishing gate is a real data-loss defect, not a refactor: `playUploadAndCompleteSession` reports an upload failure by setting `completionStatus = "failed"` and returning rather than throwing, so the unconditional advance completed the routine with those darts unsaved and no retry on screen.
Consequences: `ResultsModalShell` is not reused — its button row is bound to a per-game `back()`/`playAgain()` pair and a per-game `finished` flag — so the routine's modal is its own component; the two share an idiom, not code. The modal must stay in the page's own `x-data`, outside the nested `x-data="finishing"`, because both scopes define `completionStatus`. `StatRow.astro` cannot render the rows (it takes its label as a build-time prop, and these rows exist only at runtime), so the modal emits the same `dl` shape inside its `x-for`. Two existing end-of-routine cases in `balanced-training-play.data.test.ts` were repointed from the redirect to the modal — same guarantee, new ending — and the Finishing step gained its first test file. Full design and implementation plan: `docs/superpowers/specs/2026-09-14-routine-summary-design.md`, `docs/superpowers/plans/2026-09-14-routine-summary.md`.
```

- [ ] **Step 2: Register the component**

Add a row to the table in `docs/architecture/07-Frontend/08-Component-Inventory.md`, next to the other `layout/training` entries:

```markdown
| `RoutineSummaryModal.astro` | End-of-routine results overlay: one card per completed exercise (`stepSummaries`), total session time, `completeTraining` save status with Retry, and a `Done` button that resets the header store and leaves for `/training` | none — reads the play page's `x-data` scope (2026-09-14) |
```

- [ ] **Step 3: Run every gate**

```bash
cd /home/user/dart-analytics && for s in scripts/check-*.sh; do echo "--- $s"; bash "$s" || echo "FAILED: $s"; done
```

Expected: every script prints `OK:` and no `FAILED:` line appears.

- [ ] **Step 4: Run the full suite, the type check, the complexity gate and the formatter check**

```bash
cd app && npm test && npm run check && npx fallow && npm run format:check
```

Expected: all tests pass; `0 errors, 0 warnings, 0 hints`; fallow reports 0 above threshold; prettier reports no unformatted files.

- [ ] **Step 5: Commit and push**

```bash
cd /home/user/dart-analytics && git add decisions/frontend/alpine.md docs/architecture/07-Frontend/08-Component-Inventory.md && git commit -F - <<'MSG'
docs: record the routine summary decision and register its component

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TPuyd9UXyTNJpBhb5XURme
MSG
git push -u origin claude/game-flow-bugs-session-timer-5ydi9v
```

- [ ] **Step 6: Report what was not verified**

PR #327 was merged and this branch restarted from the new `main`, so this work needs a new PR. State plainly in the completion report that nothing here was verified in a browser — this container has no live Neon connection — and that the summary's real numbers have only been checked against engine state in tests.
