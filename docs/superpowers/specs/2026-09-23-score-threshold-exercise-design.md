# 65 or More (Score Threshold) exercise — design

Date: 2026-09-23
Input: `docs/game-rules/training/exercises/score-threshold.md` (rules, V1 cut, defer list)
Precedent: `SWITCHING_TARGET_SCORING_V1` (`app/src/modules/training/exercises/switching-target-scoring.engine.module.ts`)

## 1. Scope

New exercise type `SCORE_THRESHOLD`, ruleset `SCORE_THRESHOLD_V1`, template
"65 or More", routine step only. Offered by the routine builder via
`v_exercise_template_catalog` once seeded. No standalone page, no seeded
routine, no schema change.

## 2. Persistence

- **Capture/input mode:** `ANALYTICS` + `VISUAL_BOARD`, no game pair (D277).
  Type key joins `DART_EXERCISE_TYPE_KEYS`; ruleset key joins
  `DART_WRITING_RULESET_VERSION_KEYS`.
- **Stage type:** one `EXERCISE_BLOCK`.
- **`turns`:** one per three-dart visit; `totalScore` = board sum.
- **`darts`:** no intent (both intended columns null —
  `chk_dart_target_consistency` allows it). Board `score`.

## 3. Configuration

```ts
ScoreThresholdV1Config = z.object({
  threshold: z.literal(65),
}).strict();
```

The threshold lives in config so a later ruleset/config widening
(`z.number().int()…`) serves another threshold without a new type. V1 accepts
65 only.

## 4. Engine — `ScoreThresholdEngine`

Pure fold over turns in write order:

```
visit with 3 darts → visits++; if total ≥ threshold → beats++; last = total
visit with < 3     → current visit (not judged)
```

State: `threshold`, `beats`, `visits`, `lastVisitTotal` (`null` until a
visit is judged), `currentVisitTotal`, `dartsInVisit`, `dartsThrown`,
`status`.

Clockless (D264): `expireTimer()` completes; an unfinished visit stays
unjudged. `undo()` pops a dart or un-completes. Registered in the dart
exercise engine registry.

## 5. Server

Ruleset config + parse-only validator; `exerciseTypeKey` enums gain
`SCORE_THRESHOLD`.

## 6. Seed `0025_score_threshold_exercise_type.sql`

Type `0199a000-…-000000000007`, ruleset `0199a100-…-000000000006`, template
`0199b000-…-000000000009` "65 or More", `{"threshold":65}`. Verification
script `0025_…_seed_checks.sql`.

## 7. Client

Adapter `SCORE_THRESHOLD` / panel `score-threshold`; controller engine slot,
dispatch, `expireTimer`, readouts. Board preview highlights nothing (no
target). Panel: beats as score; This visit, Last, Visits, Rate, Time.
Summary: Beats, Visits, Beat rate, Darts.

## 8. Docs

Routines §3.4 list + subsection; File Inventory; seed ranges → `0025`;
database README; decision in `decisions/game-engine.md`; context-map history.
