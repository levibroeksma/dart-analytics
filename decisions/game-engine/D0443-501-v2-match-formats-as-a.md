---
id: D0443
status: accepted
date: 2026-10-10
origin: contemporaneous
original-date:
tags: [game-engine, 501, leg]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# 501 V2 match formats as a SET→LEG stage tree

## Context and Problem Statement
the stage tree already supports nesting (`parent_stage_id`, per-parent sequence uniqueness, `v_replay_stages`); a global leg sequence under SET parents would give `sequence` two meanings, and flat legs would make set grouping unreachable in SQL. Ignoring trailing stages in V1 costs nothing and keeps old sessions resumable; V2 has no legacy logs, so strictness catches corruption. One card avoids a duplicate 501 entry for a version the user never picks.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`501_V2` adds best of N (odd only), sets, win by 2 legs with a configurable sudden-death cap (every set or deciding set) and per-set throw rotation. With sets on, each set is a `SET` stage and its legs are child `LEG` stages whose `sequence` restarts per set; without sets, legs stay root stages. One pure fold (`match-format.module.ts`) decides set and match ends for both versions; `501_V1` snapshots read as first to `legs_to_win`. A V2-shaped configuration template (seed `0037`) lets template-merge session creation validate under the strict V2 schema. V1 legacy flat logs keep the old fold behaviour (stages after the deciding leg are ignored) so no persisted V1 session becomes unresumable; V2 throws on stages after a won match. The games card stays a single "501" card keyed on `501_V2`; resume lookups map a `501_V1` session onto it via `cardForRuleset`.".

### Consequences
no migration; seed `0037` and the `0007` capability rows carry the version. `SEAT_CAPS` gains `501_V2` (4). Statistics order legs per set. Spec: `docs/superpowers/specs/2026-10-10-501-v2-match-formats-design.md`; rules: `docs/game-rules/rulesets/501.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-10
