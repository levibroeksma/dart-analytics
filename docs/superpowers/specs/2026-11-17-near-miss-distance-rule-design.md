# Near-miss distance rule for `loose-darts` — design

Status: draft for owner approval · Date: 2026-11-17

## Intent

A dart that misses its aim by a few millimetres is a near miss, whichever way it went. Today `loose-darts` calls a dart a near miss only when it lands in a neighbouring bed (D368 decision 9, D370 decision 8). A dart just outside the double, or just off the board, is counted as loose. The owner wants near miss to mean physical closeness: **within 20 mm of the aimed bed, inside or outside**. This is the first of two projects. The second, a dedicated Doubles Training statistics page, is brainstormed after this one lands because it reads these numbers.

## Goals

- One distance rule classifies every dart for `loose-darts`, in every game that uses the section: Singles Training, Shanghai, Around the Clock, Bob's 27, Doubles Training.
- The rule is defined once, in shared board geometry, and reuses `distanceToBed` and `distanceToDisc` (`lib/game/board/board-geometry.module.ts`).
- Past sessions are reclassified at read time. Statistics are derived, so no stored data changes.

## Non-goals

- No migration, no new endpoint, no new section id, no new metric field.
- No UI change. The response keeps its shape `{ onTarget, nearMiss, loose }` per target.
- No per-game or per-user threshold.
- The Doubles Training page itself.

## Anti-goals

- A second copy of the adjacency rule or of the geometry, in SQL or TypeScript.
- A silent change of totals: a dart is never dropped from `onTarget` because its coordinates are missing.

## The rule

`classifyLanding(aim, landing)` returns `onTarget`, `nearMiss` or `loose`.

| Aim | `onTarget` | `nearMiss` | `loose` |
| --- | ---------- | ---------- | ------- |
| Stored numbered bed (`DOUBLE:n`, `TREBLE:n`, `INNER_SINGLE:n`, `OUTER_SINGLE:n`) | the hit pair equals the aimed pair | not on target, and within 20 mm of that bed's wedge | farther |
| Stored bull (`INNER_BULL`, `OUTER_BULL`) | the hit pair equals the aimed pair | not on target, and within 20 mm of that bull ring | farther |
| `NUMBER:n` (derived whole-number aim) | any ring of `n` except `MISS` (`isAimHit`) | not on target, and within 20 mm of the full wedge of `n` across all rings | farther |
| `BULL:25` (derived bull aim) | either bull ring | not on target, and within 20 mm of the bull disc | farther |

- Distance is measured to the nearest point of the bed, not its centre. The threshold is inclusive: exactly 20 mm is a near miss.
- Off-board darts are measured like any other. A dart 15 mm beyond the double is a near miss. One 40 mm beyond is loose.
- Neighbouring-bed darts that sit more than 20 mm away are now loose. That is intended.
- Darts with no landing point: a hit is still `onTarget`, from the stored hit pair. A miss cannot be measured, so it is left out of `nearMiss` and `loose` and counted as unmeasured.
- The threshold is one constant, `NEAR_MISS_MM = 20`, in `lib/stats/constants.ts`.

## Constraints

- Geometry stays single-sourced in TypeScript (D368). Any SQL distance expression would be a second copy, so classification happens in TS.
- Today the SQL path counts intended-by-hit cells, which cannot express distance. The section needs per-dart aim and landing point (`location_x`, `location_y`, `NUMERIC(6,2)` strings, converted to numbers at the repository boundary).
- Server folds are bounded by `MAX_FOLD_DARTS` and skipped sessions (`00-Overview.md` §4). A per-dart read must be bounded the same way and report what it skipped.
- The section `version` in `section-registry.ts` bumps from 1, because the result for the same data changes. Frontend consumers (`game-stats.store.ts`, `merge-metrics.ts`) and the API types keep working unchanged.
- Docs are updated in the same change: `01-Section-Catalog.md` §1.1 and the `loose-darts` rows, and the Overview if it restates the adjacency rule. The change is a new decision in `decisions/api.md` that supersedes D368 decision 9 and D370 decision 8 and cites the next free id. Existing blocks are not edited.

## Left to the builder

- How the per-dart rows are read: a new repository function over `v_stats_dart_facts`, or an extension of the existing intent-cell read. The stored-aim path and the derived-aim (server fold) path should converge on one classifier.
- Whether `computeSite` for `loose-darts` becomes `server` for all tags, and the bound and skip reporting that follows from it.
- How "unmeasured" reaches the response, if it is surfaced at all. Counting it is required. A new response field is allowed only if no existing field carries it.
- Test shape. Required cases: each aim kind at 19.99, 20.00 and 20.01 mm; an off-board dart on each side; a dart with no landing point, hit and miss; a neighbouring-bed dart more than 20 mm away.

## Marked as the author's calls

- The inclusive threshold (exactly 20 mm is near).
- Unmeasured misses are excluded rather than counted as loose.
- Measurement from the bed edge, not the centre.
- The bull disc as the reference for `BULL:25`.

## Follow-on project (not part of this change)

Doubles Training statistics page, the owner's stated contents: double accuracy per number with the favourite double (highest hit rate, minimum sample), loose darts, miss direction left or right, and inside versus outside the wire. It follows the 501 page pattern and is brainstormed separately.
