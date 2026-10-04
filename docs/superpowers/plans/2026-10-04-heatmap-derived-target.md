# Heatmap derived-target filter (Group C) Implementation Plan

Spec: `docs/superpowers/specs/2026-10-04-heatmap-derived-target-design.md`. Branch `feat/stats-heatmap-derived-target`, stacked on #769. Option A: aim stays derived by fold; no schema change.

**Correction to the spec.** A `server`-site section is fetched by the client in chunk windows and merged (`readSection` -> `readServerSection`, `mergeMetrics`). So (a) `heatmap` must join `ServerSectionId` with a merger, and (b) `MAX_FOLD_DARTS` bounds each chunk request, not the whole range. The spec's "over cap fails" applies per chunk. Fix the spec in Task 1.

Each task is red -> green -> commit. Run from `app/`; tests by path (`npx vitest run <path>`). No `//` comments in function bodies; exported types go in `lib/*/types.ts`.

## Task 1: Spec fix + site-by-target in the registry

- Edit spec decision 7: cap is per chunk window; decision 4: note the client cache passes the target to `sectionSite`.
- `lib/stats/section-registry.ts`:
  - `sectionSite(meta, gameTypeKey, hasTarget = false)`.
  - New optional `SectionMeta.siteByTagWhenFiltered?: Partial<Record<StatsTag, ComputeSite>>` (type in `lib/stats/types.ts`); consulted first when `hasTarget`.
  - `heatmap` meta: `siteByTagWhenFiltered: DERIVED_ON_SERVER`; bump `version` to 2 (cache invalidation).
- Tests `tests/lib/stats/section-registry.test.ts`:
  - heatmap + SHANGHAI/SINGLES_TRAINING/AROUND_THE_CLOCK: `sql` without target, `server` with.
  - heatmap + DOUBLES_TRAINING + target: `sql`.
  - existing `target-accuracy` etc. unchanged.

## Task 2: Server accepts a derived target

- `services/statistics.service.ts` `sectionTarget`: allow `intent-stored` or `intent-derived`. Derived game: only `NUMBER:n` and `BULL:25` (via `parseTargetKey`), else `{ error }`. Stored game behaviour unchanged.
- `resolveSectionHandler(sectionId, gameTypeKey, hasTarget)` and `resolveGameSectionSite` pass `ctx.target !== null`.
- Tests `tests/services/statistics.service.test.ts`:
  - derived + `NUMBER:7` accepted; derived + `DOUBLE:16` -> `VALIDATION_FAILED`; derived + `BULL:20` -> invalid.
  - stored + `DOUBLE:16` still accepted.
  - the registry-coverage test (every `sectionsForGame` pair resolves a handler) also covers heatmap+target on derived games.

## Task 3: Fold-side heatmap cells

- `modules/stats/sections/heatmap.module.ts`: `heatmapCellRowsFromAims(sessions, target)`:
  - `aimedDarts(session)`; keep darts whose aim matches. Match on number (and bull for `BULL:25`); `NUMBER:n` matches aim zones `NUMBER` and `OUTER_SINGLE` of `n`.
  - Bin `floor(x / HEATMAP_CELL_MM)`, `floor(y / HEATMAP_CELL_MM)`; return `HeatmapCellRow[]` so `heatmapBuckets` is reused.
  - Add an exported `aimMatchesTarget(aimKey, target)` helper, in `lib/stats/target-key.ts` beside `isAimHit`.
- Tests `tests/modules/stats/sections/heatmap.module.test.ts` and `tests/lib/stats/target-key.test.ts`:
  - filter by `NUMBER:n`, by `BULL:25`; `OUTER_SINGLE:n` aim matches `NUMBER:n`; other numbers excluded.
  - negative coordinates bin like SQL `FLOOR` (parity case at -2.5, 0, 4.99, 5).
  - empty result -> `[]` buckets.

## Task 4: Heatmap server handler

- `services/statistics.service.ts`: `heatmapFromSessions(sessions, ctx)` -> `heatmapBuckets(heatmapCellRowsFromAims(sessions, ctx.target), ctx)`. `HANDLERS.heatmap` gains `server: stepsHandler(heatmapFromSessions)`.
- Test (service): derived game + target runs the fold handler, returns `metrics.target` set and `skippedSessions` through.

## Task 5: Client chunk merge

- `lib/stats/types.ts`: add `"heatmap"` to `ServerSectionId`; `ServerSectionMetrics.heatmap: HeatmapMetrics`.
- `lib/stats/merge-metrics.ts`: `mergeHeatmap(a, b)`: sum `cells` by `ix,iy`; keep `cellMm` and `target`.
- Tests `tests/lib/stats/merge-metrics.test.ts`: overlapping and disjoint cells, additivity across split windows equals the one-shot fold.
- `lib/client/stats-cache/cache.ts` `readSection`: pass the query's `target` to `sectionSite`. Test `tests/lib/client/stats-cache/cache.test.ts`: derived+target takes the chunked path; derived without target and stored games take the aggregate path.

## Task 6: Picker for the three games

- `lib/stats/heatmap-targets.ts`:
  - `HEATMAP_TARGET_GAMES` += `SINGLES_TRAINING`, `SHANGHAI`, `AROUND_THE_CLOCK`.
  - Options: Singles, ATC = All + `NUMBER:1..20` + `BULL:25`; Shanghai = All + `NUMBER:1..20`. Labels via `targetLabel`.
- Tests `tests/lib/stats/heatmap-targets.test.ts` (update the game-set assertion; option counts 22, 22, 21) and `tests/lib/stats/sections/game-heatmap.data.test.ts` (picker on a derived game, target reset on game change).
- No `.astro` change: the `Select` is already gated by `targetOptions.length`.

## Task 7: Docs

- `decisions/frontend/alpine.md`: D408 (`bash scripts/next-decision-id.sh` first) extends D407. Cites: per-target site, aim-match ignores ring, spec correction.
- `docs/architecture/10-Statistics/00-Overview.md` §5 `target` row: derived games accept `NUMBER:n` / `BULL:25`; `01-Section-Catalog.md` heatmap entry and version (Section Catalog bump); `00-File-Inventory.md` rows; `00-Context-Map-History.md` entry.

## Verify (before PR update)

`npx vitest run tests/lib/stats tests/modules/stats tests/services tests/lib/client`, then on the user's go: full `npm test`, `npx astro check` (0/0/0), `npm run build`, `scripts/fallow-gate.sh`, the `check-*.sh` doc gates, `npm run format`. Browser check of the picker on Singles, Shanghai and ATC is not covered by tests.

## Risks

- Chunk merge is the new surface: a heatmap merged from chunks must equal the single-request result (Task 5 test).
- ATC V2 `OUTER_SINGLE` aims depend on `rulesOf(config).segmentRule`; covered by the match test, but needs a fixture from a V2 session.
- `version: 2` drops cached heatmaps once; acceptable.
- Stacked on #769: if it merges first, rebase onto `main` (single stacked branch, within the cap).
