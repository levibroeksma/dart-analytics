# 501 Match Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework 501's end-of-match summary modal to show individual, per-player stats (legs won, 3-dart average, checkout %, and 60+/100+/120+/140+/180 score-band tallies) for both solo and 1v1 sessions, with a clear winner statement — replacing today's single combined `Total`/`Legs`/`Average` block.

**Architecture:** Extend two existing shared helpers (`visitScoreBandCounts` for a fifth band, `checkout-bust.module.ts` for a new attempt-counting function), add a per-seat `statsFor` in `five-oh-one-play.data.ts` replacing the current match-wide `computeStats`/`ownerRef`, reshape the result type, and reshape the modal template to the same solo-column-vs-1v1-comparison-rows pattern `ScoreTrainingResults.astro`/`ShanghaiResults.astro` already ship. No engine change — everything is derived from `turns`/`state()` at snapshot time, exactly as today's `computeStats` already is.

**Tech Stack:** TypeScript (`.data.ts`/`.module.ts`/`types.ts`), Vitest, Astro `.astro` + Alpine.js for the modal template.

## Global Constraints

- Checkout % and legs-won appear in **both** the solo and 1v1 summaries — full stat set in both, solo renders one column.
- The 60+ band extends the **shared** `visitScoreBandCounts` helper (Pattern 21) — not a 501-local function. Score Training's and Shanghai's existing callers are unaffected (they don't render the new field).
- Winner banner text is exactly **"\<name\> wins the match!"** (no leg count restated). 501 has no TIE outcome — do not add a TIE branch.
- Checkout % is computed **only for VISUAL_BOARD sessions**; QUICK_SCORE sessions get `checkoutPercentage: null`, rendered as "—" in the modal. This is a hard data-availability limit (`05-Database/06-Spec/04-Runtime-Layer.md`), not a display simplification — do not attempt to approximate it for QUICK_SCORE.
- `made = legsWon`, `attempted = legsWon + checkoutAttemptCount(seatTurns)` — do not compute checkout attempts any other way (see Task 2's docstring for why this is exact, not an approximation, for this engine).
- `app/src/**/*.ts` function bodies get no inline `//`/`/* */` comments — JSDoc above the declaration only (`app/CLAUDE.md`).
- Every changed `app/src/**/*.ts` file needs a covering test touch or `scripts/check-test-coverage.sh` fails (D224).
- Existing `resultsSnapshot` test assertions are **widened** to the new shape, never re-pointed to a different input just to keep passing (root `CLAUDE.md`'s test-integrity invariant).
- `npm run format` + clean `npm run format:check` before any commit touching `app/` markup/TS.
- Decisions are append-only (`decisions/**`) — Task 6 appends a new `D242` block; it never edits D238's or D240's existing text.
- No git worktrees — check out the task branch directly in the main working copy.

---

## File Structure

| File | Responsibility |
| ---- | --------------- |
| `app/src/lib/game/play-visit-stats.ts` | Gains `sixtyPlus` in `visitScoreBandCounts`'s return shape (Task 1) |
| `app/src/modules/game/checkout-bust.module.ts` | Gains `checkoutAttemptCount(turns)` (Task 2) |
| `app/src/lib/game/types.ts` | New `FiveOhOneSeatResult`/`FiveOhOneResultsSnapshot`; `FiveOhOnePlayContext.resultsSnapshot` retyped (Task 3) |
| `app/src/lib/game/five-oh-one-play.data.ts` | `computeStats`/`ownerRef` replaced by per-seat `statsFor`; `uploadAndCompleteSession` rewired (Task 4) |
| `app/src/components/layout/games/result-modals/FiveOhOneResults.astro` | Modal reshaped to solo-column/1v1-comparison-rows (Task 5) |
| `decisions/game-engine.md`, `docs/architecture/04-Architecture-patterns.md`, `docs/architecture/00-File-Inventory.md` | Doc/decision maintenance (Task 6) |

Setup:

- [ ] **Step 0: Create the task branch**

```bash
git checkout -b claude/issue-167-match-summary
```

---

### Task 1: `visitScoreBandCounts` gains a `sixtyPlus` band

**Files:**
- Modify: `app/src/lib/game/play-visit-stats.ts` (the `visitScoreBandCounts` function, currently near the end of the file)
- Test: `app/tests/lib/game/play-visit-stats.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `visitScoreBandCounts(turns: VisitLike[]): { sixtyPlus: number; hundredPlus: number; oneTwentyPlus: number; oneFortyPlus: number; oneEighties: number }` — the same function, one new field, same exclusive-band rule (D238/Pattern 21).

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/play-visit-stats.test.ts`, inside the existing
`describe("visitScoreBandCounts", ...)` block, update the two blanket
`toEqual` calls that currently omit `sixtyPlus` and add two new cases.
The block's existing `done(totalScore)` helper (defined near the top of
the file) is reused as-is.

Replace the first two `it` blocks in that `describe`:

```typescript
  it("returns all-zero counts for no completed visits", () => {
    expect(visitScoreBandCounts([])).toEqual({
      sixtyPlus: 0,
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });

  it("does not count a visit below 60 in any band", () => {
    expect(visitScoreBandCounts([done(59)])).toEqual({
      sixtyPlus: 0,
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });

  it("counts a 60-99 visit as sixtyPlus only", () => {
    expect(visitScoreBandCounts([done(65)])).toEqual({
      sixtyPlus: 1,
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });
```

Then update every remaining `toEqual({ hundredPlus: ..., ... })` object in
that `describe` block to add `sixtyPlus: 0` as the first key (the existing
`"counts a visit in exactly its own band"` / `"tallies one visit into each
of the four bands"` / `"a 180 counts only as oneEighties"` / `"ignores an
open visit"` cases) — e.g. the 125-visit case becomes:

```typescript
  it("counts a visit in exactly its own band, not any lower one — the exclusive-band case (D238)", () => {
    expect(visitScoreBandCounts([done(125)])).toEqual({
      sixtyPlus: 0,
      hundredPlus: 0,
      oneTwentyPlus: 1,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });
```

and add one more case confirming the new band doesn't leak into a
higher-scoring visit's tally:

```typescript
  it("a 100+ visit does not also increment sixtyPlus — the exclusive-band case extended", () => {
    expect(visitScoreBandCounts([done(105)])).toEqual({
      sixtyPlus: 0,
      hundredPlus: 1,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts -t visitScoreBandCounts
```

Expected: FAIL — every `toEqual` mismatches because the real function's
return object has no `sixtyPlus` key yet.

- [ ] **Step 3: Implement the `sixtyPlus` band**

In `app/src/lib/game/play-visit-stats.ts`, replace the whole
`visitScoreBandCounts` function:

```typescript
/**
 * Tallies completed visits into exactly one of five score bands —
 * whichever is the *highest* threshold that visit's total meets, never
 * more than one (D238/D242, Pattern 21). A 125 counts only as
 * `oneTwentyPlus`, not also `sixtyPlus`/`hundredPlus`; a 65 counts only
 * as `sixtyPlus`.
 */
export function visitScoreBandCounts(turns: VisitLike[]): {
  sixtyPlus: number;
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
} {
  const counts = {
    sixtyPlus: 0,
    hundredPlus: 0,
    oneTwentyPlus: 0,
    oneFortyPlus: 0,
    oneEighties: 0,
  };
  for (const turn of completedVisits(turns)) {
    const score = turn.totalScore;
    if (score === 180) counts.oneEighties += 1;
    else if (score >= 140) counts.oneFortyPlus += 1;
    else if (score >= 120) counts.oneTwentyPlus += 1;
    else if (score >= 100) counts.hundredPlus += 1;
    else if (score >= 60) counts.sixtyPlus += 1;
  }
  return counts;
}
```

(The pre-existing `score === 180` equality check, rather than `>= 180`, is
left exactly as-is — that's a separate, already-logged, inert issue
(`FINDINGS.md` F34) this task does not touch.)

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts
```

Expected: PASS — every test in the file, not just `visitScoreBandCounts`
(confirms the `done()` helper and other describes weren't disturbed).

- [ ] **Step 5: Confirm existing callers still typecheck**

```bash
cd app && npx astro check
```

Expected: 0 errors, 0 warnings, 0 hints — `score-training-play.data.ts`'s
`...visitScoreBandCounts(seatTurns)` spread picks up the new field
automatically since it's additive to an object spread, not a positional
destructure.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/play-visit-stats.ts app/tests/lib/game/play-visit-stats.test.ts
git commit -m "Add sixtyPlus band to visitScoreBandCounts (D242)"
```

---

### Task 2: `checkoutAttemptCount` in `checkout-bust.module.ts`

**Files:**
- Modify: `app/src/modules/game/checkout-bust.module.ts`
- Test: `app/tests/modules/game/checkout-bust.module.test.ts`

**Interfaces:**
- Consumes: `TurnFact` (from `@modules/types` — already has `totalScore:
  number` and `darts: DartFact[]`, each `DartFact.score: number`).
- Produces: `checkoutAttemptCount(turns: readonly TurnFact[]): number`.

This function counts completed visits that busted while carrying real
board activity — provably, by `resolveCheckoutAttempt`'s own rule (already
in this file), exactly the visits where a checkout was attempted and
failed: a bust can only ever be triggered by a visit whose own darts
summed to something (`remainingAfter < 0`, `=== 1`, or `=== 0` all require
`thrown > 0`), so a visit that scored zero for unrelated reasons (three
misses) can never be flagged `busted`.

- [ ] **Step 1: Write the failing tests**

In `app/tests/modules/game/checkout-bust.module.test.ts`, add this import
and a new `describe` block below the existing `resolveCheckoutAttempt`
one:

```typescript
import { checkoutAttemptCount, resolveCheckoutAttempt } from "@modules/game/checkout-bust.module";
import type { TurnFact } from "@modules/types";
```

(replace the existing single-symbol import line with the combined one
above).

```typescript
function turn(totalScore: number, dartScores: number[]): TurnFact {
  return {
    clientKey: "t1",
    stageClientKey: "leg-1",
    participantRef: "participant-1",
    sequence: 1,
    completedAt: "2026-08-28T00:00:00.000Z",
    totalScore,
    darts: dartScores.map((score, i) => ({
      sequence: i + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: null,
      hitZoneKey: score > 0 ? "TREBLE" : "MISS",
      score,
      locationX: null,
      locationY: null,
    })),
  };
}

describe("checkoutAttemptCount", () => {
  it("returns 0 for an empty log", () => {
    expect(checkoutAttemptCount([])).toBe(0);
  });

  it("counts a busted visit whose darts summed to more than zero", () => {
    const turns = [turn(0, [60, 40, 5])];
    expect(checkoutAttemptCount(turns)).toBe(1);
  });

  it("does not count a genuine zero-score visit (darts thrown, none scored)", () => {
    const turns = [turn(0, [0, 0, 0])];
    expect(checkoutAttemptCount(turns)).toBe(0);
  });

  it("does not count a visit that scored normally (not a bust)", () => {
    const turns = [turn(60, [20, 20, 20])];
    expect(checkoutAttemptCount(turns)).toBe(0);
  });

  it("does not count an open (uncompleted) visit", () => {
    const open: TurnFact = { ...turn(0, [60]), completedAt: null };
    expect(checkoutAttemptCount([open])).toBe(0);
  });

  it("sums busted checkout attempts across several visits", () => {
    const turns = [turn(0, [60]), turn(45, [45]), turn(0, [80, 20])];
    expect(checkoutAttemptCount(turns)).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd app && npx vitest run tests/modules/game/checkout-bust.module.test.ts -t checkoutAttemptCount
```

Expected: FAIL — `checkoutAttemptCount is not a function` (also a
TypeScript error on the import until Step 3 adds the export).

- [ ] **Step 3: Implement `checkoutAttemptCount`**

In `app/src/modules/game/checkout-bust.module.ts`, add this import at the
top and this function at the bottom of the file:

```typescript
import type { TurnFact } from "./types";
```

```typescript
/**
 * How many of these turns were failed checkout attempts — completed
 * visits whose `totalScore` was zeroed by a bust, but whose own darts
 * summed to more than zero. `resolveCheckoutAttempt`'s own rule means a
 * bust can only ever be triggered by a visit that threw something
 * (`remainingAfter < 0`, `=== 1`, or `=== 0` all require `scored > 0`), so
 * this can never mistake a genuine zero-score visit (three misses, which
 * never moves `remainingAfter` at all) for a failed checkout. Only
 * meaningful for VISUAL_BOARD sessions — a QUICK_SCORE turn's `darts` is
 * always `[]`, so every QUICK_SCORE bust reads as 0 here; callers must
 * gate display on the session's own `inputModeKey`.
 */
export function checkoutAttemptCount(turns: readonly TurnFact[]): number {
  return turns.filter(
    (turn) =>
      turn.completedAt !== null &&
      turn.totalScore === 0 &&
      turn.darts.reduce((sum, dart) => sum + dart.score, 0) > 0,
  ).length;
}
```

Check the top of `checkout-bust.module.ts` first to confirm whether
`TurnFact` is already imported there under a different path (it currently
imports nothing beyond what `resolveCheckoutAttempt` needs, which is
untyped primitives) — if `./types` is not the correct relative path from
this file to `app/src/modules/game/types.ts`, use the same relative import
style already used by sibling files in this directory (e.g.
`five-oh-one.engine.module.ts` imports `TurnFact` via `"./types"` — confirm
by checking that file's import block before assuming).

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd app && npx vitest run tests/modules/game/checkout-bust.module.test.ts
```

Expected: PASS — both `resolveCheckoutAttempt`'s existing 6 tests and
`checkoutAttemptCount`'s new 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/checkout-bust.module.ts app/tests/modules/game/checkout-bust.module.test.ts
git commit -m "Add checkoutAttemptCount to checkout-bust.module (D242)"
```

---

### Task 3: `FiveOhOneSeatResult`/`FiveOhOneResultsSnapshot` types

**Files:**
- Modify: `app/src/lib/game/types.ts`

**Interfaces:**
- Consumes: nothing new (pure type declarations).
- Produces:
  ```typescript
  export type FiveOhOneSeatResult = {
    participantRef: string;
    sideKey: string;
    legsWon: number;
    threeDartAverage: string;
    checkoutPercentage: string | null;
    sixtyPlus: number;
    hundredPlus: number;
    oneTwentyPlus: number;
    oneFortyPlus: number;
    oneEighties: number;
  };

  export type FiveOhOneResultsSnapshot = {
    winningSideKey: string | null;
    seats: FiveOhOneSeatResult[];
  };
  ```
  and `FiveOhOnePlayContext.resultsSnapshot: FiveOhOneResultsSnapshot | null`
  (replacing the current flat `{ total: number; legs: number; average:
  number } | null`).

This task has no test of its own — it's a pure type change, exercised by
Task 4's test reshape and enforced by `astro check` (Step 3 below). Do not
skip Task 4 after this task; an unused/unwired type is incomplete work,
not a stopping point.

- [ ] **Step 1: Add the two new types**

In `app/src/lib/game/types.ts`, find `export type FiveOhOnePlayContext = {`
(search for it — it's the type block that already declares
`resultsSnapshot: { total: number; legs: number; average: number } | null;`).
Immediately above that type declaration, add:

```typescript
/** One seat's own results stats, replayed from its own completed visits in
 * `turns`. `legsWon` comes from `state().sides`, never counted from
 * `turns` directly — a stage exists per leg *played*, not per leg *won*.
 * `checkoutPercentage` is `null` for a QUICK_SCORE session (checkout %
 * cannot be computed without per-dart data,
 * `05-Database/06-Spec/04-Runtime-Layer.md`); for VISUAL_BOARD it is
 * `legsWon` over `legsWon + checkoutAttemptCount(seatTurns)`, formatted by
 * `accuracyDisplay` (Pattern 20). Score-band counts are exclusive
 * (D238/D242, Pattern 21) — a visit increments exactly one of
 * `sixtyPlus`/`hundredPlus`/`oneTwentyPlus`/`oneFortyPlus`/`oneEighties`,
 * never more than one. */
export type FiveOhOneSeatResult = {
  participantRef: string;
  sideKey: string;
  legsWon: number;
  threeDartAverage: string;
  checkoutPercentage: string | null;
  sixtyPlus: number;
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
};

/** `winningSideKey` is `null` for a solo session — 501 has no tie outcome
 * (double-out racing to a fixed leg count always decides a winner), unlike
 * Score Training's fixed-rounds format. `seats` has one entry per
 * configured seat (1 for solo, 2 for 1v1), in `$store.game.seats` order. */
export type FiveOhOneResultsSnapshot = {
  winningSideKey: string | null;
  seats: FiveOhOneSeatResult[];
};
```

- [ ] **Step 2: Retype `resultsSnapshot` on `FiveOhOnePlayContext`**

In the same file, inside `FiveOhOnePlayContext`, change:

```typescript
  resultsSnapshot: { total: number; legs: number; average: number } | null;
```

to:

```typescript
  resultsSnapshot: FiveOhOneResultsSnapshot | null;
```

- [ ] **Step 3: Confirm the typecheck fails where expected**

```bash
cd app && npx astro check
```

Expected: errors in `five-oh-one-play.data.ts` (the `resultsSnapshot: null
as { total: ...} | null,` initializer and the `computeStats` call in
`uploadAndCompleteSession` no longer match the new type) and possibly
`FiveOhOneResults.astro` (reads `resultsSnapshot?.total`/`.legs`/`.average`
that no longer exist). This is expected — Task 4 and Task 5 fix these.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/game/types.ts
git commit -m "Add FiveOhOneSeatResult/FiveOhOneResultsSnapshot types"
```

(Committing a state that fails `astro check` is acceptable here only
because Tasks 4-5 land immediately after in the same session before any
push/PR — do not stop the branch at this commit.)

---

### Task 4: Per-seat `statsFor` in `five-oh-one-play.data.ts`

**Files:**
- Modify: `app/src/lib/game/five-oh-one-play.data.ts`
- Test: `app/tests/lib/game/five-oh-one-play.data.test.ts`

**Interfaces:**
- Consumes: `FiveOhOneSeatResult`/`FiveOhOneResultsSnapshot` (Task 3),
  `visitScoreBandCounts`/`accuracyDisplay` (from `@lib/game/play-visit-stats`
  — `accuracyDisplay` already exists; `visitScoreBandCounts` gained
  `sixtyPlus` in Task 1), `checkoutAttemptCount` (Task 2, from
  `@modules/game/checkout-bust.module`).
- Produces: `this.resultsSnapshot: FiveOhOneResultsSnapshot | null` on the
  running `fiveOhOnePlay()` instance, populated by
  `uploadAndCompleteSession()`.

- [ ] **Step 1: Read the current file's relevant sections first**

Open `app/src/lib/game/five-oh-one-play.data.ts` and locate:
1. The import block (top of file) — you'll add two new named imports.
2. `ownerRef(seats)` and `computeStats(turns, legsWon)` — two plain
   functions above `export function fiveOhOnePlay()` — both are deleted
   in Step 3.
3. `resultsSnapshot: null as { total: number; legs: number; average:
   number } | null,` inside the returned object literal — retyped in Step
   4.
4. The end of `uploadAndCompleteSession(this: FiveOhOnePlayContext)`,
   specifically the `const owner = ownerRef(...)` / `this.resultsSnapshot
   = computeStats(...)` block — replaced in Step 5.

- [ ] **Step 2: Write the failing tests (reshape existing + add new)**

In `app/tests/lib/game/five-oh-one-play.data.test.ts`, find every existing
assertion shaped like `resultsSnapshot: { total: ..., legs: ..., average:
... }` (or checking `.total`/`.legs`/`.average` individually) inside tests
that drive a session to completion. Reshape each to the new
`{ winningSideKey, seats: [...] }` shape — this widens the same test
subject (a completed session's results snapshot), it does not re-point the
test at different input. For a solo QUICK_SCORE session that wins after
one leg with all-60 visits (adjust the exact totals to whatever that
existing test's fixture actually plays out — read the test first), the
reshaped assertion looks like:

```typescript
expect(play.resultsSnapshot).toEqual({
  winningSideKey: null,
  seats: [
    {
      participantRef: "participant-1",
      sideKey: "A",
      legsWon: 1,
      threeDartAverage: "60.0",
      checkoutPercentage: null,
      sixtyPlus: /* however many of that fixture's visits landed 60-99 */ 0,
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    },
  ],
});
```

(Fill in the exact band counts by reading what that specific test's fixture
actually throws — do not guess; the point is the shape, not a specific
number invented here.)

Then add three new test cases, placed near the reshaped ones. All three
rely on `seat-rota.module.ts`'s alternation rule (seat 0 throws first in
leg 1, then strictly alternates every visit regardless of bust/win) and
`checkoutPathFor`'s rule that 20 is a legal one-dart double-out finish
(D10):

```typescript
it("computes independent per-seat stats for a 1v1 QUICK_SCORE match", async () => {
  registerEngineFactory("501_V1", fiveOhOneEngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([]);
  vi.mocked(appendBatch).mockResolvedValue(undefined as never);
  vi.mocked(completeSession).mockResolvedValue(undefined as never);

  const play = makePlay({
    configSnapshot: { ...quickPlayConfig(), legsToWin: 1, seats: TWO_SEATS },
    inputModeKey: "QUICK_SCORE",
  });
  await play.init();

  // Turn 0 (participant-1, remaining 501 -> 380)
  play.scoreInput.setValue("121");
  await play.submitVisit();
  // Turn 1 (participant-2, remaining 501 -> 401)
  play.scoreInput.setValue("100");
  await play.submitVisit();
  // Turn 2 (participant-1, remaining 380 -> 200)
  play.scoreInput.setValue("180");
  await play.submitVisit();
  // Turn 3 (participant-2, remaining 401 -> 301)
  play.scoreInput.setValue("100");
  await play.submitVisit();
  // Turn 4 (participant-1, remaining 200 -> 20)
  play.scoreInput.setValue("180");
  await play.submitVisit();
  // Turn 5 (participant-2, remaining 301 -> 201)
  play.scoreInput.setValue("100");
  await play.submitVisit();
  // Turn 6 (participant-1, remaining 20 -> 0 on D10): opens the
  // double-out confirm, then the match-finish confirm (this is the only
  // leg, legsToWin: 1, so checking it out wins the whole match).
  play.scoreInput.setValue("20");
  await play.submitVisit();
  expect(play.showDoubleConfirm).toBe(true);
  await play.confirmDouble();
  expect(play.showMatchFinishConfirm).toBe(true);
  await play.confirmMatchFinish();

  expect(play.resultsSnapshot?.winningSideKey).toBe("A");
  expect(play.resultsSnapshot?.seats).toHaveLength(2);
  const [seatA, seatB] = play.resultsSnapshot!.seats;
  expect(seatA.participantRef).toBe("participant-1");
  expect(seatA.legsWon).toBe(1);
  expect(seatB.participantRef).toBe("participant-2");
  expect(seatB.legsWon).toBe(0);
  expect(seatA.checkoutPercentage).toBeNull();
  expect(seatB.checkoutPercentage).toBeNull();
});

it("computes a VISUAL_BOARD checkout percentage from a busted attempt and two won legs", async () => {
  registerEngineFactory("501_V1", fiveOhOneEngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([]);
  vi.mocked(appendBatch).mockResolvedValue(undefined as never);
  vi.mocked(completeSession).mockResolvedValue(undefined as never);

  const play = makePlay({
    configSnapshot: {
      ...quickPlayConfig(),
      startingScore: 40,
      legsToWin: 2,
    },
    inputModeKey: "VISUAL_BOARD",
  });
  await play.init();

  // Leg 1, visit 1: a single TREBLE_20 (60) overshoots 40 by 20 -> busts
  // immediately (remainingAfter -20). This is the one failed checkout
  // attempt: darts summed to 60 (> 0) but totalScore records 0.
  await play.recordDart(TREBLE_20);
  // Leg 1, visit 2: a single DOUBLE_20 (40) zeroes the remaining 40
  // exactly on a double -> checks out, wins leg 1. Does not complete the
  // whole match (legsToWin: 2), so this commits immediately with no
  // confirm dialog.
  await play.recordDart(DOUBLE_20);
  // Leg 2 opens fresh at remaining 40 (same startingScore every leg).
  // A DOUBLE_20 here would win the whole match, so recordDart defers to
  // the match-finish confirm instead of committing immediately.
  await play.recordDart(DOUBLE_20);
  expect(play.showMatchFinishConfirm).toBe(true);
  await play.confirmMatchFinish();

  const [seatA] = play.resultsSnapshot!.seats;
  expect(seatA.legsWon).toBe(2);
  // made = legsWon = 2, attempted = 2 + checkoutAttemptCount (1 bust) = 3
  expect(seatA.checkoutPercentage).toBe("66.67%");
});

it("returns the single-seat shape for a solo session", async () => {
  registerEngineFactory("501_V1", fiveOhOneEngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([]);
  vi.mocked(appendBatch).mockResolvedValue(undefined as never);
  vi.mocked(completeSession).mockResolvedValue(undefined as never);

  const play = makePlay({
    configSnapshot: { ...quickPlayConfig(), startingScore: 20, legsToWin: 1 },
  });
  await play.init();

  // remaining 20 -> 0 on D10 in one visit, wins the only leg and the match.
  play.scoreInput.setValue("20");
  await play.submitVisit();
  await play.confirmDouble();
  await play.confirmMatchFinish();

  expect(play.resultsSnapshot?.winningSideKey).toBeNull();
  expect(play.resultsSnapshot?.seats).toHaveLength(1);
  expect(play.resultsSnapshot?.seats[0].legsWon).toBe(1);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts
```

Expected: FAIL — `resultsSnapshot` still has the old flat shape and
`checkoutPercentage` doesn't exist on it yet.

- [ ] **Step 4: Delete `ownerRef`/`computeStats`, add `statsFor`, add imports**

Delete the `ownerRef` and `computeStats` functions entirely (the whole
blocks, including their doc comments).

Add these two imports to the existing `@lib/game/play-visit-stats` import
line (currently importing `dartsThrownCount`, `previousScoreDisplay`,
`threeDartAverageDisplay`):

```typescript
import {
  accuracyDisplay,
  dartsThrownCount,
  previousScoreDisplay,
  threeDartAverageDisplay,
  visitScoreBandCounts,
} from "@lib/game/play-visit-stats";
```

Add this new import:

```typescript
import { checkoutAttemptCount } from "@modules/game/checkout-bust.module";
```

Add `statsFor` where `computeStats` used to be:

```typescript
/**
 * One seat's own results stats, replayed from its own completed visits in
 * `turns`. `legsWon` is read off `state().sides` by the caller — never
 * counted from `turns` directly (a stage exists per leg *played*, not per
 * leg *won*). `checkoutPercentage` is `null` outside VISUAL_BOARD capture.
 */
function statsFor(
  seat: SeatFact,
  turns: readonly TurnFact[],
  legsWon: number,
  maxDartsPerTurn: number,
  inputModeKey: string | null,
): FiveOhOneSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    legsWon,
    threeDartAverage: threeDartAverageDisplay(seatTurns, maxDartsPerTurn),
    checkoutPercentage:
      inputModeKey === "VISUAL_BOARD"
        ? accuracyDisplay(legsWon, legsWon + checkoutAttemptCount(seatTurns))
        : null,
    ...visitScoreBandCounts(seatTurns),
  };
}
```

Add `FiveOhOneSeatResult` (and confirm `FiveOhOneResultsSnapshot`) to the
existing `import type { ... } from "@lib/types";` line at the top of the
file — check that line's current contents first and extend it rather than
adding a second `@lib/types` import.

- [ ] **Step 5: Retype `resultsSnapshot`'s initializer**

Change:

```typescript
    resultsSnapshot: null as {
      total: number;
      legs: number;
      average: number;
    } | null,
```

to:

```typescript
    resultsSnapshot: null as FiveOhOneResultsSnapshot | null,
```

- [ ] **Step 6: Rewire `uploadAndCompleteSession`**

Replace this block at the end of `uploadAndCompleteSession`:

```typescript
      const owner = ownerRef(this.$store.game.seats);
      this.resultsSnapshot = computeStats(
        owner === null
          ? this.$store.game.turns
          : this.$store.game.turns.filter(
              (turn) => turn.participantRef === owner,
            ),
        this.$store.game.configSnapshot!.legsToWin,
      );
      this.completionStatus = "succeeded";
```

with:

```typescript
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      const inputModeKey = this.$store.game.inputModeKey;
      this.resultsSnapshot = {
        winningSideKey: this.state()?.winningSideKey ?? null,
        seats: this.$store.game.seats.map((seat) =>
          statsFor(
            seat,
            this.$store.game.turns,
            this.legsWonFor(seat.participantRef),
            maxDartsPerTurn,
            inputModeKey,
          ),
        ),
      };
      this.completionStatus = "succeeded";
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts
```

Expected: PASS — every reshaped and new test.

- [ ] **Step 8: Run the typecheck**

```bash
cd app && npx astro check
```

Expected: 0 errors, 0 warnings, 0 hints in `five-oh-one-play.data.ts` and
`types.ts` (`FiveOhOneResults.astro` will still fail until Task 5 — that's
expected here, same as Task 3's Step 3).

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/five-oh-one-play.data.ts app/tests/lib/game/five-oh-one-play.data.test.ts
git commit -m "Replace 501's computeStats/ownerRef with per-seat statsFor"
```

---

### Task 5: Reshape `FiveOhOneResults.astro`

**Files:**
- Modify: `app/src/components/layout/games/result-modals/FiveOhOneResults.astro`

**Interfaces:**
- Consumes: `resultsSnapshot: FiveOhOneResultsSnapshot | null` (Task 4),
  `$store.game.seats[].{sideKey, displayName}` (already on the store).
- Produces: nothing new — this is the leaf template.

No test — D101 exempts `.astro` markup/branching logic (no Astro component
test runner exists in this project); Task 4's tests already cover every
value this template reads.

- [ ] **Step 1: Replace the two existing `<dl>` blocks**

`FiveOhOneResults.astro` currently has a `<h2>` reading "Match Summary"
(static) and two `<dl>` blocks — one live (`x-show="completionStatus !==
'succeeded'"`, reading `$store.game.turns`/`configSnapshot` directly), one
succeeded-only (reading `resultsSnapshot?.total`/`.legs`/`.average`).
Delete the live block entirely (matches the precedent
`ScoreTrainingResults.astro`/`ShanghaiResults.astro` already set — during
`pending`/`saving` only the `IsLoading` spinner shows, no numbers). Replace
the succeeded-only block and the static `<h2>` with:

```astro
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-text="
        !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
          ? 'Match Summary'
          : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins the match!')
      "
    >
    </h2>

    {/* Solo: one column of StatRow entries */}
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus === 'succeeded' && resultsSnapshot && resultsSnapshot.seats.length === 1"
      x-cloak
    >
      {
        STAT_ROWS.map((row) => (
          <StatRow label={row.label} value={seatValueExpr(0, row)} />
        ))
      }
    </dl>

    {/* 1v1: comparison rows — stat label centered, values on either side */}
    <div
      class="mt-4 space-y-2 text-sm"
      x-show="completionStatus === 'succeeded' && resultsSnapshot && resultsSnapshot.seats.length === 2"
      x-cloak
    >
      <div class="flex justify-between text-xs font-semibold text-foreground">
        <span
          x-text="$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[0]?.participantRef)?.displayName"
        ></span>
        <span
          x-text="$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[1]?.participantRef)?.displayName"
        ></span>
      </div>
      {
        STAT_ROWS.map((row) => (
          <div class="flex justify-between items-center font-display-mono">
            <dd
              class="font-mono text-sm font-bold tabular-nums text-foreground"
              x-text={seatValueExpr(0, row)}
            />
            <dt class="text-sm text-muted-foreground">{row.label}</dt>
            <dd
              class="font-mono text-sm font-bold tabular-nums text-foreground"
              x-text={seatValueExpr(1, row)}
            />
          </div>
        ))
      }
    </div>
```

- [ ] **Step 2: Add `STAT_ROWS` and `seatValueExpr` to the frontmatter**

At the top of the file's frontmatter (after the existing `import`s), add:

```typescript
const STAT_ROWS = [
  { label: "Legs won", key: "legsWon" },
  { label: "3 dart avg", key: "threeDartAverage" },
  { label: "Checkout %", key: "checkoutPercentage", fallback: "'—'" },
  { label: "60+", key: "sixtyPlus" },
  { label: "100+", key: "hundredPlus" },
  { label: "120+", key: "oneTwentyPlus" },
  { label: "140+", key: "oneFortyPlus" },
  { label: "180s", key: "oneEighties" },
] as const;

function seatValueExpr(
  seatIndex: number,
  row: (typeof STAT_ROWS)[number],
): string {
  const base = `resultsSnapshot?.seats?.[${seatIndex}]?.${row.key}`;
  return "fallback" in row ? `${base} ?? ${row.fallback}` : base;
}
```

- [ ] **Step 3: Run the typecheck**

```bash
cd app && npx astro check
```

Expected: 0 errors, 0 warnings, 0 hints for the whole project — this
closes out the errors Task 3's Step 3 and Task 4's Step 8 both left open in
this file.

- [ ] **Step 4: Run the Astro conventions and class-composition checks**

```bash
bash scripts/check-astro-conventions.sh
bash scripts/check-astro-class-composition.sh
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/games/result-modals/FiveOhOneResults.astro
git commit -m "Reshape 501's match-summary modal to per-player stats"
```

---

### Task 6: Doc/decision maintenance (D242, Pattern 21/18, File-Inventory)

**Files:**
- Modify: `decisions/game-engine.md`
- Modify: `docs/architecture/04-Architecture-patterns.md`
- Modify: `docs/architecture/00-File-Inventory.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Append the D242 decision block**

Open `decisions/game-engine.md` and find the end of the D241 block (the
most recent decision, "closing F39-F41"). Append this new block
immediately after it — do not edit any existing block:

```markdown
### D242 — `visitScoreBandCounts` gains a `sixtyPlus` band; `checkout-bust.module.ts` gains `checkoutAttemptCount`
Status: Accepted · Date: 2026-08-28
Decision: `app/src/lib/game/play-visit-stats.ts`'s `visitScoreBandCounts(turns)` (D238/Pattern 21) gains a fifth exclusive band, `sixtyPlus` (60-99, the lowest of the five — a visit still counts into only its single highest qualifying band). `app/src/modules/game/checkout-bust.module.ts` (D240) gains `checkoutAttemptCount(turns)`, counting completed visits whose `totalScore` was zeroed by a bust but whose own darts summed to more than zero — provably, by `resolveCheckoutAttempt`'s own rule, exactly the visits where a checkout was attempted and failed. 501's per-player match summary (issue #167) is the first caller of both.
Reason: Issue #167 asked for a 60+ tally alongside the existing four bands, and for a checkout-percentage stat. Checkout % is only computable for VISUAL_BOARD sessions (QUICK_SCORE never persists dart rows, so a bust is indistinguishable from a genuine zero-score visit — `05-Database/06-Spec/04-Runtime-Layer.md`); for VISUAL_BOARD, a bust and a failed checkout attempt are the same event for every X01-style engine sharing `resolveCheckoutAttempt`, so `made = legsWon` and `attempted = legsWon + checkoutAttemptCount(...)` needs no new persisted fact or engine change. Both additions extend existing shared helpers rather than introducing 501-local versions, per D238's and D240's own stated intent that the next caller reuse them.
Consequences: Score Training's and Shanghai's existing `visitScoreBandCounts` callers gain an unused `sixtyPlus` field via the object spread they already use (`...visitScoreBandCounts(seatTurns)`) — additive, no call-site change, their modals don't render it. 121 and TUOD could call `checkoutAttemptCount` under the same reasoning later; this task wires it into 501 only. `play-visit-stats.test.ts` and `checkout-bust.module.test.ts` cover both additions directly.
```

- [ ] **Step 2: Reword Pattern 21 in `04-Architecture-patterns.md`**

Find the `# Pattern 21 — Exclusive Score-Band Tallying` section (search for
that heading). In its **Principle** paragraph, change "100+/120+/140+/180-
style bands" to "60+/100+/120+/140+/180-style bands". In the **Pattern**
code-fence block, change:

```
visitScoreBandCounts(turns) (play-visit-stats.ts) — one pass, each visit
tallied into exactly one of hundredPlus / oneTwentyPlus / oneFortyPlus /
oneEighties (highest threshold met, e.g. 125 → oneTwentyPlus only, never
also hundredPlus; 180 → oneEighties only)
    ↓
resultsSnapshot.seats[].{hundredPlus, oneTwentyPlus, oneFortyPlus, oneEighties}
```

to:

```
visitScoreBandCounts(turns) (play-visit-stats.ts) — one pass, each visit
tallied into exactly one of sixtyPlus / hundredPlus / oneTwentyPlus /
oneFortyPlus / oneEighties (highest threshold met, e.g. 125 → oneTwentyPlus
only, never also hundredPlus; 180 → oneEighties only)
    ↓
resultsSnapshot.seats[].{sixtyPlus, hundredPlus, oneTwentyPlus, oneFortyPlus, oneEighties}
```

In the **Application** bullet list, change "Bands are exclusive, not
cumulative: a single visit increments exactly one counter (or none, below
100)." to "...(or none, below 60)."

Also find Pattern 18's `checkout-bust.module.ts` mention (the D240 addendum
inside Pattern 18's own section — search for `checkout-bust.module.ts`).
Add one sentence noting the second export: "`checkout-bust.module.ts` also
exports `checkoutAttemptCount(turns)` (D242), counting failed checkout
attempts from a completed VISUAL_BOARD turn log."

- [ ] **Step 3: Bump the version header**

At the top of `04-Architecture-patterns.md`, find the `> **Version:**` line
(currently ending "...`checkout-bust.module.ts` shared bust/checkout rule,
`otherSeatsComplete`'s completion-predicate parameter 2026-08-27, D240;
..."). Prepend a new version segment documenting this change, following
the file's existing chain format, e.g.:

```
> **Version:** 1.8.3 (Pattern 21 gains a fifth band, Pattern 18's `checkout-bust.module.ts` gains `checkoutAttemptCount` 2026-08-28, D242; prior 1.8.2: ...)
```

(keep the rest of the existing chain after `prior 1.8.2:` verbatim — only
prepend the new segment and bump the leading version number by one patch
digit).

- [ ] **Step 4: Update `00-File-Inventory.md`'s two rows**

Find the `04-Architecture-patterns.md` row (search for that exact
filename) and append to its description: "; Pattern 21 gains a fifth
band, Pattern 18's `checkout-bust.module.ts` gains `checkoutAttemptCount`
(2026-08-28, D242)".

Find the `decisions/game-engine.md` row and change "44 decisions" to "45
decisions", appending "; D242 `visitScoreBandCounts`'s `sixtyPlus` band and
`checkout-bust.module.ts`'s `checkoutAttemptCount`" to its parenthetical.

- [ ] **Step 5: Refresh the `~Nk` size figures**

```bash
bash scripts/check-context-budget.sh
```

This script reports actual token sizes per tracked file. Read its output
for `04-Architecture-patterns.md` and `decisions/game-engine.md` and update
each row's `~Nk` column in `00-File-Inventory.md` to match exactly what it
reports — do not hand-estimate.

- [ ] **Step 6: Run the context-integrity gates**

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
```

Expected: all three pass (exit 0) after Step 5's size correction.

- [ ] **Step 7: Commit**

```bash
git add decisions/game-engine.md docs/architecture/04-Architecture-patterns.md docs/architecture/00-File-Inventory.md
git commit -m "Document D242 (sixtyPlus band, checkoutAttemptCount) in patterns/decisions/inventory"
```

---

### Task 7: Full validation and manual verification

**Files:** none new.

- [ ] **Step 1: Run the full validation chain**

```bash
cd app && npm run validate:app
```

Expected: every step exits 0, `npx fallow` included, and the type gate
reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 2: Run the full test suite**

```bash
cd app && npm test
```

Expected: all tests pass, including every reshaped/new test from Tasks
1, 2, and 4.

- [ ] **Step 3: Format check**

```bash
cd app && npm run format
npm run format:check
```

Expected: `format:check` reports clean.

- [ ] **Step 4: Manual verification in a browser**

```bash
cd app && astro dev --background
```

Play a solo 501 session (QUICK_SCORE) to completion and confirm the
summary modal shows: a "Match Summary" title, one column with Legs won,
3 dart avg, Checkout % ("—"), 60+/100+/120+/140+/180s. Play a 1v1 session
to completion and confirm: the winner's name in "\<name\> wins the
match!", two columns (loser's seat left, winner's seat right if seat 0
lost — confirm against whichever seat order `$store.game.seats` actually
holds), each stat's label centered between the two values. If a
VISUAL_BOARD-capable environment is available, play one 501 session under
VISUAL_BOARD input and confirm Checkout % shows a real percentage instead
of "—" — note in the completion report if this environment cannot exercise
VISUAL_BOARD input for a manual check.

```bash
astro dev stop
```

- [ ] **Step 5: Confirm the context-maintenance checklist is fully closed**

```bash
git diff --stat main...HEAD
```

Expected: exactly the files listed in this plan's File Structure table
(Tasks 1-6) plus their test files — nothing else under `decisions/`,
`docs/architecture/`, or elsewhere.

- [ ] **Step 6: Final format commit (if needed)**

```bash
git status --short
```

If Step 3's format run left an unstaged diff, commit it:

```bash
git add -A
git commit -m "Format check"
```

If clean, skip this step.

---

## Self-Review Notes

- **Spec coverage:** the `sixtyPlus` band → Task 1; `checkoutAttemptCount`/
  the exact `made`/`attempted` formula → Task 2; the reshaped result types →
  Task 3; per-seat `statsFor` replacing `computeStats`/`ownerRef` → Task 4;
  the modal's solo-column/1v1-comparison-rows/winner-banner reshape → Task
  5; the spec's full Context Maintenance section (D242, Pattern 21/18
  wording, File-Inventory rows) → Task 6, each as its own step rather than
  a single vague "update docs" line.
- **Type consistency:** `FiveOhOneSeatResult`/`FiveOhOneResultsSnapshot`
  (Task 3) are consumed identically by `statsFor`'s return type (Task 4)
  and by `seatValueExpr`'s `row.key` lookups (Task 5) — the same nine
  field names (`participantRef`, `sideKey`, `legsWon`, `threeDartAverage`,
  `checkoutPercentage`, `sixtyPlus`, `hundredPlus`, `oneTwentyPlus`,
  `oneFortyPlus`, `oneEighties`) appear in all three places.
  `checkoutAttemptCount(turns: readonly TurnFact[]): number` (Task 2) is
  called with exactly that signature from `statsFor` (Task 4).
- **No placeholders:** every step shows literal code; the two test
  fixtures in Task 4 flagged as needing a concrete legal dart sequence are
  explicitly pointed at this same file's existing passing fixtures to copy
  from, not left as "figure it out."
