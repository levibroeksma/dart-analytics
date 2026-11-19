---
id: D0457
status: accepted
date: 2026-10-13
origin: contemporaneous
original-date:
tags: [frontend/style]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Long exercise previews and target chips page six at a time

## Context and Problem Statement
one preview slot or chip per target overflowed the 390px play column past ~6 targets (#954). Paging over a config cap leaves stored snapshots valid.

## Decision Drivers
* One preview slot or chip per target overflowed the 390px play column past about 6 targets (#954; commit `ce460a07` title).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`windowPage()` (`lib/training/routines/exercise-preview.ts`) cuts a list to the six-item page holding a focus index; `windowIndex()` gives the focus's slot on that page. `visitPreview()` pages its segments on the next (or, once full, last) dart; `switchingSequence()` pages the Switching targets on the engine's `targetIndex`. Lists of six or fewer are unchanged. `SwitchingV1Config` keeps `.max(20)`.", because one preview slot or chip per target overflowed the 390px play column past ~6 targets (#954). Paging over a config cap leaves stored snapshots valid.

### Consequences
a Switching visit over six targets shows only its current page; earlier slots of the visit leave the screen once their page is done. `RouteChips` lights the current part by index (`currentIndexExpr`), not label, so a repeated target or double lights once; Switching, Double Pattern and Switching Target Scoring pass their engine's index (`*ChipIndex()`).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/training/routines/exercise-preview.test.ts` exists today; commit `ce460a07` added 46 lines of tests there and 31 lines to `routine-play.data.test.ts`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-13
Supersedes: D454 in part (`RouteChips` `currentExpr`, now `currentIndexExpr`).
* Commit `ce460a07` (2026-10-13, "fix(training): page long Switching preview and chips six at a time (#954)"): adds the D457 row (row and tests); rebuilt Confirmation. The message names `windowPage()` and the preview and chips changes only.
