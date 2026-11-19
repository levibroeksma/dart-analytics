---
id: D0407
status: accepted
date: 2026-10-04
origin: contemporaneous
original-date:
tags: [frontend/alpine, state]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Heatmap target picker for Doubles Training and Bob's 27

## Context and Problem Statement
both games store their intent, so the server already serves `heatmap?target=`; only the page lacked a control. The per-target cache key (`paramsKey`) already isolates each target.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`gameHeatmapSection()` gains `target` state, a `targetOptions` getter and a `target` watcher; `GameHeatmapSection.astro` shows a `Select` when the options are non-empty. Options come from `heatmapTargetOptions()` (`lib/stats/heatmap-targets.ts`): empty unless the game type is in `HEATMAP_TARGET_GAMES` (Doubles Training, Bob's 27), else "All targets" (`null`, sends no `target`) plus the 21 doubles-path keys (D1..D20, bull). A `game` change resets `target` to `null`. `HEATMAP_ONLY_LAYOUTS` gains `DOUBLES_TRAINING_V1` and `BOBS27_V1`. `DOUBLES_PATH_KEYS` is the one source for Bob's 27's survival walk and the picker.", because both games store their intent, so the server already serves `heatmap?target=`; only the page lacked a control. The per-target cache key (`paramsKey`) already isolates each target.

### Consequences
Singles, Shanghai and Around the Clock still show the pooled heatmap with no filter (`intent-derived`; `target` is rejected there) until a server-fold variant is designed. `.astro` markup is untested (D101); the factory and options are covered.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (extends D406).
