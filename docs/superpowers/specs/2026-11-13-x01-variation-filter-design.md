# 501 variation filter — design

Status: approved, implemented (D556; Home pinned to 501, D557). Date: 2026-11-13.
Input to: the 501 statistics page UI plan (follows `2026-11-11-x01-inferred-aim-statistics-design.md`).

## Intent

A 501 game can start from 301, 501, 701 or a custom score (`starting_score` in the session's config snapshot). Today every completed 501-game session feeds the 501 statistics. A 301 or a custom 1001 skews averages, checkout rates, leg lengths and the inferred-aim sections. The owner wants the 501 page to describe real 501 games by default, with the other variations one dropdown away.

## Goals

- One "Variations" dropdown on the 501 statistics page. Default 501.
- Every section on the page (trend, aim sections, checkout, legs, heatmap, session list) reads only the selected variation.
- Entries are built from the owner's completed games, so the list needs no hard-coded values.

## Non-goals

- Filtering by any other config field (legs, sets, double-in, etc.).
- Showing two variations side by side or comparing them.
- Other games. The filter exists on the 501 game type only.
- Home page and career summaries (see Open items).
- A new stored column or table. Per the principle: store what happened, derive what it means. The variation is derived from the stored `starting_score`.

## Anti-goals

- A custom score leaking into the 501 entry, or a 301/701 game appearing in 501 totals.
- A request that silently ignores the filter. A game that cannot honour it rejects it.
- A dropdown that lies about the data it shows (counts must match what the sections read).

## Behaviour (owner-confirmed unless marked)

1. Variation key = the integer `starting_score`. A custom score typed as 301, 501 or 701 is the same variation as the preset (same stored value).
2. The dropdown is labelled "Variations", defaults to 501 and lists one entry per distinct score found in the owner's completed 501 sessions. Entry label: the score. Each entry shows its completed-session count (my guess).
3. 501 is always listed, even with zero 501 sessions (an empty state then shows for the sections).
4. A session with no config snapshot, or no `starting_score` in it, counts as 501 (my guess; `v_x01_checkout_darts` already documents that the snapshot can be absent, and every pre-variation game was 501).
5. Only completed sessions populate the list (the sections' default population; abandoned sessions appear only in sections that include them, and the filter applies to those too).
6. Entry order (my guess): 501 first, then ascending by score.
7. The selection applies to all sections on the page, the session list, and the aim-filtered heatmap.
8. Single-entry case (my call): the dropdown still renders, with one option, so the control is discoverable.
9. Selection is remembered per viewer in the browser (my call: `localStorage`, with 501 as the fallback). It is a per-viewer convenience, not state that must persist.
10. A remembered variation that no longer has sessions falls back to 501 and the list shows what exists.

## Mechanism

Derive in the read layer; no migration is expected, because `v_stats_session_facts.configuration` already exposes the snapshot.

- **Query parameter** `variation` (positive integer, ≥ 2 to match the ruleset floor; default 501) on the 501 section and session-list routes. Joins the Common Query Contract (`00-Overview.md` §5) beside `context`. A game other than 501 that receives it, and a routine route, return `VALIDATION_FAILED`. Routine step keys already never mix configurations (§8), so routine routes need no filter.
- **Predicate** on every session scope and every dart scope: `COALESCE((configuration->>'starting_score')::int, 501) = :variation`. All section reads go through the shared scope builders in `statistics.repository.ts` (`contextCondition` is the precedent), so the predicate lands in one place per scope kind. The builder confirms it reaches the checkout-dart view reads, the heatmap, the session list and the session count.
- **Variation list**: a new read, `GET /api/statistics/games/501/variations`, returning `[{ startingScore, sessions }]` over completed sessions for the owner, with 501 always present. View-backed (`v_stats_session_facts`), owner-scoped like every statistics route. Registered in the endpoint contracts doc.
- **`dataVersion`** stays the game's terminal-population token. It over-invalidates the cache when a game in another variation completes; that is acceptable (my call) and avoids a per-variation token.
- **Client cache**: `variation` joins `paramsKey`, so each variation caches separately. The cache-layer change is small but mandatory: without it, switching variation would serve the wrong cached series.
- **Store/UI**: `game-stats.store.ts` holds the selected variation and the list; changing it reloads every section through the existing chunked fetch path. The dropdown reuses an existing select primitive from `components/forms/` (builder checks `08-Component-Inventory.md`; proposes a new component only if nothing fits). Visual details follow the Design System artifact.

## Scope details (settled after the builder check)

- **Game guard.** Every statistics route is keyed by `:gameTypeKey` and every view read already filters on `game_type_key`, so the `COALESCE(…, 501)` default only ever applies inside 501 sessions. The `variation` parameter is accepted only when `gameTypeKey = 501`.
- **Reads that need the predicate.** The shared scope builders (`dartScopeWhere`, `sessionScopeWhere`, `gameSessionConditions`) cover `v_stats_dart_facts` and `v_stats_session_facts`. `v_x01_checkout_darts` exposes `configuration` directly. The visit, leg and bucketed-aggregate reads (`findVisitFacts`, `findLegFacts`, `findBucketedSessionAggregates`) must be checked: where a view lacks the snapshot, join `v_stats_session_facts` on `session_id`, as `findX01FoldRows` already does. That needs no migration. A view change (0056) is the fallback only if a join cannot work.
- **Routes.** One family: `GET games/501/sections/:sectionId` and `GET games/501/sessions` (plus the new variations read). The heatmap is a section on the same route. No POST bodies. The chunked client fetch passes `variation` like any other query field.
- **Dropdown count.** The count is the number of completed sessions in that variation. Sections that include abandoned sessions still apply the filter to them; the list count does not include abandoned sessions (the anti-goal about matching counts refers to the completed-session population).
- **Values.** A positive integer ≥ 2 that has no sessions returns the normal empty series, not an error. A non-numeric, empty, or < 2 value is `VALIDATION_FAILED`.
- **Order of work.** Docs first, with or alongside the code (repo rule). The builder allocates the decision id in `decisions/api.md`.

## Constraints

- Controller → Service → Repository layering; reads via `v_*` views only.
- The Statistics docs are updated with the code: Overview §5 (parameter table), Section Catalog (the filter applies to every 501 section), `04-Endpoint-Contracts.md` (new endpoint, new parameter), decision ledger entry in `decisions/api.md`.
- TDD and all repo gates apply. Tests cover: predicate in each scope kind, 501-default with absent snapshot, a custom 501 merging with the preset, non-501 rejection, cache key separation, store fallback when a remembered variation vanishes.
- The ratchet margin on `mi_average` is about 0.0002 (#1327): new code must not lower the average.

## Left to the builder

- Exact route shape of the list endpoint, if the Overview suggests a better fit (for example a field on the game header read).
- Labels for entries (for example "501" versus "501 games (42)").
- Whether the predicate is a shared SQL fragment or a column on a view; if a view change is chosen it needs migration 0056 and the carve-out rules apply.

## Open items for the owner

- Resolved (D557): the Home page is pinned to 501. Its first-9 average, daily averages and landing heatmap count a `501`-game session only when its starting score is 501 (absent counts as 501); Score Training is unaffected.
