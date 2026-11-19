---
id: D0088
status: superseded
date: 2026-10-13
origin: contemporaneous
original-date:
tags: [frontend/alpine, recovery]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0460
---

# Client recovery

## Context and Problem Statement
Amends D67 UX wording. The client is 100% responsible for session-progress persistence, so recovery is automatic: no manual abandon dialog and no sign-out in this flow. The spec replaces the `00-Overview.md` wording "offers resume or abandon" with "resume when local + server align; otherwise client auto-cleans".

## Decision Drivers
* The client owns session-progress persistence (spec, I4).
* Recovery needs no user prompt.

## Considered Options
* Manual abandon or resume prompt, the wording in `07-Frontend/00-Overview.md` before this record.
* Auto-abandon on mismatch or missing local state, with no prompt (chosen).

## Decision Outcome
Chosen option: "Client recovery: auto-abandon on mismatch/missing local; no manual abandon UI; server owns DB orphan sweeps", because Amends D67 UX wording.

### Consequences
* Neutral, because the spec amends the `00-Overview.md` recovery text and adds a footnote to the D67 row saying the UX is auto-cleanup.
* Neutral, because server DB orphans stay a future server responsibility, outside client recovery UX.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's Validation list requires that the recovery text in `00-Overview.md` matches Decision 4 before the task is claimed done.

## Pros and Cons of the Options
### Auto-abandon on mismatch
* Good, because recovery needs no user prompt.
* Neutral, because a matching local and server session resumes from the persisted store.

## Evidence / More Information
Decided: 2026-07-14

* `docs/superpowers/specs/2026-07-14-frontend-architecture-design.md` (Decision 4, I4, Validation; the proposed D88 row): rebuilt Context, Drivers, Considered Options, Consequences and Confirmation.
* Commit `238fdbc1` (2026-07-14, adds the D88 row).
* Superseded by D460 (never abandons a session; setup asks before ending one held elsewhere).
* Applied in: `docs/superpowers/specs/2026-07-17-score-training-flow-redesign.md` (shared D88 reconciliation), `docs/superpowers/plans/2026-07-17-score-training-flow-implementation.md`.
