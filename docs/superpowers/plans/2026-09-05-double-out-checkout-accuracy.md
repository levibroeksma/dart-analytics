# Double-Out Checkout Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken leg/round-level "checkout" stats in 501, TUOD, and 121 with a genuine dart-level double-attempt accuracy (`doubleAccuracy`), derived from board hits already in the fact log — no engine, schema, or capture-time change.

**Architecture:** One pure classifier (`modules/game/double-attempt.module.ts`) decides, per dart, whether it was an eligible checkout-attempt dart and whether it hit or missed, using only the remaining score before the dart and board-segment adjacency (reusing `SECTOR_ORDER` from `board-geometry.module.ts`). Each game's `statsFor` builds the classifier's input from data it already has (501: a plain running-sum reduce; TUOD/121: the already-exported `foldTuodState`/`foldOneTwentyOneState` + `turnsBeforeVisit`), then formats with the existing `accuracyDisplay`. A new Analytics view persists the raw per-dart facts needed to reproduce this for 501 history reads; TUOD/121 persisted reads are out of scope for this plan (see Task 5's note — their "remaining before a dart" needs a ladder fold, which is game-engine logic and does not belong in SQL).

**Tech Stack:** TypeScript (Vitest), PostgreSQL (Neon, dbmate-style numbered migrations), Astro/Alpine (`.astro` result modals).

## Global Constraints

- Per `app/CLAUDE.md`: TDD (write failing test, watch it fail, implement, watch it pass, commit); full suite every run; `npm run validate:app` clean (0 errors/warnings/hints) before any task is claimed done; `npm run format` + `format:check` clean before any PR; no `//`/`/* */` comments inside function bodies — doc comments above the declaration only, citing decisions in parentheses, never narrating them.
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated.
- `scripts/check-test-coverage.sh`: any touched runtime `.ts` file under `app/src/` needs a touched test that imports it.
- Never modify applied migrations (`0001`–`0023`); this plan's schema change is a new migration, `0024`.
- Per `database/CLAUDE.md` (D193): SQL behaviour only provable against a live database (view expressions resolving) ships with a `database/verification/` script the user runs against Neon, not a Vitest test.
- `.astro` markup is exempt from unit tests (D101) — verify visually via the `run` skill instead.
- Minimal diffs; no unrelated refactoring.

---

### Task 1: `double-attempt.module.ts` — the shared classifier

**Files:**
- Create: `app/src/modules/game/double-attempt.module.ts`
- Test: `app/tests/modules/game/double-attempt.module.test.ts`

**Interfaces:**
- Consumes: `DartFact`, `DartZoneKey` from `@modules/types`; `SECTOR_ORDER` from `@lib/game/board/board-geometry.module` (already exported, the same 20-number clockwise order `turn-log.module.ts` already imports `classify` from that file).
- Produces: `type CheckoutVisitDarts = { startingRemaining: number; darts: readonly DartFact[] }` and `function classifyDoubleAttempts(visits: readonly CheckoutVisitDarts[]): { hits: number; misses: number }` — the two names Tasks 2-4 import.

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/modules/game/double-attempt.module.test.ts
import { describe, expect, it } from "vitest";
import { classifyDoubleAttempts } from "@modules/game/double-attempt.module";
import type { DartFact } from "@modules/types";

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartFact["hitZoneKey"],
  score: number,
): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber,
    hitZoneKey,
    score,
    locationX: null,
    locationY: null,
  };
}

describe("classifyDoubleAttempts", () => {
  it("returns zero hits and misses for an empty log", () => {
    expect(classifyDoubleAttempts([])).toEqual({ hits: 0, misses: 0 });
  });

  it("does not count a dart thrown while the remaining score is odd", () => {
    // 121 left after this scoring dart -> the dart itself opened at 121,
    // odd, no double can finish it in one dart.
    const visits = [
      { startingRemaining: 121, darts: [dart(20, "TREBLE", 60)] },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 0 });
  });

  it("does not count a dart thrown while the remaining score is even but over 40 and not 50", () => {
    const visits = [{ startingRemaining: 82, darts: [dart(14, "TREBLE", 42)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 0 });
  });

  it("counts a checkout on the required double as a hit", () => {
    const visits = [{ startingRemaining: 40, darts: [dart(20, "DOUBLE", 40)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 1, misses: 0 });
  });

  it("counts hitting the inner bull at 50 remaining as a hit", () => {
    const visits = [{ startingRemaining: 50, darts: [dart(25, "INNER_BULL", 50)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 1, misses: 0 });
  });

  it("counts a double hit that doesn't check out (wrong double) as a miss", () => {
    const visits = [{ startingRemaining: 40, darts: [dart(5, "DOUBLE", 10)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("counts hitting outer bull while going for the inner bull at 50 as a miss", () => {
    const visits = [{ startingRemaining: 50, darts: [dart(25, "OUTER_BULL", 25)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("counts a single hit on the same segment as the required double as a miss (36 left, inner single 18)", () => {
    const visits = [
      { startingRemaining: 36, darts: [dart(18, "INNER_SINGLE", 18)] },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("counts a single hit on a board-adjacent segment to the required double as a miss (32 left, needs D16, hits single 7)", () => {
    const visits = [{ startingRemaining: 32, darts: [dart(7, "SINGLE", 7)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("counts a treble hit board-adjacent to the required double as a miss", () => {
    const visits = [{ startingRemaining: 32, darts: [dart(7, "TREBLE", 21)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("does not count a single hit on an unrelated segment as an attempt (18 left, needs D9, hits single 2 -- a deliberate reroute to D16)", () => {
    const visits = [{ startingRemaining: 18, darts: [dart(2, "SINGLE", 2)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 0 });
  });

  it("does not count a large single far from bull as an attempt at 50 (a deliberate split)", () => {
    const visits = [
      { startingRemaining: 50, darts: [dart(18, "OUTER_SINGLE", 18)] },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 0 });
  });

  it("does not count a coordinate-less bounce-out miss as an attempt", () => {
    const visits = [{ startingRemaining: 40, darts: [dart(null, "MISS", 0)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 0 });
  });

  it("tracks remaining score across multiple darts in one visit", () => {
    // 40 left: dart 1 hits inner single 20 (miss, same segment as D20),
    // remaining now 20; dart 2 hits D10 -> checks out (hit).
    const visits = [
      {
        startingRemaining: 40,
        darts: [
          dart(20, "INNER_SINGLE", 20),
          dart(10, "DOUBLE", 20),
        ],
      },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 1, misses: 1 });
  });

  it("sums hits and misses across several visits", () => {
    const visits = [
      { startingRemaining: 40, darts: [dart(20, "DOUBLE", 40)] }, // hit
      { startingRemaining: 32, darts: [dart(7, "SINGLE", 7)] }, // miss
      { startingRemaining: 18, darts: [dart(2, "SINGLE", 2)] }, // not an attempt
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 1, misses: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/double-attempt.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/game/double-attempt.module'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/src/modules/game/double-attempt.module.ts
import { SECTOR_ORDER } from "@lib/game/board/board-geometry.module";
import type { DartFact, DartZoneKey } from "./types";

const SINGLE_OR_TREBLE: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "TREBLE",
]);

const DOUBLE_OR_BULL: ReadonlySet<DartZoneKey> = new Set([
  "DOUBLE",
  "INNER_BULL",
  "OUTER_BULL",
]);

/**
 * Whether `remaining` could be finished by one dart alone -- the exact set
 * of "this could have been the last dart" states, with no route/chart
 * lookup: every dart that actually finishes a double-out leg satisfies this
 * by construction (an even number a double can reach, or the bull).
 */
function isDirectlyFinishable(remaining: number): boolean {
  if (remaining === 50) return true;
  return remaining % 2 === 0 && remaining >= 2 && remaining <= 40;
}

/** Whether board segments `a` and `b` are the same segment or immediate neighbours. */
function isBoardAdjacentOrSame(a: number, b: number): boolean {
  if (a === b) return true;
  const size = SECTOR_ORDER.length;
  const indexA = SECTOR_ORDER.indexOf(a);
  const indexB = SECTOR_ORDER.indexOf(b);
  if (indexA < 0 || indexB < 0) return false;
  const diff = (indexA - indexB + size) % size;
  return diff === 1 || diff === size - 1;
}

type DartOutcome = "HIT" | "MISS" | "NOT_ATTEMPT";

/**
 * One dart's classification against the remaining score it was thrown at.
 * `remaining === 50` treats the inner bull as "the required double" and the
 * outer bull as its own near-miss zone; every other eligible remaining
 * treats `remaining / 2` as the required double's segment number.
 */
function classifyDart(remaining: number, dart: DartFact): DartOutcome {
  if (!isDirectlyFinishable(remaining)) return "NOT_ATTEMPT";

  if (DOUBLE_OR_BULL.has(dart.hitZoneKey)) {
    return dart.score === remaining ? "HIT" : "MISS";
  }

  if (remaining === 50) return "NOT_ATTEMPT";

  if (SINGLE_OR_TREBLE.has(dart.hitZoneKey) && dart.hitTargetNumber !== null) {
    const requiredSegment = remaining / 2;
    return isBoardAdjacentOrSame(dart.hitTargetNumber, requiredSegment)
      ? "MISS"
      : "NOT_ATTEMPT";
  }

  return "NOT_ATTEMPT";
}

/** One visit's darts, plus the remaining score it opened against. */
export type CheckoutVisitDarts = {
  startingRemaining: number;
  darts: readonly DartFact[];
};

/**
 * Classifies every dart across `visits` as a checkout-attempt hit, miss, or
 * not an attempt at all (a deliberate lay-up/reroute, or an unprovable
 * bounce-out) -- see `docs/superpowers/specs/2026-09-05-double-out-checkout-accuracy-design.md`
 * for the full rule and worked examples.
 */
export function classifyDoubleAttempts(
  visits: readonly CheckoutVisitDarts[],
): { hits: number; misses: number } {
  let hits = 0;
  let misses = 0;

  for (const visit of visits) {
    let remaining = visit.startingRemaining;
    for (const dart of visit.darts) {
      const outcome = classifyDart(remaining, dart);
      if (outcome === "HIT") hits += 1;
      else if (outcome === "MISS") misses += 1;
      remaining -= dart.score;
    }
  }

  return { hits, misses };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/double-attempt.module.test.ts`
Expected: PASS, all 15 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/double-attempt.module.ts app/tests/modules/game/double-attempt.module.test.ts
git commit -m "$(cat <<'EOF'
Add shared double-attempt classifier for double-out checkout accuracy

Pure function deciding per dart whether it was an eligible checkout
attempt and whether it hit or missed, using only remaining score and
board-segment adjacency -- no stored intent, no route/chart lookup.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LnRPDLeH3R29sCj3JMhZGt
EOF
)"
```

---

### Task 2: Wire 501 — replace `checkoutPercentage` with `doubleAccuracy`

**Files:**
- Modify: `app/src/lib/game/types.ts:663-684` (`FiveOhOneSeatResult`)
- Modify: `app/src/lib/game/five-oh-one-play.data.ts:169-198` (`statsFor`)
- Modify: `app/src/components/layout/games/result-modals/FiveOhOneResults.astro:9`
- Modify: `app/tests/lib/game/five-oh-one-play.data.test.ts`

**Interfaces:**
- Consumes: `classifyDoubleAttempts`, `CheckoutVisitDarts` from `@modules/game/double-attempt.module` (Task 1); `accuracyDisplay` from `@lib/game/play-visit-stats` (already imported in this file).
- Produces: `FiveOhOneSeatResult.doubleAccuracy: string | null` — replaces `checkoutPercentage`.

- [ ] **Step 1: Write the failing test — replace the meaningful checkout-percentage test**

In `app/tests/lib/game/five-oh-one-play.data.test.ts`, replace the test at (current) lines 857-894 (`"computes a VISUAL_BOARD checkout percentage from a busted attempt and two won legs"`) with:

```typescript
  it("computes a VISUAL_BOARD double accuracy from a missed and two made checkout attempts", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
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
    await play.init.call(play);

    // Leg 1, visit 1: TREBLE_20 (60) overshoots 40 -> busts. Classified as
    // a missed checkout attempt: remaining 40 was directly finishable on
    // D20, and TREBLE_20 hit the same segment (20).
    await play.recordDart.call(play, TREBLE_20);
    // Leg 1, visit 2: DOUBLE_20 (40) checks out on the required double ->
    // hit. Wins leg 1, not the match (legsToWin: 2).
    await play.recordDart.call(play, DOUBLE_20);
    // Leg 2 opens fresh at remaining 40. DOUBLE_20 wins the whole match,
    // so recordDart defers to the match-finish confirm.
    await play.recordDart.call(play, DOUBLE_20);
    expect(play.showMatchFinishConfirm).toBe(true);
    await play.confirmMatchFinish.call(play);

    const [seatA] = play.resultsSnapshot!.seats;
    expect(seatA.legsWon).toBe(2);
    // 2 hits (both D20 checkouts), 1 miss (the busted TREBLE_20) -> 2/3.
    expect(seatA.doubleAccuracy).toBe("66.67%");
  });
```

Also update the two `expect(seatA.checkoutPercentage).toBeNull()` / `expect(seatB.checkoutPercentage).toBeNull()` lines (current lines 824-825, inside the "reports legs WON, not legs played" test) to:

```typescript
    expect(seatA.doubleAccuracy).toBeNull();
    expect(seatB.doubleAccuracy).toBeNull();
```

- [ ] **Step 2: Bulk-replace the remaining `checkoutPercentage: null,` snapshot fields**

Run:

```bash
sed -i 's/checkoutPercentage: null,/doubleAccuracy: null,/' app/tests/lib/game/five-oh-one-play.data.test.ts
```

Verify no occurrences of the old name remain and the expected count of the new one exists:

```bash
grep -c "checkoutPercentage" app/tests/lib/game/five-oh-one-play.data.test.ts
```

Expected: `0`

- [ ] **Step 3: Run the test file to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts`
Expected: FAIL — `checkoutAttemptCount`/`checkoutPercentage` references gone from tests but `statsFor` still produces `checkoutPercentage`, so `doubleAccuracy` is `undefined` in the actual result, mismatching the expected object shapes (`toEqual` fails).

- [ ] **Step 4: Update the type**

In `app/src/lib/game/types.ts`, in the `FiveOhOneSeatResult` type (currently lines 663-674):

```typescript
export type FiveOhOneSeatResult = {
  participantRef: string;
  sideKey: string;
  legsWon: number;
  threeDartAverage: string;
  doubleAccuracy: string | null;
  sixtyPlus: number;
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
  bestLeg: string;
};
```

(Only the `checkoutPercentage` line changes to `doubleAccuracy`.)

- [ ] **Step 5: Update `statsFor`**

In `app/src/lib/game/five-oh-one-play.data.ts`:

Replace the import (current line 32):

```typescript
import { checkoutAttemptCount } from "@modules/game/checkout-bust.module";
```

with:

```typescript
import {
  classifyDoubleAttempts,
  type CheckoutVisitDarts,
} from "@modules/game/double-attempt.module";
```

Add a helper just above `statsFor` (current line 175), and change `statsFor` itself (current lines 175-198):

```typescript
/**
 * One seat's checkout visits, each carrying the remaining score it opened
 * against -- `startingScore` at the start of a leg, or the running total of
 * that seat's own earlier visits in the same leg subtracted from it, since
 * a leg's remaining score never carries across a leg boundary.
 */
function fiveOhOneCheckoutVisits(
  seatTurns: readonly TurnFact[],
  startingScore: number,
): CheckoutVisitDarts[] {
  const remainingByStage = new Map<string, number>();
  return seatTurns.map((turn) => {
    const startingRemaining =
      remainingByStage.get(turn.stageClientKey) ?? startingScore;
    remainingByStage.set(
      turn.stageClientKey,
      startingRemaining - turn.totalScore,
    );
    return { startingRemaining, darts: turn.darts };
  });
}

/**
 * One seat's own results stats, replayed from its own completed visits in
 * `turns`. `legsWon` is read off `state().sides` by the caller — never
 * counted from `turns` directly (a stage exists per leg *played*, not per
 * leg *won*). `doubleAccuracy` is `null` outside VISUAL_BOARD capture,
 * since QUICK_SCORE carries no dart rows to classify.
 */
function statsFor(
  seat: SeatFact,
  turns: readonly TurnFact[],
  legsWon: number,
  maxDartsPerTurn: number,
  inputModeKey: string | null,
  legResults: readonly LegResult[],
  startingScore: number,
): FiveOhOneSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const doubleAccuracy = (() => {
    if (inputModeKey !== "VISUAL_BOARD") return null;
    const { hits, misses } = classifyDoubleAttempts(
      fiveOhOneCheckoutVisits(seatTurns, startingScore),
    );
    return accuracyDisplay(hits, hits + misses);
  })();
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    legsWon,
    threeDartAverage: threeDartAverageDisplay(seatTurns, maxDartsPerTurn),
    doubleAccuracy,
    ...visitScoreBandCounts(seatTurns),
    bestLeg: bestLegFor(seat.participantRef, legResults),
  };
}
```

Update `buildResultsSnapshot`'s call to `statsFor` (current lines 226-235) to pass the starting score:

```typescript
    seats: seats.map((seat) =>
      statsFor(
        seat,
        context.$store.game.turns,
        context.legsWonFor(seat.participantRef),
        maxDartsPerTurn,
        inputModeKey,
        legResults,
        config?.startingScore ?? 0,
      ),
    ),
```

- [ ] **Step 6: Update the result modal**

In `app/src/components/layout/games/result-modals/FiveOhOneResults.astro`, line 9:

```typescript
  { label: "Double Accuracy", key: "doubleAccuracy", fallback: "'—'" },
```

(replaces `{ label: "Checkout %", key: "checkoutPercentage", fallback: "'—'" }`)

- [ ] **Step 7: Run the test file to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts`
Expected: PASS, every test green.

- [ ] **Step 8: Run the full suite**

Run: `cd app && npx vitest run`
Expected: PASS — no other file references `checkoutPercentage`.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/five-oh-one-play.data.ts app/src/components/layout/games/result-modals/FiveOhOneResults.astro app/tests/lib/game/five-oh-one-play.data.test.ts
git commit -m "$(cat <<'EOF'
Replace 501's leg-level checkoutPercentage with dart-level doubleAccuracy

checkoutPercentage was legsWon / (legsWon + busted checkout visits) -- a
leg-level ratio that reads 100% after one clean leg regardless of how
many individual darts missed a double. doubleAccuracy classifies every
dart against the double it needed, via the shared classifier.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LnRPDLeH3R29sCj3JMhZGt
EOF
)"
```

---

### Task 3: Wire TUOD — replace `attempts`/`successes`/`failures` with `doubleAccuracy`

**Files:**
- Modify: `app/src/lib/game/types.ts:374-381` (`TuodSeatResult`)
- Modify: `app/src/lib/game/tuod-play.data.ts` (`statsFor`, `computeStats`, the `uploadAndCompleteSession` call site)
- Modify: `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro:8-13`
- Modify: `app/tests/lib/game/tuod-play.data.test.ts`

**Interfaces:**
- Consumes: `classifyDoubleAttempts`, `CheckoutVisitDarts` (Task 1); `accuracyDisplay` from `@lib/game/play-visit-stats`; `foldTuodState` (already exported, `tuod.engine.module.ts:196`); `turnsBeforeVisit` (already exported, `turn-log.module.ts`).
- Produces: `TuodSeatResult.doubleAccuracy: string | null` — replaces `attempts`/`successes`/`failures`.

- [ ] **Step 1: Write the failing test — add a VISUAL_BOARD double-accuracy test**

Find the `TREBLE_20`/`DOUBLE_20` fixture block in `app/tests/lib/game/tuod-play.data.test.ts` (around line 1148-1160) and add, in the same `describe` block as the other `resultsSnapshot`-checking tests:

```typescript
  it("computes a VISUAL_BOARD double accuracy from a missed checkout attempt", async () => {
    vi.mocked(appendBatch).mockResolvedValue(undefined as never);
    vi.mocked(completeSession).mockResolvedValue(undefined as never);

    const config: Seated<TuodSnapshot> = {
      startingTarget: 40,
      finishBonus: 20,
      missPenalty: 10,
      durationType: "ROUNDS",
      durationValue: 1,
      maxDartsPerTurn: 3,
      seats: [
        {
          participantRef: "participant-1",
          displayName: "Levi",
          sideKey: "A",
          participantTypeKey: "PLAYER",
        },
      ],
    };
    const store = gameStub({ configSnapshot: config, inputModeKey: "VISUAL_BOARD" });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    // Remaining 40 -> directly finishable on D20. TREBLE_20 (60) overshoots
    // and busts, but is still classified: same segment (20) as the
    // required double -> a missed checkout attempt, not a hit.
    await component.recordDart.call(component, TREBLE_20);
    expect(component.finished).toBe(true);

    const [seat] = component.resultsSnapshot!.seats;
    expect(seat.doubleAccuracy).toBe("0.00%");
  });
```

(Adjust `gameStub`/`settingsStub`/`Seated`/`TuodSnapshot` imports and the exact 1-seat config shape to match whatever helper this test file already uses elsewhere in the same `describe` block — reuse its existing config-builder rather than inventing a second one.)

- [ ] **Step 2: Bulk-replace the existing `attempts`/`successes`/`failures` snapshot fields**

Run:

```bash
perl -0777 -pi -e 's/attempts: \d+,\n(\s*)successes: \d+,\n\s*failures: \d+,/doubleAccuracy: null,/g' app/tests/lib/game/tuod-play.data.test.ts
```

Verify:

```bash
grep -c "attempts:\|successes:\|failures:" app/tests/lib/game/tuod-play.data.test.ts
```

Expected: `0`

- [ ] **Step 3: Run the test file to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`
Expected: FAIL — `statsFor` still returns `attempts`/`successes`/`failures`, not `doubleAccuracy`.

- [ ] **Step 4: Update the type**

In `app/src/lib/game/types.ts`, replace `TuodSeatResult` (currently lines 374-381):

```typescript
export type TuodSeatResult = {
  participantRef: string;
  sideKey: string;
  target: number;
  doubleAccuracy: string | null;
};
```

- [ ] **Step 5: Update `statsFor`/`computeStats`**

In `app/src/lib/game/tuod-play.data.ts`, add the import alongside the existing ones:

```typescript
import {
  classifyDoubleAttempts,
  type CheckoutVisitDarts,
} from "@modules/game/double-attempt.module";
import { foldTuodState } from "@modules/game/tuod.engine.module";
import { turnsBeforeVisit } from "@modules/game/turn-log.module";
```

Replace `statsFor`/`computeStats` (current lines 160-185):

```typescript
/**
 * One seat's checkout visits, each carrying the target it opened against --
 * folded via `foldTuodState` over every turn strictly before it, mirroring
 * `TuodEngine`'s own (private) `targetBeforeVisit`. `timerExpired` is always
 * `false` here: every visit folded this way is already closed, and a closed
 * visit's own `currentTarget` never depends on the live timer flag.
 */
function tuodCheckoutVisits(
  seatTurns: readonly TurnFact[],
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  participantRef: string,
): CheckoutVisitDarts[] {
  return seatTurns.map((visit) => ({
    startingRemaining: foldTuodState(
      { stages: facts.stages, turns: turnsBeforeVisit(facts.turns, visit) },
      config,
      false,
    ).seats.find((seat) => seat.participantRef === participantRef)!
      .currentTarget,
    darts: visit.darts,
  }));
}

function statsFor(
  seat: TuodSeatState,
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  inputModeKey: string | null,
): TuodSeatResult {
  const seatTurns = facts.turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const doubleAccuracy = (() => {
    if (inputModeKey !== "VISUAL_BOARD") return null;
    const { hits, misses } = classifyDoubleAttempts(
      tuodCheckoutVisits(seatTurns, facts, config, seat.participantRef),
    );
    return accuracyDisplay(hits, hits + misses);
  })();
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    target: seat.currentTarget,
    doubleAccuracy,
  };
}

function computeStats(
  state: TuodState,
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  inputModeKey: string | null,
): TuodResultsSnapshot {
  return {
    winningSideKey: state.winningSideKey,
    status: state.status === "TIE" ? "TIE" : "COMPLETE",
    seats: state.seats.map((seat) => statsFor(seat, facts, config, inputModeKey)),
  };
}
```

Add the `accuracyDisplay` import (alongside the file's existing imports):

```typescript
import { accuracyDisplay } from "@lib/game/play-visit-stats";
```

Update the `computeStats` call site (current line 623) inside `uploadAndCompleteSession`:

```typescript
        (finalState) =>
          computeStats(
            finalState,
            { stages: this.$store.game.stages, turns: this.$store.game.turns },
            this.$store.game.configSnapshot!,
            this.$store.game.inputModeKey,
          ),
```

- [ ] **Step 6: Update the result modal**

In `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro`, replace the `STAT_ROWS` array (current lines 8-13):

```typescript
const STAT_ROWS = [
  { label: "Target reached", key: "target" },
  { label: "Double Accuracy", key: "doubleAccuracy", fallback: "'—'" },
] as const;
```

- [ ] **Step 7: Run the test file to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`
Expected: PASS, every test green.

- [ ] **Step 8: Run the full suite**

Run: `cd app && npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/tuod-play.data.ts app/src/components/layout/games/result-modals/TenUpOneDownResults.astro app/tests/lib/game/tuod-play.data.test.ts
git commit -m "$(cat <<'EOF'
Replace TUOD's round-level attempts/successes/failures with doubleAccuracy

Same bug as 501, one level up: attempts/successes/failures counted whole
rounds, not darts. doubleAccuracy classifies every dart against the
double its round's target needed, via the shared classifier.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LnRPDLeH3R29sCj3JMhZGt
EOF
)"
```

---

### Task 4: Wire 121 — add `doubleAccuracy` (new stat, nothing replaced)

**Files:**
- Modify: `app/src/lib/game/types.ts:758-764` (`OneTwentyOneSeatResult`)
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts` (`statsFor`, `computeStats`, the `uploadAndCompleteSession` call site)
- Modify: `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro:6-9`
- Modify: `app/tests/lib/game/one-twenty-one-play.data.test.ts`

**Interfaces:**
- Consumes: `classifyDoubleAttempts`, `CheckoutVisitDarts` (Task 1); `accuracyDisplay` from `@lib/game/play-visit-stats`; `foldOneTwentyOneState` (already exported, `one-twenty-one.engine.module.ts:311`); `turnsBeforeVisit` (already exported, `turn-log.module.ts`).
- Produces: `OneTwentyOneSeatResult.doubleAccuracy: string | null` — additive.

- [ ] **Step 1: Write the failing test — add a VISUAL_BOARD double-accuracy test**

Add to `app/tests/lib/game/one-twenty-one-play.data.test.ts`, in the main `describe("oneTwentyOnePlay", ...)` block:

```typescript
  it("computes a VISUAL_BOARD double accuracy from a missed checkout attempt", async () => {
    vi.mocked(sessionsApi.appendBatch).mockResolvedValue(undefined as any);
    vi.mocked(sessionsApi.completeSession).mockResolvedValue({
      sessionId: "session-1",
      statusKey: "COMPLETED",
      completedAt: "2026-09-05T10:00:00Z",
    });
    store.game.inputModeKey = "VISUAL_BOARD";
    const play = createPlay();
    play.engine = oneTwentyOneEngineFactory.create(config) as any;

    // Starting target 121 (odd -- not directly finishable). Two scoring
    // darts bring the remaining to 40 (directly finishable on D20); the
    // third hits inner single 20 -- same segment as the required double,
    // so it's classified as a missed checkout attempt.
    await play.recordDart.call(play, {
      hitTargetNumber: 13,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: -102,
    });
    await play.recordDart.call(play, {
      hitTargetNumber: 14,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: -102,
    });
    await play.recordDart.call(play, {
      hitTargetNumber: 20,
      hitZoneKey: "INNER_SINGLE",
      locationX: 0,
      locationY: -50,
    });
    store.game.recordFacts(play.engine!.facts());

    await play.uploadAndCompleteSession();

    const [seat] = play.resultsSnapshot!.seats;
    expect(seat.doubleAccuracy).toBe("0.00%");
  });
```

(Reuse this file's existing `recordDart`-driven test style around line 254 for the exact call shape if `play.recordDart` needs to be called differently there — mirror that pattern rather than inventing a new one.)

- [ ] **Step 2: Add `doubleAccuracy: null,` to the 4 existing full-object snapshot assertions**

In `app/tests/lib/game/one-twenty-one-play.data.test.ts`, each of the 4 `average: <n>,` lines (currently 745, 780, 925, 932) sits inside an object literal describing one seat's `OneTwentyOneSeatResult`. Add a `doubleAccuracy: null,` line immediately after each `average: <n>,` line, matching that line's own indentation. For example, the block at (current) lines 919-926:

```typescript
      expect(play.resultsSnapshot?.seats).toEqual([
        {
          participantRef: "participant-1",
          sideKey: "A",
          target: 121,
          visits: 1,
          average: 100,
          doubleAccuracy: null,
        },
        {
          participantRef: "participant-2",
          sideKey: "B",
          target: 121,
          visits: 1,
          average: 80,
          doubleAccuracy: null,
        },
      ]);
```

Apply the same one-line addition at the other 2 occurrences (current lines 745 and 780), each inside their own `resultsSnapshot: { ..., seats: [{ ... average: 40 }] }` fixture object.

- [ ] **Step 3: Run the test file to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: FAIL — `statsFor` doesn't produce `doubleAccuracy` yet.

- [ ] **Step 4: Update the type**

In `app/src/lib/game/types.ts`, `OneTwentyOneSeatResult` (currently lines 758-764):

```typescript
export type OneTwentyOneSeatResult = {
  participantRef: string;
  sideKey: string;
  target: number;
  visits: number;
  average: number;
  doubleAccuracy: string | null;
};
```

- [ ] **Step 5: Update `statsFor`/`computeStats`**

In `app/src/lib/game/one-twenty-one-play.data.ts`, add imports alongside the existing ones:

```typescript
import {
  classifyDoubleAttempts,
  type CheckoutVisitDarts,
} from "@modules/game/double-attempt.module";
import { foldOneTwentyOneState } from "@modules/game/one-twenty-one.engine.module";
import { turnsBeforeVisit } from "@modules/game/turn-log.module";
import { accuracyDisplay } from "@lib/game/play-visit-stats";
```

Replace `statsFor`/`computeStats` (current lines 284-311):

```typescript
/**
 * One seat's checkout visits, each carrying the remaining score it opened
 * against -- folded via `foldOneTwentyOneState` over every turn strictly
 * before it, mirroring `OneTwentyOneEngine`'s own (private) `seatBeforeVisit`.
 * `timerExpired` is always `false` here: every visit folded this way is
 * already closed, and a closed visit's own `remainingInAttempt` never
 * depends on the live timer flag.
 */
function oneTwentyOneCheckoutVisits(
  seatTurns: readonly TurnFact[],
  stages: readonly StageFact[],
  turns: readonly TurnFact[],
  config: OneTwentyOneEngineConfig,
  participantRef: string,
): CheckoutVisitDarts[] {
  return seatTurns.map((visit) => ({
    startingRemaining: foldOneTwentyOneState(
      { stages, turns: turnsBeforeVisit(turns, visit) },
      config,
      false,
    ).seats.find((seat) => seat.participantRef === participantRef)!
      .remainingInAttempt,
    darts: visit.darts,
  }));
}

function statsFor(
  seat: OneTwentyOneSeatState,
  stages: readonly StageFact[],
  turns: readonly TurnFact[],
  config: OneTwentyOneEngineConfig,
  inputModeKey: string | null,
): OneTwentyOneSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const total = seatTurns.reduce((sum, turn) => sum + turn.totalScore, 0);
  const doubleAccuracy = (() => {
    if (inputModeKey !== "VISUAL_BOARD") return null;
    const { hits, misses } = classifyDoubleAttempts(
      oneTwentyOneCheckoutVisits(seatTurns, stages, turns, config, seat.participantRef),
    );
    return accuracyDisplay(hits, hits + misses);
  })();
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    target: seat.currentTarget,
    visits: seatTurns.length,
    average: seatTurns.length === 0 ? 0 : total / seatTurns.length,
    doubleAccuracy,
  };
}

function computeStats(
  state: OneTwentyOneState,
  stages: readonly StageFact[],
  turns: readonly TurnFact[],
  config: OneTwentyOneEngineConfig,
  inputModeKey: string | null,
): OneTwentyOneResultsSnapshot {
  return {
    target: state.seats[0].currentTarget,
    winningSideKey: state.winningSideKey,
    status: state.status === "WON" ? "WON" : "COMPLETE",
    seats: state.seats.map((seat) =>
      statsFor(seat, stages, turns, config, inputModeKey),
    ),
  };
}
```

Update the `computeStats` call site (current line 788) inside `uploadAndCompleteSession`:

```typescript
        (finalState) =>
          computeStats(
            finalState,
            this.$store.game.stages,
            this.$store.game.turns,
            this.$store.game.configSnapshot!,
            this.$store.game.inputModeKey,
          ),
```

(`OneTwentyOneEngineConfig` must already be imported in this file — it's the type `resumeEngine`/the engine factory already use; import it alongside the existing type imports if it isn't already in scope.)

- [ ] **Step 6: Update the result modal**

In `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro`, replace `STAT_ROWS` (current lines 6-9):

```typescript
const STAT_ROWS = [
  { label: "Visits", key: "visits" },
  { label: "Average", key: "average.toFixed(2)" },
  { label: "Double Accuracy", key: "doubleAccuracy", fallback: "'—'" },
] as const;
```

- [ ] **Step 7: Run the test file to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: PASS, every test green.

- [ ] **Step 8: Run the full suite**

Run: `cd app && npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/one-twenty-one-play.data.ts app/src/components/layout/games/result-modals/OneTwentyOneResults.astro app/tests/lib/game/one-twenty-one-play.data.test.ts
git commit -m "$(cat <<'EOF'
Add doubleAccuracy to 121 results (net-new dart-level checkout stat)

121 had no checkout-shaped stat before this. doubleAccuracy classifies
every dart against the double its ladder target needed, via the same
shared classifier 501 and TUOD now use.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LnRPDLeH3R29sCj3JMhZGt
EOF
)"
```

---

### Task 5: Persisted 501 view — `v_double_out_checkout_darts`

**Scope correction from the spec:** the spec described one view covering 501/TUOD/121 with a SQL-computed `remaining_before_dart`. That's only true for 501, whose per-visit starting remaining is a plain running-sum reduction (a leg resets to `startingScore`, nothing else). TUOD/121's starting remaining is a ladder fold (`finishBonus`/`missPenalty` escalation, clamped) — reproducing that in SQL would put real game-engine logic in a view, which `05-Views.md` forbids. This task scopes the view to `501` only; TUOD/121 persisted double-accuracy reads are follow-up work needing an application-layer replay (fetch raw dart facts, run `foldTuodState`/`foldOneTwentyOneState` + `classifyDoubleAttempts` in TypeScript), not a SQL view. The live in-session stat (Tasks 2-4) is unaffected — it already runs in TypeScript for all three games.

**Files:**
- Create: `database/migrations/0024_double_out_checkout_darts_view.sql`
- Create: `database/verification/0024_double_out_checkout_darts_view_checks.sql`

**Interfaces:**
- Consumes: `darts`, `turns`, `exercise_stages`, `exercise_sessions`, `participants`, `game_types`, `input_modes` tables (all existing).
- Produces: `v_double_out_checkout_darts` (session_id, player_id, stage_id, turn sequence, dart sequence, hit_target_number, hit_zone_key, score, remaining_before_dart), scoped to the owning participant and `game_type_key = '501'` + `input_mode_key = 'VISUAL_BOARD'`.

- [ ] **Step 1: Write the migration**

```sql
-- database/migrations/0024_double_out_checkout_darts_view.sql
-- ============================================================
-- v_double_out_checkout_darts: raw per-dart facts for 501
-- VISUAL_BOARD sessions, plus the remaining score each dart
-- opened against, for reproducing dart-level double-attempt
-- accuracy outside the live in-session read.
--
-- Scoped to 501 only. TUOD/121's "remaining before a dart"
-- depends on a ladder fold (finishBonus/missPenalty escalation)
-- that is game-engine logic, not SQL arithmetic -- 05-Views.md
-- forbids that in a view. Their persisted double-accuracy reads
-- are a follow-up needing an application-layer replay instead.
--
-- remaining_before_dart resets at each LEG (exercise_stage_id)
-- boundary to the session's own starting_score, which 501 does
-- not store per-session (it lives in exercise_configurations'
-- JSONB snapshot) -- so this view exposes the running SUM of
-- prior dart scores within (stage, participant) instead, and the
-- application read layer (which already has the session's
-- configuration snapshot) adds its own starting_score to get the
-- true remaining. This keeps the view a plain arithmetic
-- projection, never a JSONB-parsing one.
--
-- Scoped to the session's owning participant, mirroring
-- v_dart_analytics/v_dart_locations (migration 0023).
-- ============================================================

-- migrate:up
CREATE VIEW v_double_out_checkout_darts AS
SELECT es.id AS session_id,
    es.player_id,
    st.id AS stage_id,
    t.sequence_number AS turn_sequence,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score,
    SUM(d.score) OVER (
        PARTITION BY st.id, t.participant_id
        ORDER BY t.sequence_number, d.dart_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prior_scored_in_stage
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
WHERE gt.implementation_key = '501'
    AND im.implementation_key = 'VISUAL_BOARD'
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_double_out_checkout_darts IS 'Raw per-dart facts for 501 VISUAL_BOARD sessions, plus prior score within the leg, for dart-level double-attempt accuracy (owning player only). prior_scored_in_stage + the session''s own starting_score gives remaining-before-dart in the application read layer.';

-- migrate:down
DROP VIEW IF EXISTS v_double_out_checkout_darts;
```

- [ ] **Step 2: Write the verification script**

```sql
-- database/verification/0024_double_out_checkout_darts_view_checks.sql
-- ============================================================
-- Verification: 0024_double_out_checkout_darts_view_checks.sql
--
-- Runs assertions against a live database, since no PostgreSQL
-- server exists in the container that authored
-- migrations/0024_double_out_checkout_darts_view.sql (D193).
--
--   1. v_double_out_checkout_darts returns the owning player's
--      501 VISUAL_BOARD darts, in (stage, turn, dart) order
--   2. prior_scored_in_stage is NULL for the first dart of a
--      leg and the running sum for later darts
--   3. a 121 (non-501) session's darts never appear
--
-- Everything runs inside one transaction that ends in ROLLBACK.
-- Lookup rows are resolved by implementation_key, never by
-- hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0024_double_out_checkout_darts_view_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0024.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000002401',
        'verification-0024-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002402',
        '01990000-0000-7000-8000-000000002401',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        now(),
        now()
    );

INSERT INTO exercise_sessions (
        id,
        activity_id,
        player_id,
        game_type_id,
        capture_mode_id,
        input_mode_id,
        status_id,
        ruleset_version_id,
        started_at,
        created_at
    )
SELECT '01990000-0000-7000-8000-000000002403',
    '01990000-0000-7000-8000-000000002402',
    '01990000-0000-7000-8000-000000002401',
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '501_V1';

INSERT INTO exercise_stages (
        id,
        exercise_session_id,
        stage_type_id,
        sequence_number,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002404',
        '01990000-0000-7000-8000-000000002403',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO participants (
        id,
        exercise_session_id,
        participant_type_id,
        player_id,
        display_name,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002405',
        '01990000-0000-7000-8000-000000002403',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000002401',
        'Verification Owner',
        now()
    );

INSERT INTO turns (
        id,
        exercise_stage_id,
        participant_id,
        sequence_number,
        total_score,
        completed_at,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002406',
        '01990000-0000-7000-8000-000000002404',
        '01990000-0000-7000-8000-000000002405',
        1,
        60,
        now(),
        now()
    );

INSERT INTO darts (
        id,
        turn_id,
        dart_number,
        hit_target_number,
        hit_zone_id,
        score,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002407',
        '01990000-0000-7000-8000-000000002406',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'),
        60,
        now()
    ),
    (
        '01990000-0000-7000-8000-000000002408',
        '01990000-0000-7000-8000-000000002406',
        2,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'DOUBLE'),
        40,
        now()
    );

-- ------------------------------------------------------------
-- 121 session (should never appear in this view).
-- ------------------------------------------------------------
INSERT INTO exercise_sessions (
        id,
        activity_id,
        player_id,
        game_type_id,
        capture_mode_id,
        input_mode_id,
        status_id,
        ruleset_version_id,
        started_at,
        created_at
    )
SELECT '01990000-0000-7000-8000-000000002409',
    '01990000-0000-7000-8000-000000002402',
    '01990000-0000-7000-8000-000000002401',
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '121_V1';

INSERT INTO exercise_stages (
        id,
        exercise_session_id,
        stage_type_id,
        sequence_number,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000240a',
        '01990000-0000-7000-8000-000000002409',
        (SELECT id FROM stage_types WHERE implementation_key = 'ROUND'),
        1,
        now()
    );

INSERT INTO participants (
        id,
        exercise_session_id,
        participant_type_id,
        player_id,
        display_name,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000240b',
        '01990000-0000-7000-8000-000000002409',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000002401',
        'Verification Owner',
        now()
    );

INSERT INTO turns (
        id,
        exercise_stage_id,
        participant_id,
        sequence_number,
        total_score,
        completed_at,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000240c',
        '01990000-0000-7000-8000-00000000240a',
        '01990000-0000-7000-8000-00000000240b',
        1,
        60,
        now(),
        now()
    );

INSERT INTO darts (
        id,
        turn_id,
        dart_number,
        hit_target_number,
        hit_zone_id,
        score,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000240d',
        '01990000-0000-7000-8000-00000000240c',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'),
        60,
        now()
    );

-- ------------------------------------------------------------
-- Step 1: returns exactly the 2 501 darts, in dart order.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_double_out_checkout_darts returns exactly 2 rows for the 501 session',
    CASE
        WHEN count(*) = 2 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 2, found %s', count(*))
FROM v_double_out_checkout_darts
WHERE session_id = '01990000-0000-7000-8000-000000002403';

-- ------------------------------------------------------------
-- Step 2: prior_scored_in_stage is NULL for dart 1, 60 for dart 2.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'dart 1 has no prior score in the stage',
    CASE
        WHEN prior_scored_in_stage IS NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('prior_scored_in_stage=%s (expected NULL)', prior_scored_in_stage)
FROM v_double_out_checkout_darts
WHERE session_id = '01990000-0000-7000-8000-000000002403'
    AND dart_number = 1;

INSERT INTO verification_results
SELECT '2',
    'dart 2 carries dart 1''s score as its prior score in the stage',
    CASE
        WHEN prior_scored_in_stage = 60 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('prior_scored_in_stage=%s (expected 60)', prior_scored_in_stage)
FROM v_double_out_checkout_darts
WHERE session_id = '01990000-0000-7000-8000-000000002403'
    AND dart_number = 2;

-- ------------------------------------------------------------
-- Step 3: the 121 session's dart never appears.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'a 121 session''s darts do not appear in v_double_out_checkout_darts',
    CASE
        WHEN count(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 0, found %s', count(*))
FROM v_double_out_checkout_darts
WHERE session_id = '01990000-0000-7000-8000-000000002409';

-- ------------------------------------------------------------
-- Anti-vacuity guard (D192): assert the count of checks that
-- actually ran, separately from their pass/fail results.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'all 4 view-driven checks actually ran',
    CASE
        WHEN count(*) = 4 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 4 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3');

-- ------------------------------------------------------------
-- Results
-- ------------------------------------------------------------
SELECT step,
    result,
    check_name,
    detail
FROM verification_results
ORDER BY step,
    check_name;

SELECT CASE
        WHEN count(*) FILTER (
            WHERE result = 'FAIL'
        ) = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format(
            '%s OF %s CHECKS FAILED',
            count(*) FILTER (
                WHERE result = 'FAIL'
            ),
            count(*)
        )
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 3: Apply the migration and introspect**

Run: `cd app && npm run db:migrate && npm run db:introspect`
Expected: migration `0024` applies cleanly; `drizzle-kit introspect` regenerates `app/src/db/schema.ts` / `app/src/db/meta/*` to include `v_double_out_checkout_darts` (no manual edits to those generated files).

- [ ] **Step 4: Run the verification script against the real database**

Run: `psql "$DATABASE_URL" -f database/verification/0024_double_out_checkout_darts_view_checks.sql`
Expected: `ALL 4 CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/0024_double_out_checkout_darts_view.sql database/verification/0024_double_out_checkout_darts_view_checks.sql app/src/db/schema.ts app/src/db/meta/
git commit -m "$(cat <<'EOF'
Add v_double_out_checkout_darts view for persisted 501 checkout accuracy

Scoped to 501 only -- TUOD/121's remaining-before-dart needs a ladder
fold (game-engine logic), which doesn't belong in a view per
05-Views.md. Exposes raw per-dart facts plus the running score within
the leg; the application read layer adds the session's own
starting_score to get true remaining-before-dart.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LnRPDLeH3R29sCj3JMhZGt
EOF
)"
```

---

### Task 6: Docs, decisions, and final validation

**Files:**
- Modify: `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md` (register `v_double_out_checkout_darts`)
- Modify: `docs/architecture/05-Database/05-Views.md` (add to the Implemented Views table)
- Modify: `docs/architecture/04-Architecture-patterns.md` (note the shared classifier under Pattern 9 or near Pattern 18's `checkout-bust.module.ts` paragraph)
- Modify: `decisions/game-engine.md` (append-only entry)
- Run: `context-maintenance` skill, `run-all-gates` skill

- [ ] **Step 1: Register the view in `05-Read-Model-Layer.md`**

Add a new section after `v_dart_locations` (before "Read Model Layer Summary"):

```markdown
# v_double_out_checkout_darts

## Category

Analytics View

## Purpose

Raw per-dart facts for 501 `VISUAL_BOARD` sessions, plus each dart's running score within its leg, for reproducing dart-level double-attempt accuracy outside the live in-session read. <!-- 2026-09-05 -->

## Sources

- darts → turns → exercise_stages → exercise_sessions → participants, game_types, input_modes

## Exposes

Session id, player id, stage id, turn sequence, dart number, hit target + hit zone key, score, and `prior_scored_in_stage` (the running SUM of that seat's earlier dart scores within the same leg). Scoped to `game_type_key = '501'`, `input_mode_key = 'VISUAL_BOARD'`, and the session's OWNING player (mirrors migration `0023`).

## Design Rationale

Scoped to 501 only: TUOD/121's "remaining before a dart" depends on their ladder fold (`finishBonus`/`missPenalty` escalation), which is game-engine logic and does not belong in a view (`05-Views.md`). `prior_scored_in_stage` is plain arithmetic (a running sum), not the true remaining score — 501's `starting_score` lives in the session's JSONB configuration snapshot, not a queryable column, so the application read layer (which already loads that snapshot) adds it to get remaining-before-dart, then runs it through `classifyDoubleAttempts` (`app/src/modules/game/double-attempt.module.ts`) — the same classifier the live in-session stat uses, never reimplemented in SQL.
```

Update the migration-list paragraph above `v_active_sessions` to mention migration `0024`.

- [ ] **Step 2: Add to `05-Views.md`'s Implemented Views table**

Add a row:

```markdown
| `v_double_out_checkout_darts` | Analytics | Raw per-dart facts + running leg score for 501 VISUAL_BOARD checkout accuracy, owning player only (2026-09-05) |
```

- [ ] **Step 3: Note the shared classifier in `04-Architecture-patterns.md`**

Under Pattern 18's paragraph on `checkout-bust.module.ts` (the one ending "...counting failed checkout attempts from a completed VISUAL_BOARD turn log."), add:

```markdown
`modules/game/double-attempt.module.ts` (D256) classifies whether each dart in a double-out session (501, TUOD, 121) was an eligible checkout-attempt dart and whether it hit or missed, from board hits alone -- no stored intent. `five-oh-one-play.data.ts`, `tuod-play.data.ts`, and `one-twenty-one-play.data.ts` each build its input (`CheckoutVisitDarts[]`, one entry per visit carrying the remaining score it opened against) from what they already have: 501 with a plain running-sum reduce over `totalScore` within a leg, TUOD/121 by refolding `turnsBeforeVisit` through their own already-exported `foldTuodState`/`foldOneTwentyOneState` -- the same "refold vs. plain reduce" choice documented two paragraphs up for `turnsBeforeVisit` itself. Replaced 501's leg-level `checkoutPercentage` and TUOD's round-level `attempts`/`successes`/`failures`, both of which measured legs/rounds, not darts; net-new for 121.
```

- [ ] **Step 4: Append the decision**

In `decisions/game-engine.md`, append after the last existing entry:

```markdown
### D256 — `double-attempt.module.ts` classifies dart-level double-attempt accuracy for 501/TUOD/121, replacing their leg/round-level checkout stats
Status: Accepted · Date: 2026-09-05
Context: 501's `checkoutPercentage` (`legsWon / (legsWon + checkoutAttemptCount)`) and TUOD's `attempts`/`successes`/`failures` both measured whole legs/rounds, not darts -- a won leg with zero busted visits reads 100% regardless of how many individual darts missed a double. 121 had no checkout stat at all.
Decision: Added `modules/game/double-attempt.module.ts`, classifying each dart against the double its remaining score needed at the moment it was thrown: eligible only when that remaining score is directly finishable by one dart (even and ≤40, or exactly 50); a double/bull hit is a hit or miss depending on whether it actually checked out; a single/treble hit counts as a miss only when it lands on the same or a board-adjacent segment (reusing `SECTOR_ORDER` from `board-geometry.module.ts`) to the required double; anything else (an unrelated single/treble, or a coordinate-less bounce-out) is excluded entirely -- a deliberate lay-up/reroute, never fabricated as a miss. Deliberately does not store or guess *which* double a player intended (D06's Singles Training precedent: naming an intent the player never held corrupts the analysis) -- only the geometric fact of where the dart landed relative to what the remaining score required.
Consequences: 501's `FiveOhOneSeatResult.checkoutPercentage` and TUOD's `attempts`/`successes`/`failures` are removed, replaced by `doubleAccuracy: string | null` (null outside VISUAL_BOARD capture, same gating `checkoutAttemptCount` used). 121 gains `doubleAccuracy` as a new field. A persisted view, `v_double_out_checkout_darts` (migration `0024`), covers 501 history reads only -- TUOD/121's remaining-before-dart needs their ladder fold (`foldTuodState`/`foldOneTwentyOneState`), which is game-engine logic and does not belong in SQL (`05-Views.md`); their persisted reads are deferred to a future application-layer replay. Full design: `docs/superpowers/specs/2026-09-05-double-out-checkout-accuracy-design.md`.
```

- [ ] **Step 5: Run the context-maintenance skill**

Invoke the `context-maintenance` skill and follow its procedure (CLAUDE.md sync, context-map registration if a new file inventory entry is needed, gate scripts, findings gate).

- [ ] **Step 6: Run the run-all-gates skill**

Invoke the `run-all-gates` skill (this task touched `app/`, `database/`, and `docs/`) and confirm every dispatched `check-*.sh` script and `validate:app`/`validate:database` checklist item passes.

- [ ] **Step 7: Final full validation**

Run: `cd app && npm run validate:app`
Expected: every step exits zero; the type gate reports 0 errors, 0 warnings, 0 hints.

Run: `cd app && npm run format:check`
Expected: clean (run `npm run format` first and commit any diff if not).

- [ ] **Step 8: Commit**

```bash
git add docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md docs/architecture/05-Database/05-Views.md docs/architecture/04-Architecture-patterns.md decisions/game-engine.md
git commit -m "$(cat <<'EOF'
Document double-attempt classifier: view registration, pattern note, D256

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LnRPDLeH3R29sCj3JMhZGt
EOF
)"
```

---

## Rollout order

Tasks 1-4 in order (each independently testable and shippable); Task 5 can run any time after Task 1 (no dependency on 2-4); Task 6 last, once all code changes are in.
