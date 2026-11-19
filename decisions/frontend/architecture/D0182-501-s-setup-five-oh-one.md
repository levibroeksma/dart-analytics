---
id: D0182
status: accepted
date: 2026-08-02
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# 501's setup (`five-oh-one-setup.data.ts`), play (`five-oh-one-play.data.ts`) factories

## Context and Problem Statement
Two samples (Score Training, 501) are a poor basis for choosing an abstraction boundary; accepted as-is, revisit when a third RECREATIONAL/QUICK_SCORE-shaped game lands

## Decision Drivers
* Two samples (Score Training, 501) are a poor basis for choosing an abstraction boundary.
* The plan builds the existing 501 engine behind the established Score Training page pattern.

## Considered Options
* Mirror the Score Training setup, play and results-modal counterparts and accept the duplication (chosen).
* Extract shared helpers from the two counterparts.

## Decision Outcome
Chosen option: "501's setup (`five-oh-one-setup.data.ts`), play (`five-oh-one-play.data.ts`) factories and results modal mirror their Score Training counterparts (`score-training-setup.data.ts`, `score-training-play.data.ts`) rather than extracting shared helpers; `fallow` reports the play-data pair as an 8-group, 158-line clone family, plus a separate 3-group, 52-line setup clone family", because Two samples (Score Training, 501) are a poor basis for choosing an abstraction boundary; accepted as-is, revisit when a third RECREATIONAL/QUICK_SCORE-shaped game lands.

### Consequences
* Neutral, because `fallow` reports the play-data pair as an 8-group, 158-line clone family and the setup pair as a separate 3-group, 52-line family.
* Neutral, because the record accepts both clone families as they are and names a third same-shaped game as the revisit trigger.

### Confidence
Rationale unknown — no source found.

### Revisit When
A third RECREATIONAL/QUICK_SCORE-shaped game lands.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Mirror the Score Training counterparts
* Good, because two samples are a poor basis for choosing an abstraction boundary.
* Bad, because `fallow` reports an 8-group, 158-line play-data clone family and a separate 3-group, 52-line setup clone family.

### Extract shared helpers
Rationale unknown — no source found. The record rejects it only because two samples are a poor basis for the boundary.

## Evidence / More Information
Decided: 2026-08-02

* `docs/superpowers/specs/2026-08-01-501-recreational-v1-design.md` (Setup flow, Play flow): rebuilt Decision Drivers and Considered Options.
* `docs/superpowers/plans/2026-08-01-501-recreational-v1.md` (Architecture, context-maintenance step): rebuilt Decision Drivers.
* Commit `c40fb8ec` (PR #66, 2026-08-02; adds the D182 row): rebuilt Consequences, Pros and Cons and Revisit When.
* Applied in: `docs/superpowers/plans/2026-08-19-consistency.md` (cites D182's revisit trigger; records that D208 and D209 paid down the play-data half).
