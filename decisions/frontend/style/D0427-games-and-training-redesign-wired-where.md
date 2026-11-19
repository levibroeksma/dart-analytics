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

# Games and Training redesign, wired where data exists

## Context and Problem Statement
the same design-led phase as D425/D426; every element that existing reads can back is wired rather than faked.

## Decision Drivers
* Match the Claude Design `Games.dc.html` and `Training.dc.html` frames at 390px (spec, Goal).
* Wire every element that existing code backs; render an element with no data source static and file it as a `discovered-work` issue (spec, Goal).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`/games` and `/training` follow the Claude Design `Games.dc.html` / `Training.dc.html` mocks on the home backdrop. Game cards carry a `group` (`MATCH_PLAY`, `TRAINING`, `CLASSICS`; Cricket and Tactics under Match play) and render as `GameRow`s in one glass card per group via `groupedGames()`; a group with no visible game hides, and the divider skips hidden rows (`isFirstVisible`). The in-progress card binds to `resumeTarget()` — the newest active session with a card, linking to its setup route — with a static detail line (#815). Training's schedule card reads `trainingWeek()`: the active schedule plus this ISO week's completions through the pure `startOfIsoWeek`/`dayStatus`/`weekCounts` (done wins, then today, then missed/scheduled/rest; a scheduled, not-done today counts to go). Routine rows show a minutes chip only (#816) and a play link to the player. The create-routine modal is `detached`; creation is the personal-routines plus button. New shared primitives: `.feature-card` (accent gradient without the home halo), `.mode-pill`, `.section-eyebrow`, `--missed`/`--missed-muted`, `--chip-foreground`, `check-bold`/`cross-bold` icons.", because the same design-led phase as D425/D426; every element that existing reads can back is wired rather than faked.

### Consequences
`RoutineCard.astro` is removed. Weekday letters follow the browser locale. `.astro`/CSS carry no unit test (D101); the grouping, resume pick and week-status helpers are tested.

* Neutral, because 3 design elements render static or omitted and each has an issue: resume-card detail (#815), routine step chips (#816) and home weekday markers (#817) (spec, Discovered work and Implementation notes).
* Neutral, because `GameCard` stays in use on `/training/schedules` (spec, Implementation notes).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Spec § Testing extends `app/tests/lib/game/rulesets/games-visibility.test.ts`, `app/tests/lib/game/games-index.data.test.ts` and `app/tests/lib/training/schedules/today.test.ts`. Markup goes through `npm run validate:app`, `scripts/check-astro-conventions.sh` and a visual check at 390px.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-07
Referenced by D0456's `Supersedes:` line.

* Commit `1ede3fd0` (2026-10-08; adds the D427 row): origin of the existing Context, Decision Outcome and Consequences text. It rebuilt no section here.
* `docs/superpowers/specs/2026-10-07-games-training-redesign-design.md` (Goal, Games page, Testing, Discovered work, Implementation notes): rebuilt Decision Drivers, Consequences and Confirmation.
