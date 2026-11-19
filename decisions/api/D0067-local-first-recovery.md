---
id: D0067
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [api, batch, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Local-first recovery

## Context and Problem Statement
Resolves recovery-vs-batch contradiction with zero schema cost

The architecture review found that the mid-session recovery story contradicted the frozen write model, and that `clientKey` is not persisted.

## Decision Drivers
* The mid-session recovery story contradicted the frozen write model (Problem item 2).
* `clientKey` is not persisted (Problem item 2).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Local-first recovery: in-progress state in persisted Alpine stores (`$persist`); one batch at session completion; `clientKey` payload-internal only; no server mid-session recovery or cross-batch reconciliation. **UX (2026-07-14, D88):** auto-abandon on mismatch — no manual abandon prompt", because Resolves recovery-vs-batch contradiction with zero schema cost.

### Consequences
* Good, because no `client_key` column is added to any runtime table, so no schema is added.
* Neutral, because recovery is entirely client-side and same-device, with no server-side mid-session recovery in v1.
* Neutral, because whole-batch retry safety stays with the unchanged `Idempotency-Key` mechanism, and `409 SESSION_ALREADY_COMPLETED` stays the only mid-session write guard.
* Neutral, because `v_active_sessions` exists to detect an orphaned active session so the client can resume from local state or abandon it.

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

* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Problem item 2; Decision 1): rebuilt Context, Decision Drivers and Consequences.
* Applied in: `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 4, which amends the D67 recovery UX to auto-abandon, D88).
