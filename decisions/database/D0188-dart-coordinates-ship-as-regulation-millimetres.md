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

# Dart coordinates ship as regulation millimetres with a pair-or-neither constraint

## Context and Problem Statement
A landing point is one fact, not two independently-optional columns — the CHECK constraint makes "half a coordinate" unrepresentable rather than a client-side convention. This is the shipped shape that replaces the deferral recorded in `06-Spec/04-Runtime-Layer.md` ("`location_x`/`location_y` board coordinates are deferred"), now that the visual board UI can capture them. The visual board input spec (§ Decisions taken, rows 2 and 4) places the coordinates on `darts` as nullable columns and fixes the unit as regulation millimetres with the origin at the bull centre and y pointing down, matching the SVG.

## Decision Drivers
* Coordinates annotate the same fact row, so every existing view and engine keeps working (spec, decision 2).
* The SVG is already drawn in millimetres, margins read as "8 mm short of T20", and the unit survives an SVG redesign (spec, decision 4).
* "Half a coordinate" must be unrepresentable rather than a client-side convention (record rationale, from the adding commit).
* The visual board UI can now capture coordinates, so the deferral in `06-Spec/04-Runtime-Layer.md` ends.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`darts.location_x` / `darts.location_y` ship as `NUMERIC(6, 2)` millimetres, origin at the bull centre, y increasing downward to match `dartboard.svg` (migration `0017`). Both columns are nullable, but never independently: `chk_dart_location_pair` rejects one present without the other. `v_dart_locations` (migration `0018`) exposes them plus derived `radius_mm` / `angle_degrees`; miss margin needs a zone centroid, which stays out of SQL entirely and is computed in the application read layer (`app/src/lib/game/board/miss-margin.module.ts`) instead.".

### Consequences
Migration `0017` also adds the two `player_settings` foreign keys (`fk_player_settings_capture_mode`, `fk_player_settings_input_mode`) that `06-Spec/03-Player-Layer.md` specified but `0003` never created — bundled because both were reviewed together and neither is separable from the other in that migration. No capability table ships alongside this pair; it is deferred to a later plan.

* Good, because `chk_dart_location_pair` rejects a half-set coordinate in the database, not in client code.
* Good, because miss margin stays out of SQL and is computed in `miss-margin.module.ts`, so board geometry stays out of the views (spec, decision 3).
* Neutral, because the capability table is deferred to a later plan.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The visual board plan (Task 3) tests the constraint by inserting a half-set pair and expecting a refusal. It also mirrors `chk_dart_location_pair` in the batch write schema and adds a `constraint-mirror.test.ts` case (Task 7). `database/verification/0018_visual_board_checks.sql` covers `v_dart_locations`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-05

* `docs/superpowers/specs/2026-08-05-visual-board-input-design.md` ("Decisions taken" rows 2 and 4, "Migration `0017`"): rebuilt Context, Decision Drivers and Consequences.
* `docs/superpowers/plans/2026-08-05-visual-board-capture-core.md` (Tasks 3, 7 and 15): rebuilt Confirmation.
* Commit `ba175815` (PR #73, 2026-08-08; adds the D188 row in `decisions/database.md` and `database/migrations/0017_dart_locations.sql`): rebuilt Context, Decision Drivers and Consequences.
