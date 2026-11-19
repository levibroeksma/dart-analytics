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

# The Visit points kernel folds visit totals into points; it grows only with its callers

## Context and Problem Statement
the two shipped engines share only the visit walk; speccing settings no caller uses would fix a shape before any game tests it (D468 method).

## Decision Drivers
* The aim is tidying: fewer hand-written classes and one shared visit fold, not new games (spec § 1).
* The two shipped engines share only the visit walk: up to 3 darts or one keypad total, summed, then turned into points (spec § 2).
* A policy lands with its first caller, the method Track uses (spec § 1, V2).

## Considered Options
* A kernel that carries only what the two shipped engines use, with goal, bust, void and compare settings added by the first game that needs each (chosen).
* Spec the umbrella's goal, bust, void and compare-mode settings now (not done: V2 defers them to the first caller).

## Decision Outcome
Chosen option: "`visit-points-kernel.module.ts` folds one seat over turns: a turn's total is its dart sum, or its stored `totalScore` when dartless; a turn closes at `dartsPerVisit` darts or when dartless, and adds `points(total)`. `VisitPointsRules` carries only `dartsPerVisit` and `points`; goal, bust, void and compare settings land with the first game that needs each. Seat identity, duration and outcome stay in each engine. The shipped engines migrate Score Threshold → Score Training: Score Threshold fits the exercise shell unchanged; Score Training needs keypad-total input (`visitInput`) on the game shell, built to the Checkout spec §6 shape by whichever of Score Training and Ten Up One Down migrates first, and reused by the other.", because the two shipped engines share only the visit walk; speccing settings no caller uses would fix a shape before any game tests it (D468 method).

### Consequences
Score Threshold's hand-written class is gone; its behaviour is pinned by goldens recorded before the rebind. Score Training stays `PENDING` until PR 2. Spec: `docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/visit-points-kernel.module.test.ts` covers the kernel. `app/tests/modules/training/exercises/score-threshold.golden.test.ts` pins Score Threshold's behaviour across the rebind.

## Pros and Cons of the Options
### Spec all umbrella settings now
* Bad, because settings no caller uses would fix a shape before any game tests it (record Context).

## Evidence / More Information
Decided: 2026-10-27

* `docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md` (§ 1 decisions V1–V5, § 2): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* Commit `f2c8e53e` (PR #1120, 2026-10-28, adds the D502 row): kernel plus Score Threshold on the exercise shell.
