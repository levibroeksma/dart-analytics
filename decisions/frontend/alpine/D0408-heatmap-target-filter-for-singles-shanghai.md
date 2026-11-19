---
id: D0408
status: accepted
date: 2026-10-04
origin: contemporaneous
original-date:
tags: [frontend/alpine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Heatmap target filter for Singles, Shanghai and Around the Clock

## Context and Problem Statement
these games store no intent (`intent-derived`); the aim is recoverable only by the engine fold. Option A keeps the schema unchanged. The client fetches `server` sections in chunk windows, so `MAX_FOLD_DARTS` bounds each window, and a merger is required for long ranges (corrects the Group C spec).

## Decision Drivers
* The aim of these games is recoverable only by the engine fold (`aimedDarts`). Singles' configurable `target_order` and Around the Clock's progress-dependent path rule out doing it in SQL.
* The unfiltered heatmap must not regress on long ranges: it keeps the `sql` site, with no `MAX_FOLD_DARTS` cap.
* Group B's stored-intent picker is the base to reuse: same `target` param, same cache key, same `Select`.

## Considered Options
* Option A: keep the aim derived by the engine fold, with no schema change (chosen).
* Persist intent for these games (rejected in the spec's Out of scope).

## Decision Outcome
Chosen option: "`HEATMAP_TARGET_GAMES` gains Singles Training, Shanghai and Around the Clock; options are `NUMBER:1..20` plus `BULL:25` (no bull on Shanghai). `sectionTarget` accepts a `target` on `intent-derived` games, only `NUMBER:n` or `BULL:25`. `sectionSite` takes `hasTarget`; `SectionMeta.siteByTagWhenFiltered` (heatmap: `DERIVED_ON_SERVER`) routes a derived game with a target to the `server` site, so `HANDLERS.heatmap` gains `server: stepsHandler(heatmapFromSessions)`: `aimedDarts` filtered by `aimMatchesTarget`, binned with `floor(x / HEATMAP_CELL_MM)` like the SQL `FLOOR`. `NUMBER:n` also matches `OUTER_SINGLE:n` aims (ATC V2). The unfiltered heatmap stays `sql`. `heatmap` joins `ServerSectionId` with `mergeHeatmap` (sum by `ix,iy`); `readSection` passes the query target to `sectionSite`. Heatmap `version` 2.".

### Consequences
a filtered heatmap costs a fold per chunk; the pooled view is unaffected. Cached heatmaps drop once (`version` bump). The picker is not browser-checked.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's Tests section lists the checks: per-game options with no bull on Shanghai, `heatmap.module` filtering by `NUMBER:n` and `BULL:25` with a binning-parity test against the SQL floor, service site routing and `VALIDATION_FAILED`, and the client picker. `app/tests/lib/stats/heatmap-targets.test.ts` and `app/tests/modules/stats/sections/heatmap.module.test.ts` exist today.

## Pros and Cons of the Options
### Option A: derive the aim by fold
* Good, because the schema stays unchanged.
* Good, because the unfiltered heatmap stays `sql` with no `MAX_FOLD_DARTS` cap.
* Bad, because the fold cap applies per chunk window. Over it, a filtered chunk request fails with the existing `foldBoundMessage`.

### Persist intent for these games
* Bad, because the spec rejects it: `chk_dart_target_consistency` requires a zone, and "any ring" has none.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (extends D407).

* `docs/superpowers/specs/2026-10-04-heatmap-derived-target-design.md` (Problem, Decisions 1–8, Tests, Out of scope): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-10-04-heatmap-derived-target.md` (header, "Option A: aim stays derived by fold; no schema change"): rebuilt Considered Options.
* Commit `4a210c64` (2026-10-04, adds the D408 row): source of the Context, Decision Outcome and Consequences text; it rebuilt no other section.
