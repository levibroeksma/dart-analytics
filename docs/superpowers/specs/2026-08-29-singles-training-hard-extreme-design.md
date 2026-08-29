# Singles Training — Hard/Extreme Mode Design

Status: approved (brainstorming). Scope: engine, config, setup UI, play/results UI, docs for Singles Training's Hard and Extreme difficulty. Applies to both capture modes (`RECREATIONAL`+`DETAILED_DARTS` and `ANALYTICS`+`VISUAL_BOARD` — `SINGLES_V1`'s two declared pairs; gameplay rules are capture-mode-independent).

Source: `docs/game-rules/rulesets/singles-training.md`, `app/src/modules/game/singles-training.engine.module.ts`, `app/src/modules/game/bobs27.engine.module.ts` (elimination precedent), `app/src/modules/game/match-outcome.module.ts`.

## 1. Scope & Non-Goals

**In scope:** `HARD` (≥1 of 3 darts must hit the current segment each visit) and `EXTREME` (≥2 of 3) difficulty, segment-bound (single/double/treble on the current target all count as a hit, same definition already used for scoring). On failure, elimination: the match ends immediately, the failing seat is `LOST`, any other seat wins regardless of its own progress or points. Setup screen gets an editable difficulty picker. Applies uniformly for the whole session (one difficulty for all seats, same as `order_mode` today).

**Non-goals (deferred):** `PROFESSIONAL` (all 3 darts) — stays `TBD` per ruleset doc, not requested. Per-seat difficulty in 1v1. Renaming `EASY` (kept as-is, per explicit decision).

## 2. Config / Data Model

`app/src/lib/game/rulesets/types.ts`:

```ts
export const SinglesConfig = z.object({
  order_mode: z.enum(["LOW_TO_HIGH", "HIGH_TO_LOW", "RANDOM"]),
  target_order: z.array(z.number().int()).length(21),
  difficulty: z.enum(["EASY", "HARD", "EXTREME"]), // was: z.enum(["EASY"])
  points_single: z.number().int().default(1),
  points_double: z.number().int().default(2),
  points_treble: z.number().int().default(3),
}).strict().superRefine(/* unchanged */);
```

`SinglesSnapshot.difficulty` type follows automatically (`SinglesConfigData["difficulty"]`).

Required-hits-per-visit, a small pure lookup added to `singles-training.engine.module.ts`:

```ts
function requiredHitsFor(difficulty: SinglesConfigData["difficulty"]): number {
  if (difficulty === "HARD") return 1;
  if (difficulty === "EXTREME") return 2;
  return 0; // EASY: no fail condition
}
```

No seed/preset changes: `database/seeds/0002_default_templates.sql` keeps its one `EASY` preset. The setup screen sends `difficulty` as a client-side override on top of the preset at session start — the same mechanism `order_mode`/`target_order` already use via `configOverrides` (`createPresetSetupController`). One preset per game type is the established V1 pattern; it is not being changed here.

## 3. Engine (`singles-training.engine.module.ts`)

**Seat state.** `SinglesTrainingSeatState.status` (in `modules/game/types.ts`) gains `"LOST"`: `"IN_PROGRESS" | "COMPLETE" | "LOST"`.

`dartsThisVisit` changes from a bare count (`number`) to a hit/miss log (`boolean[]`), mirroring `Bobs27SeatState.dartsThisVisit`. `.length` replaces every existing use of the count; `wouldComplete()`'s `dartsThisVisit.length < 2` guard is unchanged in spirit.

**Hit predicate.** Factor the on-target check already implicit in `trainingPointsFor` into its own boolean, so hard/extreme doesn't depend on point values being nonzero:

```ts
function isHitOnTarget(target: BoardTarget, observation: DartObservation): boolean {
  if (target.kind === "BULL") {
    return (
      observation.hitTargetNumber === BULL_TARGET_NUMBER &&
      (observation.hitZoneKey === "OUTER_BULL" || observation.hitZoneKey === "INNER_BULL")
    );
  }
  return (
    observation.hitTargetNumber === target.number &&
    (SINGLE_ZONE_KEYS.has(observation.hitZoneKey) ||
      observation.hitZoneKey === "DOUBLE" ||
      observation.hitZoneKey === "TREBLE")
  );
}
```

`trainingPointsFor` keeps its own body (unaffected — still needs the ring→point mapping, not just hit/miss).

**`applySinglesTrainingDart`.** After appending this dart's hit/miss to `dartsThisVisit`:

- `dartsThisVisit.length < 3` → unchanged early return (visit continues), now storing the array.
- On the 3rd dart: compute `hits = dartsThisVisit.filter(Boolean).length`. If `hits < requiredHitsFor(config.difficulty)` → return `{ ...state, totalPoints, dartsThisVisit: [], status: "LOST" }` — checked **before** the existing bull/advance branch, so even the final (bull) visit can still fail rather than complete.
- Otherwise: existing behavior (bull → `COMPLETE`, else advance `targetIndex`).

**`foldSinglesTrainingState`.** Resolve elimination before falling back to score-compare:

```ts
const failed = seats.filter((seat) => seat.status === "LOST");
const outcome =
  failed.length > 0
    ? {
        status: "COMPLETE" as const,
        winningSideKey: eliminationWinner(
          seats.map((seat) => ({ sideKey: seat.sideKey, failed: seat.status === "LOST" })),
        ),
      }
    : scoreCompareOutcome(
        seats.map((seat) => ({ sideKey: seat.sideKey, completed: seat.status === "COMPLETE", metric: seat.totalPoints })),
        "HIGHEST",
        seats[0].status, // widens to include "LOST" for solo — scoreCompareOutcome's soloStatus param type must widen too
      );
```

Solo failing needs no special case: `seats.length === 1` inside `scoreCompareOutcome` (or the `failed.length > 0` branch above, either resolves the same way) returns `{ status: "LOST", winningSideKey: null }` directly from the seat's own status, matching Bob's 27's solo pattern.

`match-outcome.module.ts`'s `scoreCompareOutcome` signature widens `soloStatus: "IN_PROGRESS" | "COMPLETE" | "LOST"` (currently `"IN_PROGRESS" | "COMPLETE"`) — additive, no other caller (Around the Clock, Doubles Training) passes `"LOST"` so their behavior is unchanged.

**`record()` / `wouldComplete()`.** `record()`'s existing top-of-function status guard (`seatBefore.status !== "IN_PROGRESS"` → throw) already covers `LOST` with no change — a `LOST` seat is not `IN_PROGRESS`, so no further darts are accepted once eliminated, exactly like Bob's 27. `wouldComplete()` already treats any non-`IN_PROGRESS` result as "would complete" (`after.status !== "IN_PROGRESS"` — wait, current Singles `wouldComplete` checks `after.status !== "COMPLETE"`; widen that check to `after.status === "IN_PROGRESS"` returning false, i.e. `LOST` also reports "would complete").

**`undo()`.** No change needed — `undoLastDart` already pops the last dart and lets `deriveState()` re-derive; a seat that was `LOST` naturally re-derives back to `IN_PROGRESS` once the failing dart (or any dart in that visit) is popped, same as Bob's 27's `WON`/`LOST` reverting on undo.

## 4. Setup UI

`app/src/lib/game/types.ts`: `SinglesTrainingSetupContext` gains `difficulty: SinglesConfigData["difficulty"]`.

`app/src/lib/game/singles-training-setup.data.ts`:

```ts
export function singlesTrainingSetup() {
  return {
    orderMode: "LOW_TO_HIGH" as SinglesTrainingSetupContext["orderMode"],
    difficulty: "EASY" as SinglesTrainingSetupContext["difficulty"],
    ...createPresetSetupController<SinglesTrainingSetupContext>({
      // ...unchanged...
      configOverrides: (ctx) => ({
        order_mode: ctx.orderMode,
        target_order: targetOrderFor(ctx.orderMode),
        difficulty: ctx.difficulty,
      }),
    }),
  };
}
```

`SinglesTrainingSetupForm.astro`: a second `Toggle` row, same shape as the existing order-mode one:

```astro
const difficultyOpts = [
  { value: "EASY", label: "Easy" },
  { value: "HARD", label: "Hard" },
  { value: "EXTREME", label: "Extreme" },
];
```

```astro
<Toggle orientation="horizontal" options={difficultyOpts} x-model="difficulty" class="w-full" />
```

`InfoSection` description gains one sentence: "Hard requires at least 1 dart on target each visit, Extreme at least 2 — miss the requirement and it's game over."

## 5. Play / Results UI

`SinglesTrainingPlayContext.resultsSnapshot.status` widens from `"COMPLETE" | "TIE"` to `"COMPLETE" | "TIE" | "WON" | "LOST"` (naming mirrors Bob's 27). `WON`/`LOST` only occur when the match ended by elimination; `COMPLETE`/`TIE` keep today's "everyone finished, compared by points" meaning (the only reachable outcomes under `EASY`, and still reachable under `HARD`/`EXTREME` whenever nobody fails).

`singles-training-play.data.ts`, `uploadAndCompleteSession`'s status derivation:

```ts
status:
  finalState.status === "TIE"
    ? "TIE"
    : finalState.winningSideKey === null
      ? "LOST" // solo fail, or 1-seat session
      : ownerSeat.status === "LOST"
        ? "LOST"
        : finalState.seats.length > 1 && ownerSeat.sideKey === finalState.winningSideKey && ownerSeat.status !== "COMPLETE"
          ? "WON" // won by elimination, not by finishing normally
          : "COMPLETE",
```

(Exact conditional to be refined at implementation time against real test cases — the intent: `LOST` if this owner's seat failed or a solo run failed; `WON` if this owner survived an opponent's failure without also naturally completing; `COMPLETE`/`TIE` otherwise, unchanged from today.)

`SinglesTrainingResults.astro` title logic gains fail branches, evaluated before the existing `TIE`/highest-points branches:

- `status === 'LOST'` and solo (`seats.length < 2`) → `"Game over — missed the target"`.
- `status === 'LOST'` in 1v1 → `"Game over — you missed the target"`.
- `status === 'WON'` → `"<opponent displayName> missed the target — you win!"`.
- else: existing `TIE` / highest-points / "Session complete" logic, unchanged.

## 6. Docs

`docs/game-rules/rulesets/singles-training.md`:
- Move the `Hard` and `Extreme` rows in the Features table from `TBD` to `v1`. Leave `Professional` at `TBD`.
- Move the `Hard`/`Extreme` bullets out of "Later versions (V2+) → Variants" into "How to play (V1)", adding a short "Bust" section (currently "N/A") describing the mandatory-hit fail condition and elimination.
- Config & presets table: `Difficulty` row becomes "Editable" (was "Shown, locked"), values `EASY` (default) / `HARD` / `EXTREME`.

Context-maintenance pass (per root `CLAUDE.md`) still applies at implementation time: context map / decisions / findings as needed — not detailed further here since nothing in this spec introduces a new context-map pack (existing "Frontend gameplay / session features" and "New game engine" packs already cover this work).

## 7. Testing Plan

**Engine (`app/tests/modules/game/singles-training.engine.module.test.ts`):**
- `isHitOnTarget`/hit-counting: single/double/treble on-target all count; off-target and `MISS` don't; bull's outer/inner both count, no treble-bull case.
- `HARD`: visit with 0 hits → `LOST`; 1+ hits → survives (advances or completes normally).
- `EXTREME`: visit with 0-1 hits → `LOST`; 2+ hits → survives.
- Failure on the final (bull) visit → `LOST`, not `COMPLETE`.
- Solo: a failed run resolves to top-level `status: "LOST"`, `winningSideKey: null`.
- 1v1: one seat fails mid-run while the other is still `IN_PROGRESS` (not yet `COMPLETE`) → match `COMPLETE` immediately, other seat wins.
- 1v1 under `EASY` (or nobody fails under `HARD`/`EXTREME`): existing score-compare behavior unchanged (regression check).
- `wouldComplete()` reports true for a dart that would trigger elimination.
- `undo()` reverts a `LOST` seat back to `IN_PROGRESS`, further darts accepted again.

**Validator (`singles-training.validator.test.ts`):** `difficulty` accepts `HARD`/`EXTREME`; still rejects any other string (`.strict()` schema).

**Setup/play data tests:** `singles-training-setup.data.test.ts` — difficulty override reaches `configOverrides`. `singles-training-play.data.test.ts` — `resultsSnapshot.status` covers `WON`/`LOST` branches alongside existing `COMPLETE`/`TIE` cases.

`match-outcome.module.ts`'s widened `soloStatus` type: existing tests for Around the Clock / Doubles Training callers stay green (additive union member, unchanged call sites).

## 8. Open Questions

None blocking. The exact `uploadAndCompleteSession` status-derivation conditional (§5) is sketched, not final — implementation may simplify once real test cases are written; behavior (not exact expression shape) is the contract.
