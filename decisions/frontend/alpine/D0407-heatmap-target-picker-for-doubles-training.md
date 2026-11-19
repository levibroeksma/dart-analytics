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

# Heatmap target picker for Doubles Training and Bob's 27

## Context and Problem Statement
both games store their intent, so the server already serves `heatmap?target=`; only the page lacked a control. The per-target cache key (`paramsKey`) already isolates each target.

The spec scopes this to Doubles Training and Bob's 27; Singles, Shanghai and Around the Clock are out of scope (derived intent, the server rejects `target`).

## Decision Drivers
* Both games store their intent, so the server already serves `heatmap?target=`.
* The page lacks a control.
* The per-target cache key (`paramsKey`) already isolates each target.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`gameHeatmapSection()` gains `target` state, a `targetOptions` getter and a `target` watcher; `GameHeatmapSection.astro` shows a `Select` when the options are non-empty. Options come from `heatmapTargetOptions()` (`lib/stats/heatmap-targets.ts`): empty unless the game type is in `HEATMAP_TARGET_GAMES` (Doubles Training, Bob's 27), else "All targets" (`null`, sends no `target`) plus the 21 doubles-path keys (D1..D20, bull). A `game` change resets `target` to `null`. `HEATMAP_ONLY_LAYOUTS` gains `DOUBLES_TRAINING_V1` and `BOBS27_V1`. `DOUBLES_PATH_KEYS` is the one source for Bob's 27's survival walk and the picker.", because both games store their intent, so the server already serves `heatmap?target=`; only the page lacked a control. The per-target cache key (`paramsKey`) already isolates each target.

### Consequences
Singles, Shanghai and Around the Clock still show the pooled heatmap with no filter (`intent-derived`; `target` is rejected there) until a server-fold variant is designed. `.astro` markup is untested (D101); the factory and options are covered.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The record states that the factory and the options are covered; `app/tests/lib/stats/heatmap-targets.test.ts` and `constants.test.ts` exist. `.astro` markup is untested (D101).

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (extends D406).

* `docs/superpowers/specs/2026-10-04-heatmap-target-picker-design.md` (Decisions): rebuilt Context.
* Commit `4a07c192` (2026-10-04; the `decisions/frontend/alpine.md` row): rebuilt Decision Drivers.
* Applied in: `docs/superpowers/plans/2026-10-04-heatmap-derived-target.md`.
