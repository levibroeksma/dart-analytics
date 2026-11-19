---
id: D0077
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [frontend/alpine, persist]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `player_settings` deferred post-v1

## Context and Problem Statement
Table was unreachable; local persistence covers the need. The spec lists `player_settings` as unreachable. v1 ships no settings endpoints, so the table has no live server path at session start.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`player_settings` deferred post-v1: no endpoints; `forms/` persist last-used modes and send them per D60", because Table was unreachable; local persistence covers the need.

### Consequences
* Neutral, because the table stays in the schema for post-v1 and `06-Spec/03-Player-Layer.md` gains a one-line v1-status note.
* Neutral, because the spec adds `player_settings` endpoints to the Deferred list.

### Confidence
Rationale unknown — no source found.

### Revisit When
Post-v1, the deferral the spec names. The sources name no other trigger.

### Confirmation
The plan names `scripts/check-context-map.sh` as the consistency gate for its doc edits. The sources name no check specific to this decision.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-13

* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (§ 9b, the findings summary and the decision list): rebuilt Context, Consequences and Revisit When.
* `docs/superpowers/plans/2026-07-13-architecture-hardening.md` (Step 3 note on `06-Spec/03-Player-Layer.md`, the D77 ledger row, the Deferred list step): rebuilt Consequences and Confirmation.
* Commit `7c49f6d5` (2026-07-14, adds the D77 row): checked the decision wording.
* Applied in: `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 14; `forms/` is the v1 substitute).
