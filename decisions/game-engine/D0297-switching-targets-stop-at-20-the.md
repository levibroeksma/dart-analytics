---
id: D0297
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [game-engine, engine, scoring, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Switching targets stop at 20; the bull is not a Switching target

## Context and Problem Statement
Every Switching dart is stamped with the visit's target and `TREBLE` as its intended zone (D276) — the exercise's aim is the target's treble, which `09-Training/01-Routines.md` §17 writes as `T20 → T19 → T18`. The bull has no treble, so target 25 is incoherent at the intent level, not merely unscored: the widened bound admitted a config the engine could not express an aim for. Adding a bull zone instead would mean inventing a fourth scoring key and a bull-specific intended-zone rule for a mode the design spec (`2026-09-11-training-page-and-balanced-training-design.md` §5.2) never describes — new product surface to rescue a configuration nobody asked for. The element bound was copied from `WarmUpPhaseConfig`, whose targets carry no ring intent at all; the two were never the same constraint.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`SwitchingV1Config.targets`' per-element bound drops from `.max(25)` to `.max(20)`, so a configuration naming the bull is rejected by `switchingValidator` at rest and on submission rather than accepted and silently mis-scored. `SwitchingEngine.pointsFor` gains no bull zone and `SwitchingScoringConfig` gains no bull key. Warm-Up's own `targets` keep `.max(25)` — 25 is a legal warm-up target and `seeds/0015`/`0017` both use it — and `pages/api/sessions/types.ts`'s `TargetNumber` keeps `.max(25)`, since a *hit* on the bull is real data whatever was aimed at.".

### Consequences
A stored `exercise_templates.default_configuration` row naming 25 in a Switching target list would start failing validation. Every in-repo seed is clean (`seeds/0017` configures `[20, 19, 18]`), but no live database was reachable from this session (D193), so a production row carrying 25 is unverified — a reviewer with database access should confirm before merge. Reported bull-target behaviour was a silent 0 per visit, indistinguishable from a genuine miss; it is now a validation error naming `targets`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-17
