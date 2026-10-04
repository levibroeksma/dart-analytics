# Heatmap target filter for derived-intent games (Group C)

Scope: Singles Training, Shanghai, Around the Clock on `/statistics`. Group B (stored intent) is the base; this branch stacks on it.

## Problem

These games aim at one target per visit, but store no intent (`intent_*` columns are `NULL`). The shipped heatmap pools every dart. The aim is recoverable only by the engine fold (`aimedDarts`, `derived-aims.module.ts`), which Singles' configurable `target_order` and ATC's progress-dependent path rule out doing in SQL.

## Decisions

1. **One picker, five games.** `HEATMAP_TARGET_GAMES` gains `SINGLES_TRAINING`, `SHANGHAI`, `AROUND_THE_CLOCK`. Same `target` param, same cache key, same `Select`.
2. **Options per game.**
   - Singles, ATC: "All targets", `NUMBER:1`..`NUMBER:20`, `BULL:25`.
   - Shanghai: "All targets", `NUMBER:1`..`NUMBER:20` (engine never reaches bull).
   - Labels via `targetLabel` (`NUMBER:7` -> `7`, `BULL:25` -> `Bull`).
3. **Server accepts `target` on either tag.** `sectionTarget` allows `intent-stored` or `intent-derived`. A derived game accepts only `NUMBER:n` and `BULL:25`; any other zone is `VALIDATION_FAILED`.
4. **Compute site depends on the target.** Unfiltered heatmap stays `sql` (no `MAX_FOLD_DARTS` cap, no regression on long ranges). A derived game with a target resolves to `server`: `stepsLoad` -> `aimedDarts` -> keep darts whose aim matches -> bin into `HEATMAP_CELL_MM` cells. `sectionSite` takes the request's target presence as input; the client cache passes the query target too, and chunk windows merge via `mergeHeatmap`.
5. **Aim match ignores the zone ring.** The picker key `NUMBER:n` matches an aim of `n` under `NUMBER` or `OUTER_SINGLE` (ATC V2 aims outer single). One key space across ruleset versions of a game.
6. **Cell binning parity.** Fold path uses `floor(x / cellMm)` / `floor(y / cellMm)`, identical to the SQL expression; a parity test pins both.
7. **Fold cap applies per chunk window.** The client fetches `server` sections in chunk windows, so `MAX_FOLD_DARTS` bounds each window, not the range. Over it, a filtered chunk request fails with the existing `foldBoundMessage`; the picker shows the section's existing error state. Unfiltered is unaffected.
8. **Skipped sessions.** `skippedSessions` from the fold reaches the response as for other server sections; the UI surfaces it as today.

## Changes

- `lib/stats/heatmap-targets.ts`: add derived games and their option lists.
- `lib/stats/section-registry.ts`: heatmap `siteByTag: DERIVED_ON_SERVER` only when a target is present; `sectionSite` signature gains `hasTarget`.
- `services/statistics.service.ts`: `sectionTarget` gate; `heatmap` handler gains a `server` entry (`heatmapFromSessions`).
- `modules/stats/sections/heatmap.module.ts`: `heatmapCellRowsFromAims(sessions, target)`.
- `lib/stats/constants.ts`: `HEATMAP_ONLY_LAYOUTS` already covers the three games; no change.
- Docs: Section Catalog, Overview §5 `target` row, File Inventory, decision D408, context map history.

## Tests

- `heatmap-targets`: per-game options, Shanghai has no bull.
- `heatmap.module`: filter by `NUMBER:n` / `BULL:25`, `OUTER_SINGLE` aim matches `NUMBER:n`, binning parity with SQL floor.
- Service: derived + target -> server site; derived without target -> sql; derived + `DOUBLE:16` -> `VALIDATION_FAILED`; over cap -> bound error.
- Client: `game-heatmap.data` picker on a derived game, reset on game change.

## Out of scope

- Per-visit (not per-number) filtering, round ranges, multi-select targets.
- Persisting intent for these games (rejected: `chk_dart_target_consistency` requires a zone, and "any ring" has none).
