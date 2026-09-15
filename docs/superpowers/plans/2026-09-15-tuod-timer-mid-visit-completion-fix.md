# TUOD Timer Mid-Visit Completion Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issue #216 — a solo MINUTES (timed) TUOD board-input session can be marked complete and uploaded mid-visit, the instant the countdown expires, before the player has finished throwing their final visit — leaving the session unrecoverable except by abandoning it.

**Architecture:** `TuodEngine.isComplete()` reads `timerExpired && closedAttempts >= 1`, which goes true the moment the timer fires regardless of whether the *currently open* visit has resolved. `tuod-play.data.ts`'s board-dart path (`commitDart`) delegates to the shared `playCommitDart` helper (`play-lifecycle.ts`), which infers completion from a post-record `engine.isComplete()` check — too coarse for TUOD's MINUTES semantics. `score-training-play.data.ts` already solved this exact problem (documented in its own `recordDart` doc comment) by never inferring completion from `isComplete()`: it gates exclusively on the pre-record `wouldComplete()` check, and `confirmFinish` completes the session explicitly. This plan applies the same pattern to TUOD: `commitDart` stops delegating to `playCommitDart` and never calls `isComplete()`; `confirmFinish`'s dart branch completes the session explicitly, mirroring its existing keypad branch.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Vitest.

## Global Constraints

- TDD mandatory: failing test before implementation (`app/CLAUDE.md`).
- Tests live under `app/tests/`, mirroring `app/src/` — never colocated (`app/CLAUDE.md`).
- No `//`/`/* */` comments inside function bodies; doc comments above the declaration only, citing decisions/docs by id/path rather than narrating them (`app/CLAUDE.md`).
- A source edit with no covering test edit is not a completed task (`scripts/check-test-coverage.sh`, D224) — this plan's single task touches both in the same commit.
- `npm run validate:app` must pass with 0 errors/warnings/hints before the task is done (`app/CLAUDE.md`).
- Minimal diff — fix the two methods identified; do not refactor unrelated TUOD code or touch the shared `play-lifecycle.ts` helper (other games still rely on its current behavior and are out of scope).
- Branch: work happens on the current task branch already checked out (`claude/issue-triage-planning-otp0iu`) — no new branch, no worktree.

---

## File Structure

- Modify: `app/src/lib/game/tuod-play.data.ts` — `commitDart()` stops delegating to `playCommitDart`; `confirmFinish()`'s dart branch completes the session explicitly instead of relying on `commitDart`'s (removed) completion inference. Import list: drop `playCommitDart`, add `armHiddenTimer`.
- Modify: `app/tests/lib/game/tuod-play.data.test.ts` — new test in the `"recordDart (board input)"` describe block proving a non-resolving dart thrown after MINUTES timer expiry does not prematurely finish the session.

---

### Task 1: Stop TUOD board-dart completion from being inferred by a stale `isComplete()` read

**Files:**
- Modify: `app/src/lib/game/tuod-play.data.ts:10-22` (imports), `:662-695` (`commitDart`, `confirmFinish`)
- Test: `app/tests/lib/game/tuod-play.data.test.ts`

**Interfaces:**
- Consumes: `TuodPlayContext` (`app/src/lib/game/types.ts`), `armHiddenTimer(context: { hiddenTurnKey: string | null; hiddenTimer?: ReturnType<typeof setTimeout> | null }, turns: readonly TurnFact[]): void` (`@lib/game/play-lifecycle`), `TuodEngine.record(observation: DartObservation): TuodState` and `.facts(): EngineFacts` (`@modules/game/tuod.engine.module`).
- Produces: no new exports — `commitDart`/`confirmFinish` remain private methods on the object `tuodPlay()` returns; their observable behavior (what the test asserts) is the contract.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe("recordDart (board input)", () => { ... })` block in `app/tests/lib/game/tuod-play.data.test.ts` (after the `"cancelFinish discards a pending dart without recording it"` test, before `"computes a VISUAL_BOARD double accuracy..."`). It reuses the file's existing `minutes()`, `gameStub()`, `settingsStub()`, `TREBLE_20`, `SEATS` fixtures, and the `SINGLE_1` fixture pattern already defined in `tuod.engine.module.test.ts:621-626` (add it locally to this test file, next to `DOUBLE_20`/`TREBLE_20`, since it is not currently exported from anywhere):

```typescript
  it("does not finish the session on a non-resolving dart thrown right after the MINUTES timer expires mid-visit", async () => {
    const store = gameStub({ configSnapshot: { ...minutes(15), startingTarget: 40 } });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    // Closes one visit (bust against target 40), so attempts >= 1.
    await component.recordDart.call(component, TREBLE_20);
    expect(store.turns).toHaveLength(1);
    expect(component.finished).toBe(false);

    (segmentTimerInstances[0].options.onComplete as () => void)();
    expect(store.timerExpired).toBe(true);

    // First dart of a fresh visit — does not resolve it (no bust, no checkout).
    await component.recordDart.call(component, SINGLE_1);

    expect(component.finished).toBe(false);
    expect(store.turns).toHaveLength(2);
    expect(store.turns[1].completedAt).toBeNull();
    expect(store.turns[1].darts).toHaveLength(1);
  });
```

Add the `SINGLE_1` fixture next to `DOUBLE_20`/`TREBLE_20` (around line 1233-1241 of `app/tests/lib/game/tuod-play.data.test.ts`):

```typescript
/** S1 — 1, leaves 39 remaining against a 40 target: neither a bust nor a finish. */
const SINGLE_1: DartObservation = {
  hitTargetNumber: 1,
  hitZoneKey: "SINGLE",
  locationX: 15,
  locationY: -46,
};
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts -t "does not finish the session on a non-resolving dart"`

Expected: FAIL — `component.finished` is `true` (the session was ended after the first, non-resolving dart of the fresh visit), because `commitDart` currently infers completion from `context.engine.isComplete()` after recording, and `isComplete()` reads `timerExpired && attempts >= 1` without regard to whether the just-recorded dart resolved the open visit.

- [ ] **Step 3: Fix the imports in `tuod-play.data.ts`**

In `app/src/lib/game/tuod-play.data.ts`, change the `@lib/game/play-lifecycle` import block (currently lines 10-22):

```typescript
import {
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playFoldBotQuickScoreVisit,
  playRunBotVisualBoardVisit,
  playToggleTimerPause,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
```

to:

```typescript
import {
  armHiddenTimer,
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playFoldBotQuickScoreVisit,
  playRunBotVisualBoardVisit,
  playToggleTimerPause,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
```

(`playCommitDart` dropped — no longer used anywhere in this file once Step 4 lands; `armHiddenTimer` added.)

- [ ] **Step 4: Replace `commitDart()`**

In `app/src/lib/game/tuod-play.data.ts`, replace the current `commitDart` method:

```typescript
    async commitDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      await playCommitDart(this, observation);
      await this.maybeRunBotVisit();
    },
```

with:

```typescript
    /**
     * Records one dart and mirrors it into the store — never inferring
     * completion from a post-record `isComplete()` read, unlike the shared
     * `playCommitDart` this used to delegate to. A solo MINUTES session's
     * `isComplete()` can already read true — timer expired, at least one
     * prior visit closed — before the dart just recorded has resolved the
     * CURRENT visit (`TuodEngine.isMatchDecided()`'s own doc comment), and a
     * generic post-record check cannot tell the difference. `recordDart`'s
     * own pre-record `wouldComplete()` gate is the sole completion signal;
     * `confirmFinish` ends the session explicitly for the dart it defers.
     * Mirrors `score-training-play.data.ts`'s own `recordDart`.
     */
    async commitDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      if (!this.engine || this.$store.game.timerPaused) return;
      try {
        this.engine.record(observation);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        return;
      }
      this.error = "";
      const facts = this.engine.facts();
      this.$store.game.recordFacts(facts);
      armHiddenTimer(this, facts.turns);
      await this.maybeRunBotVisit();
    },
```

- [ ] **Step 5: Replace `confirmFinish()`'s dart branch**

In the same file, replace:

```typescript
    async confirmFinish(this: TuodPlayContext): Promise<void> {
      if (!this.engine || this.finished || !this.showFinishConfirm) return;

      if (this.pendingDartObservation) {
        const observation = this.pendingDartObservation;
        this.pendingDartObservation = null;
        this.showFinishConfirm = false;
        await this.commitDart(observation);
        return;
      }
```

with:

```typescript
    async confirmFinish(this: TuodPlayContext): Promise<void> {
      if (!this.engine || this.finished || !this.showFinishConfirm) return;

      if (this.pendingDartObservation) {
        const observation = this.pendingDartObservation;
        this.pendingDartObservation = null;
        this.showFinishConfirm = false;
        this.engine.record(observation);
        this.$store.game.recordFacts(this.engine.facts());
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
        return;
      }
```

(The rest of `confirmFinish` — the `pendingAttempt` keypad branch — is unchanged; it already completes explicitly this same way.)

- [ ] **Step 6: Run the new test and confirm it passes**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts -t "does not finish the session on a non-resolving dart"`

Expected: PASS

- [ ] **Step 7: Run the full TUOD play-data suite**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`

Expected: PASS — all existing tests green, including `"confirmFinish commits a pending dart and completes the session"` (line ~1295) and `"drives a solo MINUTES session to completion once the timer expires mid-session"` (line ~502), proving the explicit completion paths (keypad and dart) still work.

- [ ] **Step 8: Run full validation**

Use the `validate-app` skill's procedure (`npm run validate:app` from `app/`), confirming 0 errors/warnings/hints.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/tuod-play.data.ts app/tests/lib/game/tuod-play.data.test.ts
git commit -m "fix(app): stop TUOD board-dart completion inferring from a stale isComplete() read"
```

---

## Self-Review

- **Spec coverage:** Issue #216's repro (timer expires mid-visit in the board/board-analytics path, session cannot be completed) is directly covered — Task 1's test reproduces the premature-completion defect and the fix removes it. The keypad path (`submitVisit`/`recordAttempt`) was already correct (verified during analysis: it never infers completion from `isComplete()`) and needs no change; existing tests (`"lets the current attempt finish after the timer expires..."`, `"drives a solo MINUTES session to completion..."`) already cover it and continue passing.
- **Placeholder scan:** No TBD/TODO; all code steps show complete, exact code.
- **Type consistency:** `commitDart`, `confirmFinish`, `armHiddenTimer`, `TuodPlayContext` names and signatures match their existing declarations in `tuod-play.data.ts`/`play-lifecycle.ts`/`types.ts` — no renames introduced.

## Out of scope (per CLAUDE.md discovered-work rule — do not fix here)

- `playRunBotVisualBoardVisit`'s own direct call to `playCommitDart` (bot-thrown darts) still infers completion via `isComplete()`. Confirmed safe today only because MINUTES is locked out whenever a bot is seated (`tuod-setup.data.ts` `forceRoundsIfGuested`) — ROUNDS's `isComplete()` has no staleness window. If that invariant ever changes, this becomes exploitable the same way. Not touched by this plan; file as discovered-work if it becomes relevant.
- Other MINUTES-capable engines sharing `playCommitDart` were not audited beyond Score Training (which already opted out) and TUOD. If another engine is found with the same exposure, file it separately rather than expanding this fix.
