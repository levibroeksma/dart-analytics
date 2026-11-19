---
id: D0250
status: accepted
date: 2026-08-30
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `fallow`'s fan-in "split" targets acted on by coupling, not by size

## Context and Problem Statement
`fallow`'s refactoring-target heuristic (`docs/superpowers/plans` show it scores on fan-in × file size, not on whether a file's exports serve unrelated callers) treats high reuse of a well-factored, single-purpose utility the same as a god-file mixing shared and game-specific concerns. Acting on the metric directly would have fragmented `score-input.module.ts` and left `match-result-text.ts`'s real coupling problem unexamined; the fix that actually reduces blast radius is judged per-file by what its exports' callers have in common, not by import count alone.

## Decision Drivers
* Both targets were flagged only for high fan-in on small files, 54 and 71 LOC.
* `match-result-text.ts` bundled a generic helper with Singles Training's own title logic, while `score-input.module.ts` holds one cohesive class.

## Considered Options
* Split both flagged files, as the heuristic suggests.
* Split `match-result-text.ts` by coupling and leave `score-input.module.ts` as it is (chosen).

## Decision Outcome
Chosen option: "Of `npx fallow`'s two "Refactoring targets" (both flagged only for high fan-in on small files — 54 and 71 LOC), `match-result-text.ts` was split and `score-input.module.ts` was left as-is. `match-result-text.ts` bundled a generic helper (`matchWinnerName`, 8 unrelated `*-play.data.ts` importers) with Singles Training's own per-seat-status title logic (`singlesTrainingResultsTitle`, 1 importer, itself calling `matchWinnerName`) — every one of the 8 unrelated games' importers watched a file that also carried Singles-Training-specific branching. `singlesTrainingResultsTitle` moved to a new `lib/game/singles-training-results-title.ts` (naming precedent: `five-oh-one-legs.ts`, `one-twenty-one-duration.ts` — `<game>-<concern>.ts`), which imports `matchWinnerName` from the now generic-only `match-result-text.ts`. `score-input.module.ts` (`ScoreInputBuffer` + its one supporting constant) was left untouched: every one of its 5 dependents imports the same single class for the same purpose, and the constant is private to that class — there is no second concern inside the file to separate, so a split would fragment a cohesive unit for no coupling reduction.".

### Consequences
`npx fallow`'s refactoring-targets list drops to 1 (`score-input.module.ts`), expected to stay flagged indefinitely under this heuristic — a future agent re-running `fallow` should not re-split it without a real second concern appearing in the file. `match-result-text.test.ts` now covers only `matchWinnerName`; `singlesTrainingResultsTitle`'s existing test cases moved verbatim to a new `tests/lib/game/singles-training-results-title.test.ts`, no assertions changed. `docs/architecture/07-Frontend/03-Alpine-Patterns.md`'s Results-Modal Title Pattern section updated to name the new file.

* Good, because `npx fallow`'s refactoring-targets list drops to 1 (`score-input.module.ts`).
* Neutral, because `docs/architecture/07-Frontend/03-Alpine-Patterns.md`'s Results-Modal Title Pattern section now names the new file.

### Confidence
Rationale unknown — no source found.

### Revisit When
A real second concern appears inside `score-input.module.ts`. Until then, a future agent re-running `fallow` should not re-split it.

### Confirmation
`singlesTrainingResultsTitle`'s existing test cases move verbatim to `tests/lib/game/singles-training-results-title.test.ts`, with no assertions changed. `match-result-text.test.ts` now covers only `matchWinnerName`.

## Pros and Cons of the Options
### Split both flagged files
* Bad, because splitting `score-input.module.ts` fragments a cohesive unit for no coupling reduction: all 5 dependents import the same class for the same purpose, and the constant is private to it.

### Split by coupling
* Good, because the 8 unrelated `*-play.data.ts` importers no longer sit on a file that also carries Singles Training branching.
* Good, because `fallow`'s refactoring-targets list drops to 1.
* Bad, because `score-input.module.ts` stays flagged indefinitely under the heuristic.

## Evidence / More Information
Decided: 2026-08-30

* Commit `21f2a041` (PR #211, 2026-08-30; adds the D250 row): rebuilt every filled section.
