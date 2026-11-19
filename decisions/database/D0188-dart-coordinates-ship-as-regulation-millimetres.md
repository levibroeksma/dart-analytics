---
id: D0188
status: accepted
date: 2026-08-05
origin: contemporaneous
original-date:
tags: [database, migration, table, constraint]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Dart coordinates ship as regulation millimetres with a pair-or-neither constraint

## Context and Problem Statement
A landing point is one fact, not two independently-optional columns — the CHECK constraint makes "half a coordinate" unrepresentable rather than a client-side convention. This is the shipped shape that replaces the deferral recorded in `06-Spec/04-Runtime-Layer.md` ("`location_x`/`location_y` board coordinates are deferred"), now that the visual board UI can capture them.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`darts.location_x` / `darts.location_y` ship as `NUMERIC(6, 2)` millimetres, origin at the bull centre, y increasing downward to match `dartboard.svg` (migration `0017`). Both columns are nullable, but never independently: `chk_dart_location_pair` rejects one present without the other. `v_dart_locations` (migration `0018`) exposes them plus derived `radius_mm` / `angle_degrees`; miss margin needs a zone centroid, which stays out of SQL entirely and is computed in the application read layer (`app/src/lib/game/board/miss-margin.module.ts`) instead.".

### Consequences
Migration `0017` also adds the two `player_settings` foreign keys (`fk_player_settings_capture_mode`, `fk_player_settings_input_mode`) that `06-Spec/03-Player-Layer.md` specified but `0003` never created — bundled because both were reviewed together and neither is separable from the other in that migration. No capability table ships alongside this pair; it is deferred to a later plan.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-05
