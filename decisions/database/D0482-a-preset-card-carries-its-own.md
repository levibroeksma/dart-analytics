---
id: D0482
status: accepted
date: 2026-10-22
origin: contemporaneous
original-date:
tags: [database, migration, table, index, seed]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A preset card carries its own tags: `ruleset_version_tags` and a `CARD` branch in `v_catalog_tags`

## Context and Problem Statement
Nine Lives is a card on the Around the Clock game type and must read as its own difficulty and format. One typed link table per tagged entity is the repo rule (no EAV, no polymorphic FK); folding cards into `game_type_tags` would need a nullable second FK and a new primary key on live data.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "migration `0049_ruleset_version_tags.sql` adds a third typed link table, `ruleset_version_tags (ruleset_version_id, tag_id, is_primary, created_at)`, with a partial unique index for one primary tag, and recreates `v_catalog_tags` with a third `UNION ALL` branch: `entity_kind = 'CARD'`, `type_key` the ruleset implementation key, `context_key = 'STANDALONE'`. A rules file names its card with a `Card ruleset: \`<KEY>\`` header; the tag-seed generator writes that file's Standalone block to the table. The catalog response gains `cards`, and the Games page prefers a card's own set over its game type's wholesale (closes #1051).".

### Consequences
a card with no row falls back to its game type as before. `database/README.md`, the Database Specification chapters and `v_catalog_tags` docs name the table. Spec: `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md`; plan: `docs/superpowers/plans/2026-10-22-track-t2-nine-lives.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-22
