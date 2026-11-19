---
id: D0111
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, Score Training]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Score Training (Task 18) is the first fully-implemented game engine end-to-end

## Context and Problem Statement
Closes the 18-task Score Training engine plan; establishes the concrete shape future game engines (D40) will replicate

## Decision Drivers
* No part of the sessions vertical slice existed: no `pages/api/sessions/**` routes, no frontend game store, engine or game pages beyond a placeholder.
* Score Training is the simplest game in the ruleset set, so the design uses it as the proof case for the pattern.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Score Training (Task 18) is the first fully-implemented game engine end-to-end: `scoreTrainingSetup`/`scoreTrainingPlay` `.data.ts` factories, three routed pages (`setup`/`play`/`results`), wired into `register-route-data.ts`; also the first real (non-doc-only) instance of the ruleset-validator-registry pattern (D15/D87) driving a live client flow", because Closes the 18-task Score Training engine plan; establishes the concrete shape future game engines (D40) will replicate.

### Consequences
* Good, because the design states the registry, service, repository and routes scaffold is generic, so 501, TUOD and Singles Training can slot in later without touching shared code.
* Good, because the 2026-07-25 review finds Score Training on `main` builds its engine from a config snapshot, mints `clientKey`/`sequence`/`completedAt`, rehydrates on resume and has a registered validator.
* Bad, because the same review finds the shared store is Score-Training-shaped (ST1), engine and store keep duplicate fact logs (ST2) and config vocabulary is translated by hand in two directions (ST3).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-16

* `docs/superpowers/specs/2026-07-16-score-training-engine-design.md` (Context, Design § 2, Context Maintenance): rebuilt Decision Drivers and Consequences.
* `docs/superpowers/plans/2026-07-16-score-training-engine.md` (Goal, Task 18 closing step): rebuilt Confirmation.
* `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (§ 6, ST1–ST3): rebuilt Consequences.
* Commit `cd80aa80` (PR #29, 2026-07-21; adds the D111 row): confirmed the row text.
