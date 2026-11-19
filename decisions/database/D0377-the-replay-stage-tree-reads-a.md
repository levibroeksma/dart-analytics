---
id: D0377
status: accepted
date: 2026-09-30
origin: contemporaneous
original-date:
tags: [database, migration, view, replay]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The replay stage tree reads a stage-grain view, `v_replay_stages` (0046)

## Context and Problem Statement
issue #639. `v_game_replay` inner-joins `turns`, so a parent stage with no turns of its own has no row and `stageOrder` throws "unknown parent" on its children, turning the replay into a 500. The alternative, treating a missing parent as a root, weakens corrupt-input detection. D371 decision 3 recorded the gap as a known limitation.

## Decision Drivers
* A parent stage with no turns of its own must not turn the replay into a 500 (issue #639).
* Corrupt-input detection in `stageOrder` should stay strict.

## Considered Options
* Treat a missing parent as a root.
* Keep `SELECT DISTINCT` over `v_game_replay` (the status quo, which throws "unknown parent").
* Add the stage-grain view `v_replay_stages` (chosen).

## Decision Outcome
Chosen option: "migration `0046` adds `v_replay_stages`, one owner-scoped row per `exercise_stages` row (`session_id`, `player_id`, `stage_id`, `parent_stage_id`, `stage_sequence`, `stage_type_key`). `findReplayStages` reads it instead of `SELECT DISTINCT` over `v_game_replay`. `v_game_replay` is unchanged and still serves turn and dart rows.".

### Consequences
nested-stage engines (SET → LEG with turns only on legs) replay without a further change. A stage with no turns now reaches `stageOrder` and contributes no events. Amends D371 decision 3's source for stages only.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`database/verification/0046_replay_stages_view_checks.sql` ships with migration `0046`.

## Pros and Cons of the Options
### Treat a missing parent as a root
* Bad, because it weakens corrupt-input detection.

### Keep `SELECT DISTINCT` over `v_game_replay`
* Bad, because `v_game_replay` inner-joins `turns`, so a turnless parent has no row and its children throw "unknown parent".

### Add `v_replay_stages`
* Good, because nested-stage engines (SET → LEG with turns only on legs) replay without a further change.
* Good, because `v_game_replay` is unchanged and still serves turn and dart rows.

## Evidence / More Information
Decided: 2026-09-30

* Commit `6d4edd6b` (2026-10-01, PR #678; migration `0046`, `statistics.repository.ts`): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
