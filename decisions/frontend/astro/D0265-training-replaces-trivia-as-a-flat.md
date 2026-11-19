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

# `/training` replaces `/trivia` as a flat IA; routine detail pages get a reusable static shell

## Context and Problem Statement
the Training/Routine/`ExerciseEngine` model (`docs/architecture/09-Training/01-Routines.md`, D264) needed its first frontend surface, but wiring a real training-session page (reading the routine snapshot, running `TrainingEngine`, advancing `ExerciseEngine`s) is a separate, larger task gated on schema work for `SWITCHING`/`DOUBLE_PATTERN` that hasn't landed yet. Shipping the IA move and a static detail page now, ahead of that wiring, gives the new model a real landing spot without inventing a second parallel "routines" UI later.

## Decision Drivers
* The Training/Routine/`ExerciseEngine` model had landed on 2026-09-10 (Phase 1/Warm-Up only) with no frontend surface.
* A real training-session page is a larger task, gated on schema work for `SWITCHING`/`DOUBLE_PATTERN` that has not landed.
* "Trivia" should stop being a UI category, and the new model needs a landing spot so no second parallel "routines" UI appears later.

## Considered Options
* Nest the new pages under a `/training/trivia` or `/training/routines` intermediate level.
* A flat `/training` with a static routine detail shell (chosen).

## Decision Outcome
Chosen option: "`/trivia` is renamed to `/training`. Quick Subtract relocates to `/training/quick-subtract` as a flat `GameCard`, at the same level as the new `Balanced Training` routine — not nested under a trivia or routines sub-path. `GameCard.astro` gains an optional `duration` prop (renders `Badge.astro`) so a routine's card can show its total time; game cards that pass no `duration` are unchanged. `RoutineDetail.astro` (`components/layout/training/`) is a new shared shell — title, duration pill, an ordered step list (name/duration/plain-language explanation), and a single disabled `Start` button — with no settings, since nothing is configurable yet. `Balanced Training`'s 4 steps are static copy hand-written into its page, not read from `routine_templates`/`routine_steps`.".

### Consequences
`lib/trivia/`, `modules/trivia/`, `components/layout/trivia/` keep their current names — only the page routes moved, not the domain folders (logged as `FINDINGS.md` F77, not fixed here). The `Start` button is inert; wiring it to a real training session is a follow-up task, along with the `SWITCHING`/`DOUBLE_PATTERN` schema and the Warm-Up engine's fixed-to-proportional duration change (`docs/superpowers/specs/2026-09-11-training-page-and-balanced-training-design.md` §5-7). D261 (trivia tools stay outside `GameEngine`/`ExerciseEngine`) is unaffected — this is a navigation move, not an architecture reversal.

* Neutral, because `lib/trivia/`, `modules/trivia/` and `components/layout/trivia/` keep their names. Only the page routes moved, and the mismatch is logged as `FINDINGS.md` F77, not fixed here.
* Bad, because the `Start` button is inert until a follow-up task wires it to a real training session.
* Neutral, because that follow-up also carries the `SWITCHING`/`DOUBLE_PATTERN` schema and the Warm-Up engine's fixed-to-proportional duration change (spec §5-7).
* Neutral, because D261 (trivia tools stay outside `GameEngine`/`ExerciseEngine`) is unaffected. This is a navigation move, not an architecture reversal.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Nested IA
* Bad, because Quick Subtract would sit under a trivia or mental-training sub-path, which keeps "trivia" a UI category.

### Flat `/training` with a static detail shell
* Good, because the IA move ships ahead of the wiring and gives the model a real landing spot.
* Good, because the detail shell is reusable: step count and content vary per routine, while the title, duration pill, step list and CTA do not.
* Bad, because the Balanced Training steps are hand-written static copy, not read from `routine_templates`/`routine_steps`.

## Evidence / More Information
Decided: 2026-09-11

* `docs/superpowers/specs/2026-09-11-training-page-and-balanced-training-design.md` (§ 1 Purpose, § 2 IA, § 3 routine detail template): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-09-11-training-page-and-balanced-training.md` (the D265 append step): rebuilt Consequences.
* Commit `1d1786a1` (2026-09-11; adds the D265 row, F77 and the Component Inventory entry): confirmed the F77 note in Consequences.
* Applied in: `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md`, `docs/superpowers/plans/2026-09-17-p1-training-taxonomy.md`, `docs/superpowers/specs/2026-09-18-custom-routine-builder-design.md`.
