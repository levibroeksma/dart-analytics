---
id: D0265
status: accepted
date: 2026-09-11
origin: contemporaneous
original-date:
tags: [frontend/astro, layout, page]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `/training` replaces `/trivia` as a flat IA; routine detail pages get a reusable static shell

## Context and Problem Statement
the Training/Routine/`ExerciseEngine` model (`docs/architecture/09-Training/01-Routines.md`, D264) needed its first frontend surface, but wiring a real training-session page (reading the routine snapshot, running `TrainingEngine`, advancing `ExerciseEngine`s) is a separate, larger task gated on schema work for `SWITCHING`/`DOUBLE_PATTERN` that hasn't landed yet. Shipping the IA move and a static detail page now, ahead of that wiring, gives the new model a real landing spot without inventing a second parallel "routines" UI later.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`/trivia` is renamed to `/training`. Quick Subtract relocates to `/training/quick-subtract` as a flat `GameCard`, at the same level as the new `Balanced Training` routine — not nested under a trivia or routines sub-path. `GameCard.astro` gains an optional `duration` prop (renders `Badge.astro`) so a routine's card can show its total time; game cards that pass no `duration` are unchanged. `RoutineDetail.astro` (`components/layout/training/`) is a new shared shell — title, duration pill, an ordered step list (name/duration/plain-language explanation), and a single disabled `Start` button — with no settings, since nothing is configurable yet. `Balanced Training`'s 4 steps are static copy hand-written into its page, not read from `routine_templates`/`routine_steps`.".

### Consequences
`lib/trivia/`, `modules/trivia/`, `components/layout/trivia/` keep their current names — only the page routes moved, not the domain folders (logged as `FINDINGS.md` F77, not fixed here). The `Start` button is inert; wiring it to a real training session is a follow-up task, along with the `SWITCHING`/`DOUBLE_PATTERN` schema and the Warm-Up engine's fixed-to-proportional duration change (`docs/superpowers/specs/2026-09-11-training-page-and-balanced-training-design.md` §5-7). D261 (trivia tools stay outside `GameEngine`/`ExerciseEngine`) is unaffected — this is a navigation move, not an architecture reversal.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-11
