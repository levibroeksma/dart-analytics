# Play-Data Lifecycle Dedup (F27) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the `uploadAndCompleteSession`/`playAgain`/`abandonAndExit`/`currentFacts` duplication across `five-oh-one-play.data.ts`, `one-twenty-one-play.data.ts`, `score-training-play.data.ts`, and `tuod-play.data.ts` by wiring all 4 to the generic helpers already exported from `play-lifecycle.ts`, per `docs/superpowers/specs/2026-09-03-play-data-lifecycle-dedup-design.md` (closes FINDINGS.md F27, play-data half only — the Score Training/TUOD engine-pair clone stays out of scope per the finding's own recommendation).

**Architecture:** `play-lifecycle.ts` already exports generic `playAbandonAndExit`, `playBack`, `playUploadAndCompleteSession`, and `runPlayAgain` — the other 5 rulesets (Bob's 27, Singles Training, Doubles Training, Shanghai, Around the Clock) already call them. The 4 target files never adopted them and independently reimplemented near-identical bodies instead. This plan (a) exports one more already-private helper (`currentFacts`), (b) extends two of the four generic functions with small optional callback parameters so they can express the 4 target rulesets' own extra per-ruleset resets (timer fields, `ScoreInputBuffer.clear()`, a fresh countdown), fully backward-compatible with the 5 existing callers (no edits needed there), and (c) rewrites each of the 4 files' own methods as thin wrappers around the shared functions.

**Tech Stack:** TypeScript, Vitest, `npx fallow`.

## Global Constraints

- Closes FINDINGS.md F27 (play-data half only). Does **not** touch `score-training.engine.module.ts`/`tuod.engine.module.ts`'s own structural clone — explicitly out of scope per the finding.
- No new ruleset-facing behavior — every extraction in this plan must be output-identical to the code it replaces for every existing test case. Where a ruleset's current code has a small asymmetry against its siblings (e.g. TUOD's `playAgain` never calls `scoreInput.clear()`, unlike 501/121/Score Training), **preserve it exactly** — do not silently "fix" it as part of this refactor.
- `app/CLAUDE.md`'s D224: every changed runtime `.ts` file needs its covering test touched (even if only to confirm the existing assertions still hold after an internal refactor).
- Run `cd app && npm test` after every task in this plan (not only at the end) — this family was "hardened days earlier by the Play Again session-participant/config reseating fix" per the finding itself, the most fragile path in the app.
- Investigation note (read before starting Task 3/4): this plan's own `npx fallow dupes` run (done during plan-writing, see below) found the real clone shape differs from the spec's original "extract `computeStats`" framing — each ruleset's own per-seat stats function (`statsFor`/`computeStats`/`buildResultsSnapshot`) has a genuinely different field shape (`FiveOhOneSeatResult` vs `OneTwentyOneSeatResult` vs `ScoreTrainingSeatResult` vs `TuodSeatResult`) and is **not** a real clone group — fallow does not report it as one. The actual clone groups are `uploadAndCompleteSession`'s try/catch/idempotency prelude (28 lines × all 4 files, and a 5th match against `play-lifecycle.ts`'s own already-existing `playUploadAndCompleteSession`), `abandonAndExit` (20 lines × all 4 files, byte-identical), and several overlapping `playAgain` fragments (up to 3-way, never fully 4-way, since 121 and 501 each diverge from the Score Training/TUOD near-twins in different ways). This plan follows the real clone shape, not the spec's original guess — the spec's own risk-mitigation ordering (safest extraction first, `playAgain` last) is preserved regardless.

---

## Task 1: Export and adopt the shared `currentFacts` helper

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts:36-47`
- Modify: `app/src/lib/game/five-oh-one-play.data.ts`
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts`
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Modify: `app/src/lib/game/tuod-play.data.ts`
- Test: `app/tests/lib/game/five-oh-one-play.data.test.ts`, `app/tests/lib/game/one-twenty-one-play.data.test.ts`, `app/tests/lib/game/score-training-play.data.test.ts`, `app/tests/lib/game/tuod-play.data.test.ts`

**Interfaces:**
- Produces: `currentFacts<TConfig, TEngine extends GameEngine<DartObservation, unknown>, TResults>(context: PlayLifecycleContext<TConfig, TEngine, TResults>): EngineFacts`, exported from `@lib/game/play-lifecycle`.

- [ ] **Step 1: Export `currentFacts` from `play-lifecycle.ts`**

Change line 36 from:

```ts
function currentFacts<
```

to:

```ts
export function currentFacts<
```

The function body (lines 37-47) is unchanged.

- [ ] **Step 2: Remove the local `currentFacts` copy from `five-oh-one-play.data.ts` and import the shared one**

Delete the local function (currently `five-oh-one-play.data.ts:98-105`):

```ts
function currentFacts(context: FiveOhOnePlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}
```

Add `currentFacts` to the existing `@lib/game/play-lifecycle` import (currently lines 20-27):

```ts
import {
  clearHiddenTimer,
  currentFacts,
  playCommitDart,
  playFoldBotQuickScoreVisit,
  playRunBotVisualBoardVisit,
  playVisitMarkers,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
```

Every existing call site (`currentFacts(this)`, e.g. line 778) is unchanged — the shared function's generic signature infers `TConfig`/`TEngine`/`TResults` from the `FiveOhOnePlayContext` value passed in, same as any other generic call.

- [ ] **Step 3: Same swap in `one-twenty-one-play.data.ts`**

Delete the local `currentFacts` function (currently `one-twenty-one-play.data.ts:91-98`, same 8-line body as Step 2's). Add `currentFacts` to the existing `@lib/game/play-lifecycle` import (currently lines 24-28):

```ts
import {
  clearHiddenTimer,
  currentFacts,
  playCommitDart,
  playVisitMarkers,
} from "@lib/game/play-lifecycle";
```

- [ ] **Step 4: Same swap in `score-training-play.data.ts`**

Delete the local `currentFacts` function (currently `score-training-play.data.ts:159-166`). Add `currentFacts` to the existing import (currently lines 19-23):

```ts
import {
  armHiddenTimer,
  clearHiddenTimer,
  currentFacts,
  playVisitMarkers,
} from "@lib/game/play-lifecycle";
```

- [ ] **Step 5: Same swap in `tuod-play.data.ts`**

Delete the local `currentFacts` function (currently `tuod-play.data.ts:83-90`). Add `currentFacts` to the existing import (currently lines 21-25):

```ts
import {
  clearHiddenTimer,
  currentFacts,
  playCommitDart,
  playVisitMarkers,
} from "@lib/game/play-lifecycle";
```

- [ ] **Step 6: Type-check and run the 4 rulesets' test suites**

Run:
```bash
cd app
npx astro check --minimumFailingSeverity hint
npx vitest run tests/lib/game/five-oh-one-play.data.test.ts tests/lib/game/one-twenty-one-play.data.test.ts tests/lib/game/score-training-play.data.test.ts tests/lib/game/tuod-play.data.test.ts tests/lib/game/play-lifecycle.test.ts
```
Expected: `astro check` 0/0/0; all 5 test files pass with the same pass counts as before this task (pure internal wiring change, `currentFacts`'s behavior is byte-identical to what each file's own copy did).

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/play-lifecycle.ts app/src/lib/game/five-oh-one-play.data.ts app/src/lib/game/one-twenty-one-play.data.ts app/src/lib/game/score-training-play.data.ts app/src/lib/game/tuod-play.data.ts
git commit -m "$(cat <<'EOF'
refactor: adopt play-lifecycle's shared currentFacts across 501/121/Score Training/TUOD (F27)

Exports the already-identical currentFacts helper from play-lifecycle.ts
and removes each of the 4 files' own byte-identical copy. No behavior
change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018AvgBxkfN1d23hgeFi7s2F
EOF
)"
```

---

## Task 2: Adopt the shared `playAbandonAndExit` and `playBack`

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts` (extend `playAbandonAndExit` with an optional `onAbandoned` callback)
- Modify: `app/src/lib/game/five-oh-one-play.data.ts`
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts`
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Modify: `app/src/lib/game/tuod-play.data.ts`
- Test: same 4 `*-play.data.test.ts` files as Task 1, plus `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces: `playAbandonAndExit<TConfig, TEngine, TResults>(context, onAbandoned?: () => void): Promise<void>` — the `onAbandoned` param is new and optional; the 5 existing callers (Bob's 27, Singles Training, Doubles Training, Shanghai, Around the Clock) are unaffected and need no edits.

- [ ] **Step 1: Extend `playAbandonAndExit` in `play-lifecycle.ts` with an optional `onAbandoned` callback**

Replace the current function (`play-lifecycle.ts:431-461`):

```ts
export async function playAbandonAndExit<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(context: PlayLifecycleContext<TConfig, TEngine, TResults>): Promise<void> {
  if (context.$store.game.loading) return;
  const sessionId = context.$store.game.sessionId;
  if (!sessionId) {
    context.$store.game.reset();
    globalThis.location.href = "/games";
    return;
  }
  context.$store.game.loading = true;
  context.error = "";
  try {
    const facts = currentFacts(context);
    if (facts.turns.length > 0) {
      if (!context.$store.game.idempotencyKey) {
        context.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const batch = buildEventsBatch(facts);
      await appendBatch(sessionId, context.$store.game.idempotencyKey, batch);
    }
    await completeSession(sessionId, "ABANDONED");
    context.$store.game.reset();
    globalThis.location.href = "/games";
  } catch {
    context.error = "Could not abandon session. Try again.";
    context.$store.game.loading = false;
  }
}
```

with:

```ts
export async function playAbandonAndExit<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  onAbandoned?: () => void,
): Promise<void> {
  if (context.$store.game.loading) return;
  const sessionId = context.$store.game.sessionId;
  if (!sessionId) {
    context.$store.game.reset();
    globalThis.location.href = "/games";
    return;
  }
  context.$store.game.loading = true;
  context.error = "";
  try {
    const facts = currentFacts(context);
    if (facts.turns.length > 0) {
      if (!context.$store.game.idempotencyKey) {
        context.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const batch = buildEventsBatch(facts);
      await appendBatch(sessionId, context.$store.game.idempotencyKey, batch);
    }
    await completeSession(sessionId, "ABANDONED");
    onAbandoned?.();
    context.$store.game.reset();
    globalThis.location.href = "/games";
  } catch {
    context.error = "Could not abandon session. Try again.";
    context.$store.game.loading = false;
  }
}
```

`onAbandoned` runs only on the success path, right before the store reset/redirect — the same point 121/Score Training/TUOD's own hand-written `abandonAndExit` calls `this.timer?.stop()` today.

- [ ] **Step 2: Rewrite `five-oh-one-play.data.ts`'s `back`/`abandonAndExit`**

Replace (currently `five-oh-one-play.data.ts:806-837`):

```ts
    async back(this: FiveOhOnePlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: FiveOhOnePlayContext) {
      if (this.$store.game.loading) return;
      const sessionId = this.$store.game.sessionId;
      if (!sessionId) {
        this.$store.game.reset();
        globalThis.location.href = "/games";
        return;
      }
      this.$store.game.loading = true;
      this.error = "";
      try {
        const facts = currentFacts(this);
        if (facts.turns.length > 0) {
          if (!this.$store.game.idempotencyKey) {
            this.$store.game.idempotencyKey = crypto.randomUUID();
          }
          const batch = buildEventsBatch(facts);
          await appendBatch(sessionId, this.$store.game.idempotencyKey, batch);
        }
        await completeSession(sessionId, "ABANDONED");
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.$store.game.loading = false;
      }
    },
```

with:

```ts
    async back(this: FiveOhOnePlayContext) {
      return playBack(this);
    },

    async abandonAndExit(this: FiveOhOnePlayContext) {
      return playAbandonAndExit(this);
    },
```

Add `playAbandonAndExit` and `playBack` to the `@lib/game/play-lifecycle` import block (alongside `currentFacts` from Task 1).

- [ ] **Step 3: Rewrite `one-twenty-one-play.data.ts`'s `back`/`abandonAndExit`**

Replace (currently `one-twenty-one-play.data.ts:765-797`):

```ts
    async back(this: OneTwentyOnePlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: OneTwentyOnePlayContext) {
      if (this.$store.game.loading) return;
      const sessionId = this.$store.game.sessionId;
      if (!sessionId) {
        this.$store.game.reset();
        globalThis.location.href = "/games";
        return;
      }
      this.$store.game.loading = true;
      this.error = "";
      try {
        const facts = currentFacts(this);
        if (facts.turns.length > 0) {
          if (!this.$store.game.idempotencyKey) {
            this.$store.game.idempotencyKey = crypto.randomUUID();
          }
          const batch = buildEventsBatch(facts);
          await appendBatch(sessionId, this.$store.game.idempotencyKey, batch);
        }
        await completeSession(sessionId, "ABANDONED");
        this.timer?.stop();
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.$store.game.loading = false;
      }
    },
```

with:

```ts
    async back(this: OneTwentyOnePlayContext) {
      return playBack(this);
    },

    async abandonAndExit(this: OneTwentyOnePlayContext) {
      return playAbandonAndExit(this, () => this.timer?.stop());
    },
```

Add `playAbandonAndExit` and `playBack` to the `@lib/game/play-lifecycle` import block.

- [ ] **Step 4: Rewrite `score-training-play.data.ts`'s `back`/`abandonAndExit`**

Replace (currently `score-training-play.data.ts:573-605`) with the same shape as Step 3:

```ts
    async back(this: ScoreTrainingPlayContext) {
      return playBack(this);
    },

    async abandonAndExit(this: ScoreTrainingPlayContext) {
      return playAbandonAndExit(this, () => this.timer?.stop());
    },
```

Add `playAbandonAndExit` and `playBack` to the `@lib/game/play-lifecycle` import block.

- [ ] **Step 5: Rewrite `tuod-play.data.ts`'s `back`/`abandonAndExit`**

Replace (currently `tuod-play.data.ts:568-600`) with the same shape as Step 3:

```ts
    async back(this: TuodPlayContext) {
      return playBack(this);
    },

    async abandonAndExit(this: TuodPlayContext) {
      return playAbandonAndExit(this, () => this.timer?.stop());
    },
```

Add `playAbandonAndExit` and `playBack` to the `@lib/game/play-lifecycle` import block.

- [ ] **Step 6: Type-check and run tests**

Run:
```bash
cd app
npx astro check --minimumFailingSeverity hint
npm test
```
Expected: `astro check` 0/0/0; full suite passes, same pass count as after Task 1 (this task changes no observable behavior — `onAbandoned` reproduces the exact `this.timer?.stop()` call the 3 timer-having rulesets already made at the same point in the control flow).

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/play-lifecycle.ts app/src/lib/game/five-oh-one-play.data.ts app/src/lib/game/one-twenty-one-play.data.ts app/src/lib/game/score-training-play.data.ts app/src/lib/game/tuod-play.data.ts
git commit -m "$(cat <<'EOF'
refactor: adopt play-lifecycle's shared playAbandonAndExit/playBack (F27)

Extends playAbandonAndExit with an optional onAbandoned callback (runs
on the success path, right before store reset/redirect) so 121/Score
Training/TUOD's timer.stop() call has somewhere to attach — backward
compatible, the 5 existing callers pass no 2nd argument and are
unaffected. All 4 target rulesets' back()/abandonAndExit() are now
thin wrappers around the shared functions.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018AvgBxkfN1d23hgeFi7s2F
EOF
)"
```

---

## Task 3: Adopt the shared `playUploadAndCompleteSession`

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts` (extend `playUploadAndCompleteSession` with an optional `resolveFinalState` callback)
- Modify: `app/src/lib/game/five-oh-one-play.data.ts`
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts`
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Modify: `app/src/lib/game/tuod-play.data.ts`
- Test: same 4 `*-play.data.test.ts` files, plus `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Produces: `playUploadAndCompleteSession<TConfig, TEngine, TResults>(context, buildResultsSnapshot, resolveFinalState?: () => ReturnType<TEngine["state"]> | null): Promise<void>` — `resolveFinalState` is new and optional, defaulting to `() => context.engine?.state() ?? null` (the function's exact current behavior). The 5 existing callers pass 2 arguments today and are unaffected.

Investigation note: 501/121/Score Training/TUOD each read final state through their own page-level `state()` method (`this.state()`), which folds from the **store's persisted `stages`/`turns`** — not from `context.engine?.state()` (the live engine instance). This matters: `this.state()` still returns a result when `context.engine` is `null` (e.g. a completion retry driven straight from the results modal, which Score Training's and TUOD's own doc comments call out by name), while `context.engine?.state() ?? null` — the shared function's current hardcoded behavior — returns `null` in that exact situation, silently dropping the results snapshot. Naively pointing all 4 files at the unmodified shared function would be a real regression. The `resolveFinalState` parameter exists to prevent that: each of the 4 files passes `() => this.state()` explicitly; the other 5 rulesets don't pass it at all and keep today's exact behavior.

- [ ] **Step 1: Extend `playUploadAndCompleteSession` in `play-lifecycle.ts`**

Replace the current function (`play-lifecycle.ts:377-420`):

```ts
export async function playUploadAndCompleteSession<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  buildResultsSnapshot: (finalState: ReturnType<TEngine["state"]>) => TResults,
): Promise<void> {
  const sessionId = context.$store.game.sessionId!;

  if (!context.$store.game.idempotencyKey) {
    context.$store.game.idempotencyKey = crypto.randomUUID();
  }
  const idempotencyKey = context.$store.game.idempotencyKey;

  context.completionStatus = "saving";
  context.completionError = "";

  const finalState = context.engine?.state() ?? null;

  try {
    const batch = buildEventsBatch(currentFacts(context));
    await appendBatch(sessionId, idempotencyKey, batch);
    await completeSession(sessionId, "COMPLETED");
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    const alreadyCompleted =
      error.code === "SESSION_ALREADY_COMPLETED" ||
      error.message?.includes("SESSION_ALREADY_COMPLETED");
    if (!alreadyCompleted) {
      context.completionError =
        "Could not save your game. Check your connection and retry.";
      context.completionStatus = "failed";
      return;
    }
  }

  if (finalState) {
    context.resultsSnapshot = buildResultsSnapshot(
      finalState as ReturnType<TEngine["state"]>,
    );
  }
  context.completionStatus = "succeeded";
}
```

with:

```ts
export async function playUploadAndCompleteSession<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  buildResultsSnapshot: (finalState: ReturnType<TEngine["state"]>) => TResults,
  resolveFinalState: () => ReturnType<TEngine["state"]> | null = () =>
    (context.engine?.state() ?? null) as ReturnType<TEngine["state"]> | null,
): Promise<void> {
  const sessionId = context.$store.game.sessionId!;

  if (!context.$store.game.idempotencyKey) {
    context.$store.game.idempotencyKey = crypto.randomUUID();
  }
  const idempotencyKey = context.$store.game.idempotencyKey;

  context.completionStatus = "saving";
  context.completionError = "";

  const finalState = resolveFinalState();

  try {
    const batch = buildEventsBatch(currentFacts(context));
    await appendBatch(sessionId, idempotencyKey, batch);
    await completeSession(sessionId, "COMPLETED");
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    const alreadyCompleted =
      error.code === "SESSION_ALREADY_COMPLETED" ||
      error.message?.includes("SESSION_ALREADY_COMPLETED");
    if (!alreadyCompleted) {
      context.completionError =
        "Could not save your game. Check your connection and retry.";
      context.completionStatus = "failed";
      return;
    }
  }

  if (finalState) {
    context.resultsSnapshot = buildResultsSnapshot(finalState);
  }
  context.completionStatus = "succeeded";
}
```

- [ ] **Step 2: Rewrite `five-oh-one-play.data.ts`'s `uploadAndCompleteSession`**

Replace (currently `five-oh-one-play.data.ts:766-796`, the doc comment plus the full method body) with:

```ts
    /**
     * Uploads the fact log, then marks the session COMPLETED. Delegates to
     * `play-lifecycle.ts`'s shared `playUploadAndCompleteSession` — see this
     * file's own `buildResultsSnapshot` for the match-summary shape.
     */
    async uploadAndCompleteSession(this: FiveOhOnePlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, buildResultsSnapshot, () =>
        this.state(),
      );
    },
```

Add `playUploadAndCompleteSession` to the `@lib/game/play-lifecycle` import block. `buildResultsSnapshot` (the file's own local function, `five-oh-one-play.data.ts:216-...`) is unchanged — still defined, now called via this one indirection instead of directly.

- [ ] **Step 3: Rewrite `one-twenty-one-play.data.ts`'s `uploadAndCompleteSession`**

Replace (currently `one-twenty-one-play.data.ts:719-754`) with:

```ts
    async uploadAndCompleteSession(
      this: OneTwentyOnePlayContext,
    ): Promise<void> {
      return playUploadAndCompleteSession(
        this,
        (finalState) => computeStats(finalState, this.$store.game.turns),
        () => this.state(),
      );
    },
```

Add `playUploadAndCompleteSession` to the `@lib/game/play-lifecycle` import block. `computeStats` (the file's own local function, `one-twenty-one-play.data.ts:279-289`) is unchanged.

- [ ] **Step 4: Rewrite `score-training-play.data.ts`'s `uploadAndCompleteSession`, delete the now-dead `finalScoreTrainingState`**

Replace the method (currently `score-training-play.data.ts:513-562`) with:

```ts
    async uploadAndCompleteSession(
      this: ScoreTrainingPlayContext,
    ): Promise<void> {
      return playUploadAndCompleteSession(
        this,
        (finalState) => ({
          status: finalState.status === "TIE" ? "TIE" : "COMPLETE",
          winningSideKey: finalState.winningSideKey,
          seats: finalState.seats.map((seat) =>
            statsFor(seat, this.$store.game.turns),
          ),
        }),
        () => this.state(),
      );
    },
```

Delete the now-unused `finalScoreTrainingState` function and its doc comment (currently `score-training-play.data.ts:168-188`) — its only caller was the method just replaced, and `this.state()` (called directly above) is provably equivalent: `finalScoreTrainingState` itself called `context.state()` first and only fell back to a fresh fold when that returned `null`, which only happens when `configSnapshot` is `null` — a case the fold branch also returns `null` for, since it reads the same `configSnapshot`. Verify with `grep -n "finalScoreTrainingState" app/src/lib/game/score-training-play.data.ts` that no other call site exists before deleting (there should be none).

Add `playUploadAndCompleteSession` to the `@lib/game/play-lifecycle` import block. `statsFor` (`score-training-play.data.ts:73-89`) is unchanged.

- [ ] **Step 5: Rewrite `tuod-play.data.ts`'s `uploadAndCompleteSession`, delete the now-dead `finalTuodState`**

Replace the method (currently `tuod-play.data.ts:523-557`) with:

```ts
    async uploadAndCompleteSession(this: TuodPlayContext): Promise<void> {
      return playUploadAndCompleteSession(
        this,
        (finalState) => computeStats(finalState),
        () => this.state(),
      );
    },
```

Delete the now-unused `finalTuodState` function and its doc comment (currently `tuod-play.data.ts:92-109`) — same reasoning as Step 4. Verify with `grep -n "finalTuodState" app/src/lib/game/tuod-play.data.ts` that no other call site exists before deleting.

Add `playUploadAndCompleteSession` to the `@lib/game/play-lifecycle` import block. `computeStats` (`tuod-play.data.ts:129-141`) is unchanged.

- [ ] **Step 6: Type-check and run tests**

Run:
```bash
cd app
npx astro check --minimumFailingSeverity hint
npm test
```
Expected: `astro check` 0/0/0; full suite passes, same pass count as after Task 2. Pay particular attention to each of the 4 rulesets' own `*-play.data.test.ts` cases covering completion (a decided match, a TIE where applicable, a completion retry after a failed save) — these are exactly the paths `resolveFinalState` exists to keep working.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/play-lifecycle.ts app/src/lib/game/five-oh-one-play.data.ts app/src/lib/game/one-twenty-one-play.data.ts app/src/lib/game/score-training-play.data.ts app/src/lib/game/tuod-play.data.ts
git commit -m "$(cat <<'EOF'
refactor: adopt play-lifecycle's shared playUploadAndCompleteSession (F27)

Extends playUploadAndCompleteSession with an optional resolveFinalState
callback (defaults to the exact current context.engine?.state() ?? null
behavior — the 5 existing callers are unaffected) so 501/121/Score
Training/TUOD can supply their own store-fold-based this.state(),
preserving each ruleset's completion-retry-with-no-live-engine path.
Score Training's finalScoreTrainingState and TUOD's finalTuodState are
deleted — both were provably equivalent to state() alone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018AvgBxkfN1d23hgeFi7s2F
EOF
)"
```

---

## Task 4: Adopt the shared `runPlayAgain` (highest-risk extraction — done last)

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts` (extend `runPlayAgain` with optional `resetLocalState`/`afterEngineReady` callbacks)
- Modify: `app/src/lib/game/five-oh-one-play.data.ts`
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts`
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Modify: `app/src/lib/game/tuod-play.data.ts`
- Test: same 4 `*-play.data.test.ts` files, plus `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Produces: `runPlayAgain<TConfig extends object, TEngine, TResults>(context, gameTypeKey, rulesetVersionKey, narrowEngine, buildOverrides?, resetLocalState?: (context) => void, afterEngineReady?: (context, engine: TEngine) => void): Promise<void>` — both new params are optional; the 5 existing callers pass at most 5 arguments today and are unaffected.

- [ ] **Step 1: Extend `runPlayAgain` in `play-lifecycle.ts`**

Replace the current function (`play-lifecycle.ts:470-542`):

```ts
export async function runPlayAgain<
  TConfig extends object,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  gameTypeKey: string,
  rulesetVersionKey: RulesetVersionKey,
  narrowEngine: (engine: GameEngine<unknown, unknown>) => TEngine | null,
  buildOverrides?: (
    priorConfig: Seated<TConfig>,
  ) => PlayAgainOverrides<TConfig>,
): Promise<void> {
  const config = context.$store.game.configSnapshot;
  const templateRef = context.$store.game.templateRef;
  if (!config || !templateRef || context.playAgainLoading) return;
  const factory = getEngineFactory(rulesetVersionKey);
  if (!factory) return;

  context.playAgainLoading = true;
  context.playAgainError = "";

  const modePair = resolveSessionModePair(
    rulesetVersionKey,
    context.$store.settings,
  );
  const overrides = buildOverrides ? buildOverrides(config) : null;
  const nextConfigSnapshot = overrides ? overrides.snapshot : config;

  try {
    let session;
    try {
      session = await createSession({
        gameTypeKey,
        rulesetVersionKey,
        captureModeKey: modePair.captureModeKey,
        inputModeKey: modePair.inputModeKey,
        config: overrides
          ? { source: "template", templateRef, overrides: overrides.wire }
          : { source: "template", templateRef },
        participants: participantsFromSeats(config.seats),
      });
    } catch {
      context.playAgainError = "Could not start a new session. Try again.";
      return;
    }

    const seatedSnapshot = reseatSnapshot(
      nextConfigSnapshot,
      session.participants,
    ) as Seated<TConfig>;

    context.$store.game.sessionId = session.sessionId;
    context.$store.game.idempotencyKey = null;
    context.$store.game.configSnapshot = seatedSnapshot;
    context.$store.game.setSessionModes(modePair);

    context.finished = false;
    context.completionStatus = "pending";
    context.completionError = "";
    context.resultsSnapshot = null;
    clearHiddenTimer(context);
    context.error = "";
    context.hasActiveSession = true;

    const engine = narrowEngine(factory.create(seatedSnapshot));
    if (!engine) return;
    context.engine = engine;
    context.$store.game.recordFacts(engine.facts());
  } finally {
    context.playAgainLoading = false;
  }
}
```

with:

```ts
export async function runPlayAgain<
  TConfig extends object,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  gameTypeKey: string,
  rulesetVersionKey: RulesetVersionKey,
  narrowEngine: (engine: GameEngine<unknown, unknown>) => TEngine | null,
  buildOverrides?: (
    priorConfig: Seated<TConfig>,
  ) => PlayAgainOverrides<TConfig>,
  resetLocalState?: (
    context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  ) => void,
  afterEngineReady?: (
    context: PlayLifecycleContext<TConfig, TEngine, TResults>,
    engine: TEngine,
  ) => void,
): Promise<void> {
  const config = context.$store.game.configSnapshot;
  const templateRef = context.$store.game.templateRef;
  if (!config || !templateRef || context.playAgainLoading) return;
  const factory = getEngineFactory(rulesetVersionKey);
  if (!factory) return;

  context.playAgainLoading = true;
  context.playAgainError = "";

  const modePair = resolveSessionModePair(
    rulesetVersionKey,
    context.$store.settings,
  );
  const overrides = buildOverrides ? buildOverrides(config) : null;
  const nextConfigSnapshot = overrides ? overrides.snapshot : config;

  try {
    let session;
    try {
      session = await createSession({
        gameTypeKey,
        rulesetVersionKey,
        captureModeKey: modePair.captureModeKey,
        inputModeKey: modePair.inputModeKey,
        config: overrides
          ? { source: "template", templateRef, overrides: overrides.wire }
          : { source: "template", templateRef },
        participants: participantsFromSeats(config.seats),
      });
    } catch {
      context.playAgainError = "Could not start a new session. Try again.";
      return;
    }

    const seatedSnapshot = reseatSnapshot(
      nextConfigSnapshot,
      session.participants,
    ) as Seated<TConfig>;

    context.$store.game.sessionId = session.sessionId;
    context.$store.game.idempotencyKey = null;
    context.$store.game.configSnapshot = seatedSnapshot;
    context.$store.game.setSessionModes(modePair);

    context.finished = false;
    context.completionStatus = "pending";
    context.completionError = "";
    context.resultsSnapshot = null;
    clearHiddenTimer(context);
    context.error = "";
    context.hasActiveSession = true;
    resetLocalState?.(context);

    const engine = narrowEngine(factory.create(seatedSnapshot));
    if (!engine) return;
    context.engine = engine;
    context.$store.game.recordFacts(engine.facts());
    afterEngineReady?.(context, engine);
  } finally {
    context.playAgainLoading = false;
  }
}
```

`resetLocalState` runs after the base reset block, right before engine creation — matches where each of the 4 files' own extra field resets sit today. `afterEngineReady` runs right after `recordFacts`, for the countdown-timer restart 121/Score Training/TUOD each do at that exact point.

- [ ] **Step 2: Rewrite `five-oh-one-play.data.ts`'s `playAgain`**

Replace the method and its doc comment (currently `five-oh-one-play.data.ts:839-906`) with:

```ts
    /**
     * Replays the same configuration template the first session used, with
     * the current legs-to-win as an override. Delegates to
     * `play-lifecycle.ts`'s shared `runPlayAgain`.
     */
    async playAgain(this: FiveOhOnePlayContext) {
      await runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof FiveOhOneEngine ? engine : null),
        (config) => ({
          snapshot: config,
          wire: { legs_to_win: config.legsToWin },
        }),
        (ctx) => {
          ctx.pendingCheckoutScore = null;
          ctx.showDoubleConfirm = false;
          ctx.showMatchFinishConfirm = false;
          ctx.scoreInput.clear();
        },
      );
    },
```

Add `runPlayAgain` to the `@lib/game/play-lifecycle` import block.

- [ ] **Step 3: Rewrite `one-twenty-one-play.data.ts`'s `playAgain`, delete the now-dead `resetForReplay`**

First confirm `resetForReplay` has exactly one call site: `grep -n "resetForReplay" app/src/lib/game/one-twenty-one-play.data.ts` should show only its own definition (currently lines 234-260) and the one call inside `playAgain` being replaced below.

Replace the method and its doc comment (currently `one-twenty-one-play.data.ts:799-858`) with:

```ts
    /**
     * Replays the same configuration template the first session used,
     * against whichever ruleset version that session actually used —
     * `121_V1` stays on `121_V1`, `121_V2` stays on `121_V2` and its own
     * `duration_type`/`duration_value`. Delegates to `play-lifecycle.ts`'s
     * shared `runPlayAgain`.
     */
    async playAgain(this: OneTwentyOnePlayContext) {
      const rulesetVersionKey = this.$store.game.rulesetVersionKey;
      if (
        !rulesetVersionKey ||
        !canReplay(rulesetVersionKey, this.playAgainLoading)
      ) {
        return;
      }
      await runPlayAgain(
        this,
        GAME_TYPE_KEY,
        rulesetVersionKey,
        (engine) => (engine instanceof OneTwentyOneEngine ? engine : null),
        undefined,
        (ctx) => {
          ctx.$store.game.timerRemainingMs = null;
          ctx.$store.game.timerStartedAt = null;
          ctx.$store.game.timerExpired = false;
          ctx.pendingCheckoutScore = null;
          ctx.pendingDartObservation = null;
          ctx.showDoubleConfirm = false;
          ctx.showSessionFinishConfirm = false;
          ctx.scoreInput.clear();
        },
        (ctx, engine) => {
          const config = ctx.$store.game.configSnapshot;
          if (!config) return;
          const freshTimer = maybeStartFreshCountdown(
            ctx.$store.game,
            config,
            engine,
          );
          if (freshTimer) {
            ctx.timer?.stop();
            ctx.timer = freshTimer;
          }
        },
      );
    },
```

Delete the now-unused `resetForReplay` function and its doc comment (currently `one-twenty-one-play.data.ts:228-260`) — its only caller was the method just replaced, and every assignment it made is now covered either by `runPlayAgain`'s own base reset block or by the `resetLocalState` callback above.

Add `runPlayAgain` to the `@lib/game/play-lifecycle` import block. `canReplay` and `maybeStartFreshCountdown` (both still-used local functions) are unchanged.

- [ ] **Step 4: Rewrite `score-training-play.data.ts`'s `playAgain`**

Replace the method and its doc comment (currently `score-training-play.data.ts:607-687`) with:

```ts
    /**
     * Replays the same configuration template the first session used, with
     * the current duration value as an override. Delegates to
     * `play-lifecycle.ts`'s shared `runPlayAgain`.
     */
    async playAgain(this: ScoreTrainingPlayContext) {
      await runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof ScoreTrainingEngine ? engine : null),
        (config) => ({
          snapshot: config,
          wire: { duration_value: config.durationValue },
        }),
        (ctx) => {
          ctx.$store.game.timerRemainingMs = null;
          ctx.$store.game.timerStartedAt = null;
          ctx.$store.game.timerExpired = false;
          ctx.pendingFinishScore = null;
          ctx.pendingDartObservation = null;
          ctx.showFinishConfirm = false;
          ctx.scoreInput.clear();
        },
        (ctx, engine) => {
          const config = ctx.$store.game.configSnapshot;
          if (config?.durationType === "MINUTES") {
            ctx.timer?.stop();
            ctx.timer = startCountdown(
              ctx.$store.game,
              config.durationValue,
              engine,
            );
          }
        },
      );
    },
```

Add `runPlayAgain` to the `@lib/game/play-lifecycle` import block.

- [ ] **Step 5: Rewrite `tuod-play.data.ts`'s `playAgain`**

Replace the method and its doc comment (currently `tuod-play.data.ts:602-681`) with:

```ts
    /**
     * Replays the same configuration template the first session used, with
     * the current duration value as an override — the same carry-over
     * `score-training-play.data.ts`'s `playAgain()` does. Delegates to
     * `play-lifecycle.ts`'s shared `runPlayAgain`.
     */
    async playAgain(this: TuodPlayContext) {
      await runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof TuodEngine ? engine : null),
        (config) => ({
          snapshot: config,
          wire: { duration_value: config.durationValue },
        }),
        (ctx) => {
          ctx.$store.game.timerRemainingMs = null;
          ctx.$store.game.timerStartedAt = null;
          ctx.$store.game.timerExpired = false;
          ctx.pendingAttempt = null;
          ctx.pendingDartObservation = null;
          ctx.showFinishConfirm = false;
          // TUOD's original playAgain never called scoreInput.clear() here,
          // unlike 501/121/Score Training — preserved exactly, not added.
        },
        (ctx, engine) => {
          const config = ctx.$store.game.configSnapshot;
          if (config?.durationType === "MINUTES") {
            ctx.timer?.stop();
            ctx.timer = startCountdown(
              ctx.$store.game,
              config.durationValue,
              engine,
            );
          }
        },
      );
    },
```

Add `runPlayAgain` to the `@lib/game/play-lifecycle` import block.

- [ ] **Step 6: Type-check**

Run: `cd app && npx astro check --minimumFailingSeverity hint`
Expected: 0 errors/0 warnings/0 hints.

- [ ] **Step 7: Run the full test suite**

Run: `cd app && npm test`
Expected: full suite passes, same pass count as after Task 3.

- [ ] **Step 8: Manual/regression focus on Play Again**

This is the path the finding calls fragile ("hardened days earlier by the Play Again session-participant/config reseating fix"). Re-run each of the 4 rulesets' own `*-play.data.test.ts` Play Again cases individually and read the assertions, not just the pass/fail:

```bash
cd app
npx vitest run tests/lib/game/five-oh-one-play.data.test.ts -t "playAgain"
npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts -t "playAgain"
npx vitest run tests/lib/game/score-training-play.data.test.ts -t "playAgain"
npx vitest run tests/lib/game/tuod-play.data.test.ts -t "playAgain"
```

Confirm each still covers: a solo session replay, a 1v1 (guest or dartbot) session replay reseating participants correctly, and (for 121/Score Training/TUOD) a MINUTES-duration replay restarting the countdown timer. If any of these scenarios has no existing test, that is a pre-existing coverage gap this plan does not need to fill (no behavior changed), but note it rather than silently passing over it.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/play-lifecycle.ts app/src/lib/game/five-oh-one-play.data.ts app/src/lib/game/one-twenty-one-play.data.ts app/src/lib/game/score-training-play.data.ts app/src/lib/game/tuod-play.data.ts
git commit -m "$(cat <<'EOF'
refactor: adopt play-lifecycle's shared runPlayAgain (F27)

Extends runPlayAgain with two optional callbacks — resetLocalState
(ruleset-specific field/timer resets, called right before engine
creation) and afterEngineReady (a fresh countdown timer, called right
after recordFacts) — both backward compatible, the 5 existing callers
pass neither and are unaffected. All 4 target rulesets' playAgain() are
now thin wrappers. 121's now-redundant resetForReplay is deleted.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018AvgBxkfN1d23hgeFi7s2F
EOF
)"
```

---

## Task 5: Final validation, `fallow` re-check, and context maintenance

**Files:**
- Modify: `docs/architecture/00-Context-Map-History.md` (new Version History entry, via `context-maintenance`)
- Modify: `FINDINGS.md` (delete the F27 block)

**Interfaces:**
- Consumes: Tasks 1-4's finished diffs.
- Produces: nothing — terminal task.

- [ ] **Step 1: Re-run `npx fallow` and compare against this plan's own baseline**

Run: `cd app && npx fallow`
Expected: total duplication percentage lower than the 11.4% baseline this plan's own investigation measured before Task 1 (see Global Constraints); 0 clone groups above the configured threshold. Record the before/after percentage for the commit message and Version History entry.

- [ ] **Step 2: Full validation sequence**

Run:
```bash
cd app
npx astro check --minimumFailingSeverity hint
npm test
npx fallow
```
Expected: all three clean (0/0/0 hints; full suite passes; 0 above threshold).

- [ ] **Step 3: Delete the F27 block from FINDINGS.md**

Read the current block first: `grep -n -A6 '^### F27' FINDINGS.md`. Delete the entire `### F27 — ...` heading line through its `Proposed:` line, plus the blank line immediately after it — this closes only the play-data half; the finding's own text already scopes the engine-pair clone as intentionally left standing, so nothing else needs to change for F27 to be fully closed by this plan.

- [ ] **Step 4: Run the findings-log gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0.

- [ ] **Step 5: Invoke the `context-maintenance` skill**

Run the `context-maintenance` skill per root `CLAUDE.md`'s mandatory-every-task rule. It will add a new Version History entry to `docs/architecture/00-Context-Map-History.md` (citing the before/after `npx fallow` percentages from Step 1, the 4 files touched, and F27's closure), confirm no `00-File-Inventory.md` row went stale, and re-run the Findings gate.

- [ ] **Step 6: Commit the context-maintenance output**

```bash
git add -A
git commit -m "$(cat <<'EOF'
docs: context maintenance for play-data-lifecycle-dedup plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018AvgBxkfN1d23hgeFi7s2F
EOF
)"
```

## Testing

- Every task runs `astro check --minimumFailingSeverity hint` (0/0/0) and the full `cd app && npm test` suite, not only Task 5 — per this plan's own Global Constraints, given the finding's fragility warning.
- No new test files are created — this is a pure internal refactor (D224's exemption doesn't apply here since runtime `.ts` files ARE changed, so per D224 each changed file's existing covering test must still pass; extending or adding new test cases is only needed if Step 8 of Task 4 finds a genuine coverage gap, and even then only as a note, not a requirement of this plan).
- Task 4 Step 8 is the plan's own extra scrutiny pass on the highest-risk extraction (`playAgain`), reading assertions rather than only checking pass/fail, focused specifically on the path the finding calls fragile.
- `npx fallow` is run before (already done, during plan-writing: 11.4% baseline) and after (Task 5 Step 1) to confirm real duplication reduction, not just a subjective sense of cleaner code.

## Non-goals

- No change to `score-training.engine.module.ts`/`tuod.engine.module.ts`'s own structural clone — left as-is per the finding's own recommendation (whole-class similarity, not extractable blocks; dissolves on its own if either ruleset's rules diverge).
- No change to `PlayLifecycleContext` itself or the 9 `*PlayContext` types (`app/src/lib/game/types.ts`) — that's F29's separate plan (`docs/superpowers/plans/2026-09-03-playcontext-type-unification.md`), and this plan's own edits do not depend on it landing first or after.
- No change to `statsFor`/`computeStats`/`buildResultsSnapshot` in any of the 4 files — real investigation during plan-writing found these are not actually duplicated in a generic-izable way (each ruleset's result shape genuinely differs); forcing an extraction there would add risk for no real duplication reduction.
- No new ruleset-facing behavior — every existing asymmetry between the 4 rulesets (e.g. TUOD's `playAgain` not calling `scoreInput.clear()`) is preserved exactly, not normalized.
- No change to any of the other 5 rulesets already using `play-lifecycle.ts`'s shared functions (Bob's 27, Singles Training, Doubles Training, Shanghai, Around the Clock) — every signature extension in this plan is additive and optional, so those 5 files need zero edits.
