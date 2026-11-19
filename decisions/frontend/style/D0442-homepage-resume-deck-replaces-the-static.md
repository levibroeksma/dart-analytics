---
id: D0442
status: accepted
date: 2026-10-10
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, motion]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Homepage resume deck replaces the static resume card

## Context and Problem Statement
the static card of D425 showed sample data and a hard-coded link, and the design's multi-session frame needs one card per game. Config alone gives a useful summary for any session; live turns only exist on the device that holds the session.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the homepage lists every active non-routine game session, newest first, in a stacked `ResumeSessionDeck` (`CardStack` + `DeckPager`, factory `resumeDeck()`). Progress is hybrid. `GET /api/sessions/active` returns a config-derived `progress` summary for every session, built by `summarizeProgress()` (`modules/game/session-progress.module.ts`). The client recomputes it from `$store.game` for the one session held locally. Game turns upload only at session end, so a server fold of an active session sees none. The API flags `isRoutineStep` and the deck filters those out, while `resumeTarget` skips them; routine steps are resumed from their routine (`resumeOpenRoutine`), not from the deck. `findActiveSessions` reads the routine flag and configuration by joining `exercise_sessions` and `exercise_configurations` onto `v_active_sessions` at runtime, because `v_active_sessions` is not changed and `schema.ts` is not editable in this workspace. Resume always links to the game card's setup route.".

### Consequences
supersedes only the always-visible static resume card of D425; the rest of D425 stands. No migration. A session started on another device shows its config summary, not live progress, until incremental fact upload exists (#815 stays open). Cards for sessions not held on this device read "Start over" with a "Progress is on another device" note, because opening setup abandons them (#897); live cross-device progress depends on #815. `/games` `ResumeSessionCard` still has its own static card. The runtime join stays until `is_routine_step` and configuration are folded into the view. New tokens `--stack-1`, `--stack-2`, `--deck-top-from`, `--deck-top-to`, class `.deck-top-card`, keyframes `deck-out`/`deck-rise`/`deck-in` plus `deck-fade-*` for reduced motion. `.astro`/CSS carry no unit test (D101); the factory, summary and sort/filter helpers are tested. Spec `docs/superpowers/specs/2026-10-10-home-resume-deck-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-10
Supersedes: D425 (static resume card only).
Referenced by D0534's `Supersedes:` line.
Referenced by D0455's `Supersedes:` line.
Referenced by D0463's `Supersedes:` line.
