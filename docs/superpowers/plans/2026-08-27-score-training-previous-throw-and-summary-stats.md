# Score Training: Previous-Throw Row + Per-Player Summary Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issue #169's Part A (the 1v1 split scoreboard is missing a "Previous throw" row the solo view already has) and build Part C (the Score Training summary modal gains real per-player stats — 3-dart avg, first-9 avg, highest score, and exclusive 100+/120+/140+/180 counts — instead of one combined Total/Visits/Average block).

**Architecture:** Part A wires an already-implemented accessor into a template — no data-layer change. Part C mirrors `ShanghaiResults.astro`/`shanghai-play.data.ts`'s existing solo-column-vs-1v1-comparison-rows pattern: three new shared stat helpers land in `play-visit-stats.ts` (already the home of every other shared visit-stat function), `ScoreTrainingResultsSnapshot` is reshaped from a flat single-player object into `{status, winningSideKey, seats: ScoreTrainingSeatResult[]}`, and the modal renders one `StatRow` block per seat.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Vitest.

## Global Constraints

- TDD mandatory for every `.ts` change: failing test → minimal implementation → passing test (`app/CLAUDE.md`).
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated beside the source file.
- No `.astro` component test — `.astro` variant/branching logic stays inline in the component's own frontmatter (D101); there is no Astro-component test runner in this project.
- Alpine v3 shorthand only (`:attr`, `@event`); every `x-show` element also carries `x-cloak`; no `x-init`.
- `app/src/**/*.ts`: no inline comments inside function bodies — JSDoc above the declaration only.
- Semantic tokens only in styling; reuse `StatRow.astro` — do not hand-roll markup.
- Score bands are **exclusive**, not cumulative (D238, Pattern 21, `04-Architecture-patterns.md`): a visit counts toward its single highest qualifying band only (a 125 counts as `oneTwentyPlus` only, never also `hundredPlus`; a 180 counts as `oneEighties` only).
- Reference spec: `docs/superpowers/specs/2026-08-27-score-training-previous-throw-and-summary-stats-design.md`. D238/Pattern 21/`FINDINGS.md` bookkeeping referenced by that spec's "Context maintenance" section for D238/Pattern 21 is **already landed** on this branch (commit `31d64ca`) — only the F22 deletion in Task 5 below remains.

---

## File Structure

- Modify `app/src/components/layout/games/interfaces/ScoreTraining.astro` — add the "Previous" `StatRow` to both split-scoreboard seat slots (Part A).
- Modify `app/src/lib/game/play-visit-stats.ts` — add `firstNineAverageDisplay`, `highestVisitScore`, `visitScoreBandCounts`.
- Modify `app/tests/lib/game/play-visit-stats.test.ts` — cover the three new helpers.
- Modify `app/src/lib/game/types.ts` — replace `ScoreTrainingResultsSnapshot` with a per-seat shape; add `ScoreTrainingSeatResult`.
- Modify `app/src/lib/game/score-training-play.data.ts` — replace `computeStats` with per-seat `statsFor`; update the `uploadAndCompleteSession` call site.
- Modify `app/tests/lib/game/score-training-play.data.test.ts` — reshape existing `resultsSnapshot` assertions/fixtures to the new type; add a 1v1 test and a score-band test.
- Modify `app/src/components/layout/games/result-modals/ScoreTrainingResults.astro` — replace both existing stat `<dl>` blocks with the Shanghai-shaped solo-column / 1v1-comparison-rows pair.
- Modify `FINDINGS.md` — delete F22 (closed by this task).

---

## Task 1: Part A — "Previous" row in the split scoreboard

**Files:**
- Modify: `app/src/components/layout/games/interfaces/ScoreTraining.astro:64-89`

**Interfaces:**
- Consumes: `previousScoreThisLegFor(seatRef: string): string` — already implemented and typed on `ScoreTrainingPlayContext` (`app/src/lib/game/score-training-play.data.ts:271-280`, `app/src/lib/game/types.ts:260-263`). No new code needed to make this callable.
- Produces: nothing — this task is markup-only, nothing else depends on it.

This task is markup-only (D101 — `.astro` variant/branching logic is untested by design), so there is no red/green test cycle. Steps instead: make the edit, then verify with the project's own structural/format gates.

- [ ] **Step 1: Read the current split-scoreboard block**

Open `app/src/components/layout/games/interfaces/ScoreTraining.astro` and confirm lines 64-89 read exactly:

```astro
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "totalScoreFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "totalScoreFor(state()?.seats[1]?.participantRef)",
      }}
      isTarget={false}
      class="h-2/5"
    >
      <dl
        slot="progressA"
        class="w-full space-y-1"
      >
        <StatRow
          label="3 dart avg."
          value="threeDartAverageFor(state()?.seats[0]?.participantRef)"
        />
        <StatRow
          label="Darts"
          value="dartsThrownThisLegFor(state()?.seats[0]?.participantRef)"
        />
      </dl>
      <dl
        slot="progressB"
        class="w-full space-y-1"
      >
        <StatRow
          label="3 dart avg."
          value="threeDartAverageFor(state()?.seats[1]?.participantRef)"
        />
        <StatRow
          label="Darts"
          value="dartsThrownThisLegFor(state()?.seats[1]?.participantRef)"
        />
      </dl>
    </SplitScoreboard>
```

If the file has drifted from this, stop and re-read the whole file before editing — the rest of this task assumes this exact shape.

- [ ] **Step 2: Add the "Previous" `StatRow` to both seat slots**

Replace the two `<dl>` blocks above with:

```astro
      <dl
        slot="progressA"
        class="w-full space-y-1"
      >
        <StatRow
          label="3 dart avg."
          value="threeDartAverageFor(state()?.seats[0]?.participantRef)"
        />
        <StatRow
          label="Darts"
          value="dartsThrownThisLegFor(state()?.seats[0]?.participantRef)"
        />
        <StatRow
          label="Previous"
          value="previousScoreThisLegFor(state()?.seats[0]?.participantRef)"
        />
      </dl>
      <dl
        slot="progressB"
        class="w-full space-y-1"
      >
        <StatRow
          label="3 dart avg."
          value="threeDartAverageFor(state()?.seats[1]?.participantRef)"
        />
        <StatRow
          label="Darts"
          value="dartsThrownThisLegFor(state()?.seats[1]?.participantRef)"
        />
        <StatRow
          label="Previous"
          value="previousScoreThisLegFor(state()?.seats[1]?.participantRef)"
        />
      </dl>
    </SplitScoreboard>
```

- [ ] **Step 3: Format and validate**

Run:

```bash
cd app && npm run format
bash ../scripts/check-astro-conventions.sh
```

Expected: `format` reports no changes needed (or writes only whitespace it owns); `check-astro-conventions.sh` prints an `OK:` line and exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/layout/games/interfaces/ScoreTraining.astro
git commit -m "fix: show Previous-throw stat in Score Training's split scoreboard

Wires the already-implemented previousScoreThisLegFor(seatRef)
accessor into the 1v1 split view — the solo view already had this
row. Issue #169 (Part A)."
```

---

## Task 2: Three new shared visit-stat helpers (`play-visit-stats.ts`)

**Files:**
- Modify: `app/src/lib/game/play-visit-stats.ts`
- Test: `app/tests/lib/game/play-visit-stats.test.ts`

**Interfaces:**
- Consumes: the existing private `completedVisits<T extends VisitLike>(turns: T[]): T[]` helper already in `play-visit-stats.ts` (filters to `completedAt !== null`).
- Produces:
  - `firstNineAverageDisplay(turns: VisitLike[]): string`
  - `highestVisitScore(turns: VisitLike[]): number`
  - `visitScoreBandCounts(turns: VisitLike[]): { hundredPlus: number; oneTwentyPlus: number; oneFortyPlus: number; oneEighties: number }`

  Task 3's `statsFor` calls all three by these exact names and signatures.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/lib/game/play-visit-stats.test.ts` (after the existing `accuracyDisplay` describe block, before end of file):

```ts
describe("firstNineAverageDisplay", () => {
  it('returns "0.0" when there are no completed visits', () => {
    expect(firstNineAverageDisplay([])).toBe("0.0");
  });

  it("averages a single completed visit", () => {
    expect(firstNineAverageDisplay([done(60)])).toBe("60.0");
  });

  it("averages exactly the first 3 completed visits, ignoring later ones", () => {
    const turns = [done(60), done(45), done(30), done(180)];
    expect(firstNineAverageDisplay(turns)).toBe("45.0");
  });

  it("averages over fewer than 3 visits when only 2 have completed", () => {
    expect(firstNineAverageDisplay([done(60), done(30)])).toBe("45.0");
  });

  it("ignores an open visit at the end", () => {
    const turns = [
      done(60),
      done(45),
      { totalScore: 20, completedAt: null, darts: [{}] },
    ];
    expect(firstNineAverageDisplay(turns)).toBe("52.5");
  });
});

describe("highestVisitScore", () => {
  it("returns 0 when there are no completed visits", () => {
    expect(highestVisitScore([])).toBe(0);
  });

  it("returns the single completed visit's score", () => {
    expect(highestVisitScore([done(60)])).toBe(60);
  });

  it("returns the max across several completed visits, not the last one", () => {
    expect(highestVisitScore([done(60), done(180), done(45)])).toBe(180);
  });

  it("ignores an open visit's running total", () => {
    const turns = [done(60), { totalScore: 180, completedAt: null, darts: [{}] }];
    expect(highestVisitScore(turns)).toBe(60);
  });
});

describe("visitScoreBandCounts", () => {
  it("returns all-zero counts for no completed visits", () => {
    expect(visitScoreBandCounts([])).toEqual({
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });

  it("does not count a visit below 100 in any band", () => {
    expect(visitScoreBandCounts([done(99)])).toEqual({
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });

  it("counts a visit in exactly its own band, not any lower one — the exclusive-band case (D238)", () => {
    expect(visitScoreBandCounts([done(125)])).toEqual({
      hundredPlus: 0,
      oneTwentyPlus: 1,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });

  it("tallies one visit into each of the four bands independently", () => {
    const turns = [done(105), done(125), done(145), done(180)];
    expect(visitScoreBandCounts(turns)).toEqual({
      hundredPlus: 1,
      oneTwentyPlus: 1,
      oneFortyPlus: 1,
      oneEighties: 1,
    });
  });

  it("a 180 counts only as oneEighties, not also the lower three bands", () => {
    expect(visitScoreBandCounts([done(180)])).toEqual({
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 1,
    });
  });

  it("ignores an open visit even if its running total would clear a band", () => {
    const turns = [{ totalScore: 180, completedAt: null, darts: [{}] }];
    expect(visitScoreBandCounts(turns)).toEqual({
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });
});
```

Also add the three new names to the top-of-file import:

```ts
import {
  previousScoreDisplay,
  dartsThrownCount,
  perVisitAverageDisplay,
  threeDartAverageDisplay,
  accuracyDisplay,
  firstNineAverageDisplay,
  highestVisitScore,
  visitScoreBandCounts,
} from "@lib/game/play-visit-stats";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts`

Expected: FAIL — `firstNineAverageDisplay`/`highestVisitScore`/`visitScoreBandCounts` are not exported from `@lib/game/play-visit-stats`.

- [ ] **Step 3: Implement the three helpers**

Append to `app/src/lib/game/play-visit-stats.ts` (after the existing `accuracyDisplay` function, end of file):

```ts
/**
 * Average of the first 3 completed visits' totals, one-decimal display
 * string — the classic "first 9" darts stat. Fewer than 3 completed visits
 * averages over however many exist; "0.0" before any visit completes, same
 * convention as `perVisitAverageDisplay`.
 */
export function firstNineAverageDisplay(turns: VisitLike[]): string {
  const first = completedVisits(turns).slice(0, 3);
  if (first.length === 0) return "0.0";
  const total = first.reduce((sum, turn) => sum + turn.totalScore, 0);
  return (total / first.length).toFixed(1);
}

/** Highest single completed-visit total; 0 if none completed. */
export function highestVisitScore(turns: VisitLike[]): number {
  const completed = completedVisits(turns);
  if (completed.length === 0) return 0;
  return Math.max(...completed.map((turn) => turn.totalScore));
}

/**
 * Tallies completed visits into exactly one of four score bands — whichever
 * is the *highest* threshold that visit's total meets, never more than one
 * (D238, Pattern 21). A 125 counts only as `oneTwentyPlus`, not also
 * `hundredPlus`; a 180 counts only as `oneEighties`, not also
 * `oneFortyPlus`/`oneTwentyPlus`/`hundredPlus`.
 */
export function visitScoreBandCounts(turns: VisitLike[]): {
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
} {
  const counts = {
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
  }
  return counts;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts`

Expected: PASS, all tests in the file green (existing + new).

- [ ] **Step 5: Type-check and format**

```bash
cd app && npx astro check --minimumFailingSeverity hint
npm run format
```

Expected: `astro check` reports 0 errors/0 warnings/0 hints; `format` clean.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/play-visit-stats.ts app/tests/lib/game/play-visit-stats.test.ts
git commit -m "feat: add first-9 average, highest-visit, and score-band helpers

Three new shared visit-stat functions in play-visit-stats.ts:
firstNineAverageDisplay, highestVisitScore, visitScoreBandCounts.
Score bands are exclusive per D238/Pattern 21 — a visit counts
toward its single highest qualifying band only. Issue #169 (Part C),
first caller lands in the next task."
```

---

## Task 3: Reshape `ScoreTrainingResultsSnapshot` to per-seat stats

**Files:**
- Modify: `app/src/lib/game/types.ts:222-229`
- Modify: `app/src/lib/game/score-training-play.data.ts` (imports, `computeStats` → `statsFor`, `uploadAndCompleteSession` call site)
- Test: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**
- Consumes: `firstNineAverageDisplay`, `highestVisitScore`, `visitScoreBandCounts` (Task 2); existing `perVisitAverageDisplay` (`play-visit-stats.ts`); existing `ScoreTrainingSeatState`/`TurnFact` types (`@modules/types`).
- Produces:
  - `ScoreTrainingSeatResult` type (`app/src/lib/game/types.ts`) — `{participantRef, sideKey, total, threeDartAverage, firstNineAverage, highestScore, hundredPlus, oneTwentyPlus, oneFortyPlus, oneEighties}`.
  - Reshaped `ScoreTrainingResultsSnapshot` — `{status: "COMPLETE" | "TIE", winningSideKey: string | null, seats: ScoreTrainingSeatResult[]}`.

  Task 4's modal reads `resultsSnapshot.seats[n].<key>` by these exact field names.

- [ ] **Step 1: Reshape the types**

In `app/src/lib/game/types.ts`, replace lines 222-229:

```ts
/** `winningSideKey` is score-compare (highest total) resolved by the engine; `null` for a solo session or a TIE. `status` mirrors the engine's own completion state, collapsed to just the two outcomes a finished session can report: `COMPLETE` for a solo session or a decided 1v1 match, `TIE` when both seats totalled the same score — the only way callers can tell a genuine tie apart from a solo session, since both leave `winningSideKey` `null`. */
export type ScoreTrainingResultsSnapshot = {
  total: number;
  visits: number;
  average: number;
  winningSideKey: string | null;
  status: "COMPLETE" | "TIE";
};
```

with:

```ts
/** One seat's own results stats, replayed from its own completed visits in
 * `turns`. `total` is that seat's final score (from `finalState`, not
 * recomputed); the rest are derived by the shared `play-visit-stats.ts`
 * helpers over that seat's own completed visits only. Score-band counts are
 * exclusive (D238, Pattern 21) — a visit increments exactly one of
 * `hundredPlus`/`oneTwentyPlus`/`oneFortyPlus`/`oneEighties`, never more
 * than one. */
export type ScoreTrainingSeatResult = {
  participantRef: string;
  sideKey: string;
  total: number;
  threeDartAverage: string;
  firstNineAverage: string;
  highestScore: number;
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
};

/** `winningSideKey` is score-compare (highest total) resolved by the engine; `null` for a solo session or a TIE. `status` mirrors the engine's own completion state, collapsed to just the two outcomes a finished session can report: `COMPLETE` for a solo session or a decided 1v1 match, `TIE` when both seats totalled the same score — the only way callers can tell a genuine tie apart from a solo session, since both leave `winningSideKey` `null`. `seats` has one entry per configured seat (1 for solo, 2 for 1v1), in `$store.game.seats` order. */
export type ScoreTrainingResultsSnapshot = {
  status: "COMPLETE" | "TIE";
  winningSideKey: string | null;
  seats: ScoreTrainingSeatResult[];
};
```

- [ ] **Step 2: Write the failing tests — reshape existing assertions**

In `app/tests/lib/game/score-training-play.data.test.ts`:

Add a 4th, optional `participantRef` parameter to the `turnFact` helper (around line 75-89) so 1v1 test turns can be built for either seat, defaulting to today's behavior:

```ts
function turnFact(
  clientKey: string,
  sequence: number,
  totalScore: number,
  participantRef = "participant-1",
): TurnFact {
  return {
    clientKey,
    stageClientKey: BLOCK.clientKey,
    participantRef,
    sequence,
    completedAt: "2026-07-17T10:00:00.000Z",
    totalScore,
    darts: [],
  };
}
```

Replace the assertion in `"copies stats into resultsSnapshot on success and does not depend on turns surviving afterward"` (around line 862-868):

```ts
      expect(play.resultsSnapshot).toEqual({
        status: "COMPLETE",
        winningSideKey: null,
        seats: [
          {
            participantRef: "participant-1",
            sideKey: "A",
            total: 50,
            threeDartAverage: "50.0",
            firstNineAverage: "50.0",
            highestScore: 50,
            hundredPlus: 0,
            oneTwentyPlus: 0,
            oneFortyPlus: 0,
            oneEighties: 0,
          },
        ],
      });
```

Replace the fixture literal in `"ST4: playAgain reuses the original template so provenance matches the first play"` (around line 919-925):

```ts
      play.resultsSnapshot = {
        status: "COMPLETE",
        winningSideKey: null,
        seats: [
          {
            participantRef: "participant-1",
            sideKey: "A",
            total: 50,
            threeDartAverage: "50.0",
            firstNineAverage: "50.0",
            highestScore: 50,
            hundredPlus: 0,
            oneTwentyPlus: 0,
            oneFortyPlus: 0,
            oneEighties: 0,
          },
        ],
      };
```

Replace the assertion in `"sets finished and completionStatus pending on final visit before upload settles"` (around line 1202-1208):

```ts
      expect(component.resultsSnapshot).toEqual({
        status: "COMPLETE",
        winningSideKey: null,
        seats: [
          {
            participantRef: "participant-1",
            sideKey: "A",
            total: 60,
            threeDartAverage: "30.0",
            firstNineAverage: "30.0",
            highestScore: 30,
            hundredPlus: 0,
            oneTwentyPlus: 0,
            oneFortyPlus: 0,
            oneEighties: 0,
          },
        ],
      });
```

Add two new tests immediately after the reshaped `"copies stats into resultsSnapshot..."` test (still inside the same `describe` block, using the same `makePlay` helper defined at line 760):

```ts
    it("1v1: both seats get their own independently-scoped stats, including the losing seat", async () => {
      const play = makePlay({
        configSnapshot: { ...rounds(20), seats: TWO_SEATS },
        turns: [
          turnFact("t1", 1, 60, "participant-1"),
          turnFact("t2", 2, 45, "participant-1"),
          turnFact("t3", 1, 40, "participant-2"),
        ],
      });

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 3, darts: 9 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot?.seats).toEqual([
        {
          participantRef: "participant-1",
          sideKey: "A",
          total: 105,
          threeDartAverage: "52.5",
          firstNineAverage: "52.5",
          highestScore: 60,
          hundredPlus: 0,
          oneTwentyPlus: 0,
          oneFortyPlus: 0,
          oneEighties: 0,
        },
        {
          participantRef: "participant-2",
          sideKey: "B",
          total: 40,
          threeDartAverage: "40.0",
          firstNineAverage: "40.0",
          highestScore: 40,
          hundredPlus: 0,
          oneTwentyPlus: 0,
          oneFortyPlus: 0,
          oneEighties: 0,
        },
      ]);
    });

    it("tallies visits across all four score bands exclusively, end to end", async () => {
      const play = makePlay({
        turns: [
          turnFact("t1", 1, 105),
          turnFact("t2", 2, 125),
          turnFact("t3", 3, 145),
          turnFact("t4", 4, 180),
        ],
      });

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 4, darts: 12 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      const seat = play.resultsSnapshot?.seats[0];
      expect(seat?.highestScore).toBe(180);
      expect(seat?.hundredPlus).toBe(1);
      expect(seat?.oneTwentyPlus).toBe(1);
      expect(seat?.oneFortyPlus).toBe(1);
      expect(seat?.oneEighties).toBe(1);
    });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts`

Expected: FAIL — TypeScript/assertion errors, since `computeStats`/the old flat `ScoreTrainingResultsSnapshot` shape are still in place and don't match the new expected object shape.

- [ ] **Step 4: Update the imports in `score-training-play.data.ts`**

Replace lines 23-38:

```ts
import {
  dartsThrownCount,
  perVisitAverageDisplay,
  previousScoreDisplay,
} from "@lib/game/play-visit-stats";
import type { RulesetVersionKey } from "@lib/types";
import type {
  DartObservation,
  EngineFacts,
  ScoreTrainingState,
} from "@modules/types";
import type {
  BoardMarker,
  ScoreTrainingPlayContext,
  ScoreTrainingResultsSnapshot,
} from "./types";
```

with:

```ts
import {
  dartsThrownCount,
  firstNineAverageDisplay,
  highestVisitScore,
  perVisitAverageDisplay,
  previousScoreDisplay,
  visitScoreBandCounts,
} from "@lib/game/play-visit-stats";
import type { RulesetVersionKey } from "@lib/types";
import type {
  DartObservation,
  EngineFacts,
  ScoreTrainingSeatState,
  ScoreTrainingState,
  TurnFact,
} from "@modules/types";
import type {
  BoardMarker,
  ScoreTrainingPlayContext,
  ScoreTrainingResultsSnapshot,
  ScoreTrainingSeatResult,
} from "./types";
```

- [ ] **Step 5: Replace `computeStats` with per-seat `statsFor`**

Replace lines 59-85 (the `computeStats` JSDoc + function):

```ts
/**
 * Reads the owner seat's final resting state off the already-folded engine
 * state — never re-derives the totals separately. `status` collapses the
 * engine's own three-way `status` to the two outcomes a finished session can
 * report, so a genuine TIE (both seats total the same score) stays
 * distinguishable from a solo session even though both leave
 * `winningSideKey` `null`: solo sessions never see `TIE` from the engine
 * (score-compare only runs seats.length >= 2), so this collapse is safe.
 */
function computeStats(
  state: ScoreTrainingState,
  ownerRef: string | null,
): ScoreTrainingResultsSnapshot {
  const ownerSeat =
    state.seats.find((seat) => seat.participantRef === ownerRef) ??
    state.seats[0];
  return {
    total: ownerSeat.totalScore,
    visits: ownerSeat.turnCount,
    average:
      ownerSeat.turnCount === 0
        ? 0
        : ownerSeat.totalScore / ownerSeat.turnCount,
    winningSideKey: state.winningSideKey,
    status: state.status === "TIE" ? "TIE" : "COMPLETE",
  };
}
```

with:

```ts
/**
 * One seat's own results stats, replayed from its own completed visits in
 * `turns` — `total` is read off the already-folded engine state (never
 * recomputed), the rest are derived from that seat's own filtered turns via
 * the shared `play-visit-stats.ts` helpers.
 */
function statsFor(
  seat: ScoreTrainingSeatState,
  turns: readonly TurnFact[],
): ScoreTrainingSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    total: seat.totalScore,
    threeDartAverage: perVisitAverageDisplay(seatTurns),
    firstNineAverage: firstNineAverageDisplay(seatTurns),
    highestScore: highestVisitScore(seatTurns),
    ...visitScoreBandCounts(seatTurns),
  };
}
```

- [ ] **Step 6: Update the `uploadAndCompleteSession` call site**

Replace (around line 541-549):

```ts
      const finalState = finalScoreTrainingState(this);
      const ownerRef =
        this.$store.game.seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )?.participantRef ?? null;
      if (finalState) {
        this.resultsSnapshot = computeStats(finalState, ownerRef);
      }
      this.completionStatus = "succeeded";
```

with:

```ts
      const finalState = finalScoreTrainingState(this);
      if (finalState) {
        this.resultsSnapshot = {
          status: finalState.status === "TIE" ? "TIE" : "COMPLETE",
          winningSideKey: finalState.winningSideKey,
          seats: finalState.seats.map((seat) =>
            statsFor(seat, this.$store.game.turns),
          ),
        };
      }
      this.completionStatus = "succeeded";
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts`

Expected: PASS, all tests in the file green (existing + reshaped + 2 new).

- [ ] **Step 8: Type-check and run the full suite**

```bash
cd app && npx astro check --minimumFailingSeverity hint
npx vitest run
npm run format
```

Expected: `astro check` 0/0/0; full suite green (no other file references the old flat `ScoreTrainingResultsSnapshot` shape — confirmed during spec research); `format` clean.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/score-training-play.data.ts app/tests/lib/game/score-training-play.data.test.ts
git commit -m "feat: reshape ScoreTrainingResultsSnapshot to per-seat stats

ScoreTrainingResultsSnapshot is now {status, winningSideKey, seats:
ScoreTrainingSeatResult[]} instead of one flat total/visits/average
object. statsFor(seat, turns) replaces computeStats, mirroring
Shanghai's own per-seat results-stats precedent. Issue #169 (Part C)."
```

---

## Task 4: Modal layout — per-player stats (`ScoreTrainingResults.astro`)

**Files:**
- Modify: `app/src/components/layout/games/result-modals/ScoreTrainingResults.astro`

**Interfaces:**
- Consumes: `resultsSnapshot.seats[n].{total, threeDartAverage, firstNineAverage, highestScore, hundredPlus, oneTwentyPlus, oneFortyPlus, oneEighties}` (Task 3); `$store.game.seats[n].displayName`.
- Produces: nothing — this is the final consumer in this plan.

Markup-only (D101) — no unit test. This also closes F22 (deleted in Task 5): the live pre-succeeded block this step removes is exactly what F22 flags.

- [ ] **Step 1: Read the current file**

Confirm `app/src/components/layout/games/result-modals/ScoreTrainingResults.astro` still matches the version read during spec research (frontmatter with 3 imports, no `STAT_ROWS` constant, two `<dl>` blocks for Total/Visits/Average). If it has drifted, re-read the whole file before editing.

- [ ] **Step 2: Add `STAT_ROWS` to the frontmatter**

Replace the frontmatter:

```astro
---
import Button from "@components/forms/Button.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import IsLoading from "@components/ui/IsLoading.astro";
---
```

with:

```astro
---
import Button from "@components/forms/Button.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import IsLoading from "@components/ui/IsLoading.astro";

const STAT_ROWS = [
  { label: "Total", key: "total" },
  { label: "3 dart avg.", key: "threeDartAverage" },
  { label: "First 9 avg.", key: "firstNineAverage" },
  { label: "Highest score", key: "highestScore" },
  { label: "100+", key: "hundredPlus" },
  { label: "120+", key: "oneTwentyPlus" },
  { label: "140+", key: "oneFortyPlus" },
  { label: "180s", key: "oneEighties" },
] as const;
---
```

- [ ] **Step 3: Replace both stat `<dl>` blocks**

Replace this whole section:

```astro
    {/* Stats: live from store while saving, snapshot once succeeded */}
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus !== 'succeeded'"
      x-cloak
    >
      <StatRow
        label="Total"
        value="$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0)"
      />
      <StatRow
        label="Visits"
        value="$store.game.turns.length"
      />
      <StatRow
        label="Average"
        value="$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0) / Math.max($store.game.turns.length, 1)"
      />
    </dl>
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus === 'succeeded' && resultsSnapshot"
      x-cloak
    >
      <StatRow
        label="Total"
        value="resultsSnapshot?.total"
      />
      <StatRow
        label="Visits"
        value="resultsSnapshot?.visits"
      />
      <StatRow
        label="Average"
        value="resultsSnapshot?.average.toFixed(1)"
      />
    </dl>
```

with:

```astro
    {/* Solo: one column of StatRow entries */}
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus === 'succeeded' && resultsSnapshot && resultsSnapshot.seats.length === 1"
      x-cloak
    >
      {
        STAT_ROWS.map((row) => (
          <StatRow
            label={row.label}
            value={`resultsSnapshot?.seats?.[0]?.${row.key}`}
          />
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
              x-text={`resultsSnapshot?.seats?.[0]?.${row.key}`}
            />
            <dt class="text-sm text-muted-foreground">{row.label}</dt>
            <dd
              class="font-mono text-sm font-bold tabular-nums text-foreground"
              x-text={`resultsSnapshot?.seats?.[1]?.${row.key}`}
            />
          </div>
        ))
      }
    </div>
```

- [ ] **Step 4: Format and validate**

```bash
cd app && npm run format
bash ../scripts/check-astro-conventions.sh
npx astro check --minimumFailingSeverity hint
```

Expected: `format` clean; `check-astro-conventions.sh` OK; `astro check` 0/0/0.

- [ ] **Step 5: Manual verification**

Start the dev server and play a Score Training session (solo, then 1v1 with a guest) through to completion, confirming: solo shows one column of 8 stats; 1v1 shows two-seat comparison rows with correct names; band counts match visits actually thrown (e.g. throw one visit ≥140 and confirm both `140+` and `100+`/`120+` do **not** double-count it — only `140+` increments).

```bash
cd app && astro dev --background
```

Check the running dev server via `astro dev status` / `astro dev logs`, then stop it with `astro dev stop` once verified.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/layout/games/result-modals/ScoreTrainingResults.astro
git commit -m "feat: per-player summary stats in Score Training's results modal

Replaces the combined Total/Visits/Average block with Shanghai's
solo-column / 1v1-comparison-rows pattern, rendering 3-dart avg,
first-9 avg, highest score, and 100+/120+/140+/180s per seat. Drops
the live pre-succeeded block entirely (closes F22 — no more
unfiltered combined-seat reads during the save window). Issue #169
(Part C)."
```

---

## Task 5: Context maintenance and final validation

**Files:**
- Modify: `FINDINGS.md` (delete F22)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing — final task.

- [ ] **Step 1: Delete F22 from `FINDINGS.md`**

Open `FINDINGS.md` and delete the entire `### F22 — Score Training's live-stats banner shows combined-seat data during the post-match save window` block (Status/Claim/Evidence/Impact/Proposed, through the line before the next `### F...` heading or end of file). Do not renumber any other finding or change the `highest-issued` front-matter line — F22's id is retired, not reused, matching this file's own "Opposite lifecycle to `DECISIONS.md`" rule.

- [ ] **Step 2: Run the findings-log gate**

Run: `bash scripts/check-findings-log.sh`

Expected: `OK:` lines, exit 0 (F22 no longer counted; no other finding's evidence paths were touched by this plan).

- [ ] **Step 3: Run the full validation chain**

```bash
cd app && npm run validate:app
```

Expected: every step exits 0, including `npx fallow` and `astro check --minimumFailingSeverity hint` at 0 errors/0 warnings/0 hints. `db:status`/`db:migrate`/`db:introspect` may fail with no `DATABASE_URL` in a sandboxed session (established precedent, D193) — acceptable only if that is the sole failure and this change touches no schema (it doesn't).

- [ ] **Step 4: Run the repo-root structural gates**

```bash
bash scripts/check-context-map.sh
bash scripts/check-context-budget.sh
bash scripts/check-doc-links.sh
bash scripts/check-decision-ids.sh
bash scripts/check-findings-log.sh
```

Expected: all `OK:`, exit 0.

- [ ] **Step 5: Confirm no stale reference to the old flat snapshot shape remains**

Run: `git grep -n 'resultsSnapshot?\?\.\(total\|visits\|average\)' -- app/src/components/layout/games/result-modals/ScoreTrainingResults.astro app/src/lib/game/score-training-play.data.ts`

Expected: no output (both files now read the per-seat shape exclusively).

- [ ] **Step 6: Commit**

```bash
git add FINDINGS.md
git commit -m "docs: close F22 — Score Training's live-stats block is gone

The unfiltered combined-seat live block F22 flagged no longer exists
(Task 4 replaced it with the per-seat succeeded-only blocks). Issue
#169 context maintenance."
```

- [ ] **Step 7: Push**

```bash
git push -u origin claude/issue-169-brainstorming-hxzm90
```

---

## Self-Review Notes

- **Spec coverage:** Part A → Task 1. Part C's 4 sub-points (helpers, types, `statsFor`/call site, modal) → Tasks 2-4. D238/Pattern 21/File-Inventory bookkeeping → already landed pre-plan (noted in Global Constraints). F22 closure → Task 5. Testing section's three helper-coverage asks, the reshaped-assertion ask, the 1v1 case, and the band-mixing case are all in Task 2/3's test steps. No spec section without a task.
- **Placeholder scan:** no TBD/TODO; every step shows complete code, not a description of code.
- **Type consistency:** `ScoreTrainingSeatResult`/`ScoreTrainingResultsSnapshot` field names are identical across Task 3 (definition + `statsFor`) and Task 4 (modal's `STAT_ROWS` keys) — `total`, `threeDartAverage`, `firstNineAverage`, `highestScore`, `hundredPlus`, `oneTwentyPlus`, `oneFortyPlus`, `oneEighties`, `participantRef`, `sideKey`. `visitScoreBandCounts`'s return shape (Task 2) matches the four band field names used in `statsFor`'s spread (Task 3) exactly.
