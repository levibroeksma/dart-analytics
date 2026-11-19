---
id: D0121
status: accepted
date: 2026-07-21
origin: contemporaneous
original-date:
tags: [frontend/astro]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Game **play** routes use `GameLayout` (exit chrome + confirm modal, no `BottomNav`)

## Context and Problem Statement
Separates resume-friendly persistence from explicit session close for statistics
Score Training play used `AppLayout`, which always renders `BottomNav`, and the bottom nav must never appear during gameplay. The design spec adds `GameLayout.astro` with exit chrome and a confirm modal. It separates two cases: closing the browser is not an abandon, and only the explicit Leave confirmation closes the session on the server.

## Decision Drivers
* The bottom nav must never appear during gameplay.
* Browser close, refresh or navigating away must keep resumable state, not end the session.
* Statistics should capture in-progress gameplay when the player leaves explicitly.

## Considered Options
* New `GameLayout.astro` with exit chrome and a confirm modal, and no `BottomNav` (chosen).
* The spec records no other layout option.

## Decision Outcome
Chosen option: "Game **play** routes use `GameLayout` (exit chrome + confirm modal, no `BottomNav`). In-game Leave → `appendBatch` when turns exist, then `PATCH ABANDONED`, then `store.reset()` + `/games`. Browser close/refresh is not abandon — `$persist` + D88 resume.", because Separates resume-friendly persistence from explicit session close for statistics.

### Consequences
* Good, because Leave uploads partial turns before `PATCH ABANDONED`, so statistics capture in-progress gameplay.
* Neutral, because browser close, refresh or navigating away makes no API call; `$persist` on `$store.game` keeps state and D88 resume applies.
* Neutral, because every future game play route uses `GameLayout`, while hub and setup routes keep `AppLayout`.
* Neutral, because the setup page's `abandonSession()` stays `PATCH ABANDONED` only, with no batch.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The play factory's `abandonAndExit()` is unit tested in `app/tests/lib/game/score-training-play.data.test.ts`. `.astro` markup has no Vitest coverage (D101).

## Pros and Cons of the Options
### `GameLayout` with explicit Leave
* Good, because it keeps resume-friendly persistence apart from explicit session close.
* Good, because Leave sends partial turns first, so statistics keep them.

## Evidence / More Information
Decided: 2026-07-21

* `docs/superpowers/specs/2026-07-21-score-training-play-ui-design.md` (Context, brainstorming decisions, "Session persistence vs manual abandon"): rebuilt Context, Decision Drivers, Considered Options and Consequences.
* `docs/superpowers/plans/2026-07-21-score-training-play-ui.md` (ledger step, Global Constraints): rebuilt Consequences and Confirmation.
* Commit `2e1c55e2` (PR #31 rebase reconcile, 2026-07-21; adds the D121 row): confirmed the origin.
* Applied in: `docs/superpowers/specs/2026-07-25-game-engine-review-design.md`, `docs/superpowers/plans/2026-07-21-score-training-undo-finish-confirm.md`.
