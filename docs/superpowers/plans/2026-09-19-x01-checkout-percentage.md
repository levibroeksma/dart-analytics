# X01 Checkout Percentage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the double/checkout statistic for 501, TUOD and 121 count the right darts, derive remaining-before-dart from one correct definition, and report the same number in the result modals and on `/statistics`.

**Architecture:** One classifier (`double-attempt.module.ts`) decides per dart whether it was a hit, a miss, or not an attempt. One shared builder (`checkout-visits.module.ts`) turns a session's fact log into the per-visit remaining the classifier consumes, replacing three private copies. A new view (`v_x01_checkout_darts`) exposes facts only — no running-total arithmetic in SQL — and the statistics service replays the ladder through the same builder the modals use, so the career number is by construction the sum of the per-game ones.

**Tech Stack:** TypeScript, Astro, Alpine, Vitest, Drizzle ORM, dbmate, PostgreSQL (Neon).

**Spec:** `docs/superpowers/specs/2026-09-19-x01-checkout-percentage-design.md`

## Global Constraints

- TDD: write the failing test, run it, watch it fail, then implement. No implementation before a red test.
- `npm test` runs the whole suite (`cd app && npm test`) — never a single file only when finishing a task.
- Never modify an applied migration (`0001`–`0037`). Schema change = new numbered migration + verification file.
- `app/src/db/schema.ts` is generated. Never hand-edit it; run `npm run db:introspect` after a migration.
- Reads go through views. No repository may select a raw runtime table.
- Comments: JSDoc only. No inline `//` or non-JSDoc `/* */` comments inside function bodies (`check-comments.sh` enforces this).
- Exported types live in type barrels (`modules/game/types.ts`, `lib/game/types.ts`, …), never inline in a module (`check-type-barrels.sh` enforces this). A non-exported local type alias inside a module is fine.
- `npm run format` before every commit; `npm run format:check` must be clean.
- Work on branch `fix/x01-checkout-percentage` (already created off `main`). Do not merge to `main` directly.
- Anything you notice that this plan does not ask you to change is captured as a GitHub issue via the `capturing-discovered-work` skill — never fixed in the same pass.

---

### Task 1: The classification rule

**Files:**
- Modify: `app/src/modules/game/double-attempt.module.ts`
- Test: `app/tests/modules/game/double-attempt.module.test.ts`

**Interfaces:**
- Consumes: `resolveCheckoutAttempt(remainingBefore: number, scored: number, endedOnDouble: boolean): { remainingAfter: number; checkedOut: boolean; busted: boolean }` from `@modules/game/checkout-bust.module`; `SECTOR_ORDER: readonly number[]` from `@lib/game/board/board-geometry.module`.
- Produces: `classifyDart(remaining: number, dart: DartFact): DartOutcome` and `classifyDoubleAttempts(visits: readonly CheckoutVisitDarts[]): { hits: number; misses: number }` — both already exported today, signatures unchanged, verdicts changed.

- [ ] **Step 1: Flip the bounce-out test and add the new cases**

In `app/tests/modules/game/double-attempt.module.test.ts`, replace the existing `"does not count a coordinate-less bounce-out miss as an attempt"` case with the block below, and add the rest inside the same `describe("classifyDoubleAttempts")`. Keep the existing `dart()` helper and every other existing case untouched.

```ts
  it("counts a bounce-out or off-board dart thrown at a double as a miss", () => {
    const visits = [{ startingRemaining: 40, darts: [dart(null, "MISS", 0)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("counts a dart that busts by overshooting as a miss (32 left, treble 20)", () => {
    const visits = [{ startingRemaining: 32, darts: [dart(20, "TREBLE", 60)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("counts a dart that busts by leaving exactly 1 as a miss (20 left, single 19)", () => {
    const visits = [{ startingRemaining: 20, darts: [dart(19, "SINGLE", 19)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("counts a dart that reaches zero off a single as a miss (20 left, single 20)", () => {
    const visits = [
      { startingRemaining: 20, darts: [dart(20, "INNER_SINGLE", 20)] },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("counts an inner single at 50 remaining as a missed bull, whatever the number", () => {
    const visits = [
      { startingRemaining: 50, darts: [dart(18, "INNER_SINGLE", 18)] },
      { startingRemaining: 50, darts: [dart(10, "INNER_SINGLE", 10)] },
      { startingRemaining: 50, darts: [dart(12, "INNER_SINGLE", 12)] },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 3 });
  });

  it("does not count an outer single or treble at 50 remaining as an attempt", () => {
    const visits = [
      { startingRemaining: 50, darts: [dart(18, "OUTER_SINGLE", 18)] },
      { startingRemaining: 50, darts: [dart(10, "TREBLE", 30)] },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 0 });
  });

  it("counts a treble that busts from 50 as a miss, ahead of the 50-remaining sector rule", () => {
    const visits = [{ startingRemaining: 50, darts: [dart(18, "TREBLE", 54)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 1 });
  });

  it("does not count an unbanded keypad single at 50 remaining, whose band is unknowable", () => {
    const visits = [{ startingRemaining: 50, darts: [dart(18, "SINGLE", 18)] }];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 0, misses: 0 });
  });

  it("scores the worked 101 example at one hit in four attempts", () => {
    const visits = [
      {
        startingRemaining: 101,
        darts: [
          dart(20, "TREBLE", 60),
          dart(9, "OUTER_SINGLE", 9),
          dart(16, "OUTER_SINGLE", 16),
        ],
      },
      {
        startingRemaining: 16,
        darts: [
          dart(null, "MISS", 0),
          dart(null, "MISS", 0),
          dart(8, "DOUBLE", 16),
        ],
      },
    ];
    expect(classifyDoubleAttempts(visits)).toEqual({ hits: 1, misses: 3 });
  });

  it("counts the boundary remainders 2 and 40 and excludes 41", () => {
    expect(classifyDart(2, dart(1, "DOUBLE", 2))).toBe("HIT");
    expect(classifyDart(40, dart(20, "DOUBLE", 40))).toBe("HIT");
    expect(classifyDart(41, dart(20, "TREBLE", 60))).toBe("NOT_ATTEMPT");
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `cd app && npx vitest run tests/modules/game/double-attempt.module.test.ts`
Expected: FAIL — the bounce-out, bust, inner-single-at-50 and 101-example cases report `{ hits: 0, misses: 0 }` or similar, because the current rule excludes them.

- [ ] **Step 3: Rewrite the classifier**

Replace the whole body of `app/src/modules/game/double-attempt.module.ts` with:

```ts
import { SECTOR_ORDER } from "@lib/game/board/board-geometry.module";
import { resolveCheckoutAttempt } from "./checkout-bust.module";
import type {
  CheckoutVisitDarts,
  DartFact,
  DartOutcome,
  DartZoneKey,
} from "./types";

export type { CheckoutVisitDarts };

/** The rings a finishing dart can land in; a hit here is an attempt whatever it scored. */
const RING_ZONES: ReadonlySet<DartZoneKey> = new Set([
  "DOUBLE",
  "INNER_BULL",
  "OUTER_BULL",
]);

/** Everything that lands in a numbered sector rather than a finishing ring. */
const SECTOR_ZONES: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "TREBLE",
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

/**
 * One dart's classification against the remaining score it was thrown at.
 *
 * Order matters. A dart that busts the visit is always an attempt, because
 * no one lays up into a bust -- so the bust test runs before the rules that
 * let a legal sector hit off as a deliberate reroute. At `remaining === 50`
 * the inner bull is the required finish, the outer bull is its own near
 * miss, and the inner single band (which nobody aims at) is a missed bull;
 * the outer single band and the trebles there are ordinary setup shots. The
 * unbanded `SINGLE` key that keypad capture writes can never prove which
 * band it was, so it stays excluded at 50.
 */
export function classifyDart(remaining: number, dart: DartFact): DartOutcome {
  if (!isDirectlyFinishable(remaining)) return "NOT_ATTEMPT";

  const endedOnDouble =
    dart.hitZoneKey === "DOUBLE" || dart.hitZoneKey === "INNER_BULL";
  if (endedOnDouble && dart.score === remaining) return "HIT";
  if (RING_ZONES.has(dart.hitZoneKey)) return "MISS";
  if (dart.hitZoneKey === "MISS") return "MISS";

  const { busted } = resolveCheckoutAttempt(remaining, dart.score, false);
  if (busted) return "MISS";

  if (remaining === 50) {
    return dart.hitZoneKey === "INNER_SINGLE" ? "MISS" : "NOT_ATTEMPT";
  }

  if (SECTOR_ZONES.has(dart.hitZoneKey) && dart.hitTargetNumber !== null) {
    return isBoardAdjacentOrSame(dart.hitTargetNumber, remaining / 2)
      ? "MISS"
      : "NOT_ATTEMPT";
  }

  return "NOT_ATTEMPT";
}

/**
 * Classifies every dart across `visits` as a checkout-attempt hit, miss, or
 * not an attempt at all (a deliberate lay-up/reroute) -- see
 * `docs/superpowers/specs/2026-09-19-x01-checkout-percentage-design.md` for
 * the full rule and its ten reference darts.
 */
export function classifyDoubleAttempts(visits: readonly CheckoutVisitDarts[]): {
  hits: number;
  misses: number;
} {
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

- [ ] **Step 4: Run the full suite**

Run: `cd app && npm test`
Expected: PASS. If `tests/lib/game/five-oh-one-play.data.test.ts`, `tuod-play.data.test.ts` or `one-twenty-one-play.data.test.ts` now report a different percentage, that is the new rule working — update the expected value in those tests to match the new classification and note which dart changed verdict in the commit message. Do not weaken a test to make it pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/levi.broeksma/Dev/dart-analytics
npm --prefix app run format
git add app/src/modules/game/double-attempt.module.ts app/tests/modules/game/double-attempt.module.test.ts app/tests/lib/game
git commit -m "fix: count bounce-outs, busts and bull-band misses as double attempts

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Shared checkout-visit builder

**Files:**
- Create: `app/src/modules/game/checkout-visits.module.ts`
- Create: `app/tests/modules/game/checkout-visits.module.test.ts`
- Modify: `app/src/lib/game/five-oh-one-play.data.ts` (remove the private `fiveOhOneCheckoutVisits`, import the shared one)
- Modify: `app/src/lib/game/tuod-play.data.ts` (remove the private `tuodCheckoutVisits`)
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts` (remove the private `oneTwentyOneCheckoutVisits`)

**Interfaces:**
- Consumes: `foldTuodState(facts, config, timerExpired)`, `foldOneTwentyOneState(facts, config, timerExpired)`, `turnsBeforeVisit(turns, visit)`, `classifyDoubleAttempts` from Task 1.
- Produces:
  - `fiveOhOneCheckoutVisits(seatTurns: readonly TurnFact[], startingScore: number): CheckoutVisitDarts[]`
  - `tuodCheckoutVisits(seatTurns: readonly TurnFact[], facts: EngineFacts, config: Seated<TuodSnapshot>, participantRef: string): CheckoutVisitDarts[]`
  - `oneTwentyOneCheckoutVisits(seatTurns: readonly TurnFact[], stages: readonly StageFact[], turns: readonly TurnFact[], config: OneTwentyOneLadderConfig, participantRef: string): CheckoutVisitDarts[]` where `OneTwentyOneLadderConfig` is a module-local union of `Seated<OneTwentyOneSnapshot>` and `Seated<OneTwentyOneV2Snapshot>`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/game/checkout-visits.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fiveOhOneCheckoutVisits } from "@modules/game/checkout-visits.module";
import type { DartFact, TurnFact } from "@modules/types";

function dart(
  sequence: number,
  hitTargetNumber: number | null,
  hitZoneKey: DartFact["hitZoneKey"],
  score: number,
): DartFact {
  return {
    sequence,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber,
    hitZoneKey,
    score,
    locationX: null,
    locationY: null,
  };
}

function turn(
  sequence: number,
  totalScore: number,
  darts: DartFact[],
): TurnFact {
  return {
    clientKey: `turn-${sequence}`,
    stageClientKey: "leg-1",
    participantRef: "seat-1",
    sequence,
    completedAt: "2026-09-19T10:00:00.000Z",
    totalScore,
    darts,
  };
}

describe("fiveOhOneCheckoutVisits", () => {
  it("opens the first visit of a leg on the session's starting score", () => {
    const visits = fiveOhOneCheckoutVisits(
      [turn(1, 60, [dart(1, 20, "TREBLE", 60)])],
      501,
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501]);
  });

  it("subtracts each visit's counted total from the next visit's remaining", () => {
    const visits = fiveOhOneCheckoutVisits(
      [
        turn(1, 60, [dart(1, 20, "TREBLE", 60)]),
        turn(2, 100, [dart(1, 20, "TREBLE", 60), dart(2, 20, "DOUBLE", 40)]),
      ],
      501,
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501, 441]);
  });

  it("ignores a busted visit's thrown darts, which the engine zeroes out of the counted total", () => {
    const busted = turn(2, 0, [dart(1, 20, "TREBLE", 60)]);
    const visits = fiveOhOneCheckoutVisits(
      [turn(1, 60, [dart(1, 20, "TREBLE", 60)]), busted, turn(3, 0, [])],
      501,
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([
      501, 441, 441,
    ]);
  });

  it("restarts each leg at the starting score", () => {
    const legTwo: TurnFact = {
      ...turn(2, 60, [dart(1, 20, "TREBLE", 60)]),
      stageClientKey: "leg-2",
    };
    const visits = fiveOhOneCheckoutVisits(
      [turn(1, 60, [dart(1, 20, "TREBLE", 60)]), legTwo],
      501,
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501, 501]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd app && npx vitest run tests/modules/game/checkout-visits.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/game/checkout-visits.module'`.

- [ ] **Step 3: Create the shared module**

Create `app/src/modules/game/checkout-visits.module.ts`:

```ts
import type {
  OneTwentyOneSnapshot,
  OneTwentyOneV2Snapshot,
  Seated,
  TuodSnapshot,
} from "@lib/types";
import { foldOneTwentyOneState } from "./one-twenty-one.engine.module";
import { foldTuodState } from "./tuod.engine.module";
import { turnsBeforeVisit } from "./turn-log.module";
import type {
  CheckoutVisitDarts,
  EngineFacts,
  StageFact,
  TurnFact,
} from "./types";

type OneTwentyOneLadderConfig =
  | Seated<OneTwentyOneSnapshot>
  | Seated<OneTwentyOneV2Snapshot>;

/**
 * One seat's checkout visits, each carrying the remaining score it opened
 * against -- `startingScore` at the start of a leg, or the running total of
 * that seat's own earlier visits in the same leg subtracted from it, since a
 * leg's remaining score never carries across a leg boundary.
 *
 * Reads `totalScore`, the visit's *counted* score, which the engine zeroes on
 * a bust while the visit keeps its darts' real board scores. Summing the
 * darts instead would move every later dart in the leg onto a remaining the
 * player was never on.
 */
export function fiveOhOneCheckoutVisits(
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
 * One seat's checkout visits, each carrying the target it opened against --
 * folded via `foldTuodState` over every turn strictly before it, mirroring
 * `TuodEngine`'s own (private) `targetBeforeVisit`. `timerExpired` is always
 * `false` here: every visit folded this way is already closed, and a closed
 * visit's own `currentTarget` never depends on the live timer flag.
 */
export function tuodCheckoutVisits(
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

/**
 * One seat's checkout visits, each carrying the remaining score it opened
 * against -- folded via `foldOneTwentyOneState` over every turn strictly
 * before it, mirroring `OneTwentyOneEngine`'s own (private)
 * `seatBeforeVisit`. `timerExpired` is always `false` here, for the same
 * reason it is in `tuodCheckoutVisits`.
 */
export function oneTwentyOneCheckoutVisits(
  seatTurns: readonly TurnFact[],
  stages: readonly StageFact[],
  turns: readonly TurnFact[],
  config: OneTwentyOneLadderConfig,
  participantRef: string,
): CheckoutVisitDarts[] {
  return seatTurns.map((visit) => ({
    startingRemaining: foldOneTwentyOneState(
      { stages: [...stages], turns: turnsBeforeVisit(turns, visit) },
      config,
      false,
    ).seats.find((seat) => seat.participantRef === participantRef)!
      .remainingInAttempt,
    darts: visit.darts,
  }));
}
```

If `foldOneTwentyOneState`'s `EngineFacts` parameter types `stages` as a mutable array, `[...stages]` above already satisfies it; if it accepts `readonly`, drop the spread.

- [ ] **Step 4: Run the new test**

Run: `cd app && npx vitest run tests/modules/game/checkout-visits.module.test.ts`
Expected: PASS.

- [ ] **Step 5: Repoint the three play-data files**

In each file, delete the private builder function and its JSDoc, and import the shared one instead. The call sites keep the same arguments.

`app/src/lib/game/five-oh-one-play.data.ts`: delete `fiveOhOneCheckoutVisits` (around lines 173-191) and add to the existing `@modules/game/...` import block:

```ts
import { fiveOhOneCheckoutVisits } from "@modules/game/checkout-visits.module";
```

`app/src/lib/game/tuod-play.data.ts`: delete `tuodCheckoutVisits` (around lines 139-161) and add:

```ts
import { tuodCheckoutVisits } from "@modules/game/checkout-visits.module";
```

Remove the now-unused `turnsBeforeVisit` import from this file if nothing else uses it.

`app/src/lib/game/one-twenty-one-play.data.ts`: delete `oneTwentyOneCheckoutVisits` (around lines 298-321) and add:

```ts
import { oneTwentyOneCheckoutVisits } from "@modules/game/checkout-visits.module";
```

Remove the now-unused `turnsBeforeVisit` import if nothing else uses it. Keep the local `OneTwentyOneConfig` type if other functions still use it; the shared builder accepts it structurally.

- [ ] **Step 6: Run the full suite and the type check**

Run: `cd app && npm test && npm run check`
Expected: PASS, with no unused-import errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/levi.broeksma/Dev/dart-analytics
npm --prefix app run format
git add app/src/modules/game/checkout-visits.module.ts app/tests/modules/game/checkout-visits.module.test.ts app/src/lib/game
git commit -m "refactor: one shared checkout-visit builder for 501, TUOD and 121

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The `v_x01_checkout_darts` view

**Files:**
- Create: `database/migrations/0039_x01_checkout_darts_view.sql`
- Create: `database/verification/0039_x01_checkout_darts_view_checks.sql`
- Modify (generated, do not hand-edit): `app/src/db/schema.ts` via `npm run db:introspect`

**Interfaces:**
- Produces: view `v_x01_checkout_darts`, one row per dart, columns `session_id`, `player_id`, `game_type_key`, `ruleset_version_key`, `configuration`, `stage_id`, `stage_sequence`, `stage_type_key`, `parent_stage_id`, `turn_id`, `turn_sequence`, `turn_total_score`, `turn_completed_at`, `participant_id`, `dart_number`, `hit_target_number`, `hit_zone_key`, `score`. Drizzle will name it `vX01CheckoutDarts` after introspection — confirm the generated name before using it in Task 4.

- [ ] **Step 1: Write the migration**

Create `database/migrations/0039_x01_checkout_darts_view.sql`:

```sql
-- ============================================================
-- v_x01_checkout_darts: per-dart facts for the three X01
-- ladders (501, TUOD, 121) under VISUAL_BOARD capture, for
-- dart-level checkout accuracy outside the live in-session
-- read.
--
-- Replaces v_double_out_checkout_darts (0024, widened in
-- 0036), which projected a running SUM(d.score) as the leg's
-- prior score. A busted visit stores turns.total_score = 0
-- while keeping its darts' real board scores -- that
-- divergence is deliberate (it is what makes bust rate
-- computable) -- so the SUM over darts overstated the leg's
-- counted score and moved every later dart in that leg onto a
-- remaining the player was never on.
--
-- This view therefore projects no running totals at all. It
-- exposes facts only: the counted turn total, the dart, the
-- stage tree, the session's configuration snapshot and its
-- ruleset version. The application read layer folds them
-- through the same checkout-visits builder the live result
-- modals use, so remaining-before-dart has exactly one
-- definition. TUOD's and 121's ladders (finishBonus /
-- missPenalty escalation) are game-engine logic that
-- 05-Views.md forbids in a view, which is why they could not
-- join 501 here until the fold moved into the app.
--
-- Scoped to the session's owning participant, mirroring
-- v_dart_analytics / v_dart_locations (migration 0023). The
-- configuration join is LEFT and cannot fan out:
-- uq_exercise_configuration_session makes
-- exercise_configurations at most one row per session.
-- ============================================================

-- migrate:up
CREATE VIEW v_x01_checkout_darts AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    rv.implementation_key AS ruleset_version_key,
    ec.configuration,
    st.id AS stage_id,
    st.sequence_number AS stage_sequence,
    stg.implementation_key AS stage_type_key,
    st.parent_stage_id,
    t.id AS turn_id,
    t.sequence_number AS turn_sequence,
    t.total_score AS turn_total_score,
    t.completed_at AS turn_completed_at,
    t.participant_id,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN stage_types stg ON stg.id = st.stage_type_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN ruleset_versions rv ON rv.id = es.ruleset_version_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
WHERE gt.implementation_key IN ('501', 'TUOD', 'ONE_TWENTY_ONE')
    AND im.implementation_key = 'VISUAL_BOARD'
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_x01_checkout_darts IS 'Per-dart facts plus the stage tree, counted turn total, ruleset version and configuration snapshot for 501/TUOD/121 VISUAL_BOARD sessions (owning player only). Remaining-before-dart is folded in the application read layer, never here.';

DROP VIEW IF EXISTS v_double_out_checkout_darts;

-- migrate:down
DROP VIEW IF EXISTS v_x01_checkout_darts;
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
    ) AS prior_scored_in_stage,
    (ec.configuration ->> 'starting_score')::int AS starting_score
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
WHERE gt.implementation_key = '501'
    AND im.implementation_key = 'VISUAL_BOARD'
    AND p.player_id = es.player_id;
```

Before running it, confirm the two column/key names this migration assumes against the applied chain: `exercise_sessions.ruleset_version_id` and the TUOD game type's `implementation_key` (grep `database/seeds/0001_reference_data.sql` and `database/migrations/0004*`–`0006*`). If TUOD's key differs (e.g. `TEN_UP_ONE_DOWN`), use the real key in the `IN (...)` list and in Task 4's dispatch.

- [ ] **Step 2: Write the verification file**

Copy `database/verification/0024_double_out_checkout_darts_view_checks.sql` to `database/verification/0039_x01_checkout_darts_view_checks.sql` and adapt it: keep the `BEGIN; … ROLLBACK;` envelope, the `verification_results` temp table, the resolve-lookups-by-`implementation_key` rule, and the fixture-insert style; bump every hardcoded UUID from the `…0000-0000-7000-8000-0000000024xx` block to a `…0000-0000-7000-8000-0000000039xx` block so the two files can run in the same database; and add a TUOD and a 121 session to the fixture alongside the existing 501 one. It must assert:

1. `v_x01_checkout_darts` exists and `v_double_out_checkout_darts` does not.
2. The view exposes every column listed in this task's Interfaces block.
3. Only `501`, `TUOD` and `ONE_TWENTY_ONE` game types appear.
4. Only `VISUAL_BOARD` sessions appear.
5. Every row's `participant_id` belongs to a participant whose `player_id` equals the session's `player_id`.

- [ ] **Step 3: Apply and introspect**

Run:
```bash
cd app
npm run db:status
npm run db:migrate
npm run db:introspect
npm run db:verify
```
Expected: `0039` applied, introspection regenerates `src/db/schema.ts` with the new view, `db:verify` passes.

- [ ] **Step 4: Commit**

```bash
cd /Users/levi.broeksma/Dev/dart-analytics
npm --prefix app run format
git add database/migrations/0039_x01_checkout_darts_view.sql database/verification/0039_x01_checkout_darts_view_checks.sql app/src/db/schema.ts database/schema.sql
git commit -m "feat(db): v_x01_checkout_darts exposes facts only for all three X01 ladders

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Career read through the shared builder

**Files:**
- Create: `app/src/modules/stats/x01-checkout-sessions.module.ts`
- Create: `app/tests/modules/stats/x01-checkout-sessions.module.test.ts`
- Modify: `app/src/modules/stats/types.ts` (add the row type)
- Modify: `app/src/repositories/statistics.repository.ts` (replace `findDoubleOutVisits`)
- Modify: `app/src/services/statistics.service.ts` (call the new pair)
- Modify: `app/tests/services/statistics.service.test.ts`

**Interfaces:**
- Consumes: `fiveOhOneCheckoutVisits`, `tuodCheckoutVisits`, `oneTwentyOneCheckoutVisits` (Task 2); `toSnapshot(key, wire)` from `@lib/game/rulesets/config-codec`; view `v_x01_checkout_darts` (Task 3).
- Produces:
  - `X01CheckoutDartRow` (exported type in `modules/stats/types.ts`)
  - `checkoutVisitsFromRows(rows: readonly X01CheckoutDartRow[]): CheckoutVisitDarts[]`
  - `findX01CheckoutDarts(db, playerId): Promise<X01CheckoutDartRow[]>` replacing `findDoubleOutVisits`

- [ ] **Step 1: Add the row type**

In `app/src/modules/stats/types.ts`, append:

```ts
/**
 * One row of `v_x01_checkout_darts`: a single dart, carrying enough of its
 * session, stage and turn to rebuild the fact log the checkout-visit builders
 * fold. `configuration` is the session's stored snapshot -- snake_case
 * ruleset fields plus a camelCase `seats` array, exactly as
 * `session.service.ts` writes it.
 */
export type X01CheckoutDartRow = {
  sessionId: string;
  gameTypeKey: string;
  rulesetVersionKey: string;
  configuration: Record<string, unknown> | null;
  stageId: string;
  stageSequence: number;
  stageTypeKey: string;
  parentStageId: string | null;
  turnId: string;
  turnSequence: number;
  turnTotalScore: number;
  turnCompletedAt: string | null;
  participantId: string;
  dartNumber: number;
  hitTargetNumber: number | null;
  hitZoneKey: DartFact["hitZoneKey"];
  score: number;
};
```

Add `DartFact` to that file's existing type imports if it is not already imported there.

- [ ] **Step 2: Write the failing test**

Create `app/tests/modules/stats/x01-checkout-sessions.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkoutVisitsFromRows } from "@modules/stats/x01-checkout-sessions.module";
import type { X01CheckoutDartRow } from "@modules/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "HOME",
    participantTypeKey: "PLAYER",
  },
];

function row(overrides: Partial<X01CheckoutDartRow>): X01CheckoutDartRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    configuration: { starting_score: 501, legs_to_win: 1, seats: SEATS },
    stageId: "stage-1",
    stageSequence: 1,
    stageTypeKey: "LEG",
    parentStageId: null,
    turnId: "turn-1",
    turnSequence: 1,
    turnTotalScore: 60,
    turnCompletedAt: "2026-09-19T10:00:00.000Z",
    participantId: "participant-1",
    dartNumber: 1,
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    score: 60,
    ...overrides,
  };
}

describe("checkoutVisitsFromRows", () => {
  it("returns nothing for no rows", () => {
    expect(checkoutVisitsFromRows([])).toEqual([]);
  });

  it("opens a 501 leg's first visit on the configured starting score", () => {
    const visits = checkoutVisitsFromRows([row({})]);
    expect(visits).toEqual([
      { startingRemaining: 501, darts: [expect.objectContaining({ score: 60 })] },
    ]);
  });

  it("does not let a busted visit's darts move the next visit's remaining", () => {
    const visits = checkoutVisitsFromRows([
      row({}),
      row({
        turnId: "turn-2",
        turnSequence: 2,
        turnTotalScore: 0,
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
      }),
      row({
        turnId: "turn-3",
        turnSequence: 3,
        turnTotalScore: 0,
        dartNumber: 1,
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        score: 0,
      }),
    ]);
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([
      501, 441, 441,
    ]);
  });

  it("keeps two sessions' ladders separate", () => {
    const visits = checkoutVisitsFromRows([
      row({}),
      row({
        sessionId: "session-2",
        stageId: "stage-2",
        turnId: "turn-9",
        turnSequence: 1,
      }),
    ]);
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501, 501]);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `cd app && npx vitest run tests/modules/stats/x01-checkout-sessions.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/stats/x01-checkout-sessions.module'`.

- [ ] **Step 4: Write the module**

Create `app/src/modules/stats/x01-checkout-sessions.module.ts`:

```ts
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import type { RulesetVersionKey, SeatFact } from "@lib/types";
import {
  fiveOhOneCheckoutVisits,
  oneTwentyOneCheckoutVisits,
  tuodCheckoutVisits,
} from "@modules/game/checkout-visits.module";
import type {
  CheckoutVisitDarts,
  EngineFacts,
  StageFact,
  TurnFact,
  X01CheckoutDartRow,
} from "@modules/types";

type SessionRows = {
  rows: X01CheckoutDartRow[];
};

/** Rebuilds one session's stage list, newest row wins nothing -- stages are unique by id. */
function stagesOf(rows: readonly X01CheckoutDartRow[]): StageFact[] {
  const byId = new Map<string, StageFact>();
  for (const row of rows) {
    if (byId.has(row.stageId)) continue;
    byId.set(row.stageId, {
      clientKey: row.stageId,
      stageTypeKey: row.stageTypeKey as StageFact["stageTypeKey"],
      parentClientKey: row.parentStageId,
      sequence: row.stageSequence,
    });
  }
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}

/**
 * Rebuilds one session's turns, each carrying its own darts in dart order.
 * `totalScore` is the counted total the engine wrote, so a busted visit
 * arrives here as the zero it was recorded as.
 */
function turnsOf(rows: readonly X01CheckoutDartRow[]): TurnFact[] {
  const byId = new Map<string, TurnFact>();
  for (const row of rows) {
    let turn = byId.get(row.turnId);
    if (!turn) {
      turn = {
        clientKey: row.turnId,
        stageClientKey: row.stageId,
        participantRef: row.participantId,
        sequence: row.turnSequence,
        completedAt: row.turnCompletedAt,
        totalScore: row.turnTotalScore,
        darts: [],
      };
      byId.set(row.turnId, turn);
    }
    turn.darts.push({
      sequence: row.dartNumber,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: row.hitTargetNumber,
      hitZoneKey: row.hitZoneKey,
      score: row.score,
      locationX: null,
      locationY: null,
    });
  }
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}

/**
 * The session's stored configuration decoded back into the seated camelCase
 * snapshot its engine folds. `seats` is stored alongside the ruleset's own
 * snake_case fields and is already camelCase, so it is lifted out before the
 * codec runs and put back afterwards.
 */
function snapshotOf(
  rulesetVersionKey: string,
  configuration: Record<string, unknown> | null,
): Record<string, unknown> & { seats: readonly SeatFact[] } {
  const { seats = [], ...wire } = (configuration ?? {}) as {
    seats?: readonly SeatFact[];
  } & Record<string, unknown>;
  return {
    ...(toSnapshot(rulesetVersionKey as RulesetVersionKey, wire) as Record<
      string,
      unknown
    >),
    seats,
  };
}

function visitsForSession(rows: readonly X01CheckoutDartRow[]): CheckoutVisitDarts[] {
  const first = rows[0];
  if (!first) return [];

  const facts: EngineFacts = { stages: stagesOf(rows), turns: turnsOf(rows) };
  const participantRef = first.participantId;
  const seatTurns = facts.turns.filter(
    (turn) => turn.participantRef === participantRef,
  );
  const config = snapshotOf(first.rulesetVersionKey, first.configuration);

  if (first.gameTypeKey === "501") {
    return fiveOhOneCheckoutVisits(
      seatTurns,
      Number(config.startingScore ?? 0),
    );
  }
  if (first.gameTypeKey === "TUOD") {
    return tuodCheckoutVisits(
      seatTurns,
      facts,
      config as Parameters<typeof tuodCheckoutVisits>[2],
      participantRef,
    );
  }
  return oneTwentyOneCheckoutVisits(
    seatTurns,
    facts.stages,
    facts.turns,
    config as Parameters<typeof oneTwentyOneCheckoutVisits>[3],
    participantRef,
  );
}

/**
 * Every checkout visit the player owns, across every X01 session
 * `v_x01_checkout_darts` returns -- one fold per session, through the same
 * builders the live result modals use, so the career number can never
 * disagree with the per-game ones.
 */
export function checkoutVisitsFromRows(
  rows: readonly X01CheckoutDartRow[],
): CheckoutVisitDarts[] {
  const bySession = new Map<string, SessionRows>();
  for (const row of rows) {
    const bucket = bySession.get(row.sessionId) ?? { rows: [] };
    bucket.rows.push(row);
    bySession.set(row.sessionId, bucket);
  }
  return [...bySession.values()].flatMap((bucket) =>
    visitsForSession(bucket.rows),
  );
}
```

If the `seats` default in `snapshotOf` trips the type-barrel or comment gates, keep the logic identical and adjust only the syntax.

- [ ] **Step 5: Run the new test**

Run: `cd app && npx vitest run tests/modules/stats/x01-checkout-sessions.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Replace the repository read**

In `app/src/repositories/statistics.repository.ts`, delete `MutableCheckoutVisit` and `findDoubleOutVisits` entirely, swap the `vDoubleOutCheckoutDarts` import for the introspected name of the new view (confirm it in `app/src/db/schema.ts` — expected `vX01CheckoutDarts`), and add:

```ts
/**
 * Reads every X01 checkout dart the player owns through
 * `v_x01_checkout_darts`, ordered so a session's rows arrive in stage, turn
 * and dart order -- the order `checkoutVisitsFromRows` folds them in.
 */
export async function findX01CheckoutDarts(
  db: Db,
  playerId: string,
): Promise<X01CheckoutDartRow[]> {
  const rows = await db
    .select({
      sessionId: vX01CheckoutDarts.sessionId,
      gameTypeKey: vX01CheckoutDarts.gameTypeKey,
      rulesetVersionKey: vX01CheckoutDarts.rulesetVersionKey,
      configuration: vX01CheckoutDarts.configuration,
      stageId: vX01CheckoutDarts.stageId,
      stageSequence: vX01CheckoutDarts.stageSequence,
      stageTypeKey: vX01CheckoutDarts.stageTypeKey,
      parentStageId: vX01CheckoutDarts.parentStageId,
      turnId: vX01CheckoutDarts.turnId,
      turnSequence: vX01CheckoutDarts.turnSequence,
      turnTotalScore: vX01CheckoutDarts.turnTotalScore,
      turnCompletedAt: vX01CheckoutDarts.turnCompletedAt,
      participantId: vX01CheckoutDarts.participantId,
      dartNumber: vX01CheckoutDarts.dartNumber,
      hitTargetNumber: vX01CheckoutDarts.hitTargetNumber,
      hitZoneKey: vX01CheckoutDarts.hitZoneKey,
      score: vX01CheckoutDarts.score,
    })
    .from(vX01CheckoutDarts)
    .where(eq(vX01CheckoutDarts.playerId, playerId))
    .orderBy(
      vX01CheckoutDarts.sessionId,
      vX01CheckoutDarts.stageSequence,
      vX01CheckoutDarts.turnSequence,
      vX01CheckoutDarts.dartNumber,
    );

  return rows as X01CheckoutDartRow[];
}
```

Update the file's type imports: drop `CheckoutVisitDarts` and `DartFact` if nothing else in the file uses them, add `X01CheckoutDartRow`.

- [ ] **Step 7: Repoint the service**

In `app/src/services/statistics.service.ts`:

- swap the `findDoubleOutVisits` import for `findX01CheckoutDarts`,
- add `import { checkoutVisitsFromRows } from "@modules/stats/x01-checkout-sessions.module";`,
- replace the `doubleOutVisits` fetch and its use:

```ts
  const [sessions, visits, legs, checkoutDarts] = await Promise.all([
    findSessionSummaries(db, playerId),
    findVisitFacts(db, playerId),
    findLegFacts(db, playerId),
    findX01CheckoutDarts(db, playerId),
  ]);

  const bands = scoreBandCounts(visits);
  const checkoutVisits = checkoutVisitsFromRows(checkoutDarts);
  const { hits, misses } = classifyDoubleAttempts(checkoutVisits);
```

and pass `checkoutVisits` to `highestCheckout(...)` in place of `doubleOutVisits`.

- [ ] **Step 8: Update the service test**

In `app/tests/services/statistics.service.test.ts`, replace the `findDoubleOutVisits` mock with a `findX01CheckoutDarts` mock returning `X01CheckoutDartRow[]`, using rows shaped like Task 4 Step 2's `row()` helper. Add one case that spans all three game types in one fixture — a 501 session containing a busted visit, a TUOD session and a 121 session — and assert the returned `checkoutPercentage` equals the ratio computed from those rows by hand. Read the file's existing mocking style first and follow it exactly.

- [ ] **Step 9: Run the full suite**

Run: `cd app && npm test && npm run check`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
cd /Users/levi.broeksma/Dev/dart-analytics
npm --prefix app run format
git add app/src/modules/stats app/src/repositories/statistics.repository.ts app/src/services/statistics.service.ts app/tests
git commit -m "fix: career checkout stat folds the real ladder, busts included

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Rename to Checkout %, and dash the empty case

**Files:**
- Modify: `app/src/lib/game/play-visit-stats.ts` (add `checkoutPercentageDisplay`)
- Modify: `app/src/lib/game/types.ts`, `app/src/lib/stats/types.ts`, `app/src/services/types.ts`, `app/src/pages/api/statistics/types.ts`
- Modify: `app/src/lib/game/five-oh-one-play.data.ts`, `tuod-play.data.ts`, `one-twenty-one-play.data.ts`
- Modify: `app/src/lib/stats/format-statistics-overview.ts`, `app/src/stores/stats.store.ts`, `app/src/pages/statistics/index.astro`
- Modify: `app/src/components/layout/games/result-modals/FiveOhOneResults.astro`, `TenUpOneDownResults.astro`, `OneTwentyOneResults.astro`
- Modify: `app/src/modules/training/routines/routine-summary.module.ts`
- Test: `app/tests/lib/game/play-visit-stats.test.ts` and every suite naming `doubleAccuracy`

**Interfaces:**
- Produces: `checkoutPercentageDisplay(hits: number, attempts: number): string` — `"—"` when `attempts === 0`, otherwise the same two-decimal percentage `accuracyDisplay` returns. `accuracyDisplay` itself is unchanged, because Bob's 27, Doubles Training and the routine hit-rate rows still depend on its `0.00%`.
- The seat result field `doubleAccuracy: string | null` becomes `checkoutPercentage: string | null` on `FiveOhOneSeatResult`, `TuodSeatResult` and `OneTwentyOneSeatResult`; the career DTO field `doubleAccuracy: number | null` becomes `checkoutPercentage: number | null`.

- [ ] **Step 1: Write the failing display test**

Add to `app/tests/lib/game/play-visit-stats.test.ts`:

```ts
describe("checkoutPercentageDisplay", () => {
  it("dashes when no dart was ever thrown at a double", () => {
    expect(checkoutPercentageDisplay(0, 0)).toBe("—");
  });

  it("formats a real rate to two decimals", () => {
    expect(checkoutPercentageDisplay(1, 4)).toBe("25.00%");
  });

  it("reports a genuine zero as zero, not a dash", () => {
    expect(checkoutPercentageDisplay(0, 3)).toBe("0.00%");
  });
});
```

Add `checkoutPercentageDisplay` to that file's import from `@lib/game/play-visit-stats`.

- [ ] **Step 2: Run it and watch it fail**

Run: `cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts`
Expected: FAIL — `checkoutPercentageDisplay is not a function`.

- [ ] **Step 3: Add the helper**

In `app/src/lib/game/play-visit-stats.ts`, next to `accuracyDisplay`:

```ts
/**
 * A checkout rate for display: an em dash when no dart was ever thrown at a
 * double, since a rate over no attempts is nothing to report rather than a
 * failed one. `accuracyDisplay`'s `0.00%` stays as it is -- Bob's 27 and
 * Doubles Training count every dart as an attempt, so zero attempts there
 * means zero darts thrown, which genuinely is 0%.
 */
export function checkoutPercentageDisplay(
  hits: number,
  attempts: number,
): string {
  if (attempts === 0) return "—";
  return accuracyDisplay(hits, attempts);
}
```

- [ ] **Step 4: Rename the field and switch the three games to the new helper**

In each of `five-oh-one-play.data.ts`, `tuod-play.data.ts`, `one-twenty-one-play.data.ts`, rename the `doubleAccuracy` local and result field to `checkoutPercentage` and replace `accuracyDisplay(hits, hits + misses)` with `checkoutPercentageDisplay(hits, hits + misses)`. Example, from `five-oh-one-play.data.ts`:

```ts
  const checkoutPercentage = (() => {
    if (inputModeKey !== "VISUAL_BOARD") return null;
    const { hits, misses } = classifyDoubleAttempts(
      fiveOhOneCheckoutVisits(seatTurns, startingScore),
    );
    return checkoutPercentageDisplay(hits, hits + misses);
  })();
```

Rename the field on `FiveOhOneSeatResult`, `TuodSeatResult` and `OneTwentyOneSeatResult` in `app/src/lib/game/types.ts`, updating the JSDoc that mentions "checkout accuracy" to name the statistic `Checkout %`.

- [ ] **Step 5: Rename through the career stack and relabel the UI**

- `app/src/services/types.ts`: `doubleAccuracy: number | null` → `checkoutPercentage: number | null`.
- `app/src/pages/api/statistics/types.ts`: `doubleAccuracy: z.number()...` → `checkoutPercentage: z.number().min(0).max(1).nullable()`.
- `app/src/lib/stats/types.ts`: `doubleAccuracy: string` → `checkoutPercentage: string`.
- `app/src/lib/stats/format-statistics-overview.ts`: rename the key, keep the existing `"—"`-on-null branch.
- `app/src/stores/stats.store.ts`: rename the field in the initial state and the assignment.
- `app/src/pages/statistics/index.astro`: `{ label: "Double accuracy", key: "doubleAccuracy" }` → `{ label: "Checkout %", key: "checkoutPercentage" }`.
- `FiveOhOneResults.astro`, `TenUpOneDownResults.astro`, `OneTwentyOneResults.astro`: the stat row's label becomes `Checkout %` and its key `checkoutPercentage`.
- `app/src/modules/training/routines/routine-summary.module.ts`: `{ label: "Double accuracy", value: seat.doubleAccuracy ?? NO_VALUE }` → `{ label: "Checkout %", value: seat.checkoutPercentage ?? NO_VALUE }`.

- [ ] **Step 6: Update every test that names the old field**

Run `grep -rn "doubleAccuracy" app/src app/tests` and rename each remaining occurrence. `app/tests/stores/stats.store.test.ts`, `app/tests/lib/stats/format-statistics-overview.test.ts`, `app/tests/lib/client/api/statistics.test.ts`, `app/tests/pages/api/statistics/*.test.ts`, `app/tests/modules/training/routines/routine-summary.module.test.ts` and the three `*-play.data.test.ts` suites all reference it. Where a test asserted `"0.00%"` for a session with no attempts, the expectation becomes `"—"`.

- [ ] **Step 7: Run everything**

Run: `cd app && npm test && npm run check && npm run format:check`
Expected: PASS, and `grep -rn "doubleAccuracy" app/src app/tests` returns nothing.

- [ ] **Step 8: Commit**

```bash
cd /Users/levi.broeksma/Dev/dart-analytics
npm --prefix app run format
git add app
git commit -m "feat: one Checkout % stat across the modals, routines and statistics

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Docs, decisions, gates, PR

**Files:**
- Modify: `docs/architecture/05-Database/05-Views/00-Overview.md`
- Modify: `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md`
- Modify: `docs/architecture/06-API/04-Endpoint-Contracts.md`
- Modify: `docs/architecture/04-Architecture-patterns.md`
- Modify: `decisions/game-engine.md`
- Modify: `docs/architecture/00-File-Inventory.md`, `docs/architecture/00-Context-Map-History.md` (per the `context-maintenance` skill)

- [ ] **Step 1: Register the view, retire the old one**

In `05-Views/00-Overview.md`, replace the `v_double_out_checkout_darts` row with:

```markdown
| `v_x01_checkout_darts` | Analytics | Per-dart facts + stage tree + counted turn total + configuration snapshot for 501/TUOD/121 `VISUAL_BOARD` checkout accuracy, owning player only; remaining-before-dart is folded in the app, never in SQL (2026-09-19) |
```

Make the matching edit in `06-Spec/05-Read-Model-Layer.md`, stating in one sentence why the running total left SQL: a busted visit's darts keep their board scores while its counted total is zero, so a `SUM(d.score)` running total is not the leg's counted score.

- [ ] **Step 2: Update the endpoint contract**

In `06-API/04-Endpoint-Contracts.md`, rename `doubleAccuracy` to `checkoutPercentage` in the statistics overview response contract and take the doc-version bump the freeze-semantics rule allows. Note in the same line that the field is a 0–1 ratio over darts thrown at a double, `null` when there were none.

- [ ] **Step 3: Note the shared builder**

In `04-Architecture-patterns.md`, beside Pattern 18's `checkout-bust.module.ts` paragraph, add one sentence: the per-visit remaining for every X01 ladder is built once in `checkout-visits.module.ts` and consumed by both the live result modals and the career statistics read, so the two can never disagree.

- [ ] **Step 4: Append the decision**

In `decisions/game-engine.md`, append one new block (never edit an existing one) recording: the unit is a dart at a double; bounce-outs and bust-causing darts are misses; the inner single band at 50 remaining is a missed bull while the outer band and trebles there are setup shots; deliberate reroutes stay excluded; the ladder fold moved to the app because `05-Views.md` forbids it in SQL, which is what let TUOD and 121 join the career stat. Cite `Supersedes:` the 2026-09-05 double-out accuracy decision and reference this plan's spec.

- [ ] **Step 5: Run the gates**

Invoke the `run-all-gates` skill (touched areas: `app/`, `database/`, `docs/`). Then invoke the `context-maintenance` skill and complete every step it names, including the File Inventory row for the new spec and plan and the Context-Map-History entry.

Run: `cd app && npm run validate:app`
Expected: every step passes. Report each script's pass/fail explicitly — do not summarise.

- [ ] **Step 6: Commit and open the PR**

```bash
cd /Users/levi.broeksma/Dev/dart-analytics
npm --prefix app run format
git add docs decisions
git commit -m "docs: register v_x01_checkout_darts and the Checkout % rule

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Then use the `superpowers:finishing-a-development-branch` skill together with `finishing-a-dart-branch` (Option 2 — push and open a PR, every time).

---

## Verification checklist

Before claiming the work done, each of these must be true and stated with its evidence:

- [ ] `cd app && npm test` passes in full.
- [ ] `cd app && npm run check` passes.
- [ ] `cd app && npm run format:check` passes.
- [ ] `cd app && npm run validate:app` passes end to end.
- [ ] `grep -rn "doubleAccuracy\|v_double_out_checkout_darts" app/src app/tests docs database` returns nothing except the historical mentions inside `decisions/**` and `docs/superpowers/specs/**`.
- [ ] The ten reference darts from the spec each have a named test case.
- [ ] A 501 session with a bust produces the same per-visit remaining in the modal and in the career read (the Task 2 and Task 4 bust regression tests).
- [ ] The three result modals were opened in a real session via the `run` skill and show `Checkout %`, with `—` where no dart was thrown at a double.
