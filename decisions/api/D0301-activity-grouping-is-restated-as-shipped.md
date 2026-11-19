---
id: D0301
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [api, endpoint, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0064
superseded-by:
---

# Activity grouping is restated as shipped: one activity spans N step sessions

## Context and Problem Statement
issue #339. `startTraining` creates one `activities` row plus an `activity_configurations` snapshot, and each `startTrainingStep` call inserts a further `exercise_sessions` row against that same activity, so Balanced Training ships exactly the one-activity-to-four-sessions shape both documents deferred. A frozen decision that shipped code contradicts is worse than no decision: the next agent reading it either designs against a constraint that no longer holds or "fixes" working code to satisfy it. The alternative — leaving the freeze and treating the training path as an undocumented exception — was rejected because frozen decisions are the strongest claim the API docs make, and an exception nobody recorded is how the contradiction arose.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Restate the frozen activity-grouping bullet to describe what ships.
* Leave the freeze and treat the training path as an undocumented exception.

## Decision Outcome
Chosen option: "`06-API/00-Overview.md`'s frozen Activity grouping bullet and `04-Endpoint-Contracts.md`'s Activity note are restated to describe what ships: activities are server-managed, a standalone game session gets an activity of its own, and a training routine's activity spans every step session started under it. Multi-session activities and routine-run writes are no longer described as deferred post-v1.".

### Consequences
the freeze on activity grouping is lifted in the documents rather than in behaviour; nothing in `app/` changes. This is a semantics correction, not a doc-only bump, so both documents take a minor version bump and this block is the authority for it. Activity-level uniqueness stays unenforced at the database level for the reason D288 records, and the auto-abandon rule D292 established is unaffected.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-17

* Commit `1ca45c03` (PR #407, 2026-09-17; fixes #339; adds the D301 row to `decisions/api.md`): rebuilt Considered Options; source of the split-copied Context and Consequences. Its message says D301 supersedes D64.
