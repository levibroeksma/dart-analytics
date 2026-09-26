<!--
status: canonical
scope: architecture/statistics
read-when: designing or building any detailed statistics page, insight section, statistics endpoint, or the statistics client cache
updated: 2026-09-26
-->

# Statistics — Overview

> **Version:** 1.0.0 (2026-09-26, D364/D365/D366)
>
> Architecture for the detailed per-game statistics pages on `/statistics`.
> Design record: `docs/superpowers/specs/2026-09-26-statistics-pages-architecture-design.md`.
> Status: **designed, not built.** Nothing here exists in `app/` or `database/`
> yet; each rollout phase (§12) is its own spec + plan.

| File | Covers |
| ---- | ------ |
| `00-Overview.md` | this file — the shared layer every game page and section uses |
| `01-Section-Catalog.md` | the shared section library and the section list of each game page |
| `02-Replay.md` | the paginated per-session replay route |

The career-wide overview (`GET /api/statistics/overview`, `05-Views/01-General-Views.md`)
is a separate, shipped read. It is not replaced by this design; it may later be
re-expressed as registry sections, which this design allows but does not require.

---

# 1. Scope

- **Surface:** the Games tab of `/statistics` (game picker already built). The
  Routines tab is a later consumer of the same layer (§8).
- **Capture mode:** `ANALYTICS` + `VISUAL_BOARD` only in this version — the only mode
  with per-dart coordinates. The `inputMode` parameter (§5) exists from day one so
  recreational-mode sections are additive later.
- **Population:** sessions whose game pair (game type + ruleset version) matches the
  page's ruleset, in **both** play contexts (§8). No exercise-type-to-game mapping:
  a routine step counts toward a game only when it runs that game's engine.
- **Time:** career aggregates plus time series (month-over-month, year-over-year).

---

# 2. Insight Section — the unit of design

A game page is an ordered list of **insight sections** (heat map, average trend,
favorite double, …). Each section is one entry in a typed registry
(planned: *lib/stats/section-registry.ts*):

| Field | Meaning | Why it scales |
| ----- | ------- | ------------- |
| `id` | stable section key (`heatmap`, `checkout-rate`, …) | routes and cache keys never change when sections are added |
| `version` | integer, bumped on any logic change | part of every cache key — old results invalidate themselves |
| `requires` | capability tags (§3) | a new game gets every section its tags admit, no list edits |
| `computeSite` | `sql` \| `server` \| `client` (§4) | picked per section by cost, recorded with a reason |
| `bucketable` | supports `bucket` (§5) | enables MoM / YoY series |
| `includesAbandoned` | whether abandoned sessions enter the population | partial games never skew averages by accident |
| `configSensitive` | snapshot fields the result is grouped by (e.g. `ruleset_version_key`, `starting_score`) | unlike configurations are never blended |
| `contract` | zod schema of the result | typed API + client |
| `module` | pure, isomorphic TS function (`modules/stats/sections/*`) | moves between `server` and `client` without rewrite |

Adding an insight = one registry entry + one module + optionally one thin view.
No new route, no contract change elsewhere.

---

# 3. Capability Tags

A section declares the facts it needs; a ruleset declares the facts it produces.
The page renders the intersection.

| Tag | Fact it guarantees | Rulesets (VISUAL_BOARD) |
| --- | ------------------ | ----------------------- |
| `board` | landing coordinates per dart | all |
| `intent-stored` | `intended_target_number`/`intended_zone` stored per dart | Singles, Doubles Training, Bob's 27 |
| `intent-derived` | the aimed target is implicit and recovered by an engine fold | Shanghai, Around the Clock |
| `scoring` | face-value visit scoring | 501, Score Training |
| `checkout` | double-out remaining-score ladder | 501, 121, TUOD |
| `leg` | `LEG` stages | 501 |
| `ladder` | target climbs/falls per attempt | 121, TUOD |
| `target-sequence` | one target per visit/round | Singles, Doubles Training, Bob's 27, Shanghai, Around the Clock |

X01 and Score Training capture **no intent** (verified 2026-09-26: only the
Singles, Doubles Training and Bob's 27 engines set it). Sections needing intent
are therefore not offered for them; inferring an aim would fabricate a fact.

The tag map lives beside `RULESET_CAPABILITIES` (`lib/game/rulesets/capabilities.ts`)
so a new ruleset declares its tags where it already declares its modes.

---

# 4. Compute-Site Rule

Calculate where it is cheapest, subject to three hard constraints:

| Site | Use when | Hard constraint |
| ---- | -------- | --------------- |
| `sql` | plain arithmetic that collapses many rows into few: counts, sums, binning, `date_trunc` buckets, angle sectors | **no game rules in SQL** (`05-Views/00-Overview.md` §Business Logic). Mandatory for any section over an unbounded range (all-time, YoY, long series). |
| `server` | a game-rule fold (remaining score, checkout path, ladder, active number) | **bounded input only.** Workers have CPU limits; a fold whose input grows with history is a defect. |
| `client` | recomputation on interaction over an already-cached, bounded window (one session, last N days) | never over an unbounded range |

Escalation when a `server` section outgrows its bound, in order: reduce its input
in SQL → add an index → a materialized `(player, game, month)` rollup under the
existing materialized-view rules (refresh strategy required). Never a persisted
stat table: statistics stay in views (root `CLAUDE.md` Hard Invariants).

Every section records its site and a one-line reason in `01-Section-Catalog.md`.

---

# 5. Common Query Contract

Every statistics endpoint in this design accepts the same parameters. A
parameter a section cannot honour is rejected with `VALIDATION_FAILED`, never
silently ignored.

| Param | Values | Rule |
| ----- | ------ | ---- |
| `from`, `to` | ISO 8601 instants | **Required.** Half-open `[from, to)` on `completed_at`. The client supplies boundaries (no server timezone, D343). |
| `tz` | IANA zone name | Required when `bucket ≠ none`. Used only for bucket boundaries (`date_trunc(…, completed_at AT TIME ZONE tz)`). Never stored. |
| `bucket` | `none` \| `day` \| `week` \| `month` \| `year` | Bucketable sections only. Server caps bucket count per request (e.g. 120). |
| `status` | `completed` (default) \| `abandoned` \| `all` | Constrained by the section's `includesAbandoned`. |
| `context` | `all` (default for game pages) \| `standalone` \| `routine` | §8 |
| `inputMode` | `VISUAL_BOARD` (only value in this version) | reserved for recreational sections |
| `limit`, `cursor` | per `06-API/03-Shared-Conventions.md` §Pagination | every list or raw-row endpoint |

## 5.1 Additive metric components

Every numeric result is returned as its **additive components**, never only a
ratio: `{ pointsScored, dartsThrown }`, not `average`; `{ hits, attempts }`, not
`rate`. The client derives ratios.

- Month buckets re-aggregate exactly into quarters, years, or any custom range.
- **Year-over-year** is a client regrouping of month buckets (same month, different
  year) — no dedicated endpoint.
- A future materialized monthly rollup slots in behind the same contract.

Medians and other non-additive measures are allowed only as `bucket = none`
results, or as histograms (additive counts per bin) from which the client reads
the median.

## 5.2 Series shape

```ts
type Series<M> = {
  sectionId: string;
  sectionVersion: number;
  dataVersion: string;          // opaque, §7
  bucket: "day" | "week" | "month" | "year";
  tz: string;
  buckets: { start: string; closed: boolean; sampleSize: number; metrics: M }[];
};
```

`closed` is `true` when the bucket ends before the request time: no completed
session can ever land in it again (completion is always stamped "now"), so the
client caches it forever (§7).

---

# 6. Endpoints (planned)

All under `/api/statistics/`, protected route class, caller is always `me`,
view-backed end to end (D63).

| Route | Returns |
| ----- | ------- |
| `GET games/:rulesetKey/sessions` | paginated session list for the page (completed + abandoned, with progress-at-end), newest first |
| `GET games/:rulesetKey/sections/:sectionId` | one section result (`Series` or single value), dispatched through the registry; unknown or non-applicable section → `NOT_FOUND` |
| `GET sessions/:sessionId/replay` | paginated replay (`02-Replay.md`) |

One generic section route keeps the route count flat as insights grow; the
registry, not the router, is what grows. Contracts are written into
`06-API/04-Endpoint-Contracts.md` when the phase that builds them lands.

---

# 7. Client Cache (IndexedDB)

`/statistics` is a multi-page Astro app; an Alpine store dies on navigation. The
stats cache therefore lives in IndexedDB (planned: *lib/client/stats-cache/*),
behind one module; Alpine stores read through it.

| Store | Key | Invalidation |
| ----- | --- | ------------ |
| `sectionResults` | `(playerId, sectionId, sectionVersion, params, bucketStart)` | closed buckets: never. Open bucket and `bucket = none`: when `dataVersion` changes. |
| `sessionLists` | `(playerId, rulesetKey, params, cursor)` | when `dataVersion` changes |
| `replayPages` | `(sessionId, cursor)` | never — completed gameplay is immutable |
| `facts` | `(playerId, rulesetKey, month)` | bounded windows only, LRU-evicted under a size budget |
| `meta` | `schemaVersion`, per-game `dataVersion` | schema bump wipes all stores; logout wipes all stores |

- **`dataVersion`** is an opaque server token per (player, game), returned on every
  response. Its definition (today: count + max `completed_at` of the population)
  can widen later — e.g. to cover corrections — without a client change.
- **Fetch rule:** a request is made only for keys absent from the cache or stale
  under the table above. Splitting a series request into its open bucket only is
  the main cost saving for Neon and Workers.
- Every read and write is wrapped so a blocked or empty IndexedDB (private mode,
  quota) degrades to network-only, never to an error.

---

# 8. Play Context

A game run as a routine step stores the same game pair as a standalone game; only
its activity carries an `activity_configurations` snapshot
(`05-Database/06-Spec/04-Runtime-Layer.md`). Context is derived in the fact views,
never stored:

| `context_key` | Rule |
| ------------- | ---- |
| `STANDALONE` | the session's activity has no `activity_configurations` row |
| `ROUTINE` | it has one |

| Consumer | Population |
| -------- | ---------- |
| Game pages (now) | game pair match, both contexts; `context` filter optional |
| Routine pages (later) | `ROUTINE` only, scoped by routine snapshot identity + step index. The server fixes `context = routine`; the client cannot widen it. |

A routine step may pin a different configuration than the player's usual
standalone setup, so sections whose result depends on configuration declare it
in `configSensitive` and group by snapshot, not by context. A new context (e.g.
league match) is a new `context_key` value, not a new design.

---

# 9. Abandoned Sessions

An abandoned session has status `ABANDONED` with `completed_at` set. The play-page
abandon path uploads pending turns before changing status
(`playAbandonAndExit`, `lib/game/play-lifecycle.ts`), so its partial facts are
complete. Two paths close a session with **no** turns — migration `0034`'s backfill
and training-activity abandon — and are classed "never started", separately from
a mid-game quit.

Sections exclude abandoned sessions unless `includesAbandoned`; the `completion`
section (`01-Section-Catalog.md`) is the one built to read them.

---

# 10. Data Layer

The two base views are **built** (migration `0043`, 2026-09-26). Thin
per-section views are still planned.

| View | Grain | Serves | Status |
| ---- | ----- | ------ | ------ |
| `v_stats_session_facts` | one row per completed or abandoned session, owner-scoped | session lists, `completion`, `volume`, `session-result`; carries `context_key`, `activity_id`, status, ruleset version, input mode, configuration snapshot, turn count | built (0043) |
| `v_stats_dart_facts` | one row per `VISUAL_BOARD` dart, owner-scoped | the base for every `board`/`intent-*` section; `v_dart_locations` columns plus `completed_at`, status, `ruleset_version_key`, `context_key` | built (0043) |
| thin per-section views (`v_stats_<section>`) | reduced rows | only where SQL is the compute site; each reads the two base views (dependency depth ≤ 2) | planned |

- Replay reads `v_game_replay`, widened with coordinates and `context_key`, or a
  sibling view if its current consumers forbid widening — decided in the replay
  phase's spec.
- Index for the date-range entry point: `exercise_sessions (player_id, game_type_id,
  completed_at DESC)`. Others only when measured.
- Every view change is a new numbered migration; applied migrations stay untouched.

---

# 11. Scalability Review

| Axis | Risk | Covered by |
| ---- | ---- | ---------- |
| More insights | route/contract sprawl | registry + one generic section route (§2, §6) |
| More games / ruleset versions | per-game wiring | capability tags (§3); `configSensitive` splits versions |
| Recreational mode | redesign | `inputMode` param, tag model (§3, §5) |
| Years of darts | slow scans, Worker CPU | required date range, compute-site rule, escalation ladder (§4) |
| Many views | maintenance | two base views + thin section views, depth ≤ 2 (§10) |
| Logic change | stale cached results | `version` in every cache key (§7) |
| Corrections (unbuilt) | cached facts wrong | opaque `dataVersion`; replay header gains `supersededBy` when corrections ship |
| Routine stats | second stack | same layer with `context = routine` (§8) |
| Opponent / comparison stats | owner-only views | new optional param; owner scoping stays the default |
| Client storage growth | quota | results are small; facts bounded + LRU; network-only fallback (§7) |

---

# 12. Rollout

Each phase is its own spec, plan, and migration.

1. Base views, session list, `completion`/`volume`/`session-result`, registry
   skeleton, IndexedDB cache.
2. Board sections: `heatmap`, and the `intent-stored` family (Singles, Doubles
   Training, Bob's 27).
3. Checkout family for 501/121/TUOD (`server` folds).
4. `intent-derived` sections (Shanghai, Around the Clock) and the game-specific sections.
5. Replay route (`02-Replay.md`).
6. Routine statistics (later; `context = routine`).
