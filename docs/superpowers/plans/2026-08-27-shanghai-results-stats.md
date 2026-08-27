# Shanghai: per-seat results stats (Issue #166, part 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix #166's 2nd complaint — Shanghai's results modal shows only the completing player's total score and round reached, with no accuracy or zone breakdown, and no per-seat split in 1v1.

**Architecture:** `ShanghaiResultsSnapshot` moves from a flat `{score, status, round, winningSideKey}` to `{status, winningSideKey, seats: ShanghaiSeatResult[]}` — one entry per configured seat, computed by replaying that seat's own darts. The modal renders a single stat list for solo sessions, or comparison rows (stat centered, values on either side) for 1v1. No engine or schema change — one existing engine helper is exported for reuse, the rest is play-data + modal markup.

**Tech Stack:** TypeScript, Vitest, Alpine.js, Astro.

## Global Constraints

- Scope: `app/src/modules/game/shanghai.engine.module.ts` (export one existing helper, no behavior change), `app/src/lib/game/shanghai-play.data.ts`, `app/src/lib/game/types.ts`, `app/src/components/layout/games/result-modals/ShanghaiResults.astro`, and their test files. Do not touch any other ruleset's results modal or play-data file.
- `app/CLAUDE.md`: no `//` or `/* */` comments inside function bodies in `app/src/**/*.ts`; tests mirror `app/src/`'s directory structure under `app/tests/`, never colocated; every source edit needs a covering test edit (`scripts/check-test-coverage.sh`) — type-only edits are exempt (D224).
- `.astro` markup: variant/branching logic stays inline in the component's own frontmatter — no extracted helper file solely to make it testable (D101). No `.astro` component test exists or is added for this plan's modal change.
- Run `cd app && npm run format` before considering any task done.
- This plan lands after `2026-08-27-shanghai-preview-seat-scoping.md` on the same branch. Its final task runs the full `context-maintenance` procedure for the whole #166 issue, including the two `FINDINGS.md` entries (Singles Training's identical preview bug; Around the Clock's reveal-window active-seat staleness) both plans' brainstorming surfaced — logged here, once, rather than split across both plans.

---

### Task 1: Export `zoneBucketOf` for reuse

**Files:**

- Modify: `app/src/modules/game/shanghai.engine.module.ts`
- Test: `app/tests/modules/game/shanghai.engine.module.test.ts`

**Interfaces:**

- Produces: `export function zoneBucketOf(zone: DartZoneKey): "SINGLE" | "DOUBLE" | "TREBLE" | null` — same function, same behavior, now exported. Task 3 imports this.

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `app/tests/modules/game/shanghai.engine.module.test.ts`, right after the closing `});` of the existing `describe("shanghaiEngineFactory", ...)` block (after line 93 in the current file, before `describe("initialShanghaiState", ...)`):

```ts
describe("zoneBucketOf", () => {
  it("buckets every single-ring zone key as SINGLE", () => {
    expect(zoneBucketOf("SINGLE")).toBe("SINGLE");
    expect(zoneBucketOf("INNER_SINGLE")).toBe("SINGLE");
    expect(zoneBucketOf("OUTER_SINGLE")).toBe("SINGLE");
  });

  it("buckets DOUBLE and TREBLE as themselves", () => {
    expect(zoneBucketOf("DOUBLE")).toBe("DOUBLE");
    expect(zoneBucketOf("TREBLE")).toBe("TREBLE");
  });

  it("buckets both bull zones and MISS as null — none of the three", () => {
    expect(zoneBucketOf("OUTER_BULL")).toBeNull();
    expect(zoneBucketOf("INNER_BULL")).toBeNull();
    expect(zoneBucketOf("MISS")).toBeNull();
  });
});
```

Also update the top import (currently `import { applyShanghaiDart, foldShanghaiState, initialShanghaiState, ShanghaiEngine, shanghaiEngineFactory } from "@modules/game/shanghai.engine.module";`) to add `zoneBucketOf`:

```ts
import {
  applyShanghaiDart,
  foldShanghaiState,
  initialShanghaiState,
  ShanghaiEngine,
  shanghaiEngineFactory,
  zoneBucketOf,
} from "@modules/game/shanghai.engine.module";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/shanghai.engine.module.test.ts -t zoneBucketOf`
Expected: FAIL — `zoneBucketOf` is not exported from the module (import error / undefined).

- [ ] **Step 3: Export the function**

In `app/src/modules/game/shanghai.engine.module.ts`, change:

```ts
function zoneBucketOf(
  zone: DartZoneKey,
): "SINGLE" | "DOUBLE" | "TREBLE" | null {
```

to:

```ts
export function zoneBucketOf(
  zone: DartZoneKey,
): "SINGLE" | "DOUBLE" | "TREBLE" | null {
```

No other line changes — every existing internal caller (`applyShanghaiDart`, `isShanghai`) keeps calling it exactly as before.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/shanghai.engine.module.test.ts`
Expected: PASS, every test in the file green.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/shanghai.engine.module.ts app/tests/modules/game/shanghai.engine.module.test.ts
git commit -m "Export zoneBucketOf from the Shanghai engine for reuse (#166)"
```

---

### Task 2: Reshape `ShanghaiResultsSnapshot` into per-seat stats

**Files:**

- Modify: `app/src/lib/game/types.ts`

**Interfaces:**

- Produces:
  ```ts
  export type ShanghaiSeatResult = {
    participantRef: string;
    sideKey: string;
    score: number;
    round: number;
    accuracy: string;
    trebles: number;
    doubles: number;
    singles: number;
  };

  export type ShanghaiResultsSnapshot = {
    status: "SHANGHAI" | "COMPLETE" | "TIE";
    winningSideKey: string | null;
    seats: ShanghaiSeatResult[];
  };
  ```
  Task 3 builds this shape; the modal (Task 4) reads it.

Type-only change — `scripts/check-test-coverage.sh` exempts type-only edits (D224), so this task has no test step of its own; Task 3's tests exercise the new shape end to end.

- [ ] **Step 1: Replace the type**

In `app/src/lib/game/types.ts`, replace:

```ts
/** `round` is 1-indexed: the round the session ended on — always 20 for a `COMPLETE`/`TIE` session, the round the Shanghai landed on for a `SHANGHAI` one. `status` mirrors the match-level `ShanghaiState.status`, not the owner seat's own status — a solo session's own status and the match status always coincide, but only the match status can read `TIE`. */
export type ShanghaiResultsSnapshot = {
  score: number;
  status: "SHANGHAI" | "COMPLETE" | "TIE";
  round: number;
  winningSideKey: string | null;
};
```

with:

```ts
/** One seat's own results stats. `round` is 1-indexed: the round that seat
 * ended on — always 20 for a `COMPLETE`/`TIE` session, the round the
 * Shanghai landed on for a `SHANGHAI` one (the losing seat in a
 * Shanghai-ending 1v1 session may show an earlier round, if the match ended
 * before its own turn came back around). `accuracy` is that seat's hits
 * (darts landing on its own round's assigned number) over darts thrown,
 * formatted as a percentage, `"0%"` when it never threw a dart (e.g. the
 * losing seat in a 1v1 session that ended on the opening seat's own
 * round-1 Shanghai). `trebles`/`doubles`/`singles` are raw zone tallies
 * over every dart that seat threw, independent of whether it hit that
 * round's own target — a bull hit or a miss increments none of the three. */
export type ShanghaiSeatResult = {
  participantRef: string;
  sideKey: string;
  score: number;
  round: number;
  accuracy: string;
  trebles: number;
  doubles: number;
  singles: number;
};

/** `status` mirrors the match-level `ShanghaiState.status`, not any one
 * seat's own status — a solo session's own status and the match status
 * always coincide, but only the match status can read `TIE`. `seats` has
 * one entry per configured seat (1 for solo, 2 for 1v1), in the same order
 * `$store.game.seats` is already in. */
export type ShanghaiResultsSnapshot = {
  status: "SHANGHAI" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
  seats: ShanghaiSeatResult[];
};
```

- [ ] **Step 2: Confirm it's type-only**

Run: `cd app && git diff --stat app/src/lib/game/types.ts`
Expected: only `app/src/lib/game/types.ts` changed; no `.ts` runtime file needs a paired test edit for this step per D224.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/game/types.ts
git commit -m "Reshape ShanghaiResultsSnapshot into per-seat stats (#166)"
```

---

### Task 3: Compute per-seat stats in `shanghai-play.data.ts`

**Files:**

- Modify: `app/src/lib/game/shanghai-play.data.ts`
- Test: `app/tests/lib/game/shanghai-play.data.test.ts`

**Interfaces:**

- Consumes: `zoneBucketOf` from Task 1 (`@modules/game/shanghai.engine.module`); `ShanghaiSeatResult`/`ShanghaiResultsSnapshot` from Task 2 (`@lib/types`, already the import path this file uses for other `Shanghai*` types).
- Produces: no new public API beyond the reshaped `resultsSnapshot` field itself, already typed by Task 2's `ShanghaiResultsSnapshot`.

- [ ] **Step 1: Write the failing tests**

The three existing solo-session `resultsSnapshot` assertions need reshaping to the new type before any new behavior can be added — a widened assertion on the same test subject, not a re-pointed test (root `CLAUDE.md`'s test-integrity invariant: these tests still assert "the snapshot reflects the session's outcome," just against the new shape).

In `app/tests/lib/game/shanghai-play.data.test.ts`, replace (around line 281):

```ts
    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot).toEqual({
      score: 6,
      status: "SHANGHAI",
      round: 1,
      winningSideKey: "A",
    });
    expect(play.completionStatus).toBe("succeeded");
  });
```

with:

```ts
    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot).toEqual({
      status: "SHANGHAI",
      winningSideKey: "A",
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          score: 6,
          round: 1,
          accuracy: "100%",
          trebles: 1,
          doubles: 1,
          singles: 1,
        },
      ],
    });
    expect(play.completionStatus).toBe("succeeded");
  });
```

Replace (around line 320, the "completes without a Shanghai after round 20's 3rd dart" case — 19 prior rounds of 3 SINGLE hits each, then 3 MISS darts on round 20):

```ts
    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot).toEqual({
      score: 3 * ((19 * 20) / 2),
      status: "COMPLETE",
      round: 20,
      winningSideKey: null,
    });
  });
```

with:

```ts
    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot).toEqual({
      status: "COMPLETE",
      winningSideKey: null,
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          score: 3 * ((19 * 20) / 2),
          round: 20,
          accuracy: "95%",
          trebles: 0,
          doubles: 0,
          singles: 57,
        },
      ],
    });
  });
```

(19 prior rounds × 3 SINGLE darts = 57 singles, all hits; round 20's 3 MISS darts are neither a hit nor any of the three zone buckets — 57 hits out of 60 darts thrown = 95%.)

Replace (around line 344, the "reports SHANGHAI, not COMPLETE, when round 20 itself is a Shanghai" case — 19 prior rounds of SINGLE, then SINGLE/DOUBLE/TREBLE on round 20):

```ts
    expect(play.resultsSnapshot).toEqual({
      score: 3 * ((19 * 20) / 2) + 20 + 40 + 60,
      status: "SHANGHAI",
      round: 20,
      winningSideKey: "A",
    });
  });
```

with:

```ts
    expect(play.resultsSnapshot).toEqual({
      status: "SHANGHAI",
      winningSideKey: "A",
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          score: 3 * ((19 * 20) / 2) + 20 + 40 + 60,
          round: 20,
          accuracy: "100%",
          trebles: 1,
          doubles: 1,
          singles: 58,
        },
      ],
    });
  });
```

(19 prior rounds × 3 SINGLE = 57 singles + round 20's SINGLE = 58 singles, 1 double, 1 treble; every one of the 60 darts thrown hit its own round's number, so 100%.)

Now the three `describe("session completion — 1v1", ...)` cases (around lines 403-479), which currently only assert `.status`/`.winningSideKey` via optional chaining — widen each to also assert `.seats`. Replace:

```ts
    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot?.status).toBe("SHANGHAI");
    expect(play.resultsSnapshot?.winningSideKey).toBe("A");
  });
```

(the "ends the whole match instantly on either seat's Shanghai" case) with:

```ts
    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot).toEqual({
      status: "SHANGHAI",
      winningSideKey: "A",
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          score: 6,
          round: 1,
          accuracy: "100%",
          trebles: 1,
          doubles: 1,
          singles: 1,
        },
        {
          participantRef: "participant-2",
          sideKey: "B",
          score: 0,
          round: 1,
          accuracy: "0%",
          trebles: 0,
          doubles: 0,
          singles: 0,
        },
      ],
    });
  });
```

(Seat B never threw — the match ends on seat A's own opening visit. This is the zero-darts edge case the design spec calls out: `accuracy: "0%"`, every zone count `0`, not `NaN%` or an error.)

Replace the TIE case's tail:

```ts
    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot?.status).toBe("TIE");
    expect(play.resultsSnapshot?.winningSideKey).toBeNull();
  });
```

with:

```ts
    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot?.status).toBe("TIE");
    expect(play.resultsSnapshot?.winningSideKey).toBeNull();
    expect(play.resultsSnapshot?.seats).toEqual([
      {
        participantRef: "participant-1",
        sideKey: "A",
        score: 0,
        round: 20,
        accuracy: "0%",
        trebles: 0,
        doubles: 0,
        singles: 0,
      },
      {
        participantRef: "participant-2",
        sideKey: "B",
        score: 0,
        round: 20,
        accuracy: "0%",
        trebles: 0,
        doubles: 0,
        singles: 0,
      },
    ]);
  });
```

(Both seats miss every dart of all 20 rounds — every zone count and accuracy is `0%`/`0` for both, and this is the mixed trebles/doubles/singles/misses case's miss half.)

Replace the "names the higher-scoring seat the winner" case's tail:

```ts
    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot?.status).toBe("COMPLETE");
    expect(play.resultsSnapshot?.winningSideKey).toBe("A");
  });
```

with:

```ts
    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot?.status).toBe("COMPLETE");
    expect(play.resultsSnapshot?.winningSideKey).toBe("A");
    expect(play.resultsSnapshot?.seats).toEqual([
      {
        participantRef: "participant-1",
        sideKey: "A",
        score: 3 * ((20 * 21) / 2),
        round: 20,
        accuracy: "100%",
        trebles: 0,
        doubles: 0,
        singles: 60,
      },
      {
        participantRef: "participant-2",
        sideKey: "B",
        score: 0,
        round: 20,
        accuracy: "0%",
        trebles: 0,
        doubles: 0,
        singles: 0,
      },
    ]);
  });
```

(Seat A scores a SINGLE on every one of its 60 darts across 20 rounds; `boardScore(targetNumber, "SINGLE")` returns `targetNumber` itself — round *r*'s 3 SINGLE darts score `3 * r` each, so the 20-round total is `3 * sum(1..20)` = `3 * ((20 * 21) / 2)` = 630 — 60 singles, 0 trebles/doubles, 100% accuracy, matching the file's own `3 * ((19 * 20) / 2)` pattern used two describe blocks above for the same SINGLE-scores-face-value fact.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/shanghai-play.data.test.ts`
Expected: FAIL — every reshaped case above still gets the old flat `{score, status, round, winningSideKey}` object back from `uploadAndCompleteSession`, which does not match the new nested-`seats` assertion.

- [ ] **Step 3: Implement `statsFor` and rewire `uploadAndCompleteSession`**

In `app/src/lib/game/shanghai-play.data.ts`, add the import:

```ts
import { getEngineFactory } from "@modules/game/engine.registry";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import { zoneBucketOf } from "@modules/game/shanghai.engine.module";
```

(insert the `zoneBucketOf` import line after the existing `numbersPath, targetAt` import.)

Add `statsFor` as a new module-scope function, placed directly after `previewSegmentsFor` (the function this plan's companion plan already modified — place this new function right after it, before `resumeEngine`):

```ts
/**
 * One seat's own results stats, replayed from its own darts in `turns` — a
 * seat's `targetIndex`/`totalScore` (from `finalState`) name where it ended
 * and its final score, but not its per-dart accuracy or zone breakdown,
 * which need each dart's own round at the time it was thrown. Every one of
 * a seat's own turns holds exactly 3 darts by the time a session is fully
 * complete (Shanghai has no early-visit-end rule), so grouping the seat's
 * flattened darts into 3s in throw order reproduces its round-by-round
 * history exactly.
 */
function statsFor(
  seat: ShanghaiSeatState,
  turns: readonly TurnFact[],
): ShanghaiSeatResult {
  const seatDarts = turns
    .filter((turn) => turn.participantRef === seat.participantRef)
    .flatMap((turn) => turn.darts);

  let hits = 0;
  let trebles = 0;
  let doubles = 0;
  let singles = 0;
  seatDarts.forEach((dart, index) => {
    const targetNumber = targetNumberAt(Math.floor(index / 3));
    if (dart.hitTargetNumber === targetNumber) hits += 1;
    const bucket = zoneBucketOf(dart.hitZoneKey);
    if (bucket === "TREBLE") trebles += 1;
    if (bucket === "DOUBLE") doubles += 1;
    if (bucket === "SINGLE") singles += 1;
  });

  const accuracy =
    seatDarts.length === 0
      ? "0%"
      : `${Math.round((hits / seatDarts.length) * 100)}%`;

  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    score: seat.totalScore,
    round: seat.targetIndex + 1,
    accuracy,
    trebles,
    doubles,
    singles,
  };
}
```

Add the type imports it needs — change the existing type-only import line for `ShanghaiPlayContext`/`ShanghaiPreviewSegment` to also bring in `ShanghaiSeatResult`:

```ts
import type {
  BoardMarker,
  ShanghaiPlayContext,
  ShanghaiPreviewSegment,
  ShanghaiSeatResult,
} from "./types";
```

Also add `ShanghaiSeatState` to the existing `@modules/types` type import (find the line importing `DartObservation, TurnFact` from `@modules/types` and widen it):

```ts
import type {
  DartObservation,
  ShanghaiSeatState,
  TurnFact,
} from "@modules/types";
```

Replace the existing `uploadAndCompleteSession` method:

```ts
    uploadAndCompleteSession(this: ShanghaiPlayContext): Promise<void> {
      const ownerRef =
        this.$store.game.seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )?.participantRef ?? null;
      return playUploadAndCompleteSession(this, (finalState) => {
        const ownerSeat =
          finalState.seats.find((seat) => seat.participantRef === ownerRef) ??
          finalState.seats[0];
        return {
          score: ownerSeat.totalScore,
          status: finalState.status as "SHANGHAI" | "COMPLETE" | "TIE",
          round: ownerSeat.targetIndex + 1,
          winningSideKey: finalState.winningSideKey,
        };
      });
    },
```

with:

```ts
    uploadAndCompleteSession(this: ShanghaiPlayContext): Promise<void> {
      const turns = this.$store.game.turns;
      return playUploadAndCompleteSession(this, (finalState) => ({
        status: finalState.status as "SHANGHAI" | "COMPLETE" | "TIE",
        winningSideKey: finalState.winningSideKey,
        seats: finalState.seats.map((seat) => statsFor(seat, turns)),
      }));
    },
```

(The old `ownerRef`/`ownerSeat` lookup is removed — every seat's stats are now returned, so there is no longer a single "owner seat" to single out here.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/shanghai-play.data.test.ts`
Expected: PASS, every test in the file green.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/shanghai-play.data.ts app/tests/lib/game/shanghai-play.data.test.ts
git commit -m "Compute per-seat accuracy and zone stats in Shanghai's resultsSnapshot (#166)"
```

---

### Task 4: Comparison-row results modal

**Files:**

- Modify: `app/src/components/layout/games/result-modals/ShanghaiResults.astro`

**Interfaces:**

- Consumes: `resultsSnapshot: ShanghaiResultsSnapshot | null` (Task 2/3's shape) — `resultsSnapshot.seats`, each `ShanghaiSeatResult`.

No test step — `.astro` markup logic is untested by project convention (D101).

- [ ] **Step 1: Replace the stats block**

In `app/src/components/layout/games/result-modals/ShanghaiResults.astro`, add to the frontmatter (after the existing imports, before the closing `---`):

```astro
const STAT_ROWS = [
  { label: "Score", key: "score" },
  { label: "Round", key: "round" },
  { label: "Accuracy", key: "accuracy" },
  { label: "Trebles", key: "trebles" },
  { label: "Doubles", key: "doubles" },
  { label: "Singles", key: "singles" },
] as const;
```

Replace the existing stats block:

```astro
    {/* Stats: shown once the final score is known */}
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus === 'succeeded' && resultsSnapshot"
      x-cloak
    >
      <StatRow
        label="Total score"
        value="resultsSnapshot?.score"
      />
      <StatRow
        label="Round reached"
        value="resultsSnapshot?.round"
      />
    </dl>
```

with:

```astro
    {/* Solo: one column of StatRow entries, same shape as before, more rows */}
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
        <span x-text="$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[0]?.participantRef)?.displayName" />
        <span x-text="$store.game.seats.find((s) => s.participantRef === resultsSnapshot?.seats?.[1]?.participantRef)?.displayName" />
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

(The title block above this, and everything below it — completion status, `playAgainError`, action buttons — is unchanged; neither reads `.score`/`.round` directly, only `.status`/`.winningSideKey`.)

- [ ] **Step 2: Format**

Run: `cd app && npm run format`
Expected: no diff, or a clean Prettier-applied diff (Astro/Alpine attribute formatting) — commit whatever it produces.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/result-modals/ShanghaiResults.astro
git commit -m "Show per-seat comparison stats in Shanghai's results modal (#166)"
```

---

### Task 5: Full validation and context maintenance

**Files:**

- Modify: `FINDINGS.md` (context-maintenance step)

- [ ] **Step 1: Run the full validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type gate reports 0 errors, 0 warnings, 0 hints. As in the companion plan, if `db:status`/`db:migrate`/`db:introspect` cannot run (no `DATABASE_URL` in this environment), note it explicitly — no migration or schema is touched by either plan — and still run `npx fallow`, `npm test`, `npm run check`, `npm run format:check`.

- [ ] **Step 2: Manual UI check, if a dev server is reachable**

Per root `CLAUDE.md`: for UI changes, start the dev server and exercise the feature in a browser before claiming done. If Neon/database credentials are unavailable in the execution environment (as they were during this issue's brainstorming), state that limitation explicitly in the completion report rather than claiming a browser check that did not happen — do not report the modal as visually verified without one.

- [ ] **Step 3: Run the `context-maintenance` skill**

Invoke the `context-maintenance` skill for the whole #166 issue (both plans' changes together, since they share one branch). It must:

- Add two new blocks to `FINDINGS.md`, bumping `highest-issued` from `F31` to `F33`:

  ```markdown
  ### F32 — Singles Training's dart preview has the identical seat-unscoped round-index bug Shanghai had (#166)
  Status: Open · Found: 2026-08-27 · Task: claude/issue-166-shanghai-preview
  Claim: `singles-training-play.data.ts`'s `previewSegmentsFor` computes `targetAt(numbersPath(config.targetOrder), turns.length - 1)` — the same global-turn-count index Shanghai's own `previewSegmentsFor` used before this issue's fix, wrong the moment a 1v1 session's turns from two seats interleave
  Evidence: `app/src/lib/game/singles-training-play.data.ts:145-155`; `previewSegments()` (line 256-263) passes `this.$store.game.turns` unfiltered, exactly as Shanghai's did before `2026-08-27-shanghai-preview-seat-scoping.md`'s fix; Singles Training supports 1v1 (`app/src/components/layout/games/interfaces/SinglesTraining.astro` renders `SplitScoreboard` with `seats[1]`), so the bug is reachable there the same way it was in Shanghai
  Impact: in a 1v1 Singles Training session, the per-dart hit/miss preview strip misclassifies darts once both players have thrown at least once, and can throw (via `targetAt`'s own out-of-range guard) once the combined turn count runs past the target list — same shape as issue #166's report, not yet reported against this ruleset
  Proposed: apply the identical fix `shanghai-play.data.ts`'s `previewSegmentsFor` received — derive the round index from a count of turns filtered to the last turn's own `participantRef`, not `turns.length`
  ```

  ```markdown
  ### F33 — Around the Clock's dart preview reads the wrong seat's turns during the reveal-then-clear window in 1v1
  Status: Open · Found: 2026-08-27 · Task: claude/issue-166-shanghai-preview
  Claim: `around-the-clock-play.data.ts`'s `previewSegments()` filters `this.$store.game.turns` down to `state.activeParticipantRef`'s own turns before computing the preview — but `seat-rota.module.ts`'s `activeSeat` rotates to the other seat the instant a turn closes (`completedAt !== null`), before `playCommitDart`'s 1.5s reveal timer even starts, so during that reveal window `state.activeParticipantRef` already names the *next* thrower, not the seat whose darts are fading out
  Evidence: `app/src/modules/game/seat-rota.module.ts:53-78` (`activeSeat`'s own doc: "A visit still open always holds its own seat... the thrower keeps the turn until it resolves" — implying, correctly, that a *closed* turn does not); `app/src/lib/game/around-the-clock-play.data.ts:225-235` (`previewSegments()` filters by `state.activeParticipantRef` before calling `previewSegmentsFor`)
  Impact: in a 1v1 Around the Clock session, for the 1.5s window after a turn closes, the visible preview strip is scoped to the wrong seat's turn history — at minimum showing a stale/empty strip instead of the just-thrown darts' hit/miss marks, since the newly-active seat's own last turn (if any) is a different turn entirely; not yet reported by a user, found while tracing issue #166's identical-shaped Shanghai bug
  Proposed: scope `previewSegments()`'s turn filter to the last turn's own `participantRef` (`this.$store.game.turns.at(-1)?.participantRef`), not `state.activeParticipantRef` — the same fix direction as F32 and this issue's own Shanghai fix, adapted to Around the Clock's `previewSegmentsFor(config, seatTurns, hiddenTurnKey)` signature
  ```

- Confirm no `CLAUDE.md` rule changed (this composes onto the existing `playPreviewSegments`/Pattern 19 mechanism and the Doubles Training results-stats precedent — no new pattern, no new decision).
- Confirm `08-Component-Inventory.md` needs no change (no new shared component — Task 4's comparison rows are inline `.astro` markup per D101).
- Run `scripts/check-findings-log.sh` and confirm it passes.
- Confirm branch/PR state and report it (branch `claude/issue-166-shanghai-preview`; no PR yet unless already opened).

- [ ] **Step 4: Run the `run-all-gates` skill**

Invoke `run-all-gates` for the full change set (both plans). Run the "Always run" set plus the "If `app/` changed" set, and confirm every script passes, including `scripts/check-findings-log.sh` (already run in Step 3, but `run-all-gates` re-confirms it alongside every other applicable gate).

## Self-review notes

- Spec coverage: Task 1 covers the design spec's "Reuse `zoneBucketOf`" section; Task 2 covers the `ShanghaiResultsSnapshot` reshape; Task 3 covers the replay/`statsFor` computation, including the zero-darts edge case (design spec's Testing section, "zero-darts-for-one-seat edge case... if reachable" — confirmed reachable via the existing Shanghai-ends-the-match-instantly test, reused rather than a new fixture); Task 4 covers the modal layout; Task 5 covers both `FINDINGS.md` entries the design spec's Context maintenance section calls for.
- No placeholders: every step shows exact code and exact old/new snippets. Caught and fixed one arithmetic error during self-review — Task 3's "names the higher-scoring seat the winner" case originally computed seat A's score as `60`, which conflated dart *count* with the sum of round-numbered SINGLE hits; corrected to `3 * ((20 * 21) / 2)` = 630, verified against `boardScore`'s own SINGLE-scores-face-value rule and the file's existing `3 * ((19 * 20) / 2)` precedent two describe blocks above.
- Type consistency: `statsFor(seat: ShanghaiSeatState, turns: readonly TurnFact[]): ShanghaiSeatResult` matches `ShanghaiSeatResult`'s field names and types exactly as defined in Task 2, and is called with exactly that signature in Task 3's `uploadAndCompleteSession` rewrite. `zoneBucketOf`'s exported signature (Task 1) matches its only new caller (Task 3) exactly.
