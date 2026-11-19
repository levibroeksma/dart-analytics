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
<!-- backfill: pending -->

# Heatmap target filter for Singles, Shanghai and Around the Clock

## Context and Problem Statement
these games store no intent (`intent-derived`); the aim is recoverable only by the engine fold. Option A keeps the schema unchanged. The client fetches `server` sections in chunk windows, so `MAX_FOLD_DARTS` bounds each window, and a merger is required for long ranges (corrects the Group C spec).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`HEATMAP_TARGET_GAMES` gains Singles Training, Shanghai and Around the Clock; options are `NUMBER:1..20` plus `BULL:25` (no bull on Shanghai). `sectionTarget` accepts a `target` on `intent-derived` games, only `NUMBER:n` or `BULL:25`. `sectionSite` takes `hasTarget`; `SectionMeta.siteByTagWhenFiltered` (heatmap: `DERIVED_ON_SERVER`) routes a derived game with a target to the `server` site, so `HANDLERS.heatmap` gains `server: stepsHandler(heatmapFromSessions)`: `aimedDarts` filtered by `aimMatchesTarget`, binned with `floor(x / HEATMAP_CELL_MM)` like the SQL `FLOOR`. `NUMBER:n` also matches `OUTER_SINGLE:n` aims (ATC V2). The unfiltered heatmap stays `sql`. `heatmap` joins `ServerSectionId` with `mergeHeatmap` (sum by `ix,iy`); `readSection` passes the query target to `sectionSite`. Heatmap `version` 2.".

### Consequences
a filtered heatmap costs a fold per chunk; the pooled view is unaffected. Cached heatmaps drop once (`version` bump). The picker is not browser-checked.

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
Supersedes: none (extends D407).
