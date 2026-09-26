<!--
status: canonical
scope: architecture/statistics/sections
read-when: adding, changing, or choosing insight sections for a statistics game page
updated: 2026-09-26
-->

# Statistics — Section Catalog

> **Version:** 1.3.0 (2026-09-26, D369)
>
> The shared insight-section library and the section list of each game page.
> Registry fields, tags, compute sites and the query contract are defined once in
> `00-Overview.md`; this file only applies them. Status: `session-result`,
> `completion`, `volume`, `heatmap`, `target-accuracy`, `confusion`,
> `grouping`, `miss-direction`, `loose-darts`, `checkout-rate`,
> `double-performance`, `checkout-path`, `bust-rate`, `leg-stats`,
> `ladder-progress`, `scoring-trend` and `treble-rate` are **built** (phase 1 +
> 2 + 3); every other section below is still designed, not built.

---

# 1. Shared Section Library

Sections are reusable across games; a page picks them by capability tag
(`00-Overview.md` §3). "Site" follows `00-Overview.md` §4.

| Section | Requires | Site | Reason for site | Bucketable | Insight |
| ------- | -------- | ---- | --------------- | ---------- | ------- |
| `heatmap` | `board` | sql | grid binning of coordinates collapses months of darts to a fixed grid | no | where darts land in the range; filter by target where intent exists |
| `grouping` | `board` + `intent-stored` | sql | position moment sums (Σx, Σy, Σx², Σy², Σxy) re-aggregate exactly across buckets; mean/spread/bias are derived isomorphically against `zoneCentroid` (D368) | yes | spread size and bias per target ("pulls low-left on D16") |
| `miss-direction` | `board` + `intent-*` | sql (stored) / server (derived) | angle sectors are arithmetic against reference points TS binds as parameters (D368); derived intent needs the engine fold | no | direction of misses per target, inside/within/outside the intended ring band |
| `loose-darts` | `board` + `intent-*` (stored: sql; derived: server) | sql (stored) / server (derived) | SQL counts intended × hit cells; TS classifies each aggregated cell with board geometry, so geometry stays single-sourced (D368) | yes | loose-dart rate per target and its trend |
| `target-accuracy` | `intent-*` | sql (stored) / server (derived) | hit counts per target and ring | yes | hit rate per target/ring; strongest and weakest targets |
| `confusion` | `intent-*` | sql (stored) / server (derived) | intended × hit counts | no | where aims at a target actually land (e.g. D16 → D8/D7) |
| `scoring-trend` | `scoring` | sql | sums and counts per bucket; first-nine is a turn-sequence filter; score bands are exclusive bins, not cumulative thresholds (D369) | yes | 3-dart average, first-nine average, score bands (100+/140+/180) |
| `treble-rate` | `scoring` + `board` | sql | ring counts inside the scoring beds; counted per landed segment, not per aimed target — X01 and Score Training store no intent (D369) | yes | treble share of darts thrown at the scoring beds |
| `checkout-rate` | `checkout` | server | remaining score is a ladder fold (`checkout-visits.module.ts`); a chance is counted per visit, not per dart (D369) | yes | checkout % overall and by remaining-score band |
| `double-performance` | `checkout` | server | double attempts need remaining-before-dart (`double-attempt.module.ts`); counted per dart, keyed per double the remaining requires (D369) | yes | darts at double, hit rate per double, **favorite double** (best rate above a minimum sample) |
| `checkout-path` | `checkout` | server | route per remaining needs the fold | no | **preferred path by setup shot**: from remaining X, the route taken and how often it finished |
| `bust-rate` | `checkout` | server | bust is a fold outcome; the shared double-out rule only — a ruleset's early-bust forfeit (121's final-visit rule, TUOD's one-dart rule) is not counted (D369) | yes | busts per remaining-score band |
| `leg-stats` | `leg` | server | finished legs need the checkout fold; `v_player_leg_facts` has no winner column and counts lost 1v1 legs and the abandoned final leg as legs, which breaks "darts per leg"/"best leg" (D369) | yes | darts per leg, best leg, distribution |
| `ladder-progress` | `ladder` | server | target per attempt is a ladder fold | yes | highest target reached, success rate per target band, recovery after a miss |
| `session-result` | any | sql | rule-free components (`counted_score`, `dart_count`, `turn_count`, min/max per bucket); PB direction per game (`RESULT_DIRECTION`, D367) | yes | the session's game-specific result with the personal-best line, where the game's headline is a pure function of the rule-free components |
| `completion` | any | sql | status counts per bucket | yes | abandon rate; where the player quits (progress and score state at quit); "never started" separated |
| `volume` | any | sql | counts and durations | yes | sessions, darts, time; standalone vs routine split |

`completion` is the only section with `includesAbandoned = true`.
`session-result`, `completion`, `volume`, `heatmap`, `target-accuracy`,
`confusion`, `grouping`, `miss-direction`, `loose-darts`, `checkout-rate`,
`double-performance`, `checkout-path`, `bust-rate`, `leg-stats`,
`ladder-progress`, `scoring-trend` and `treble-rate` are built (phase 1 + 2 +
3); every other row above is planned.

## 1.1 Loose darts

A dart with stored intent (Doubles Training, Bob's 27) is classified by where
it lands relative to the intended bed (D368 decision 9):

| Class | Rule |
| ----- | ---- |
| `on-target` | the hit pair equals the intended pair |
| `near-miss` | the same ring in either neighbouring sector (`SECTOR_ORDER`), or the neighbouring ring in the same sector. Ring order: `INNER_SINGLE`, `TREBLE`, `OUTER_SINGLE`, `DOUBLE`. For `INNER_BULL` the near-miss is `OUTER_BULL`, and the reverse |
| `loose` | anywhere else, including `MISS` — off the board |

SQL counts intended × hit cells over `v_stats_dart_facts`; TS classifies each
**aggregated cell** against board geometry (`loose-darts.module.ts`,
`board-geometry.module.ts`'s `SECTOR_ORDER`) — the same geometry the
`isHitOn`/`classify` functions use, never a second copy in SQL. The adjacency
rule is a constant in the section module; changing it bumps the section
`version`.

## 1.2 Derived intent

For `intent-derived` rulesets (Singles Training, Shanghai, Around the Clock)
the aimed target is the engine's active number at the time of the dart. For
Singles Training that is just the current number, any ring — every ring on it
is a valid aim (D367), unlike Shanghai/Around the Clock where the active
number also changes across the visit. It is recovered by folding the
session's facts through the engine — the same pure engine the play page
runs — in the `server` site, over a bounded range. It is never written back as
stored intent.

---

# 2. Game Pages

Order is the page order. Every page also lists its sessions with a link to the
replay route (`02-Replay.md`).

| Game (ruleset family) | Sections |
| --------------------- | -------- |
| **501** | scoring-trend, checkout-rate, double-performance, checkout-path, bust-rate, leg-stats, treble-rate, heatmap, session-result, completion, volume |
| **121** | ladder-progress, checkout-rate, double-performance, checkout-path, bust-rate, heatmap, session-result, completion, volume |
| **Ten Up One Down** | ladder-progress, checkout-rate, double-performance, checkout-path, bust-rate, heatmap, session-result, completion, volume |
| **Score Training** | scoring-trend, treble-rate, heatmap, session-result, completion, volume |
| **Singles Training** | target-accuracy (per ring), confusion, grouping, miss-direction, loose-darts, heatmap, session-result, completion, volume |
| **Doubles Training** | target-accuracy (per double; favorite and weakest double), confusion, grouping, miss-direction (inside vs outside the wire), loose-darts, heatmap, session-result, completion, volume |
| **Bob's 27** | target-accuracy (per double), `bobs27-survival`, confusion, grouping, miss-direction, loose-darts, heatmap, session-result, completion, volume |
| **Shanghai** | target-accuracy (per number and ring), `shanghai-count`, points-per-round via session-result, confusion, miss-direction, loose-darts, heatmap, completion, volume |
| **Around the Clock** | `atc-darts-per-target`, target-accuracy, confusion, miss-direction, loose-darts, heatmap, session-result, completion, volume |

X01 and Score Training carry no `grouping`/`miss-direction`/`loose-darts`: they
store no intent (`00-Overview.md` §3).

## 2.1 Game-specific sections

| Section | Game | Site | Insight |
| ------- | ---- | ---- | ------- |
| `bobs27-survival` | Bob's 27 | server | the double where runs die; running-score curve per session |
| `shanghai-count` | Shanghai | sql | Shanghai (S+D+T in one round) frequency per bucket |
| `atc-darts-per-target` | Around the Clock | server | darts needed per target; slowest targets |

## 2.2 Ruleset versions

Versions that change scoring or difficulty (Singles V1–V3, Shanghai V1/V2, 121
V1/V2, Around the Clock V1/V2) put `ruleset_version_key` in `configSensitive`:
results are grouped or filtered per version, never blended. `configSensitive`
governs **result-shaped** sections — `session-result` and `ladder-progress`,
whose headline result depends on which version's rules produced it (D369).
The checkout family, `scoring-trend`, `treble-rate` and `leg-stats` are
**fact-shaped**: a dart at remaining 32 or a landed treble is the same fact
under any ruleset version, so those sections pool versions instead (D369
decision 9).

---

# 3. Deferred

- **Career-wide doubles:** Doubles Training, Bob's 27 and X01 checkout darts
  measure one skill; a combined career section is additive later.
- **Recreational-mode sections** (`QUICK_SCORE`, `DETAILED_DARTS`).
- **Routine pages** (`00-Overview.md` §8).
