<!--
status: canonical
scope: architecture/statistics
read-when: designing or building any detailed statistics page, insight section, statistics endpoint, or the statistics client cache
updated: 2026-10-03
-->

# Statistics — Overview

> **Version:** 1.6.0 (2026-09-29, D364/D365/D366/D367/D368/D369/D370/D371/D372)
>
> Architecture for the detailed per-game statistics pages on `/statistics`.
> Design record: `docs/superpowers/specs/2026-09-26-statistics-pages-architecture-design.md`.
> Status: **built** — every phase of §12 has landed (1–6): base views (0043), the session
> list, the `completion`/`volume`/`session-result` sections, the registry
> skeleton, the IndexedDB cache, the six board sections (`heatmap`,
> `target-accuracy`, `confusion`, `grouping`, `miss-direction`,
> `loose-darts`) for every `board` game and the `intent-stored` family
> (Doubles Training, Bob's 27), the checkout family for 501/121/TUOD —
> six `server` folds (`checkout-rate`, `double-performance`, `checkout-path`,
> `bust-rate`, `ladder-progress`, `leg-stats`) plus two `sql` sections
> (`scoring-trend`, `treble-rate`), all bounded by `MAX_FOLD_DARTS` and
> fetched in client chunk windows (D369), and phase 4 (D370): derived intent
> (`target-accuracy`, `confusion`, `miss-direction`, `loose-darts` widened
> onto Singles Training, Shanghai and Around the Clock via an engine fold) and
> three game-specific sections (`shanghai-count`, `atc-darts-per-target`,
> `bobs27-survival`), phase 5 (D371): the paginated per-session replay
> (`02-Replay.md`), and phase 6 (D372): the Routines tab — routine and step
> identity from the snapshot (§8), the run- and step-level sections
> (`01-Section-Catalog.md` §3), a GAME step's own game sections, and
> training-step replay. Still designed, not built: thin per-section views
> (§10) and the `facts` cache store (§7).

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

- **Surface:** the Games and Routines tabs of `/statistics`. The Routines tab
  (D372) reads the same layer through routine and step scopes (§8); it loads
  on its first activation, never at page load.
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
(*lib/stats/section-registry.ts*):

| Field | Meaning | Why it scales |
| ----- | ------- | ------------- |
| `id` | stable section key (`heatmap`, `checkout-rate`, …) | routes and cache keys never change when sections are added |
| `version` | integer, bumped on any logic change | part of every cache key — old results invalidate themselves |
| `requires` | `readonly Requirement[]`, `Requirement = StatsTag \| { anyOf: readonly StatsTag[] }` (§3) | a new game gets every section its tags admit, no list edits; `anyOf` lets one section serve two families that reach the same fact by different means (D370 decision 5) |
| `computeSite` | `sql` \| `server` \| `client` (§4) | picked per section by cost, recorded with a reason |
| `siteByTag` | `Partial<Record<StatsTag, ComputeSite>>`, optional | overrides `computeSite` when the game carries that tag; `sectionSite(meta, gameTypeKey)` is the one resolver the service and client both read (D370 decision 5) |
| `games` | `readonly GameTypeKey[]`, optional | narrows a section to named games on top of its tags — how a game-specific section (`bobs27-survival`, …) attaches to exactly one game (D370 decision 10) |
| `bucketable` | supports `bucket` (§5) | enables MoM / YoY series |
| `includesAbandoned` | whether abandoned sessions enter the population | partial games never skew averages by accident |
| `configSensitive` | snapshot fields the result is grouped by (e.g. `ruleset_version_key`, `starting_score`) | unlike configurations are never blended |
| `params` | optional query parameters beyond the shared ones (§5), e.g. `["target"]` | a param a section doesn't declare is `VALIDATION_FAILED`, never silently ignored (D368 decision 5) |
| `contract` | zod schema of the result | typed API + client |
| `module` | pure, isomorphic TS function (`modules/stats/sections/*`) | moves between `server` and `client` without rewrite |

Adding an insight = one registry entry + one module + optionally one thin view.
No new route, no contract change elsewhere.

**Page order overrides (D370 decision 11):** `PAGE_ORDER_OVERRIDES:
Partial<Record<GameTypeKey, readonly SectionId[]>>` lets one game reorder its
own tag-derived section list — today only Shanghai, whose page puts
`session-result` right after `shanghai-count` (`01-Section-Catalog.md` §2). An
override may only reorder: a test asserts every override is a permutation of
the same game's tag-derived set, so it can never add or drop a section.

---

# 3. Capability Tags

A section declares the facts it needs; a ruleset declares the facts it produces.
The page renders the intersection.

| Tag | Fact it guarantees | Rulesets (VISUAL_BOARD) |
| --- | ------------------ | ----------------------- |
| `board` | landing coordinates per dart | all |
| `intent-stored` | `intended_target_number`/`intended_zone` stored per dart | Doubles Training, Bob's 27 |
| `intent-derived` | the aimed target is implicit and recovered by an engine fold | Singles, Shanghai, Around the Clock |
| `scoring` | face-value visit scoring | 501, Score Training |
| `checkout` | double-out remaining-score ladder | 501, 121, TUOD |
| `leg` | `LEG` stages | 501 |
| `ladder` | target climbs/falls per attempt | 121, TUOD |
| `target-sequence` | one target per visit/round | Singles, Doubles Training, Bob's 27, Shanghai, Around the Clock |

X01 and Score Training capture **no intent** (only Doubles Training and Bob's
27 store it). Singles Training carries `intent-derived`, not `intent-stored`
(D367): its engine (`singles-training.engine.module.ts` `record`) writes both
intent columns `NULL` by design — every ring on the current number is a valid
aim, and `chk_dart_target_consistency` (`0007`) rejects a number without a
zone — so its aimed number is recovered from the visit index, the same way as
Shanghai and Around the Clock. Sections needing intent are not offered where
neither tag applies; inferring an aim would fabricate a fact.

**`intent-derived`'s aim zones (D370 decision 2):** the target key format
(`01-Section-Catalog.md` §1.2, `<ZONE_KEY>:<number>`) gains two zones beyond
the stored ones: `NUMBER:n` (any ring of number `n`, 1-20 — a hit is any ring
except `MISS`) and `BULL:25` (either bull ring). Both are recovered from an
engine's own `activeTargetOf`, never inferred by stats code, and are
parity-tested against each engine's own hit rule (`isAimHit`,
`lib/stats/target-key.ts`) so a section can never disagree with the play page
about what counted as a hit.

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

**The `server` bound, made mechanical (D369):** a `server` section's dart cap
is `MAX_FOLD_DARTS = 5_000`. Before loading, the service sums `dart_count`
over the scoped `v_stats_session_facts` rows (`findScopeDartCount`); above the
cap the request fails `VALIDATION_FAILED`, `reason` naming it, before any fold
row is even read. The number was measured, not guessed: a synthetic
worst-case TUOD session log (the ruleset whose per-visit refold is quadratic
within a session) took ~128ms at the plan's original placeholder of 20,000
darts — over the 50ms budget — and ~30ms at 5,000. The client keeps the cap
from ever being hit in practice by fetching in **chunk windows** — the bucket
unit for `day`/`week`/`month`, or calendar months in `tz` for `none`/`year` —
so a server fold never runs over more than one chunk's sessions at a time; an
all-time view costs one fold per month, once, since closed chunks are cached
forever (§7) and every server metric is additive (§5.1).

---

# 5. Common Query Contract

Every statistics endpoint in this design accepts the same parameters. A
parameter a section cannot honour is rejected with `VALIDATION_FAILED`, never
silently ignored.

| Param | Values | Rule |
| ----- | ------ | ---- |
| `from`, `to` | ISO 8601 instants | **Required.** Half-open `[from, to)` on `completed_at`. The client supplies boundaries (no server timezone, D343). |
| `tz` | IANA zone name | Required when `bucket ≠ none`. Used only for bucket boundaries (`date_trunc(…, completed_at AT TIME ZONE tz)`). Never stored. |
| `bucket` | `none` \| `day` \| `week` \| `month` \| `year` | Bucketable sections only. Server caps bucket count per request (120, D367) — the estimate is span ÷ nominal unit length, rounded up, plus 1 for widening. |
| `status` | `completed` (default) \| `abandoned` \| `all` | Constrained by the section's `includesAbandoned` (D367 decision 5): an `includesAbandoned` section accepts only `all` (its default); every other section accepts only `completed` (its default); the session list accepts and defaults to all three. Anything else is `VALIDATION_FAILED`. |
| `context` | `all` (default for game pages) \| `standalone` \| `routine` | §8 |
| `inputMode` | `VISUAL_BOARD` (only value in this version) | reserved for recreational sections |
| `limit`, `cursor` | per `06-API/03-Shared-Conventions.md` §Pagination | every list or raw-row endpoint. The session list orders by `(completed_at DESC, session_id DESC)`; the opaque cursor encodes both (D367 decision 4). |
| `target` | `<ZONE_KEY>:<number>` (a `TargetKey`, e.g. `DOUBLE:16`) | Only a section that declares `params: ["target"]` accepts it, and only on a game with the `intent-stored` tag (D368 decision 5); joins the client cache's `paramsKey`. Anything else is `VALIDATION_FAILED`. In phase 2 only `heatmap` declares it. |

**Bucket widening (D367 decision 2):** a bucketed request's `from` is floored
to the start of its own bucket in `tz` before the query runs, and the server
echoes the widened range it actually used as `range: { from, to }`. A bucket
is `closed` iff `bucketEnd ≤ min(to, now)` — the client never caches a partial
bucket as closed and needs no timezone arithmetic of its own.

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
  bucket: "none" | "day" | "week" | "month" | "year";
  tz: string | null;            // null iff bucket = "none"
  range: { from: string; to: string };  // the widened range actually queried (D367)
  buckets: { start: string; end: string; closed: boolean; sampleSize: number; metrics: M }[];
};
```

`closed` is `true` when the bucket ends before the request time: no completed
session can ever land in it again (completion is always stamped "now"), so the
client caches it forever (§7). Precisely, `closed` iff `end ≤ min(to, now)`
(D367 decision 2).

---

# 6. Endpoints

All under `/api/statistics/`, protected route class, caller is always `me`,
view-backed end to end (D63).

| Route | Returns | Status |
| ----- | ------- | ------ |
| `GET games/:gameTypeKey/sessions` | paginated session list for the page (completed + abandoned, with progress-at-end; sessions with no darts left out, D405), newest first | built (phase 1) |
| `GET games/:gameTypeKey/sections/:sectionId` | one section result (`Series` or single value), dispatched through the registry; unknown or non-applicable section → `NOT_FOUND` | built (phase 1: `completion`/`volume`/`session-result`; phase 2: `heatmap`/`target-accuracy`/`confusion`/`grouping`/`miss-direction`/`loose-darts`; phase 3: `checkout-rate`/`double-performance`/`checkout-path`/`bust-rate`/`ladder-progress`/`leg-stats`/`scoring-trend`/`treble-rate`; phase 4: `target-accuracy`/`confusion`/`miss-direction`/`loose-darts` widened onto Singles Training/Shanghai/Around the Clock, plus `shanghai-count`/`atc-darts-per-target`/`bobs27-survival`) |
| `GET sessions/:sessionId/replay` | paginated replay (`02-Replay.md`) | built (phase 5, D371; training steps, phase 6, D372) |
| `GET routines` | every routine the caller has trained, newest run first, unpaginated | built (phase 6, D372) |
| `GET routines/:routineKey` | the routine header: name, run counts, `dataVersion`, and every step key it has run | built (phase 6, D372) |
| `GET routines/:routineKey/sections/:sectionId` | one run-level section (`routine-volume`, `routine-completion`) | built (phase 6, D372) |
| `GET routines/:routineKey/steps/:stepKey/sections/:sectionId` | one step section: a GAME step's own game sections, else `step-result`/`step-volume` (`01-Section-Catalog.md` §3) | built (phase 6, D372) |
| `GET routines/:routineKey/steps/:stepKey/sessions` | the step's paginated session list, newest first, each row linking to its replay | built (phase 6, D372) |

The route segment is `:gameTypeKey` (`game_types.implementation_key`), not
`:rulesetKey` (D367 decision 1): a game page spans ruleset versions (e.g.
Singles V1–V3), and `configSensitive` (§2) is what keeps versions from
blending within it. One generic section route keeps the route count flat as
insights grow; the registry, not the router, is what grows. Full contracts
for every built route are in `06-API/04-Endpoint-Contracts.md`.

The routine routes fix `context = routine` (§8, D372 decision 4). The two
section routes accept `from`, `to`, `tz`, `bucket` and `status` only; the step
session list `from`, `to`, `status`, `limit` and `cursor`; the list and the
header nothing. Anything else is `VALIDATION_FAILED`. A malformed
`routineKey` or `stepKey` is `VALIDATION_FAILED` before any read; a routine
the caller never trained, a step key it never ran, or a section the routine
or step does not offer is `NOT_FOUND`.

---

# 7. Client Cache (IndexedDB)

`/statistics` is a multi-page Astro app; an Alpine store dies on navigation. The
stats cache therefore lives in IndexedDB (*lib/client/stats-cache/*),
behind one module; Alpine stores read through it.

| Store | Key | Invalidation |
| ----- | --- | ------------ |
| `sectionResults` | `(playerId, scopeKey, sectionId, sectionVersion, params, bucketStart)` | closed buckets: never. Open bucket and `bucket = none`: when `dataVersion` changes. |
| `sessionLists` | `(playerId, scopeKey, params, cursor)` | when `dataVersion` changes |
| `replayPages` | `(sessionId, cursor)` | never — completed gameplay is immutable; built (phase 5, D371, `STATS_SCHEMA_VERSION` 2) |
| `facts` | `(playerId, rulesetKey, month)` | bounded windows only, LRU-evicted under a size budget |
| `meta` | `schemaVersion`, per-scope `dataVersion` | schema bump wipes all stores; logout wipes all stores |

- **`dataVersion`** is an opaque server token per (player, game) — per
  (player, routine) for a routine and its steps — returned on every
  response. Its definition (today: count + max `completed_at` of the population)
  can widen later — e.g. to cover corrections — without a client change.
- **Scope key (D372 decision 12):** every key carries a scope, not a game:
  `game:<gameTypeKey>`, `routine:<routineKey>` or
  `routine:<routineKey>:step:<stepKey>`. A routine and its steps share one
  `dataVersion` entry (`versionKey = routine:<routineKey>`), computed over the
  routine's terminal runs, so a new run is the only thing that stales either
  scope. The Routines tab records the header's fresh token
  (`noteDataVersion`) before it reads any section. The move bumped
  `STATS_SCHEMA_VERSION` 2 → 3, which wipes every store, `replayPages`
  included — and so also covers the replay header's phase 6 contract change
  (`02-Replay.md` §2).
- **Timestamp form (2026-09-29):** `range.from` and every bucket's
  `start`/`end` are UTC ISO text (`2026-01-01T00:00:00.000Z`) — the form the
  request's `from`/`to` accept, since the cache sends a stored coverage bound
  back as the next `from`. `STATS_SCHEMA_VERSION` 3 → 4 wipes caches that had
  stored Postgres' own `timestamptz` text (`2026-01-01 00:00:00+00`), which
  failed request validation on every later load.
- **Fetch rule:** a request is made only for keys absent from the cache or stale
  under the table above. Splitting a series request into its open bucket only is
  the main cost saving for Neon and Workers.
- **Chunked reads for `server` sections (D369):** `readSection` splits a
  `computeSite: "server"` request into `chunkWindows(from, to, bucket, tz)` —
  the bucket unit for `day`/`week`/`month`, calendar months in `tz` for
  `none`/`year` — reads whatever chunks are already cached, and fetches the
  missing ones sequentially (one Worker fold at a time). Results are merged
  with `mergeMetrics(sectionId, a, b)` (`lib/stats/merge-metrics.ts`): numeric
  leaves sum, `maxTarget` merges by `max` with `null` as the identity, and
  record-keyed metrics merge by key — one exhaustive
  `Record<ServerSectionId, merger>`, so a new server section with no merger
  entry is a compile error. A `year` view is a client regroup of cached month
  chunks. A `VALIDATION_FAILED` chunk shows the card error state and is never
  auto-split further. A `step-result` chunk (D372) merges with
  `mergeStepResult` under its exercise kind's `STEP_METRIC_SPECS` entry, which
  the step scope carries; `mergeMetrics` stays game-only.
- Every read and write is wrapped so a blocked or empty IndexedDB (private mode,
  quota) degrades to network-only, never to an error.

**Dedicated layouts.** A game in `DEDICATED_STATS_LAYOUTS` (`lib/stats/constants.ts`) is not loaded by the `gameStats` store. Its layout is mounted with `x-if` only while selected, and each section's own Alpine factory (`lib/stats/sections/*.data.ts`) fetches in `init()` through `loadGameSection` (`lib/stats/load-game-section.ts`), which is the same cached read path the store uses. A section owns its range, loading and error state, so a failure stays in its card (D385).

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
| Game pages | game pair match, both contexts; `context` filter optional |
| Routines tab (built, D372) | `ROUTINE` only, scoped by routine snapshot identity + step key. The server fixes `context = routine`; the client cannot widen it. |

**Routine identity (D372 decision 1):** `routine_key` is the
`activity_configurations` snapshot's `routineTemplateId`, never a template
FK, so a deleted routine keeps its statistics. A snapshot written before
that field existed (D321) keys as `name-<md5(routineName)>`, so one legacy
name is one routine; the two forms cannot collide. The display name is the
latest run's `routineName`, so a renamed routine keeps its history; a latest
run whose snapshot has none reads as "Unnamed routine" rather than failing.

**Step identity (decision 2):** `step_key = <sequenceNumber>-<md5>`, the md5
of the step's snapshot element without `sequenceNumber` (`jsonb` text output
is canonical). The element is found by `sequenceNumber`, never by array
position. Any change to a step's exercise, ruleset, duration or
configuration starts a new key; earlier keys stay listed as earlier versions
of that index. A key never mixes configurations, so no step section needs
`configGroupKey`. A step key is `current` when it is the latest key seen at
its `sequenceNumber` and that index is within the latest run's step count —
so a step edited in the latest run but not yet reached shows its old key as
current until it is reached.

**Fixed context (decision 4):** the routine routes take no `context` or
`inputMode` (§6). A GAME step's section runs the game path with
`context: "routine"` and `routineStep: { routineKey, stepKey }` set
server-side. `routineStep` adds one predicate to every session and dart
scope — `session_id IN (SELECT session_id FROM v_stats_routine_step_facts
WHERE player_id = $p AND routine_key = $r AND step_key = $s)` — phase 1's own
readers included, so each of the game's sections is scoped to that step.

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
| `v_stats_routine_run_facts` | one row per completed or abandoned training activity, owner-scoped | routine statistics (§8, §12 item 6); routine identity resolved from the `activity_configurations` snapshot, step counts, owner-scoped dart count | built (0045) |
| `v_stats_routine_step_facts` | one row per completed or abandoned routine step session, owner-scoped | routine statistics (§8, §12 item 6); step identity resolved by `sequenceNumber` (never array position), owner-scoped turn/dart/score counts | built (0045) |
| thin per-section views (`v_stats_<section>`) | reduced rows | only where SQL is the compute site; each reads the two base views (dependency depth ≤ 2) | planned |

- Replay reads its stage tree from `v_replay_stages` (migration `0046`, D377:
  one row per stage, turns or not) and its turns and darts from
  `v_game_replay`, widened with participant identity
  (`participant_id`, `participant_type_key`) and dart coordinates
  (`location_x`/`location_y`) in place (migration `0044`) — no per-row
  `context_key`; that is a session fact, already exposed once by
  `v_stats_session_facts` (`0043`).
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

1. **Done** (1a: base views, 0043, 2026-09-26; 1b: session list,
   `completion`/`volume`/`session-result`, registry skeleton, IndexedDB
   cache, D367).
2. **Done** (board sections, 2026-09-26, D368): `heatmap` on every `board`
   game; `target-accuracy`, `confusion`, `grouping`, `miss-direction`,
   `loose-darts` on the `intent-stored` family (Doubles Training, Bob's 27).
3. **Done** (checkout family, 2026-09-26, D369): six `server` folds for
   501/121/TUOD (`checkout-rate`, `double-performance`, `checkout-path`,
   `bust-rate`, `ladder-progress`, `leg-stats`), bounded by
   `MAX_FOLD_DARTS = 5_000` and fetched in client chunk windows; two `sql`
   sections (`scoring-trend`, `treble-rate`) also serving Score Training via
   its `scoring` tag.
4. **Done** (derived intent + game-specific sections, 2026-09-27, D370):
   `target-accuracy`, `confusion`, `miss-direction`, `loose-darts` widened
   onto Singles Training, Shanghai and Around the Clock via a single-seat
   engine fold (`derived-aims.module.ts`); `shanghai-count`,
   `atc-darts-per-target` and `bobs27-survival` gated by `SectionMeta.games`.
   `RESULT_DIRECTION` (issue #615) is untouched by this phase: it stays
   `null` for Bob's 27 and Around the Clock, and the new game-specific
   sections give each a headline of their own shape (a survival curve, a
   darts-per-target list) rather than a `session-result` PB line. Singles and
   Doubles Training likewise get `training-result` (#738, D396).
5. **Done** (replay, 2026-09-28, D371): `GET sessions/:sessionId/replay`
   (turn pages, first-page header, a forever client cache) and the
   `/statistics/replay?session=` page, whose per-turn values come from a
   client-side engine fold and per-game presenters (`02-Replay.md`).
6. **Done** (routine statistics; 6a: routine fact views, 0045, 2026-09-28;
   6b: 2026-09-29, D372): the Routines tab — the trained-routine picker,
   `routine-volume`/`routine-completion`, a step list with earlier versions,
   a GAME step's own game sections, `step-result`/`step-volume` for a
   non-game step, the step session list, and training-step replay, all under
   a fixed `context = routine` (§8).
