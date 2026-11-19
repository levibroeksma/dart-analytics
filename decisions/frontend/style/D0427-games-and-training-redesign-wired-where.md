---
id: D0427
status: accepted
date: 2026-10-07
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, glass]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Games and Training redesign, wired where data exists

## Context and Problem Statement
the same design-led phase as D425/D426; every element that existing reads can back is wired rather than faked.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`/games` and `/training` follow the Claude Design `Games.dc.html` / `Training.dc.html` mocks on the home backdrop. Game cards carry a `group` (`MATCH_PLAY`, `TRAINING`, `CLASSICS`; Cricket and Tactics under Match play) and render as `GameRow`s in one glass card per group via `groupedGames()`; a group with no visible game hides, and the divider skips hidden rows (`isFirstVisible`). The in-progress card binds to `resumeTarget()` — the newest active session with a card, linking to its setup route — with a static detail line (#815). Training's schedule card reads `trainingWeek()`: the active schedule plus this ISO week's completions through the pure `startOfIsoWeek`/`dayStatus`/`weekCounts` (done wins, then today, then missed/scheduled/rest; a scheduled, not-done today counts to go). Routine rows show a minutes chip only (#816) and a play link to the player. The create-routine modal is `detached`; creation is the personal-routines plus button. New shared primitives: `.feature-card` (accent gradient without the home halo), `.mode-pill`, `.section-eyebrow`, `--missed`/`--missed-muted`, `--chip-foreground`, `check-bold`/`cross-bold` icons.", because the same design-led phase as D425/D426; every element that existing reads can back is wired rather than faked.

### Consequences
`RoutineCard.astro` is removed. Weekday letters follow the browser locale. `.astro`/CSS carry no unit test (D101); the grouping, resume pick and week-status helpers are tested.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-07
Referenced by D0456's `Supersedes:` line.
