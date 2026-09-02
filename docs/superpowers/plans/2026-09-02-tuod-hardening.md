# TUOD Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap TUOD's checkout ladder at a finishable ceiling, close a stale finding whose underlying markup no longer exists, and stop a solo MINUTES session from getting permanently stuck once the timer expires mid-session.

**Architecture:** Task 1 adds a symmetric ceiling to `applyTuodAttempt`'s success branch, mirroring its existing failure-branch floor. Task 2 is a doc-only closure — the finding's own markup was replaced by a prior task. Task 3 gives `TuodEngine` the same `isMatchDecided()` guard `ScoreTrainingEngine` already carries (D229), narrowing which methods throw/refuse on an already-complete session so a solo session's last MINUTES attempt is never blocked.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- Closes `FINDINGS.md` F10, F18, F21.
- No change to `checkout-path.module.ts` / `checkoutPathFor`'s bogey-number behaviour (Task 1 relies on it unchanged).
- No change to `ScoreTrainingEngine` (already correct, used only as the reference pattern for Task 3).
- No change to `tuod-setup.data.ts` / `TuodSetupForm.astro` to expose `finish_bonus`/`duration_value` as editable.
- No change to MINUTES TUOD's solo-only capture restriction (1v1 MINUTES is a separate, deferred problem).

---

### Task 1: Cap the checkout ladder at 170

**Files:**
- Modify: `app/src/modules/game/tuod.engine.module.ts:43` (near `MIN_FINISHABLE_TARGET`), `:148-165` (`applyTuodAttempt`)
- Test: `app/tests/modules/game/tuod.engine.module.test.ts`

**Interfaces:**
- Consumes: `MIN_FINISHABLE_TARGET` (existing module constant, value `2`).
- Produces: `MAX_FINISHABLE_TARGET` (new module constant, value `170`) — not exported, module-private like `MIN_FINISHABLE_TARGET`. `applyTuodAttempt(config: TuodSnapshot, state: TuodSeatState, succeeded: boolean): TuodSeatState` keeps its existing signature.

- [ ] **Step 1: Write the failing test**

In `app/tests/modules/game/tuod.engine.module.test.ts`, find the `describe` block that exercises `applyTuodAttempt` or a ROUNDS-config run of consecutive checkouts (search the file for `applyTuodAttempt` or `finishBonus` to locate the right block), and add:

```ts
  it("caps the ladder at 170, the highest three-dart double-out total, on a run of successes", () => {
    const engine = tuodEngineFactory.create({
      ...config(),
      startingTarget: 168,
      finishBonus: 5,
    });

    const state = engine.record({
      checkedOut: true,
      dartsUsed: 1,
      finishedOnDouble: true,
    });

    expect(state.seats[0].currentTarget).toBe(170);
  });
```

(`config()`, defined at the top of this test file, already sets `finishBonus: 10`/`missPenalty: 1`/`durationType: "ROUNDS"`; this fixture overrides only `startingTarget`/`finishBonus` so an unclamped success would land on `168 + 5 = 173`, strictly above the 170 ceiling.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts -t "caps the ladder at 170"`
Expected: FAIL — `currentTarget` reads `173`, not `170`.

- [ ] **Step 3: Add the ceiling constant**

In `app/src/modules/game/tuod.engine.module.ts`, immediately after the existing `MIN_FINISHABLE_TARGET` declaration (line 43: `const MIN_FINISHABLE_TARGET = 2;`), add:

```ts
/**
 * The ladder ceiling: the highest three-dart double-out total that exists
 * on a standard board (T20 T20 D25). A success climbs the ladder by
 * `finishBonus` with no cap of its own; clamping here keeps it from
 * walking onto a target no double can ever finish. Duplicated from
 * `tuod.validator.ts`'s own `MAX_THREE_DART_CHECKOUT` rather than shared
 * across the services/engine layer boundary — same value, same reasoning,
 * independently arrived at there already.
 */
const MAX_FINISHABLE_TARGET = 170;
```

- [ ] **Step 4: Clamp the success branch**

In `app/src/modules/game/tuod.engine.module.ts`, `applyTuodAttempt` (lines 148-165), replace:

```ts
    currentTarget: succeeded
      ? state.currentTarget + config.finishBonus
      : Math.max(
          MIN_FINISHABLE_TARGET,
          state.currentTarget - config.missPenalty,
        ),
```

with:

```ts
    currentTarget: succeeded
      ? Math.min(MAX_FINISHABLE_TARGET, state.currentTarget + config.finishBonus)
      : Math.max(
          MIN_FINISHABLE_TARGET,
          state.currentTarget - config.missPenalty,
        ),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts -t "caps the ladder at 170"`
Expected: PASS.

- [ ] **Step 6: Run the whole file to check for regressions**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts`
Expected: PASS (all) — a target that lands exactly on 170 or on a bogey below it is unaffected by this change; only the previously-unbounded case (target strictly above 170) changes.

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/game/tuod.engine.module.ts app/tests/modules/game/tuod.engine.module.test.ts
git commit -m "fix(tuod): cap the checkout ladder at 170, the highest finishable target"
```

---

### Task 2: Close FINDINGS.md F18 (already resolved)

**Files:**
- Modify: `FINDINGS.md`

**Interfaces:** none — doc-only.

F18 claimed `TenUpOneDownResults.astro`'s live-stats `<dl>` block showed combined-seat data during the post-match save window. That block no longer exists: commit `21f2a04` ("Result modal consolidation: shared summary components, 1v1 stats data-layer fix, title extraction (#211)") replaced it with `SinglePlayerSummary`/`ComparisonSummary`, whose `pending`/`saving` state renders `StatRowSkeleton` placeholders instead of reading any seat data at all.

- [ ] **Step 1: Confirm the block is gone**

Run: `grep -n "turns.length\|currentTargetLabel" app/src/components/layout/games/result-modals/TenUpOneDownResults.astro`
Expected: no output (or only matches unrelated to a "live" `<dl>` block) — confirms the finding's own concern cannot occur under the current markup before deleting the entry.

- [ ] **Step 2: Delete the F18 block**

In `FINDINGS.md`, delete this entire block (currently lines 70-75, immediately after F9's block and before F20's — exact position may shift if Task 3 of the board-dart-bull-double-checkout plan or another concurrent task has already landed; locate by header text, not line number, if the file has moved):

```markdown
### F18 — TUOD's live-stats banner shows combined-seat data during the post-match save window
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: `TenUpOneDownResults.astro`'s pre-existing "live" `<dl>` block (unfiltered `x-show="completionStatus !== 'succeeded'"`) reads `$store.game.turns.length`/filtered counts and `currentTargetLabel()` as if there is exactly one player throwing
Evidence: `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro` — the live stats block, against `app/src/lib/game/tuod-play.data.ts`'s `currentTargetLabel()`, which now delegates to whichever seat is `activeParticipantRef` (added when TUOD gained 1v1 support in this plan's Task 12)
Impact: during the brief `pending`/`saving` window right after a 1v1 TUOD match finishes, this block shows attempt/success/failure counts summed across BOTH seats' turns, and a "Target reached" value keyed to whichever seat happened to be active last — not the viewer's own seat. Harmless while TUOD was solo-only (one player, one set of turns); now seat-count-dependent and misleading for the one window it's visible
Proposed: scope the live block's `turns`/`currentTargetLabel` reads to the viewer's own seat (or to `state()?.activeParticipantRef`'s seat specifically), mirroring the seat-scoped accessors (`*For(seatRef)`) already added elsewhere in this file's sibling engines during this plan
```

Leave the surrounding blank lines exactly as they were — one blank line between the previous block and the next.

- [ ] **Step 3: Run the findings gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add FINDINGS.md
git commit -m "docs: close F18 — live-stats block it described no longer exists"
```

---

### Task 3: Fix the solo MINUTES stuck-session bug

**Files:**
- Modify: `app/src/modules/game/tuod.engine.module.ts:293-312` (`rejectionReason`), `:374-426` (`recordDart`), `:454-455` (`wouldCompleteDart`)
- Test: `app/tests/modules/game/tuod.engine.module.test.ts`, `app/tests/lib/game/tuod-play.data.test.ts`

**Interfaces:**
- Consumes: `this.deriveState()` (existing private method, returns `TuodState`).
- Produces: `TuodEngine.isMatchDecided(): boolean` (new private method) — `rejectionReason`, `recordDart`, and `wouldCompleteDart` call it instead of `this.isComplete()`. `isComplete(): boolean` (public, line 541) is unchanged — `tuod-play.data.ts` keeps consulting it directly, exactly as today.

- [ ] **Step 1: Write the failing regression test against `TuodEngine` directly**

In `app/tests/modules/game/tuod.engine.module.test.ts`, in the `describe` block covering MINUTES-duration behavior (search the file for `MINUTES` or `expireTimer` to locate it), add:

```ts
  it("accepts a second solo MINUTES attempt recorded after the timer expires mid-session (F21)", () => {
    const engine = tuodEngineFactory.create(minutesConfig()) as TuodEngine;

    engine.record(MISS);
    engine.expireTimer();

    expect(engine.wouldComplete(CHECKOUT)).toBe(true);
    expect(() => engine.record(CHECKOUT)).not.toThrow();
    expect(engine.isComplete()).toBe(true);
  });
```

(`minutesConfig()` and the `CHECKOUT`/`MISS` fixtures are already defined at the top of this test file — `minutesConfig()` is `config()` with `durationType: "MINUTES"`, `CHECKOUT` is `{ checkedOut: true, dartsUsed: 3, finishedOnDouble: true }`, `MISS` is `{ checkedOut: false, dartsUsed: 3 }`.)

- [ ] **Step 2: Write the failing regression test against `tuod-play.data.ts`'s real flow**

In `app/tests/lib/game/tuod-play.data.test.ts`, mirroring `app/tests/lib/game/score-training-play.data.test.ts`'s `it("drives a MINUTES session to completion once the timer expires", ...)` test (same file pattern this task follows for TUOD's own store stub and timer-mock setup), add:

```ts
  it("drives a solo MINUTES session to completion once the timer expires mid-session", async () => {
    const store = gameStub({ configSnapshot: minutes(15) });
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    await component.recordAttempt.call(component, MISS);
    expect(component.showFinishConfirm).toBe(false);
    expect(store.turns).toHaveLength(1);

    (segmentTimerInstances[0].options.onComplete as () => void)();

    await component.recordAttempt.call(component, CHECKOUT);

    expect(component.showFinishConfirm).toBe(true);
    expect(store.turns).toHaveLength(1);

    await component.confirmFinish.call(component);
    expect(component.finished).toBe(true);
  });
```

(`gameStub`, `minutes(...)`, `segmentTimerInstances`, `settingsStub`, `tuodPlay`, `recordAttempt`, and the module-level `CHECKOUT`/`MISS` fixtures are all already defined/imported at the top of this test file — this mirrors `score-training-play.data.test.ts:575-605`'s already-verified MINUTES-completion pattern, substituting TUOD's own `recordAttempt`/`CHECKOUT`/`MISS` for Score Training's `scoreInput.setValue`/`submitVisit`.)

- [ ] **Step 3: Run both new tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts tests/lib/game/tuod-play.data.test.ts -t "F21"`
Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts -t "mid-session"`
Expected: both FAIL — the second attempt throws (engine test) or `component.error` is set and `showFinishConfirm` never becomes `true` (play-data test).

- [ ] **Step 4: Add `isMatchDecided()`**

In `app/src/modules/game/tuod.engine.module.ts`, add this private method to the `TuodEngine` class, placed near `rejectionReason` (before it, so it is declared above its first use):

```ts
  /**
   * Whether the WHOLE (2-seat) session's score-compare outcome is already
   * settled. Deliberately narrower than `isComplete()`, mirroring
   * `ScoreTrainingEngine.isMatchDecided()` (D229): a solo session is exempt
   * here because MINUTES completion there is driven by `timerExpired`, an
   * external signal `expireTimer()` can set mid-attempt — `isComplete()` can
   * already read true before the one finishing attempt still needs to be
   * recorded, so a solo session's own boundary is that attempt-count-based
   * `isComplete()` reading, left to `tuod-play.data.ts` to consult directly,
   * never enforced here. A 1v1 match carries no such risk: it is
   * ROUNDS-only, so `status` only turns terminal as the direct result of
   * the very record call that reaches the last seat's budget.
   */
  private isMatchDecided(): boolean {
    const state = this.deriveState();
    return state.seats.length > 1 && state.status !== "IN_PROGRESS";
  }
```

- [ ] **Step 5: Swap `rejectionReason`'s guard**

In `app/src/modules/game/tuod.engine.module.ts`, line 297, replace:

```ts
    if (this.isComplete()) {
```

with:

```ts
    if (this.isMatchDecided()) {
```

(inside `rejectionReason`, the `if` block immediately following stays unchanged — same error message.)

- [ ] **Step 6: Swap `recordDart`'s guard**

In `app/src/modules/game/tuod.engine.module.ts`, line 375, replace:

```ts
    if (this.isComplete()) {
```

with:

```ts
    if (this.isMatchDecided()) {
```

(inside `recordDart` — confirm this is the only other bare `this.isComplete()` call in the method before replacing; the surrounding throw/error text stays unchanged.)

- [ ] **Step 7: Swap `wouldCompleteDart`'s guard**

In `app/src/modules/game/tuod.engine.module.ts`, line 455, replace:

```ts
    if (this.isComplete()) return false;
```

with:

```ts
    if (this.isMatchDecided()) return false;
```

- [ ] **Step 8: Confirm `wouldComplete`'s non-dart branch needs no edit**

`wouldComplete`'s non-dart (keypad total) branch (near line 513) already defers to `rejectionReason` (`if (this.rejectionReason(activeSeatState, input) !== null) return false;`) rather than calling `isComplete()` directly — fixing `rejectionReason` in Step 5 already fixes this branch. No separate edit needed; this step is a verification-only checkpoint, confirm by reading the method before moving on.

- [ ] **Step 9: Run both new tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts tests/lib/game/tuod-play.data.test.ts -t "F21"`
Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts -t "mid-session"`
Expected: PASS (both).

- [ ] **Step 10: Add a 1v1 no-regression case**

In `app/tests/modules/game/tuod.engine.module.test.ts`, in the existing `describe("TuodEngine — 1v1", ...)` block (starts at line 900, defines a local `twoSeatConfig` with `durationValue: 2`), add this test after `it("stamps every turn's participantRef with a seat present in seats[]", ...)`:

```ts
  it("still blocks record() after a 1v1 match's outcome is settled (no regression on the multi-seat guard)", () => {
    const engine = new TuodEngine(twoSeatConfig);
    engine.record({ checkedOut: false }); // p1 round 1: fail
    engine.record({ checkedOut: false }); // p2 round 1: fail
    engine.record({ checkedOut: false }); // p1 round 2: fail
    engine.record({ checkedOut: true, finishedOnDouble: true }); // p2 round 2: success, ends the match

    expect(engine.isComplete()).toBe(true);
    expect(() =>
      engine.record({ checkedOut: false }),
    ).toThrow();
  });
```

(Reuses this describe block's own `twoSeatConfig`/`TuodEngine` import — same fixture already exercised by its sibling tests. Intent: with `isMatchDecided()` in place, a genuinely decided 1v1 match must still refuse a further `record()` call, exactly as before this task.)

- [ ] **Step 11: Run the whole file to check for regressions**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts tests/lib/game/tuod-play.data.test.ts`
Expected: PASS (all).

- [ ] **Step 12: Commit**

```bash
git add app/src/modules/game/tuod.engine.module.ts app/tests/modules/game/tuod.engine.module.test.ts app/tests/lib/game/tuod-play.data.test.ts
git commit -m "fix(tuod): give solo MINUTES sessions the same isMatchDecided() guard as Score Training (F21)"
```

---

### Task 4: Close FINDINGS.md F10 and F21, run the full gate suite

**Files:**
- Modify: `FINDINGS.md`

- [ ] **Step 1: Delete the F10 block**

In `FINDINGS.md`, delete the entire `### F10 — TUOD's ladder can climb onto a target no double can finish` block (its current text is reproduced in the spec this plan implements, `docs/superpowers/specs/2026-09-02-tuod-hardening-design.md`; locate it by header, not line number, since Task 2/3's edits shift line numbers). Leave one blank line between the surrounding blocks.

- [ ] **Step 2: Delete the F21 block**

In `FINDINGS.md`, delete the entire `### F21 — A solo MINUTES TUOD session with two-or-more attempts can get permanently stuck once the timer expires mid-session` block, same way. Leave one blank line between the surrounding blocks.

- [ ] **Step 3: Run the findings gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0 (F10, F21, F18 all gone; `highest-issued` unchanged).

- [ ] **Step 4: Run the full `run-all-gates` suite**

Invoke the `run-all-gates` skill's "Always run" set plus the "If `app/` changed" set. State each script's result explicitly in the completion report.

- [ ] **Step 5: Format and commit**

```bash
cd app && npm run format && npm run format:check
cd ..
git add FINDINGS.md
git commit -m "docs: close F10, F21 — ladder capped, solo MINUTES timer-expiry bug fixed"
```

## Testing

- Task 1: one new Vitest case in `tuod.engine.module.test.ts` proving the ladder never exceeds 170 on an all-success run.
- Task 2: doc-only; verified by grep confirming the finding's own markup no longer exists, then the findings gate.
- Task 3: two regression cases (direct engine unit test, and the real `tuod-play.data.ts` flow) proving a solo MINUTES session survives a second attempt after timer expiry, plus a 1v1 no-regression case proving the narrower guard still blocks a decided match.
- Task 4: doc-only; verified by the findings gate and the full `run-all-gates` suite.

## Non-goals

No change to `checkout-path.module.ts` or `checkoutPathFor`'s bogey-number behaviour. No change to `ScoreTrainingEngine`. No change to `tuod-setup.data.ts`/`TuodSetupForm.astro` to expose `finish_bonus`/`duration_value` as editable. No change to MINUTES TUOD's solo-only capture restriction.
