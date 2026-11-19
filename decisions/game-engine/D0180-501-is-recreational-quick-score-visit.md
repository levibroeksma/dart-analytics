---
id: D0180
status: accepted
date: 2026-08-02
origin: contemporaneous
original-date:
tags: [game-engine, checkout, 501, leg, visit, bust]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# 501 is RECREATIONAL + QUICK_SCORE (visit totals only, no per-dart rows), so when an

## Context and Problem Statement
Matches `docs/game-rules/rulesets/501.md`'s Finishing section: the finishing dart, not the visit, must be a double, and the app has no per-dart fact to check that against

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "501 is RECREATIONAL + QUICK_SCORE (visit totals only, no per-dart rows), so when an entered visit score would bring the leg's remaining total to exactly 0 the client cannot tell a legal double-out checkout from a bust from the number alone; `five-oh-one-play.data.ts`'s `submitVisit` gates behind a "Finished on a double?" confirm (`showDoubleConfirm`/`confirmDouble`/`denyDouble`) before recording anything", because Matches `docs/game-rules/rulesets/501.md`'s Finishing section: the finishing dart, not the visit, must be a double, and the app has no per-dart fact to check that against.

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-02

* Commit `c40fb8ec` (PR #66, 2026-08-02; adds the D180 row): adds the row; no section rebuilt.
* `docs/superpowers/plans/2026-08-01-501-recreational-v1.md`: the D183 note records the gate that later grew to three actions.
