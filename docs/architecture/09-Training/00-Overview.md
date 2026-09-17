<!--
status: canonical
scope: architecture/training
read-when: orienting in the /training surface before reading either sibling
updated: 2026-09-17
-->

# Training — Overview

`/training` bundles two kinds of thing, and this folder holds one file per kind:

| File | Covers |
| ---- | ------ |
| `01-Routines.md` | the Training/Routine/`ExerciseEngine` model, routine steps, exercise types, persistence |
| `02-Trivia.md` | the non-persisted client tools (Quick Subtract, Checkout Trivia) that sit outside `ExerciseEngine` (D261) |

Both surfaces are flat cards on `/training` — "trivia" is a source and docs domain, not a UI category (D265). The source tree mirrors this split: `lib/training/{trivia,exercises,routines}`, and the same three sub-domains under `modules/` and `components/layout/training/`.
