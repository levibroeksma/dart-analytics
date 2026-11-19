---
id: D0119
status: accepted
date: 2026-07-17
origin: contemporaneous
original-date:
tags: [game-engine, Score Training]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Score Training hard-gate completion

## Context and Problem Statement
Prevents concurrent ACTIVE sessions; hard-gate is Score Training–scoped, not generalized

## Decision Drivers
* Omitting `PATCH COMPLETED` leaves the session `ACTIVE`, which blocks `uq_sessions_single_active` for Play again and new setup creates.
* Play again must not race an unfinished terminal transition.

## Considered Options
* Enqueue the completed batch to the D90 outbox and allow a passive "unsaved, will retry" path (the pattern in force before this record).
* Hard-gate the results modal until batch POST and `PATCH COMPLETED` both succeed (chosen).

## Decision Outcome
Chosen option: "Score Training hard-gate completion: results modal gates Back / Play again until batch POST and `PATCH COMPLETED` both succeed (`completionStatus === "succeeded"`; treats `409 SESSION_ALREADY_COMPLETED` as success); amends D90's passive-outbox pattern for Score Training so terminal session state is reached before a new session can be created; supersedes D112's results-via-query-params / dedicated `/results` page for this flow — results render as a play-page modal from a component-local snapshot", because Prevents concurrent ACTIVE sessions; hard-gate is Score Training–scoped, not generalized.

### Consequences
* Good, because Play again cannot start until the previous session is terminal, which keeps the single-active-session invariant.
* Bad, because a failed completion keeps Back and Play again disabled until a retry of the full sequence succeeds. The modal shows an error and a Retry control.
* Neutral, because the spec keeps the general outbox as the canonical pattern for other games and says not to generalize the gate silently.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/score-training-play.data.test.ts` covers the completion path: `SESSION_ALREADY_COMPLETED` counts as success, and a failure sets `completionStatus = "failed"` with the buttons still disabled.

## Pros and Cons of the Options
### Outbox with a passive unsaved path
* Bad, because Play again could race an unfinished terminal transition.

### Hard-gate until batch and `COMPLETED` succeed
* Good, because the terminal session state is reached before a new session can be created.
* Bad, because Back and Play again stay disabled while completion fails.

## Evidence / More Information
Decided: 2026-07-17

* `docs/superpowers/specs/2026-07-17-score-training-flow-redesign.md` (Phase 1 completion sequence, "Hard-gate vs D90", Non-Negotiables): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-07-17-score-training-flow-implementation.md` (Task 8): the plan records D119 and notes it supersedes D112's results-via-query-params page for this flow.
* Commit `cd80aa80` (PR #29, 2026-07-21; adds the D119 row): confirmed the row text.
* Applied in: `docs/superpowers/specs/2026-07-21-score-training-undo-finish-confirm-design.md`, `docs/superpowers/plans/2026-07-21-score-training-undo-finish-confirm.md`, `docs/superpowers/specs/2026-07-22-hardening-first-deploy-design.md`.
