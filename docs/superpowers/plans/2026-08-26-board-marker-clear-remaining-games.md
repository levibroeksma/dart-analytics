# Board Marker Clear For Remaining Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing 1500ms reveal-then-clear board-marker mechanism (Pattern 19, `play-lifecycle.ts`) to the 4 games that don't have it yet — 501, 121, Score Training, Ten Up One Down — so a dart's marker on the visual board clears 1500ms after its visit resolves, in every game mode, single-player and 1v1.

**Architecture:** Extract the timer-arm/clear logic already inside `playCommitDart` into two small exported primitives (`armHiddenTimer`, `clearHiddenTimer`). 501, 121, and TUOD already hand-roll a `commitDart` that is otherwise identical to `playCommitDart` (record → mirror → complete-check) — replace its body with a one-line delegation, exactly like Bob's 27 already does. Score Training's `recordDart` cannot delegate to the whole `playCommitDart` composite (its engine's completion check must never run after every dart — see Task 5) — it calls `armHiddenTimer` directly instead.

**Tech Stack:** TypeScript, Alpine.js, Vitest.

## Global Constraints

- Timer duration is 1500ms, matching the existing mechanism — never changed.
- TDD mandatory: a failing test before any implementation change, in every task (`app/CLAUDE.md`).
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated with the source file.
- No `//`/`/* */` comments inside function bodies in `app/src/**/*.ts` — JSDoc above the declaration only.
- Alpine v3 shorthand, no `x-init`, `x-data="factory()"` — not touched by this plan (no `.astro`/markup changes).
- `modules/` never imports `@client/api` or Alpine — not touched by this plan (no changes under `modules/`).
- Full test suite (`npm test`) must stay green — never scoped to only the touched files.
- Every source edit under `app/src/` needs a covering test edit in the same change (`scripts/check-test-coverage.sh`, D224).
- Decisions are append-only: never edit `decisions/frontend/alpine.md`'s existing blocks; a new block only.
- Findings are edited in place when their claim goes stale (not append-only like decisions) — `FINDINGS.md`'s F29.

---

## Task 1: Extract `armHiddenTimer`/`clearHiddenTimer` in `play-lifecycle.ts`

Pure refactor: `playCommitDart`'s inline timer-arming block and
`playUndoVisit`/`runPlayAgain`'s inline timer-clearing blocks become calls to
two new exported functions. No behavior change for any existing caller —
proven by the existing `play-lifecycle.test.ts` suite passing unmodified,
plus new unit tests for the two extracted functions directly.

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts:109-161` (the `playCommitDart` body, `playUndoVisit`), `app/src/lib/game/play-lifecycle.ts:372-377` (inside `runPlayAgain`)
- Test: `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Produces: `armHiddenTimer(context: { hiddenTurnKey: string | null; hiddenTimer?: ReturnType<typeof setTimeout> | null }, turns: readonly TurnFact[]): void` and `clearHiddenTimer(context: { hiddenTurnKey: string | null; hiddenTimer?: ReturnType<typeof setTimeout> | null }): void`, both exported from `@lib/game/play-lifecycle`. Tasks 2–5 import both (Score Training) or just `clearHiddenTimer` (501/121/TUOD, which get `armHiddenTimer`'s effect for free via `playCommitDart`).

- [ ] **Step 1: Write the failing tests for the two new functions**

Open `app/tests/lib/game/play-lifecycle.test.ts`. Add `armHiddenTimer` and `clearHiddenTimer` to the existing import from `@lib/game/play-lifecycle` (line 20-31):

```ts
import {
  armHiddenTimer,
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playPreviewSegments,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
```

Insert this new block immediately after the `describe("playCommitDart", ...)` block ends (after line 379, before `describe("playUndoVisit", ...)` at line 381):

```ts
describe("armHiddenTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function resolvedTurn(clientKey: string): TurnFact {
    return {
      clientKey,
      stageClientKey: "block-1",
      participantRef: "participant-1",
      sequence: 1,
      completedAt: "2026-08-26T00:00:00.000Z",
      totalScore: 60,
      darts: [],
    };
  }

  function openTurn(clientKey: string): TurnFact {
    return { ...resolvedTurn(clientKey), completedAt: null };
  }

  it("arms a 1500ms timer once the last turn has resolved", () => {
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: null, hiddenTimer: null };

    armHiddenTimer(context, [resolvedTurn("t1")]);

    expect(context.hiddenTurnKey).toBeNull();
    expect(context.hiddenTimer).not.toBeNull();

    vi.advanceTimersByTime(1500);

    expect(context.hiddenTurnKey).toBe("t1");
  });

  it("does nothing while the last turn is still open", () => {
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: null, hiddenTimer: null };

    armHiddenTimer(context, [openTurn("t1")]);

    expect(context.hiddenTimer).toBeNull();
  });

  it("does nothing when there are no turns", () => {
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: null, hiddenTimer: null };

    armHiddenTimer(context, []);

    expect(context.hiddenTimer).toBeNull();
  });

  it("replaces a still-pending timer rather than stacking two", () => {
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: null, hiddenTimer: null };

    armHiddenTimer(context, [resolvedTurn("t1")]);
    const firstTimer = context.hiddenTimer;
    armHiddenTimer(context, [resolvedTurn("t1"), resolvedTurn("t2")]);

    expect(context.hiddenTimer).not.toBe(firstTimer);

    vi.advanceTimersByTime(1500);

    expect(context.hiddenTurnKey).toBe("t2");
  });
});

describe("clearHiddenTimer", () => {
  it("cancels a pending timer and clears the key", () => {
    vi.useFakeTimers();
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: null, hiddenTimer: null };
    armHiddenTimer(context, [
      {
        clientKey: "t1",
        stageClientKey: "block-1",
        participantRef: "participant-1",
        sequence: 1,
        completedAt: "2026-08-26T00:00:00.000Z",
        totalScore: 60,
        darts: [],
      },
    ]);

    clearHiddenTimer(context);
    vi.advanceTimersByTime(1500);

    expect(context.hiddenTurnKey).toBeNull();
    expect(context.hiddenTimer).toBeNull();
    vi.useRealTimers();
  });

  it("is a no-op when nothing is pending", () => {
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: null, hiddenTimer: null };

    expect(() => clearHiddenTimer(context)).not.toThrow();

    expect(context.hiddenTurnKey).toBeNull();
  });

  it("clears an already-set hiddenTurnKey even with no pending timer", () => {
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: "t1", hiddenTimer: null };

    clearHiddenTimer(context);

    expect(context.hiddenTurnKey).toBeNull();
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts`
Expected: FAIL — `armHiddenTimer`/`clearHiddenTimer` are not exported from `@lib/game/play-lifecycle` (import error / `is not a function`).

- [ ] **Step 3: Extract the two functions in `play-lifecycle.ts`**

In `app/src/lib/game/play-lifecycle.ts`, replace the existing `playCommitDart` function (currently lines 109-145):

```ts
export async function playCommitDart<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  observation: DartObservation,
): Promise<void> {
  if (!context.engine) return;
  try {
    context.engine.record(observation);
  } catch (err: unknown) {
    context.error = (err as Error).message;
    return;
  }
  context.error = "";
  const facts = context.engine.facts();
  context.$store.game.recordFacts(facts);

  const resolvedTurn = facts.turns.at(-1);
  if (resolvedTurn?.completedAt) {
    if (context.hiddenTimer) {
      clearTimeout(context.hiddenTimer);
      context.hiddenTimer = null;
    }
    const clientKey = resolvedTurn.clientKey;
    context.hiddenTimer = setTimeout(() => {
      context.hiddenTurnKey = clientKey;
    }, 1500);
  }

  if (context.engine.isComplete()) {
    context.finished = true;
    context.completionStatus = "pending";
    await context.uploadAndCompleteSession();
  }
}
```

with:

```ts
function clearTimerHandle(context: {
  hiddenTimer?: ReturnType<typeof setTimeout> | null;
}): void {
  if (context.hiddenTimer) {
    clearTimeout(context.hiddenTimer);
    context.hiddenTimer = null;
  }
}

/**
 * Arms the 1500ms reveal-then-clear timer once `turns`' last entry has
 * resolved (`completedAt` set). This is the primitive `playCommitDart` uses
 * internally, and the one a caller whose engine has different completion
 * semantics (Score Training, D234) calls directly instead of adopting the
 * whole `playCommitDart` composite. A no-op while the last turn is open, or
 * when there are no turns yet.
 */
export function armHiddenTimer(
  context: {
    hiddenTurnKey: string | null;
    hiddenTimer?: ReturnType<typeof setTimeout> | null;
  },
  turns: readonly TurnFact[],
): void {
  const resolvedTurn = turns.at(-1);
  if (!resolvedTurn?.completedAt) return;
  clearTimerHandle(context);
  const clientKey = resolvedTurn.clientKey;
  context.hiddenTimer = setTimeout(() => {
    context.hiddenTurnKey = clientKey;
  }, 1500);
}

/**
 * Cancels a pending reveal-then-clear timer and clears `hiddenTurnKey`, so
 * an undone or replayed visit's markers/preview stay visible instead of
 * disappearing on a timer that no longer applies to it.
 */
export function clearHiddenTimer(context: {
  hiddenTurnKey: string | null;
  hiddenTimer?: ReturnType<typeof setTimeout> | null;
}): void {
  clearTimerHandle(context);
  context.hiddenTurnKey = null;
}

export async function playCommitDart<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  observation: DartObservation,
): Promise<void> {
  if (!context.engine) return;
  try {
    context.engine.record(observation);
  } catch (err: unknown) {
    context.error = (err as Error).message;
    return;
  }
  context.error = "";
  const facts = context.engine.facts();
  context.$store.game.recordFacts(facts);
  armHiddenTimer(context, facts.turns);

  if (context.engine.isComplete()) {
    context.finished = true;
    context.completionStatus = "pending";
    await context.uploadAndCompleteSession();
  }
}
```

Then replace `playUndoVisit` (currently lines 147-161):

```ts
export function playUndoVisit<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(context: PlayLifecycleContext<TConfig, TEngine, TResults>): void {
  if (context.finished) return;
  if (!context.engine || !context.engine.undo()) return;
  if (context.hiddenTimer) {
    clearTimeout(context.hiddenTimer);
    context.hiddenTimer = null;
  }
  context.hiddenTurnKey = null;
  context.$store.game.recordFacts(context.engine.facts());
  context.error = "";
}
```

with:

```ts
export function playUndoVisit<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(context: PlayLifecycleContext<TConfig, TEngine, TResults>): void {
  if (context.finished) return;
  if (!context.engine || !context.engine.undo()) return;
  clearHiddenTimer(context);
  context.$store.game.recordFacts(context.engine.facts());
  context.error = "";
}
```

Finally, in `runPlayAgain`, replace this block (currently lines 372-377):

```ts
    if (context.hiddenTimer) {
      clearTimeout(context.hiddenTimer);
      context.hiddenTimer = null;
    }
    context.hiddenTurnKey = null;
    context.error = "";
```

with:

```ts
    clearHiddenTimer(context);
    context.error = "";
```

- [ ] **Step 4: Run the full `play-lifecycle.test.ts` suite**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts`
Expected: PASS — all tests, including the pre-existing `playCommitDart`/`playUndoVisit`/`runPlayAgain` ones and the new `armHiddenTimer`/`clearHiddenTimer` ones.

- [ ] **Step 5: Run the full test suite**

Run: `cd app && npm test`
Expected: PASS — no other file references the removed inline blocks.

- [ ] **Step 6: Commit**

```bash
cd app && git add src/lib/game/play-lifecycle.ts tests/lib/game/play-lifecycle.test.ts
git commit -m "Extract armHiddenTimer/clearHiddenTimer primitives from play-lifecycle.ts"
```

---

## Task 2: Wire 501's board markers onto the shared timer

**Files:**
- Modify: `app/src/lib/game/types.ts:513-573` (`FiveOhOnePlayContext`)
- Modify: `app/src/lib/game/five-oh-one-play.data.ts` (imports, state, `commitDart`, `undoVisit`, `playAgain`)
- Test: `app/tests/lib/game/five-oh-one-play.data.test.ts`

**Interfaces:**
- Consumes: `playCommitDart`, `playVisitMarkers`, `clearHiddenTimer` from `@lib/game/play-lifecycle` (Task 1); `BoardMarker` type from `./types`.
- Produces: `fiveOhOnePlay()`'s returned object gains `hiddenTurnKey: string | null`, `hiddenTimer: ReturnType<typeof setTimeout> | null`, `visitMarkers(): BoardMarker[]`.

- [ ] **Step 1: Write the failing tests**

Open `app/tests/lib/game/five-oh-one-play.data.test.ts`. Insert this new `describe` block right after the `describe("recordDart — plain darts", ...)` block ends (after line 1061, before `describe("recordDart — checkout on a double vs. the same score on a treble", ...)` at line 1063):

```ts
describe("recordDart — reveal-then-clear board markers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the closed visit's markers visible, then clears them after 1500ms", async () => {
    const play = makePlay({}, { inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, SINGLE_20);
    await play.recordDart.call(play, SINGLE_20);
    await play.recordDart.call(play, SINGLE_20);

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBeNull();
    expect(play.visitMarkers.call(play)).not.toEqual([]);

    vi.advanceTimersByTime(1500);

    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.visitMarkers.call(play)).toEqual([]);
  });

  it("undoVisit cancels a pending hide timer so a reopened visit stays visible", async () => {
    const play = makePlay({}, { inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    await play.recordDart.call(play, SINGLE_20);
    await play.recordDart.call(play, SINGLE_20);
    await play.recordDart.call(play, SINGLE_20);

    vi.advanceTimersByTime(1000);
    play.undoVisit.call(play);
    vi.advanceTimersByTime(1000);

    expect(play.hiddenTurnKey).toBeNull();
  });

  it("playAgain resets hiddenTurnKey so the new session's board starts clear", async () => {
    vi.mocked(createSession).mockResolvedValue({
      sessionId: "s2",
      participants: [
        { participantRef: "participant-1", sideKey: "A" },
      ],
    });
    const play = makePlay(
      { turns: turnsReaching(40), configSnapshot: bestOf5Config() },
      { inputModeKey: "VISUAL_BOARD" },
    );
    await play.init.call(play);
    await play.recordDart.call(play, DOUBLE_20);
    vi.advanceTimersByTime(1500);
    expect(play.hiddenTurnKey).not.toBeNull();

    await play.playAgain.call(play);

    expect(play.hiddenTurnKey).toBeNull();
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts -t "reveal-then-clear"`
Expected: FAIL — `play.hiddenTurnKey`/`play.visitMarkers` are `undefined` (not part of the returned object yet), and/or the marker never clears.

- [ ] **Step 3: Add the fields to `FiveOhOnePlayContext`**

In `app/src/lib/game/types.ts`, in `FiveOhOnePlayContext` (starts line 513), add after the `engine: FiveOhOneEngine | null;` line (533):

```ts
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  visitMarkers(this: FiveOhOnePlayContext): BoardMarker[];
```

- [ ] **Step 4: Wire `five-oh-one-play.data.ts`**

Add a new import block for the play-lifecycle functions, right after the existing `import { boardInputData } from "@lib/game/board-input.data";` line — that line itself is unchanged:

```ts
import {
  clearHiddenTimer,
  playCommitDart,
  playVisitMarkers,
} from "@lib/game/play-lifecycle";
```

Change the type import:

```ts
import type { FiveOhOnePlayContext } from "./types";
```

to:

```ts
import type { BoardMarker, FiveOhOnePlayContext } from "./types";
```

Add the two new fields right after `engine: null as FiveOhOneEngine | null,` (line 160):

```ts
    engine: null as FiveOhOneEngine | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
```

Add a `visitMarkers` method after the `...boardInputData((observation) => self.recordDart(observation)),` spread (line 161) and before `turnsInCurrentLeg` — object-literal key order means this later definition overrides `boardInputData`'s own default `visitMarkers`, exactly like Bob's 27:

```ts
    ...boardInputData((observation) => self.recordDart(observation)),

    /** Overrides `boardInputData`'s own default — object-literal key order
     * means this later definition wins. Delegates to `play-lifecycle.ts`'s
     * shared implementation, mirrors `bobs27-play.data.ts`. */
    visitMarkers(this: FiveOhOnePlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    turnsInCurrentLeg(this: FiveOhOnePlayContext): TurnFact[] {
```

Replace `commitDart` (currently lines 417-428):

```ts
    async commitDart(this: FiveOhOnePlayContext, observation: DartObservation) {
      if (!this.engine) return;
      this.engine.record(observation);
      this.error = "";
      this.$store.game.recordFacts(this.engine.facts());

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },
```

with:

```ts
    commitDart(
      this: FiveOhOnePlayContext,
      observation: DartObservation,
    ): Promise<void> {
      return playCommitDart(this, observation);
    },
```

In `undoVisit` (currently lines 574-586), add `clearHiddenTimer(this);` right after the guard:

```ts
    undoVisit(this: FiveOhOnePlayContext) {
      if (
        this.finished ||
        this.showDoubleConfirm ||
        this.showMatchFinishConfirm
      )
        return;
      if (!this.engine || !this.engine.undo()) return;

      clearHiddenTimer(this);
      this.$store.game.recordFacts(this.engine.facts());
      this.scoreInput.clear();
      this.error = "";
    },
```

In `playAgain`'s reset block (currently around lines 715-724), add `clearHiddenTimer(this);` right after `this.showMatchFinishConfirm = false;`:

```ts
        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.pendingCheckoutScore = null;
        this.showDoubleConfirm = false;
        this.showMatchFinishConfirm = false;
        clearHiddenTimer(this);
        this.scoreInput.clear();
        this.error = "";
        this.hasActiveSession = true;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts`
Expected: PASS — full file, including the new block and every pre-existing test.

- [ ] **Step 6: Run the full test suite**

Run: `cd app && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd app && git add src/lib/game/types.ts src/lib/game/five-oh-one-play.data.ts tests/lib/game/five-oh-one-play.data.test.ts
git commit -m "Clear 501's board markers 1500ms after a visit resolves"
```

---

## Task 3: Wire 121's board markers onto the shared timer

Same shape as Task 2, applied to `one-twenty-one-play.data.ts`. 121's test
file has no `vi.useFakeTimers()` usage yet and builds its play object via
`createPlay()`/`store` (not `makePlay()`), and calls `play.recordDart()`
directly with `.call(play)` without going through `init()` — the engine is
assigned directly.

**Files:**
- Modify: `app/src/lib/game/types.ts:583-639` (`OneTwentyOnePlayContext`)
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts` (imports, state, `commitDart`, `undoVisit`, `playAgain`)
- Test: `app/tests/lib/game/one-twenty-one-play.data.test.ts`

**Interfaces:**
- Consumes: `playCommitDart`, `playVisitMarkers`, `clearHiddenTimer` from `@lib/game/play-lifecycle` (Task 1).
- Produces: `oneTwentyOnePlay()`'s returned object gains `hiddenTurnKey`, `hiddenTimer`, `visitMarkers()` — same shape as Task 2.

- [ ] **Step 1: Write the failing tests**

Open `app/tests/lib/game/one-twenty-one-play.data.test.ts`. Add `vi.useFakeTimers`/`afterEach` support — the top of the file has no `afterEach` import yet, so change line 1:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
```

to:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
```

Insert this new `describe` block right after the `describe("recordDart (board input)", ...)` block ends (after line 296, before `describe("recordDart — session-ending checkout defers to the confirm dialog", ...)` at line 298):

```ts
  describe("recordDart — reveal-then-clear board markers", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("keeps the closed visit's markers visible, then clears them after 1500ms", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;

      await play.recordDart.call(play, {
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });

      const clientKey = store.game.turns[0].clientKey;
      expect(play.hiddenTurnKey).toBeNull();
      expect(play.visitMarkers.call(play)).not.toEqual([]);

      vi.advanceTimersByTime(1500);

      expect(play.hiddenTurnKey).toBe(clientKey);
      expect(play.visitMarkers.call(play)).toEqual([]);
    });

    it("undoVisit cancels a pending hide timer so a reopened visit stays visible", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;

      await play.recordDart.call(play, {
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });

      vi.advanceTimersByTime(1000);
      play.undoVisit();
      vi.advanceTimersByTime(1000);

      expect(play.hiddenTurnKey).toBeNull();
    });
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts -t "reveal-then-clear"`
Expected: FAIL — `play.hiddenTurnKey`/`play.visitMarkers` are `undefined`.

- [ ] **Step 3: Add the fields to `OneTwentyOnePlayContext`**

In `app/src/lib/game/types.ts`, in `OneTwentyOnePlayContext` (starts line 583), add after the `engine: OneTwentyOneEngine | null;` line (603):

```ts
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  visitMarkers(this: OneTwentyOnePlayContext): BoardMarker[];
```

- [ ] **Step 4: Wire `one-twenty-one-play.data.ts`**

Add the import:

```ts
import {
  clearHiddenTimer,
  playCommitDart,
  playVisitMarkers,
} from "@lib/game/play-lifecycle";
```

Change the type import:

```ts
import type { OneTwentyOnePlayContext } from "./types";
```

to:

```ts
import type { BoardMarker, OneTwentyOnePlayContext } from "./types";
```

Add the two new fields right after `engine: null as OneTwentyOneEngine | null,` (line 144):

```ts
    engine: null as OneTwentyOneEngine | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
```

Add a `visitMarkers` method after `...boardInputData((observation) => self.recordDart(observation)),` (line 145):

```ts
    ...boardInputData((observation) => self.recordDart(observation)),

    /** Overrides `boardInputData`'s own default — object-literal key order
     * means this later definition wins. Delegates to `play-lifecycle.ts`'s
     * shared implementation, mirrors `bobs27-play.data.ts`. */
    visitMarkers(this: OneTwentyOnePlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    state(this: OneTwentyOnePlayContext): OneTwentyOneState | null {
```

Replace `commitDart` (currently lines 353-367):

```ts
    async commitDart(
      this: OneTwentyOnePlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine) return;
      this.engine.record(observation);
      this.error = "";
      this.$store.game.recordFacts(this.engine.facts());

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },
```

with:

```ts
    commitDart(
      this: OneTwentyOnePlayContext,
      observation: DartObservation,
    ): Promise<void> {
      return playCommitDart(this, observation);
    },
```

In `undoVisit` (currently lines 500-512), add `clearHiddenTimer(this);` right after the guard:

```ts
    undoVisit(this: OneTwentyOnePlayContext) {
      if (
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm
      )
        return;
      if (!this.engine || !this.engine.undo()) return;

      clearHiddenTimer(this);
      this.$store.game.recordFacts(this.engine.facts());
      this.scoreInput.clear();
      this.error = "";
    },
```

In `playAgain`'s reset block (currently around lines 636-646), add `clearHiddenTimer(this);` right after `this.showSessionFinishConfirm = false;`:

```ts
        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.pendingCheckoutScore = null;
        this.pendingDartObservation = null;
        this.showDoubleConfirm = false;
        this.showSessionFinishConfirm = false;
        clearHiddenTimer(this);
        this.scoreInput.clear();
        this.error = "";
        this.hasActiveSession = true;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full test suite**

Run: `cd app && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd app && git add src/lib/game/types.ts src/lib/game/one-twenty-one-play.data.ts tests/lib/game/one-twenty-one-play.data.test.ts
git commit -m "Clear 121's board markers 1500ms after a visit resolves"
```

---

## Task 4: Wire Ten Up One Down's board markers onto the shared timer

Same shape as Tasks 2–3, applied to `tuod-play.data.ts`. TUOD's test file
builds its play object as `{ ...tuodPlay(), $store: { game: store, settings: settingsStub() } }` and calls `init()` first.

**Files:**
- Modify: `app/src/lib/game/types.ts:290-340` (`TuodPlayContext`)
- Modify: `app/src/lib/game/tuod-play.data.ts` (imports, state, `commitDart`, `undoAttempt`, `playAgain`)
- Test: `app/tests/lib/game/tuod-play.data.test.ts`

**Interfaces:**
- Consumes: `playCommitDart`, `playVisitMarkers`, `clearHiddenTimer` from `@lib/game/play-lifecycle` (Task 1).
- Produces: `tuodPlay()`'s returned object gains `hiddenTurnKey`, `hiddenTimer`, `visitMarkers()`.

- [ ] **Step 1: Write the failing tests**

Open `app/tests/lib/game/tuod-play.data.test.ts`. The `describe("recordDart (board input)", ...)` block starts at line 1019 and closes with `});` at line 1115, immediately followed by `describe("session completion — 1v1", ...)` at line 1117. Insert this new block between them, after line 1115 and before line 1117:

```ts
describe("recordDart — reveal-then-clear board markers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the closed visit's markers visible, then clears them after 1500ms", async () => {
    const store = gameStub({
      configSnapshot: { ...rounds(10), startingTarget: 40 },
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    await component.recordDart.call(component, DOUBLE_20);

    const clientKey = store.turns[0].clientKey;
    expect(component.hiddenTurnKey).toBeNull();
    expect(component.visitMarkers.call(component)).not.toEqual([]);

    vi.advanceTimersByTime(1500);

    expect(component.hiddenTurnKey).toBe(clientKey);
    expect(component.visitMarkers.call(component)).toEqual([]);
  });

  it("undoAttempt cancels a pending hide timer so a reopened visit stays visible", async () => {
    const store = gameStub({
      configSnapshot: { ...rounds(10), startingTarget: 40 },
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);
    await component.recordDart.call(component, DOUBLE_20);

    vi.advanceTimersByTime(1000);
    component.undoAttempt();
    vi.advanceTimersByTime(1000);

    expect(component.hiddenTurnKey).toBeNull();
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts -t "reveal-then-clear"`
Expected: FAIL — `component.hiddenTurnKey`/`component.visitMarkers` are `undefined`.

- [ ] **Step 3: Add the fields to `TuodPlayContext`**

In `app/src/lib/game/types.ts`, in `TuodPlayContext` (starts line 290), add after the `engine: TuodEngine | null;` line (311):

```ts
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  visitMarkers(this: TuodPlayContext): BoardMarker[];
```

- [ ] **Step 4: Wire `tuod-play.data.ts`**

Add the import:

```ts
import {
  clearHiddenTimer,
  playCommitDart,
  playVisitMarkers,
} from "@lib/game/play-lifecycle";
```

Change the type import:

```ts
import type { TuodPlayContext, TuodResultsSnapshot } from "./types";
```

to:

```ts
import type { BoardMarker, TuodPlayContext, TuodResultsSnapshot } from "./types";
```

Add the two new fields right after `engine: null as TuodEngine | null,` (line 188):

```ts
    engine: null as TuodEngine | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
```

Add a `visitMarkers` method after `...boardInputData((observation) => self.recordDart(observation)),` (line 190):

```ts
    ...boardInputData((observation) => self.recordDart(observation)),

    /** Overrides `boardInputData`'s own default — object-literal key order
     * means this later definition wins. Delegates to `play-lifecycle.ts`'s
     * shared implementation, mirrors `bobs27-play.data.ts`. */
    visitMarkers(this: TuodPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    state(this: TuodPlayContext): TuodState | null {
```

Replace `commitDart` (currently lines 427-448):

```ts
    async commitDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      if (!this.engine) return;

      try {
        this.engine.record(observation);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        return;
      }

      this.error = "";
      this.$store.game.recordFacts(this.engine.facts());

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },
```

with:

```ts
    commitDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      return playCommitDart(this, observation);
    },
```

In `undoAttempt` (currently lines 484-492), add `clearHiddenTimer(this);` right after the guard:

```ts
    undoAttempt(this: TuodPlayContext) {
      if (this.finished || this.showDoubleConfirm || this.showFinishConfirm)
        return;
      if (!this.engine || !this.engine.undo()) return;

      clearHiddenTimer(this);
      this.$store.game.recordFacts(this.engine.facts());
      this.scoreInput.clear();
      this.error = "";
    },
```

In `playAgain`'s reset block (currently around lines 616-623), add `clearHiddenTimer(this);` right after `this.showFinishConfirm = false;`:

```ts
        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.pendingAttempt = null;
        this.pendingDartObservation = null;
        this.showFinishConfirm = false;
        clearHiddenTimer(this);
        this.error = "";
        this.hasActiveSession = true;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full test suite**

Run: `cd app && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd app && git add src/lib/game/types.ts src/lib/game/tuod-play.data.ts tests/lib/game/tuod-play.data.test.ts
git commit -m "Clear Ten Up One Down's board markers 1500ms after a visit resolves"
```

---

## Task 5: Wire Score Training's board markers onto the shared primitive (not the composite)

Score Training's `recordDart` deliberately never calls `isComplete()` after
recording — a MINUTES-mode session can already be complete before a dart is
thrown (timer expiry via `expireTimer()`), and a post-record completion
check would upload/finish the session mid-visit, on the first dart of a
fresh visit. `playCommitDart` always does that check, so Score Training
calls `armHiddenTimer` directly instead of delegating to `playCommitDart`.
`recordDart` stays a synchronous method — `armHiddenTimer` is synchronous
too, so no signature change is needed.

**Files:**
- Modify: `app/src/lib/game/types.ts:229-278` (`ScoreTrainingPlayContext`)
- Modify: `app/src/lib/game/score-training-play.data.ts` (imports, state, `recordDart`, `undoVisit`, `playAgain`)
- Test: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**
- Consumes: `armHiddenTimer`, `clearHiddenTimer`, `playVisitMarkers` from `@lib/game/play-lifecycle` (Task 1) — **not** `playCommitDart`.
- Produces: `scoreTrainingPlay()`'s returned object gains `hiddenTurnKey`, `hiddenTimer`, `visitMarkers()`.

- [ ] **Step 1: Write the failing tests**

Open `app/tests/lib/game/score-training-play.data.test.ts`. Insert this new
`describe` block right after `describe("scoreTrainingPlay — visual board input", ...)` closes (after line 1812, before `describe("scoreTrainingPlay — playAgain mode resolution", ...)` at line 1814):

```ts
describe("scoreTrainingPlay — reveal-then-clear board markers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    segmentTimerInstances.length = 0;
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...VISUAL_ACTIVE_SESSION },
    ]);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the closed visit's markers visible, then clears them after 1500ms", async () => {
    const play = boardPlay();
    await play.init.call(play);

    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, TREBLE_20);
    play.recordDart.call(play, SINGLE_20);

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBeNull();
    expect(play.visitMarkers.call(play)).not.toEqual([]);

    vi.advanceTimersByTime(1500);

    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.visitMarkers.call(play)).toEqual([]);
  });

  it("undoVisit cancels a pending hide timer so a reopened visit stays visible", async () => {
    const play = boardPlay();
    await play.init.call(play);
    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, TREBLE_20);
    play.recordDart.call(play, SINGLE_20);

    vi.advanceTimersByTime(1000);
    play.undoVisit.call(play);
    vi.advanceTimersByTime(1000);

    expect(play.hiddenTurnKey).toBeNull();
  });

  it("a MINUTES session already complete from timer expiry still arms the timer without re-triggering completion", async () => {
    const play = boardPlay({
      configSnapshot: { ...rounds(20), durationType: "MINUTES", durationValue: 1 },
    });
    await play.init.call(play);
    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, TREBLE_20);
    play.recordDart.call(play, SINGLE_20);
    play.engine!.expireTimer();

    play.recordDart.call(play, SINGLE_20);

    expect(appendBatch).not.toHaveBeenCalled();
    expect(play.finished).toBe(false);
  });
});
```

Note: `boardPlay()`'s default config is `rounds(20)` (`app/tests/lib/game/score-training-play.data.test.ts:1662`) — the third test above overrides `configSnapshot` to a 1-minute MINUTES config so `expireTimer()` is meaningful; only `engine.expireTimer()` is called directly, matching the existing "MINUTES duration mode timer wiring" describe block's own style (`app/tests/lib/game/score-training-play.data.test.ts:553`), never the real countdown's `setInterval` side effects.

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "reveal-then-clear"`
Expected: FAIL — `play.hiddenTurnKey`/`play.visitMarkers` are `undefined`.

- [ ] **Step 3: Add the fields to `ScoreTrainingPlayContext`**

In `app/src/lib/game/types.ts`, in `ScoreTrainingPlayContext` (starts line 229), add after the `engine: ScoreTrainingEngine | null;` line (246):

```ts
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  visitMarkers(this: ScoreTrainingPlayContext): BoardMarker[];
```

- [ ] **Step 4: Wire `score-training-play.data.ts`**

Add the import:

```ts
import {
  armHiddenTimer,
  clearHiddenTimer,
  playVisitMarkers,
} from "@lib/game/play-lifecycle";
```

Change the type import:

```ts
import type {
  ScoreTrainingPlayContext,
  ScoreTrainingResultsSnapshot,
} from "./types";
```

to:

```ts
import type {
  BoardMarker,
  ScoreTrainingPlayContext,
  ScoreTrainingResultsSnapshot,
} from "./types";
```

Add the two new fields right after `engine: null as ScoreTrainingEngine | null,` (line 216):

```ts
    engine: null as ScoreTrainingEngine | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
```

Add a `visitMarkers` method after `...boardInputData((observation) => self.recordDart(observation)),` (line 218):

```ts
    ...boardInputData((observation) => self.recordDart(observation)),

    /** Overrides `boardInputData`'s own default — object-literal key order
     * means this later definition wins. Delegates to `play-lifecycle.ts`'s
     * shared implementation, mirrors `bobs27-play.data.ts`. */
    visitMarkers(this: ScoreTrainingPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    state(this: ScoreTrainingPlayContext): ScoreTrainingState | null {
```

Replace `recordDart` (currently lines 418-430):

```ts
    recordDart(this: ScoreTrainingPlayContext, observation: DartObservation) {
      if (!this.engine || this.finished || this.showFinishConfirm) return;

      if (this.engine.wouldComplete(observation)) {
        this.pendingDartObservation = observation;
        this.showFinishConfirm = true;
        return;
      }

      this.engine.record(observation);
      this.error = "";
      this.$store.game.recordFacts(this.engine.facts());
    },
```

with:

```ts
    recordDart(this: ScoreTrainingPlayContext, observation: DartObservation) {
      if (!this.engine || this.finished || this.showFinishConfirm) return;

      if (this.engine.wouldComplete(observation)) {
        this.pendingDartObservation = observation;
        this.showFinishConfirm = true;
        return;
      }

      this.engine.record(observation);
      this.error = "";
      this.$store.game.recordFacts(this.engine.facts());
      armHiddenTimer(this, this.$store.game.turns);
    },
```

In `undoVisit` (currently lines 477-484), add `clearHiddenTimer(this);` right after the guard:

```ts
    undoVisit(this: ScoreTrainingPlayContext) {
      if (this.finished || this.showFinishConfirm) return;
      if (!this.engine || !this.engine.undo()) return;

      clearHiddenTimer(this);
      this.$store.game.recordFacts(this.engine.facts());
      this.scoreInput.clear();
      this.error = "";
    },
```

In `playAgain`'s reset block (currently around lines 621-629), add `clearHiddenTimer(this);` right after `this.showFinishConfirm = false;`:

```ts
        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.pendingFinishScore = null;
        this.pendingDartObservation = null;
        this.showFinishConfirm = false;
        clearHiddenTimer(this);
        this.scoreInput.clear();
        this.error = "";
        this.hasActiveSession = true;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full test suite**

Run: `cd app && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd app && git add src/lib/game/types.ts src/lib/game/score-training-play.data.ts tests/lib/game/score-training-play.data.test.ts
git commit -m "Clear Score Training's board markers 1500ms after a visit resolves"
```

---

## Task 6: Update Pattern 19 in `04-Architecture-patterns.md`

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md` (version header + Pattern 19 section)

**Interfaces:** none (documentation only).

- [ ] **Step 1: Bump the version header**

Change:

```
> **Version:** 1.6.0 (Pattern 19: shared reveal-then-clear preview 2026-08-26; prior 1.5.0 Pattern 18: seat layer — `participantRef`, `stageOwnership`, seat-less `record()` 2026-08-21; 1.4.1 Pattern 18: undo depth, derived-value returns, `completedAt` timing 2026-07-26; prior 1.4.0 Pattern 18 game engine contract 2026-07-26; 1.3.0 Pattern 17 frontend layering 2026-07-14)
```

to:

```
> **Version:** 1.6.1 (Pattern 19: `armHiddenTimer`/`clearHiddenTimer` primitive extracted, all 9 board-input games covered 2026-08-26; prior 1.6.0 Pattern 19: shared reveal-then-clear preview 2026-08-26; 1.5.0 Pattern 18: seat layer — `participantRef`, `stageOwnership`, seat-less `record()` 2026-08-21; 1.4.1 Pattern 18: undo depth, derived-value returns, `completedAt` timing 2026-07-26; prior 1.4.0 Pattern 18 game engine contract 2026-07-26; 1.3.0 Pattern 17 frontend layering 2026-07-14)
```

- [ ] **Step 2: Update the Pattern 19 section**

Replace the `## Application` list under `# Pattern 19 — Shared Reveal-Then-Clear Preview`:

```
## Application

- Timer duration and the hidden/empty gate live once in `play-lifecycle.ts`
  (`playCommitDart`, `playPreviewSegments`). A new per-dart game mode
  supplies only a `classify(dart, index) => "hit" | "miss"` callback — never
  its own timer or its own 3-empty-placeholder gate.
- The mechanism is turn/seat-scoped, not player-count-scoped: single-player
  and 1v1 both read `$store.game.turns`/`hiddenTurnKey` identically, so a
  future 2v2 (once its `sideKey`-group work lands) needs no special case
  here either.
- `VisitPreview.astro` stays markup-only, reading `previewSegments()` off
  the page's own Alpine scope — it never depends on which classifier the
  page used.
```

with:

```
## Application

- Timer duration and the hidden/empty gate live once in `play-lifecycle.ts`
  (`playCommitDart`, `playPreviewSegments`). A new per-dart game mode
  supplies only a `classify(dart, index) => "hit" | "miss"` callback — never
  its own timer or its own 3-empty-placeholder gate.
- The timer-arm/clear logic itself is a separate exported primitive —
  `armHiddenTimer(context, turns)` / `clearHiddenTimer(context)` —
  factored out of `playCommitDart` so a caller whose engine has different
  completion semantics can reuse just the timer without adopting the whole
  `playCommitDart` composite. Score Training's `recordDart` is this case:
  its engine can already be complete before a dart is thrown (MINUTES-mode
  timer expiry), so it must never run `playCommitDart`'s post-record
  `isComplete()` check — it calls `armHiddenTimer` directly instead. Every
  other per-dart game (501, 121, Ten Up One Down, and the 5 originally
  wired) delegates its whole `commitDart` to `playCommitDart`.
- All 9 board-input games (501, 121, Score Training, Ten Up One Down, Bob's
  27, Singles Training, Doubles Training, Shanghai, Around the Clock) clear
  their board markers via `playVisitMarkers`, whether or not they also
  render `VisitPreview.astro`'s 3-dart strip — 501/121/Score
  Training/TUOD score by visit total/checkout and correctly render no
  preview strip, but still show per-dart board markers under
  `ANALYTICS`+`VISUAL_BOARD` capture and clear them the same way.
- The mechanism is turn/seat-scoped, not player-count-scoped: single-player
  and 1v1 both read `$store.game.turns`/`hiddenTurnKey` identically, so a
  future 2v2 (once its `sideKey`-group work lands) needs no special case
  here either.
- `VisitPreview.astro` stays markup-only, reading `previewSegments()` off
  the page's own Alpine scope — it never depends on which classifier the
  page used.
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/04-Architecture-patterns.md
git commit -m "Document armHiddenTimer/clearHiddenTimer and full 9-game board-marker coverage in Pattern 19"
```

---

## Task 7: Fix stale doc claims, record the decision, update F29

**Files:**
- Modify: `docs/architecture/07-Frontend/00-Overview.md` (Visual Board Input section + version header)
- Modify: `decisions/frontend/alpine.md` (new decision block)
- Modify: `FINDINGS.md` (F29 evidence)

**Interfaces:** none (documentation only).

- [ ] **Step 1: Fix `00-Overview.md`'s Visual Board Input section**

Change the version header line:

```
> **Version:** 0.3.5 (treble ring width corrected 10mm→8mm to match the regulation fix in `board-geometry.module.ts`, 2026-08-11); prior 0.3.4 (Score Training recovery/hard-gate alignment, 2026-07-17)
```

to:

```
> **Version:** 0.3.6 (Visual Board Input section corrected: all 9 rulesets support it, marker clearing described as the reveal-then-clear timer, 2026-08-26); prior 0.3.5 (treble ring width corrected 10mm→8mm to match the regulation fix in `board-geometry.module.ts`, 2026-08-11); 0.3.4 (Score Training recovery/hard-gate alignment, 2026-07-17)
```

Also update the frontmatter `updated:` date at the top of the file from `2026-08-11` to `2026-08-26`.

Change this sentence:

```
An ANALYTICS + `VISUAL_BOARD` session captures **one dart at a time** by pointer on a drawn board, instead of a typed visit total. Only 501 and Score Training offer it. The mode pair is chosen in **Settings → App mode** (`AppModeForm.astro`), not on the game's setup screen; setup forwards the settings store through `resolveSessionModePair` (`lib/game/session-mode-resolution.ts`), which narrows the choice to what the ruleset's capability declaration actually supports. Once a session exists, the session's own stored pair — not the settings store — is the authority for how it is played and validated.
```

to:

```
An ANALYTICS + `VISUAL_BOARD` session captures **one dart at a time** by pointer on a drawn board, instead of a typed visit total. Every ruleset declares it as a capability pair (`lib/game/rulesets/capabilities.ts`). The mode pair is chosen in **Settings → App mode** (`AppModeForm.astro`), not on the game's setup screen; setup forwards the settings store through `resolveSessionModePair` (`lib/game/session-mode-resolution.ts`), which narrows the choice to what the ruleset's capability declaration actually supports. Once a session exists, the session's own stored pair — not the settings store — is the authority for how it is played and validated.
```

Change this paragraph:

```
**Landed darts are drawn as markers on the board.** They show the most recent turn's located darts — still open, or just closed by its last dart — so a finished visit's grouping stays on the board until the next visit's first dart replaces it. An unseen dart has no coordinate and is not drawn.
```

to:

```
**Landed darts are drawn as markers on the board.** They show the most recent turn's located darts — still open, or just closed by its last dart. A closed visit's grouping stays on the board for 1500ms (the reveal-then-clear timer, `04-Architecture-patterns.md` Pattern 19), then clears — the same timer every board-input game uses, whether or not it also renders a 3-dart preview strip. An unseen dart has no coordinate and is not drawn.
```

- [ ] **Step 2: Add the decision**

Derive the next id:

Run: `git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**/*.md decisions/*.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1`

Use that number (expected `234` if no other decision landed since Task 1 was planned; confirm at commit time). Append to the end of `decisions/frontend/alpine.md`:

```markdown
### D234 — `armHiddenTimer`/`clearHiddenTimer` extracted; all 9 board-input games clear their markers on the shared timer
Status: Accepted · Date: 2026-08-26
Decision: `play-lifecycle.ts`'s reveal-then-clear timer logic is split into two exported primitives, `armHiddenTimer(context, turns)` and `clearHiddenTimer(context)`, factored out of `playCommitDart`/`playUndoVisit`/`runPlayAgain` with no behavior change for existing callers. 501, 121, and Ten Up One Down — whose `commitDart` was otherwise identical to `playCommitDart` (record → mirror → complete-check) — now delegate to it directly, the same way Bob's 27 already does (D233). Score Training calls `armHiddenTimer` directly from `recordDart` instead: its engine can already be complete before a dart is thrown (MINUTES-mode timer expiry via `expireTimer()`), so a post-record `isComplete()` check — which `playCommitDart` always runs — would upload and finish the session mid-visit, on the first dart of a fresh visit. All 9 board-input games now clear their board markers via `playVisitMarkers` on the same 1500ms timer.
Reason: 501/121/TUOD/Score Training never had `hiddenTurnKey`/`hiddenTimer` state at all, so `BoardInputPanel.astro`'s markers — rendered unconditionally by every board-input game — never cleared for these four; a dart's marker sat on the board until the next visit's first dart overwrote the same slot. Extracting the primitive rather than forcing Score Training onto the full `playCommitDart` composite avoids reintroducing the exact class of bug D229 fixed (an unconditional post-record completion check tripping on an already-decided session).
Consequences: `FiveOhOnePlayContext`, `OneTwentyOnePlayContext`, `ScoreTrainingPlayContext`, and `TuodPlayContext` each gain their own `hiddenTurnKey`/`hiddenTimer`/`visitMarkers()` fields, extending the same hand-restated-shape pattern `FINDINGS.md`'s F29 already flags for 5 other `*PlayContext` types (now 9). `docs/architecture/07-Frontend/00-Overview.md`'s Visual Board Input section, which pre-dated most of the 9-game rollout, is corrected to state every ruleset supports `VISUAL_BOARD` and to describe the reveal-then-clear timer instead of the older "stays until the next visit's first dart" behavior.
```

- [ ] **Step 3: Update F29's evidence**

In `FINDINGS.md`, F29's `Claim:` line currently reads:

```
Claim: `Bobs27PlayContext`, `SinglesTrainingPlayContext`, `DoublesTrainingPlayContext`, `ShanghaiPlayContext`, and `AroundTheClockPlayContext` (all in `app/src/lib/game/types.ts`) each hand-declare `hiddenTurnKey`, `hiddenTimer`, `loading`, `error`, `finished`, and the rest of `PlayLifecycleContext<TConfig, TEngine, TResults>`'s fields, rather than being defined in terms of it
```

Change it to:

```
Claim: `Bobs27PlayContext`, `SinglesTrainingPlayContext`, `DoublesTrainingPlayContext`, `ShanghaiPlayContext`, `AroundTheClockPlayContext`, `FiveOhOnePlayContext`, `OneTwentyOnePlayContext`, `ScoreTrainingPlayContext`, and `TuodPlayContext` (all in `app/src/lib/game/types.ts`) each hand-declare `hiddenTurnKey`, `hiddenTimer`, `loading`, `error`, `finished`, and the rest of `PlayLifecycleContext<TConfig, TEngine, TResults>`'s fields, rather than being defined in terms of it
```

And its `Impact:` line currently reads:

```
Impact: a future field added to the shared lifecycle contract (e.g. a new timer or status field) must be hand-copied into 5 places instead of one; noticed while extracting `playPreviewSegments`/unifying the reveal timer (this task), but a full generic-based unification is a separate, larger type-level refactor outside this task's scope
```

Change `5 places` to `9 places`:

```
Impact: a future field added to the shared lifecycle contract (e.g. a new timer or status field) must be hand-copied into 9 places instead of one; noticed while extracting `playPreviewSegments`/unifying the reveal timer, then widened when `FiveOhOnePlayContext`/`OneTwentyOnePlayContext`/`ScoreTrainingPlayContext`/`TuodPlayContext` picked up the same fields (D234) — a full generic-based unification is a separate, larger type-level refactor outside either task's scope
```

Also update its `Proposed:` line's "5 files" reference if present — read the current line and change any remaining "5" count to "9" for consistency.

- [ ] **Step 4: Run the doc/decision gate scripts**

Run: `bash scripts/check-context-map.sh && bash scripts/check-decision-ids.sh && bash scripts/check-findings-log.sh && bash scripts/check-doc-links.sh`
Expected: all four exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/07-Frontend/00-Overview.md decisions/frontend/alpine.md FINDINGS.md
git commit -m "Fix stale Visual Board Input claims, record D234, widen F29 to 9 files"
```

---

## Task 8: Context maintenance and full validation

**Files:** none new — this task runs the mandatory closing procedure.

- [ ] **Step 1: Run the context-maintenance skill**

Invoke the `context-maintenance` skill per root `CLAUDE.md`. It confirms:
CLAUDE.md files still accurate, context map/file inventory need no new
rows (no files added or moved by this plan — only existing files edited),
`decisions/**` entry present (Task 7), `FINDINGS.md` accurate (Task 7),
gate scripts pass, branch/PR state check.

- [ ] **Step 2: Run the full validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0 — `db:status`, `db:migrate`, `db:introspect`,
`fallow` (0 files above the health threshold; duplication percentage should
not have increased, since Tasks 2–5 each replace a hand-rolled multi-line
`commitDart`/`recordDart` block with either a one-line delegation or one
extra primitive call, and add a 3-line `visitMarkers()` override — the same
small shape already repeated 5 times across the wired games), `npm test`,
`astro check` (0 errors/warnings/hints), graph refresh.

- [ ] **Step 3: Run `npm run format:check`**

Run: `cd app && npm run format:check`
Expected: clean. If not, run `npm run format` and commit the formatting
diff before proceeding (per `app/CLAUDE.md`'s mandatory pre-PR step).

- [ ] **Step 4: Confirm branch and push**

Confirm the current branch is a dedicated task branch (never `main`).
Push per the repo's git-push convention (`git push -u origin <branch>`).
Do not open a PR unless the user asks for one.
