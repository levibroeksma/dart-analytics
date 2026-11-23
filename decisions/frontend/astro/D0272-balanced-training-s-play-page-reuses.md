---
id: D0272
status: accepted
date: 2026-09-13
origin: contemporaneous
original-date:
tags: [frontend/astro, component, nav, page]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Balanced Training's play page reuses `GameLayout`, not `AppLayout`

## Context and Problem Statement
issue #274 — the bottom nav let a player leave a routine mid-warm-up with no confirmation and no explicit abandon path, unlike every game mode. `GameLayout` already owns that exact UX end to end (header exit button, `ExitModal`, `confirm-exit` event); reusing it needed no new component or pattern.

## Decision Drivers
* Issue #274: the bottom nav let a player leave a routine mid-warm-up with no confirmation and no explicit abandon path, unlike every game mode.
* `GameLayout` already owns that UX end to end (header exit button, `ExitModal`, `confirm-exit` event), so reuse needs no new component or pattern.

## Considered Options
* Keep `AppLayout` for the play page (the state before this record).
* Use `GameLayout` for the play page (chosen).

## Decision Outcome
Chosen option: "`app/src/pages/training/balanced-training/play/index.astro` swaps `AppLayout` for `GameLayout`. The bottom nav no longer renders during play, matching every `games/*/play` page, and the header's exit button opens the existing `ExitModal`, which dispatches `confirm-exit` on `window`. The root `x-data` element adds `@confirm-exit.window="abandonAndExit()"`, wired to `balancedTrainingPlay()`'s new `abandonAndExit()` method (`decisions/api.md` D271 covers what that method does server-side). `gameTitle` is passed as the static string `"Balanced Training"` — the page has no per-match title to compute the way `gameTitleExpr` does for a 1v1 game.".

### Consequences
the Finishing (`GAME`) step's own `TenUpOneDown` interface renders inside this same shell with no header of its own, so one Leave button covers the whole routine rather than one per step — leaving during Finishing goes through `finishing-step.data.ts`'s wrapped `abandonAndExit`, not a second exit control.

* Good, because the Finishing (`GAME`) step's `TenUpOneDown` interface renders inside this same shell with no header of its own, so one Leave button covers the whole routine rather than one per step.
* Neutral, because leaving during Finishing goes through the wrapped `abandonAndExit` in `finishing-step.data.ts`, not a second exit control.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `cebf5fb3` adds `abandonAndExit` tests. Commit `b30e4cc9` (PR #419) later removed that suite and the page, so this is not a live check.

## Pros and Cons of the Options
### Keep `AppLayout`
* Bad, because the bottom nav lets a player leave mid-routine with no confirmation and no abandon path.

### Use `GameLayout`
* Good, because it reuses the exit button, `ExitModal` and `confirm-exit` event that every game mode already has.
* Good, because the bottom nav no longer renders during play, matching every `games/*/play` page.

## Evidence / More Information
Decided: 2026-09-13

* Commit `cebf5fb3` (PR #277, 2026-09-13; adds the D272 row, the `GameLayout` swap and the `abandonAndExit` tests): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
