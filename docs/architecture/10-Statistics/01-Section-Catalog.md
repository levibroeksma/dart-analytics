<!--
status: canonical
scope: architecture/statistics/sections
read-when: adding, changing, or choosing insight sections for a statistics game page
updated: 2026-09-26
-->

# Statistics — Section Catalog

> **Version:** 1.0.0 (2026-09-26, D364)
>
> The shared insight-section library and the section list of each game page.
> Registry fields, tags, compute sites and the query contract are defined once in
> `00-Overview.md`; this file only applies them. Status: **designed, not built.**

---

# 1. Shared Section Library

Sections are reusable across games; a page picks them by capability tag
(`00-Overview.md` §3). "Site" follows `00-Overview.md` §4.

| Section | Requires | Site | Reason for site | Bucketable | Insight |
| ------- | -------- | ---- | --------------- | ---------- | ------- |
| `heatmap` | `board` | sql | grid binning of coordinates collapses months of darts to a fixed grid | no | where darts land in the range; filter by target where intent exists |
| `grouping` | `board` + `intent-stored` | sql | mean/std of offset per target is plain arithmetic | yes | spread size and bias per target ("pulls low-left on D16") |
| `miss-direction` | `board` + `intent-*` | sql (stored) / server (derived) | angle sectors are arithmetic; derived intent needs the engine fold | no | direction of misses per target |
| `loose-darts` | `board` + `intent-*` | server | classification needs board geometry, which lives in TS only (`miss-margin.module.ts`) | yes | loose-dart rate per target and its trend |
| `target-accuracy` | `intent-*` | sql (stored) / server (derived) | hit counts per target and ring | yes | hit rate per target/ring; strongest and weakest targets |
| `confusion` | `intent-*` | sql (stored) / server (derived) | intended × hit counts | no | where aims at a target actually land (e.g. D16 → D8/D7) |
| `scoring-trend` | `scoring` | sql | sums and counts per bucket; first-nine is a turn-sequence filter | yes | 3-dart average, first-nine average, score bands (100+/140+/180) |
| `treble-rate` | `scoring` + `board` | sql | ring counts inside the scoring beds | yes | treble share of darts thrown at the scoring beds |
| `checkout-rate` | `checkout` | server | remaining score is a ladder fold (`checkout-visits.module.ts`) | yes | checkout % overall and by remaining-score band |
| `double-performance` | `checkout` | server | double attempts need remaining-before-dart (`double-attempt.module.ts`) | yes | darts at double, hit rate per double, **favorite double** (best rate above a minimum sample) |
| `checkout-path` | `checkout` | server | route per remaining needs the fold | no | **preferred path by setup shot**: from remaining X, the route taken and how often it finished |
| `bust-rate` | `checkout` | server | bust is a fold outcome | yes | busts per remaining-score band |
| `leg-stats` | `leg` | sql | per-leg dart counts already in `v_player_leg_facts` | yes | darts per leg, best leg, distribution |
| `ladder-progress` | `ladder` | server | target per attempt is a ladder fold | yes | highest target reached, success rate per target band, recovery after a miss |
| `session-result` | any | sql | one scalar per session | yes | the session's game-specific result with the personal-best line |
| `completion` | any | sql | status counts per bucket | yes | abandon rate; where the player quits (progress and score state at quit); "never started" separated |
| `volume` | any | sql | counts and durations | yes | sessions, darts, time; standalone vs routine split |

`completion` is the only section with `includesAbandoned = true`.

## 1.1 Loose darts

A dart with intent is classified by where it lands relative to the intended bed:

| Class | Rule |
| ----- | ---- |
| `on-target` | inside the intended bed |
| `near-miss` | outside it, but in an adjacent segment or ring of the intended bed |
| `loose` | anywhere else, including off the board |

Built on `miss-margin.module.ts` / `zoneCentroid` — the same geometry the
classifier uses, never a second copy in SQL. The adjacency rule is a constant in
the section module; changing it bumps the section `version`.

## 1.2 Derived intent

For `intent-derived` rulesets (Shanghai, Around the Clock) the aimed target is
the engine's active number at the time of the dart. It is recovered by folding
the session's facts through the engine — the same pure engine the play page
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
results are grouped or filtered per version, never blended.

---

# 3. Deferred

- **Career-wide doubles:** Doubles Training, Bob's 27 and X01 checkout darts
  measure one skill; a combined career section is additive later.
- **Recreational-mode sections** (`QUICK_SCORE`, `DETAILED_DARTS`).
- **Routine pages** (`00-Overview.md` §8).
