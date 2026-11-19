---
id: D0069
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [api]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Terminal statuses (COMPLETED, ABANDONED) always set `completed_at` (server default

## Context and Problem Statement
Aligns `uq_sessions_single_active` with `v_active_sessions`; unblocks abandon flow

The 2026-07-13 architecture review found 2 conflicting definitions of an active session, and that ABANDONED could permanently block a player.

## Decision Drivers
* `uq_sessions_single_active` tests `completed_at IS NULL`, while `v_active_sessions` tests `status = 'ACTIVE'`, so the 2 definitions of active disagree.
* An ABANDONED session could permanently block a player.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Terminal statuses (COMPLETED, ABANDONED) always set `completed_at` (server default `now()`); `ACTIVE` ⇔ `completed_at IS NULL` invariant", because Aligns `uq_sessions_single_active` with `v_active_sessions`; unblocks abandon flow.

### Consequences
* Good, because the unique index and the view agree by construction, with no schema change.
* Neutral, because the invariant is enforced in the service layer and documented, not by a database constraint.
* Neutral, because abandonment stays client-driven and stale-session sweeps stay out of scope for v1.
* Neutral, because the same rule applies to `activities` when their terminal transitions are server-managed.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-13

* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Problem item 3; Decision 3): rebuilt Context, Decision Drivers and Consequences.
* Applied in: `docs/superpowers/plans/2026-07-22-hardening-first-deploy.md` (the `findActiveSessionForGameType` interface).
