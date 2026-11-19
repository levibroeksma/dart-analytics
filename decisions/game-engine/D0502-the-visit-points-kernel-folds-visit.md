---
id: D0502
status: accepted
date: 2026-10-27
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, Score Training, visit, bust, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The Visit points kernel folds visit totals into points; it grows only with its callers

## Context and Problem Statement
the two shipped engines share only the visit walk; speccing settings no caller uses would fix a shape before any game tests it (D468 method).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`visit-points-kernel.module.ts` folds one seat over turns: a turn's total is its dart sum, or its stored `totalScore` when dartless; a turn closes at `dartsPerVisit` darts or when dartless, and adds `points(total)`. `VisitPointsRules` carries only `dartsPerVisit` and `points`; goal, bust, void and compare settings land with the first game that needs each. Seat identity, duration and outcome stay in each engine. The shipped engines migrate Score Threshold → Score Training: Score Threshold fits the exercise shell unchanged; Score Training needs keypad-total input (`visitInput`) on the game shell, built to the Checkout spec §6 shape by whichever of Score Training and Ten Up One Down migrates first, and reused by the other.", because the two shipped engines share only the visit walk; speccing settings no caller uses would fix a shape before any game tests it (D468 method).

### Consequences
Score Threshold's hand-written class is gone; its behaviour is pinned by goldens recorded before the rebind. Score Training stays `PENDING` until PR 2. Spec: `docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-27
