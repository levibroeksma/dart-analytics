# Switching Target Scoring exercise — design

Date: 2026-09-23
Input: `docs/game-rules/training/exercises/switching-target-scoring.md` (rules, V1 cut, defer list)
Precedent: `TARGET_SCORING_V1` (`app/src/modules/training/exercises/target-scoring.engine.module.ts`)

## 1. Scope

New exercise type `SWITCHING_TARGET_SCORING`, ruleset
`SWITCHING_TARGET_SCORING_V1`, routine step only. Offered by the routine
builder via `v_exercise_template_catalog` once seeded. No standalone page, no
seeded routine, no schema change.

## 2. Persistence

- **Capture/input mode:** `ANALYTICS` + `VISUAL_BOARD`, no game pair (D277).
  Type key joins `DART_EXERCISE_TYPE_KEYS`; ruleset key joins
  `DART_WRITING_RULESET_VERSION_KEYS`.
- **Stage type:** one `EXERCISE_BLOCK`.
- **`turns`:** one per three-dart visit.
- **`darts`:** intended target = current target; intended zone = `TREBLE`, or
  `INNER_BULL` on 25. Board `score`.

## 3. Configuration

```ts
SwitchingTargetScoringV1Config = z.object({
  targets: z.array(target /* 1–20 or 25 */).length(3).refine(unique),
}).strict();
```

Scoring is locked; it reuses `targetScoringPoints` from the Target Scoring
engine (same point table, shared, not copied).

## 4. Engine — `SwitchingTargetScoringEngine`

Pure fold over darts in write order:

```
hit  (points ≠ null) → chain += points; best = max; index = (index+1) % 3;
                        if index wrapped → completedSequences++
miss                 → if chain > 0: bestFinished = max(.., chain)
                        chain = 0; index = 0
```

State: `currentTargetNumber`, `targetIndex`, `currentChain`, `bestChain`
(live counts), `markToBeat` (`bestFinished`, `null` until one chain ends),
`completedSequences`, `hits`, `dartsThrown`, `status`.

Clockless (D264): `expireTimer()` completes; `undo()` pops a dart or
un-completes. Registered in the dart exercise engine registry.

## 5. Server

Ruleset config + parse-only validator; `exerciseTypeKey` enums gain
`SWITCHING_TARGET_SCORING`.

## 6. Seed `0024_switching_target_scoring_exercise_type.sql`

Type `0199a000-…-000000000006`, ruleset `0199a100-…-000000000005`, template
`0199b000-…-000000000008` "Switching Target Scoring",
`{"targets":[20,19,18]}`. Verification script `0024_…_seed_checks.sql`.

## 7. Client

Adapter `SWITCHING_TARGET_SCORING` / panel `switching-target-scoring`;
controller engine slot, dispatch, `expireTimer`, readouts; preview hit rule
via `targetScoringPoints`. Panel: chain as score; Target, To beat, Best,
Time. Summary: Best chain, Sequences, Darts, Hit rate.

## 8. Docs

Routines §3.4 list + §18 subsection; File Inventory; seed ranges → `0024`;
database README; decision in `decisions/game-engine.md`; context-map history.
