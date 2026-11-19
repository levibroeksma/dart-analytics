---
id: D0074
status: accepted
date: 2026-07-13
origin: contemporaneous
original-date:
tags: [database, migration, replay]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Migration `0016` rebuilds `v_game_replay` (LEFT JOIN darts, `turn_total_score`

## Context and Problem Statement
Recreational + nested-stage replay; integer DTO contract. The spec rebuilds `v_game_replay` and `v_session_overview` in migration `0016` and leaves `0009`, `0013` and `0014` unedited.

## Decision Drivers
* Turn-total-only (recreational) turns had no rows in `v_game_replay`, because darts were inner-joined (spec Decision 7).
* Stage `sequence_number` is only unique per session and parent, so flat ordering was ambiguous for nested stages (spec Decision 7).
* The `SessionOverview.durationSeconds` contract is an integer (spec Decision 7).

## Considered Options
* Rebuild the views in migration `0016` with DROP and CREATE (chosen).
* Edit the applied `0009`, `0013` or `0014` migrations. The spec rules this out.

## Decision Outcome
Chosen option: "Migration `0016` rebuilds `v_game_replay` (LEFT JOIN darts, `turn_total_score`, `stage_id`/`parent_stage_id`) and floors `v_session_overview.duration_seconds`", because Recreational + nested-stage replay; integer DTO contract.

### Consequences
* Good, because recreational sessions replay at turn resolution and nested stages can be reconstructed and ordered.
* Good, because `duration_seconds` meets the integer contract without repository fix-ups.
* Neutral, because dart columns are NULL for turn-total-only turns.
* Neutral, because the naming rule gains a second purpose for exposed entity UUIDs: structural identity to rebuild hierarchies.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec checks that the `ReplayEntry` and `SessionOverview` DTOs match the `0016` view projections column for column, and that migrations `0001`–`0016` plus seeds apply cleanly from empty (spec, "Testing / Validation").

## Pros and Cons of the Options
Rebuild in `0016`:

* Good, because every completed exercise is replayable without exceptions.

## Evidence / More Information
Decided: 2026-07-13

* `docs/superpowers/specs/2026-07-13-architecture-hardening-design.md` (Decision 7; naming-rule amendment; "Testing / Validation"): rebuilt Decision Drivers, Considered Options, Consequences and Confirmation.
* `docs/superpowers/plans/2026-07-13-architecture-hardening.md` (Task 2; ledger row D74): shows the migration and the row text.
* Commit `7c49f6d5` (2026-07-14; "record D67-D78 architecture hardening decisions"): adds the decision row.
