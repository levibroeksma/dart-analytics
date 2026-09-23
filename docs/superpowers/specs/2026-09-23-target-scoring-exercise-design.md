# Target Scoring exercise — design

Date: 2026-09-23
Input: `docs/game-rules/training/exercises/target-scoring.md` (rules, V1 cut, defer list)
Precedent: `SWITCHING_V1` (`app/src/modules/training/exercises/switching.engine.module.ts`)

## 1. Scope

New exercise type `TARGET_SCORING`, ruleset `TARGET_SCORING_V1`, playable as a
routine step only. It appears in the routine builder via
`v_exercise_template_catalog` once a published type and a system template
exist — no builder code change. No standalone page, no seeded routine.

## 2. Persistence (hard invariant: engine must prove its state persists)

- **Capture/input mode:** `ANALYTICS` + `VISUAL_BOARD`, no game pair — same as
  Switching (D277). `TARGET_SCORING` joins `DART_EXERCISE_TYPE_KEYS`
  (`training-session.service.ts`) and `TARGET_SCORING_V1` joins
  `DART_WRITING_RULESET_VERSION_KEYS` (`exercise-rulesets/registry.ts`).
- **Stage type:** one `EXERCISE_BLOCK` (`exerciseBlockStage()`).
- **`turns`:** one per three-dart visit, independent of target changes.
- **`darts`:** `intended_target_number` = current target (1–20 or 25);
  `intended_zone_key` = `TREBLE` on a number, `INNER_BULL` on 25 (satisfies
  `chk_dart_target_consistency`). Hit fields from the board; `score` is the
  board score.
- **No schema change.** Seed only.

## 3. Configuration

```ts
TargetScoringV1Config = z.object({
  targets: z.array(z.number().int().min(1).max(25)
                     .refine(n => n <= 20 || n === 25))
             .min(1).max(21)
             .refine(unique, "targets must not repeat"),
}).strict();
```

Scoring is locked (rules doc: "Shown, locked"), so it is not configuration —
it lives in the engine. Adding a target later is a config edit; nothing in
the engine is keyed to 20/19/18.

## 4. Engine — `TargetScoringEngine implements DartExerciseEngine`

Pure fold over darts in write order, as `foldSwitchingState`:

```
points(target, dart):
  target 25: OUTER_BULL→1, INNER_BULL→3, else miss
  target n : hitTargetNumber≠n → miss; TREBLE→3; single zones→1; DOUBLE→miss
step:
  hit  → chain += points; bestChain = max; perTargetLive
  miss → if chain > 0: finishedBest[target] = max(.., chain); advance index (cyclic)
         chain = 0
```

`chain > 0` is "≥1 hit": every hit scores ≥1.

State:

| Field | Meaning |
| --- | --- |
| `currentTargetNumber`, `targetIndex` | target the next dart is thrown at |
| `currentChain` | live chain |
| `bestChain` | max over finished chains and the live one (live counts at expiry) |
| `markToBeat` | best *finished* chain on the current target this run, `null` if none — the match-pressure readout |
| `bestChainByTarget` | per configured target, max of finished and live; `0` if none |
| `hits`, `dartsThrown`, `status` | |

Clockless (D264): `expireTimer()` completes; `undo()` pops the last dart (or
un-completes), state re-derives by replay. Registered in the dart exercise
engine registry.

## 5. Server

- `EXERCISE_RULESET_CONFIGS` + `targetScoringValidator` (parse-only, like
  Switching).
- `exerciseTypeKey` unions/enums gain `TARGET_SCORING`
  (`services/types.ts`, `pages/api/training-sessions/types.ts`).

## 6. Seed `0023_target_scoring_exercise_type.sql`

- `exercise_types` `0199a000-…-000000000005` `TARGET_SCORING`, published.
- `exercise_ruleset_versions` `0199a100-…-000000000004` `TARGET_SCORING_V1`.
- `exercise_templates` `0199b000-…-000000000007` "Target Scoring", system,
  pinned to that ruleset version, `{"targets":[20,19,18,25]}`.

`ON CONFLICT (id) DO NOTHING`, re-runnable.

## 7. Client

- `StepAdapterKey`/`StepPanel` gain `TARGET_SCORING`/`target-scoring`;
  `targetScoringAdapter` in `STEP_ADAPTERS` (header label `target`).
- `routine-play.data.ts`: `targetScoringEngine` slot, record dispatch,
  `expireTimer`, `activeDartEngine` union, label/readout helpers; preview
  hit rule uses the engine's own `isTargetScoringHit` (double = miss, either
  bull ring = hit).
- `TargetScoringPanel.astro`: primary readout = current chain; stat rows
  Target (`20` / `Bull`), Best, To beat (shown only when `markToBeat` is not
  null), Time; `VisitPreview` + `ExerciseBoardInputPanel`.
- Summary: `summariseTargetScoring` → Best chain, one "Best on X" row per
  target, Darts, Hit rate.

## 8. Docs

`09-Training/01-Routines.md` §3.4 list and a §17 "Target Scoring" subsection;
reference-layer seed list; decision entry in `decisions/game-engine.md`;
seed-range mentions bumped to `0023`.

## 9. Tests

Engine fold (hit/miss per zone, double miss, bull rings, advance only on
broken chain, cycling, markToBeat, live chain in bestChain, undo, replay via
`prior`), config (duplicates, 21–24 and 26 rejected), validator, adapter
registry, summary.
