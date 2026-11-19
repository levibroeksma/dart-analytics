---
id: D0064
status: superseded
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0301
---

# v1 = one activity per session, server-managed

## Context and Problem Statement
Defer, not contradict, the activities-group-sessions model

## Decision Drivers
* The DB models 1 activity to many sessions with an `ACTIVE` to `COMPLETED` or `ABANDONED` lifecycle. The API only mints a fresh activity per `POST /api/sessions`. It has no `activityId` input and no activity or routine-run write path (validation spec, Section 3 finding F5).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "v1 = one activity per session, server-managed; multi-session activities + routine-run writes deferred", because Defer, not contradict, the activities-group-sessions model.

### Consequences
* Neutral, because each `POST /api/sessions` creates its own activity implicitly, with no `activityId` input and no standalone activity API.
* Neutral, because completing a session through `PATCH /api/sessions/:sessionId` also moves the parent activity to `COMPLETED`.
* Neutral, because abandonment detection is a server or background concern outside the v1 API scope.
* Neutral, because routines stay read-only (`GET` only) in v1.

### Confidence
Rationale unknown — no source found.

### Revisit When
Post-v1, when multi-session activities and the routine-run write path are built; the validation spec defers both.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-12

* `docs/superpowers/specs/2026-07-12-v1-api-freeze-validation-design.md` (Section 3 F5, Section 4 D5, Section 6; the spec's own numbering): rebuilt Decision Drivers, Consequences and Revisit When.
* `docs/superpowers/plans/2026-07-12-v1-api-freeze-reconciliation.md` (Task 5 Step 2): appends the ledger row D64 dated 2026-07-12.
* Applied in: `docs/superpowers/specs/2026-07-16-game-rules-wiring-design.md` (Context, Design 1), which cites D64 for the deferred routine-run write path.
* Superseded by D0301 (frontmatter `superseded-by`).
