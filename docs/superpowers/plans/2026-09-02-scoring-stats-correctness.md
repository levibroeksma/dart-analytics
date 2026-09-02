# Scoring/Stats Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four independent stats/results correctness gaps in the Score Training / Shanghai results path: a solo Shanghai's `winningSideKey` leaking non-null, a band-count function's top band using equality instead of "highest threshold," Score Training's per-seat `total` including an open visit when the other seven stats don't, and missing 1v1 regression coverage for `winningSideKey`/`status`.

**Architecture:** Task 1 gives `foldShanghaiState` the same `seats.length === 1 ? null :` guard `foldOneTwentyOneState` already carries. Task 2 changes one comparison operator. Task 3 adds one exported helper to `play-visit-stats.ts` (alongside its existing neighbours) and swaps `statsFor`'s `total` field to use it. Task 4 is test-only — two new 1v1 cases, no source change.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- Closes `FINDINGS.md` F20, F34, F35, F37.
- No change to `ShanghaiResults.astro`'s solo short-circuit (Task 1 fixes the underlying data, not this already-correct rendering guard).
- No change to `one-twenty-one.engine.module.ts` (already correct, used only as the reference pattern for Task 1).
- No change to any seeded template's `max_visit_score` (Task 2 fixes the function's contract regardless of whether 180 is reachable today).
- No change to Score Training's persisted-mirror retry path itself (Task 3 only changes what one field of its resulting snapshot reports).

---

### Task 1: Fix `foldShanghaiState`'s solo `winningSideKey` leak

**Files:**
- Modify: `app/src/modules/game/shanghai.engine.module.ts:195-200`
- Test: `app/tests/modules/game/shanghai.engine.module.test.ts`, `app/tests/lib/game/shanghai-play.data.test.ts`

**Interfaces:**
- Consumes: `raceWinner(entries: { sideKey: string; finished: boolean }[]): string | null` from `match-outcome.module.ts` (unchanged signature).
- Produces: nothing new — `foldShanghaiState`'s return shape (`ShanghaiState`, with `winningSideKey: string | null`) is unchanged; only which sessions produce `null` changes.

- [ ] **Step 1: Write the failing test**

In `app/tests/modules/game/shanghai.engine.module.test.ts`, in the existing `describe("foldShanghaiState — solo session", ...)` block (starts at line 992), add this test after `it("reproduces initialShanghaiState for an empty fact log", ...)`:

```ts
  it("reports winningSideKey: null for a solo session that ends on a Shanghai (F20)", () => {
    const engine = new ShanghaiEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    const state = engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });

    expect(state.seats[0].status).toBe("SHANGHAI");
    expect(state.winningSideKey).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/shanghai.engine.module.test.ts -t "F20"`
Expected: FAIL — `state.winningSideKey` is `"A"`, not `null`.

- [ ] **Step 3: Fix `foldShanghaiState`**

In `app/src/modules/game/shanghai.engine.module.ts`, lines 195-200, replace:

```ts
  const raceResult = raceWinner(
    seats.map((seat) => ({
      sideKey: seat.sideKey,
      finished: seat.status === "SHANGHAI",
    })),
  );
```

with:

```ts
  const raceResult =
    seats.length === 1
      ? null
      : raceWinner(
          seats.map((seat) => ({
            sideKey: seat.sideKey,
            finished: seat.status === "SHANGHAI",
          })),
        );
```

No other line changes — `compareResult`'s existing `seats.length > 1 &&` guard (two lines below) and `winningSideKey: raceResult ?? compareResult` are unaffected.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/shanghai.engine.module.test.ts -t "F20"`
Expected: PASS.

- [ ] **Step 5: Update the now-stale solo-Shanghai assertions in `shanghai-play.data.test.ts`**

In `app/tests/lib/game/shanghai-play.data.test.ts`, three existing tests assert `winningSideKey: "A"` for a solo session that wins on a Shanghai (currently at lines 309, 394, 514 — locate by the surrounding `status: "SHANGHAI"` object literal if line numbers have shifted). Change each occurrence from:

```ts
      winningSideKey: "A",
```

to:

```ts
      winningSideKey: null,
```

These tests must be updated alongside the fix, not left passing against the old (wrong) contract — a green suite after the guard changes is only real coverage if these three assertions changed with it.

- [ ] **Step 6: Run both test files to verify everything passes**

Run: `cd app && npx vitest run tests/modules/game/shanghai.engine.module.test.ts tests/lib/game/shanghai-play.data.test.ts`
Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/game/shanghai.engine.module.ts app/tests/modules/game/shanghai.engine.module.test.ts app/tests/lib/game/shanghai-play.data.test.ts
git commit -m "fix(shanghai): winningSideKey is null for a solo session, matching every other engine"
```

---

### Task 2: Fix `visitScoreBandCounts`'s top-band equality check

**Files:**
- Modify: `app/src/lib/game/play-visit-stats.ts:136`
- Test: `app/tests/lib/game/play-visit-stats.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `visitScoreBandCounts`'s existing return shape is unchanged; only visit totals strictly above 180 (unreachable through the engine today, per `FINDINGS.md` F34's own Impact note) change which band they land in.

- [ ] **Step 1: Write the failing test**

In `app/tests/lib/game/play-visit-stats.test.ts`, in the existing `describe("visitScoreBandCounts", ...)` block, add this test after `it("a 180 counts only as oneEighties, not also the lower three bands", ...)` (currently ends at line 275):

```ts
  it("a total above 180 still counts as oneEighties — the function's own 'highest threshold' contract, exercised directly since the engine cannot produce one today", () => {
    expect(visitScoreBandCounts([done(200)])).toEqual({
      sixtyPlus: 0,
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 1,
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts -t "still counts as oneEighties"`
Expected: FAIL — `oneFortyPlus: 1` instead of `oneEighties: 1` (a 200 falls through the `=== 180` check into the `>= 140` branch).

- [ ] **Step 3: Fix the check**

In `app/src/lib/game/play-visit-stats.ts`, line 136, replace:

```ts
    if (score === 180) counts.oneEighties += 1;
```

with:

```ts
    if (score >= 180) counts.oneEighties += 1;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts -t "still counts as oneEighties"`
Expected: PASS.

- [ ] **Step 5: Run the whole file to check for regressions**

Run: `cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts`
Expected: PASS (all) — the existing "a 180 counts only as oneEighties" test is unaffected (`180 >= 180` is still true).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/play-visit-stats.ts app/tests/lib/game/play-visit-stats.test.ts
git commit -m "fix(play-visit-stats): visitScoreBandCounts' top band uses >=, matching the other three"
```

---

### Task 3: Score Training's `total` excludes an open visit, matching the other seven stats

**Files:**
- Modify: `app/src/lib/game/play-visit-stats.ts` (add export near `highestVisitScore`, line 106-110), `app/src/lib/game/score-training-play.data.ts:82`
- Test: `app/tests/lib/game/play-visit-stats.test.ts`, `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**
- Consumes: `completedVisits<T extends VisitLike>(turns: T[]): T[]` — existing module-private helper in `play-visit-stats.ts`, already used by `perVisitAverageDisplay`/`highestVisitScore`/`visitScoreBandCounts`.
- Produces: `completedVisitsTotal(turns: VisitLike[]): number` (new exported function in `play-visit-stats.ts`) — later tasks or callers import it the same way as `highestVisitScore`.

- [ ] **Step 1: Write the failing test for the new helper**

In `app/tests/lib/game/play-visit-stats.test.ts`, add a new `describe` block after the `describe("highestVisitScore", ...)` block (ends at line 205, right before `describe("visitScoreBandCounts", ...)` begins):

```ts
describe("completedVisitsTotal", () => {
  it("sums only completed visits, excluding an open one", () => {
    const turns = [
      done(60),
      done(45),
      { totalScore: 999, completedAt: null, darts: [{}] },
    ];
    expect(completedVisitsTotal(turns)).toBe(105);
  });

  it("returns 0 for an empty turn list", () => {
    expect(completedVisitsTotal([])).toBe(0);
  });
});
```

Add `completedVisitsTotal` to this test file's existing import from `@lib/game/play-visit-stats` (top of file, currently importing `previousScoreDisplay`, `dartsThrownCount`, `perVisitAverageDisplay`, `threeDartAverageDisplay`, `accuracyDisplay`, `firstNineAverageDisplay`, `highestVisitScore`, `visitScoreBandCounts`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts -t "completedVisitsTotal"`
Expected: FAIL — `completedVisitsTotal` is not exported yet (import error / `undefined is not a function`).

- [ ] **Step 3: Add the helper**

In `app/src/lib/game/play-visit-stats.ts`, immediately after `highestVisitScore` (ends at line 110), add:

```ts
/** Sum of every completed visit's total; 0 if none completed. Excludes an open visit's running score — matches `perVisitAverageDisplay`/`highestVisitScore`/`visitScoreBandCounts`'s own filter, so a results summary's `total` never contradicts its other stats. */
export function completedVisitsTotal(turns: VisitLike[]): number {
  return completedVisits(turns).reduce((sum, turn) => sum + turn.totalScore, 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts -t "completedVisitsTotal"`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `statsFor`'s `total`**

In `app/tests/lib/game/score-training-play.data.test.ts`, locate the describe block covering the persisted-mirror retry path or open-visit handling (search the file for `openVisit` or a test recording an in-progress visit before `uploadAndCompleteSession`/`resultsSnapshot` is read — the finding's own Evidence names this as "reachable via the persisted-mirror retry path, not the normal `confirmFinish` route"). Add a test asserting `total` matches the sum of completed visits, not `seat.totalScore`, when an open visit is present at snapshot time:

```ts
    it("total excludes an open visit's running score, matching the other seven stats", async () => {
      const play = makePlay({
        turns: [
          turnFact("t1", 1, 60),
          { ...turnFact("t2", 2, 45), completedAt: null },
        ],
      });

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 2, darts: 6 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot?.seats[0].total).toBe(60);
    });
```

(Place this inside the same describe/`makePlay` scope as the existing `it("1v1: both seats get their own independently-scoped stats, including the losing seat", ...)` test at line 886 — it shares that block's `makePlay`, `turnFact`, `rounds`, `appendBatch`, `completeSession` imports.)

- [ ] **Step 6: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "total excludes an open visit"`
Expected: FAIL — `total` is `105` (60 + 45, the open visit's running score included), not `60`.

- [ ] **Step 7: Swap `statsFor`'s `total` field**

In `app/src/lib/game/score-training-play.data.ts`, line 82, replace:

```ts
    total: seat.totalScore,
```

with:

```ts
    total: completedVisitsTotal(seatTurns),
```

Add `completedVisitsTotal` to this file's existing import from `@lib/game/play-visit-stats` (alongside `perVisitAverageDisplay`/`firstNineAverageDisplay`/`highestVisitScore`/`visitScoreBandCounts`, already imported near the top of the file for `statsFor`'s other four stats).

- [ ] **Step 8: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "total excludes an open visit"`
Expected: PASS.

- [ ] **Step 9: Run both test files to check for regressions**

Run: `cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts tests/lib/game/score-training-play.data.test.ts`
Expected: PASS (all) — every existing test whose fixture has no open visit at snapshot time is unaffected, since `completedVisitsTotal` equals `seat.totalScore` whenever every visit is closed.

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/game/play-visit-stats.ts app/src/lib/game/score-training-play.data.ts app/tests/lib/game/play-visit-stats.test.ts app/tests/lib/game/score-training-play.data.test.ts
git commit -m "fix(score-training): total excludes an open visit, matching the other seven summary stats (F35)"
```

---

### Task 4: Add 1v1 regression coverage for `winningSideKey`/`status`

**Files:**
- Test: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**
- Consumes: `makePlay`, `turnFact`, `rounds`, `TWO_SEATS` — all already defined in this test file (`rounds(durationValue)` returns a `ROUNDS`-duration config; `TWO_SEATS` has `participant-1`/sideKey `"A"` and `participant-2`/sideKey `"B"`).
- Produces: nothing — test-only, no source change.

- [ ] **Step 1: Write the decided-finish test**

In `app/tests/lib/game/score-training-play.data.test.ts`, in the same describe/`makePlay` scope as the existing `it("1v1: both seats get their own independently-scoped stats, including the losing seat", ...)` test (line 886), add:

```ts
    it("1v1: winningSideKey matches the higher-scoring seat once the round budget decides the match", async () => {
      const play = makePlay({
        configSnapshot: { ...rounds(1), seats: TWO_SEATS },
        turns: [
          turnFact("t1", 1, 60, "participant-1"),
          turnFact("t2", 1, 40, "participant-2"),
        ],
      });

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 2, darts: 6 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot?.status).toBe("COMPLETE");
      expect(play.resultsSnapshot?.winningSideKey).toBe("A");
    });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "winningSideKey matches the higher-scoring seat"`
Expected: PASS — this is regression coverage for already-correct behavior (no source change in this task), so it should pass immediately; if it fails, stop and investigate before continuing (a failure here means the reshape this task is meant to cover regressed silently at some point).

- [ ] **Step 3: Write the tie test**

Immediately after, add:

```ts
    it("1v1: a tie at the round budget reports status TIE and winningSideKey null", async () => {
      const play = makePlay({
        configSnapshot: { ...rounds(1), seats: TWO_SEATS },
        turns: [
          turnFact("t1", 1, 50, "participant-1"),
          turnFact("t2", 1, 50, "participant-2"),
        ],
      });

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 2, darts: 6 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot?.status).toBe("TIE");
      expect(play.resultsSnapshot?.winningSideKey).toBeNull();
    });
```

- [ ] **Step 4: Run both new tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "1v1:"`
Expected: PASS (all 1v1-tagged tests, including the two pre-existing ones).

- [ ] **Step 5: Run the whole file to check for regressions**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add app/tests/lib/game/score-training-play.data.test.ts
git commit -m "test(score-training): cover the reshaped ResultsSnapshot's winningSideKey/status for a decided 1v1 finish and a tie (F37)"
```

---

### Task 5: Close FINDINGS.md F20, F34, F35, F37; run the full gate suite

**Files:**
- Modify: `FINDINGS.md`

- [ ] **Step 1: Delete the F20, F34, F35, F37 blocks**

In `FINDINGS.md`, delete all four blocks in full: `### F20 — ...`, `### F34 — ...`, `### F35 — ...`, `### F37 — ...` (their current text is reproduced in `docs/superpowers/specs/2026-09-02-scoring-stats-correctness-design.md`; locate each by header, not line number, since Tasks 1-4's edits shift line numbers). Leave exactly one blank line between each of the surrounding remaining blocks.

- [ ] **Step 2: Run the findings gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0 (`highest-issued` unchanged).

- [ ] **Step 3: Run the full `run-all-gates` suite**

Invoke the `run-all-gates` skill's "Always run" set plus the "If `app/` changed" set. State each script's result explicitly in the completion report.

- [ ] **Step 4: Format and commit**

```bash
cd app && npm run format && npm run format:check
cd ..
git add FINDINGS.md
git commit -m "docs: close F20, F34, F35, F37 — scoring/stats correctness fixes complete"
```

## Testing

- Task 1: one new Vitest case proving `foldShanghaiState`'s `winningSideKey` is `null` for a solo Shanghai, plus three pre-existing assertions in `shanghai-play.data.test.ts` updated to match the corrected contract.
- Task 2: one new Vitest case proving a visit total above 180 still lands in `oneEighties`.
- Task 3: two new Vitest cases (`completedVisitsTotal`'s own unit coverage, plus `statsFor`'s `total` field against an open-visit fixture).
- Task 4: two new Vitest cases (decided 1v1 finish, 1v1 tie) — no source change, pure regression coverage.
- Task 5: doc-only; verified by the findings gate and the full `run-all-gates` suite.

## Non-goals

No change to `ShanghaiResults.astro`. No change to `one-twenty-one.engine.module.ts`. No change to any seeded template's `max_visit_score`. No change to Score Training's persisted-mirror retry path itself.
