---
id: D0565
status: accepted
date: 2026-11-19
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Checkout statistics page: finish-rate comparison and shared ladder helpers

## Context and Problem Statement
The owner wants improvement measured over time on the CHECKOUT family. `121_V1` and `TUOD_V1` show only the heatmap, and `121_V2` falls through to "Statistics for this game are being rebuilt". The five sections the page needs (`ladder-progress`, `bust-rate`, `double-performance`, `checkout-path`, `checkout-rate`) already exist and are tagged for both games, but their client derivations live in `game-stats.store.ts` and no component renders them.

## Decision Drivers
* Improvement is read as a higher finish rate, a higher peak, better recovery and fewer busts, each against the preceding period of equal length.
* No new section id, migration or endpoint.
* Anti-goal: a second copy of the ladder banding, hit-rate rows or route logic.
* Anti-goal: a change shown from too few goes.

## Considered Options
* Leave the games on the heatmap layout.
* One `CHECKOUT_LAYOUTS` set and layout for `121_V1`, `121_V2` and `TUOD_V1`, with the store helpers moved to `lib/stats/checkout/` (chosen).
* Separate pages for 121 and Ten Up One Down.

## Decision Outcome
Chosen option: "`121_V1`, `121_V2` and `TUOD_V1` render `CheckoutStatsOverview.astro` (`CHECKOUT_LAYOUTS`; `121_V1` and `TUOD_V1` leave `HEATMAP_ONLY_LAYOUTS`). Over the page Period it shows the completion tile and four tiles against the preceding period of equal length: finish rate (goes finished over goes, a go being one `ladder-progress` attempt: a round in 121, a visit in Ten Up One Down), highest target reached, recovery rate (finishes straight after a failed go over goes straight after one), and bust rate (`bust-rate` busts over visits). A change shows only when both periods have at least 30 (`MIN_TARGET_SAMPLE`) in the tile's denominator; All Time shows none. Then three cards over the current period: finish rate by target range (bands of 20 from the start score, 121 or 41, to 170; targets below the start in one 2 to 40 band; a rate from 10 goes, `MIN_ROW_SAMPLE`), double hit rate (`double-performance`), and the routes thrown at a chosen target (`checkout-path`), then the heatmap and the session list.".

### Consequences
`ladder-totals.ts` and `checkout-routes.ts` in `lib/stats/checkout/` now hold the ladder folds and route lists the store used privately; the store delegates to them. `ratioTile` in `lib/stats/sections/comparison-tile.ts` is shared with the Ace tiles. `10-Statistics/01-Section-Catalog.md` 1.14.0.

* Good, because the page needs no new section id, migration or endpoint.
* Good, because the ladder banding, route list and tile wording each live once.
* Bad, because the four-tile row wraps three and one above the phone width: `StatTileRow.astro` is a three-column grid.
* Neutral, because `121_V1` and `121_V2` share one layout; V2 differs only in duration modes.
* Neutral, because the finish rate counts per go, not per `checkout-rate` chance.

### Confidence
High — every figure comes from an existing section.

### Revisit When
A section for average darts per finish exists, or the owner wants win rate in 1v1.

### Confirmation
`app/tests/lib/stats/checkout/` covers the ladder bands, routes, comparison and card rows. `app/tests/lib/stats/sections/checkout-comparison.data.test.ts` and `checkout-cards.data.test.ts` cover the Alpine scopes. `app/tests/lib/stats/constants.test.ts` asserts `CHECKOUT_LAYOUTS` and the narrowed `HEATMAP_ONLY_LAYOUTS`.

## Pros and Cons of the Options
### Leave the games on the heatmap layout
* Bad, because the sections the games already carry are never shown.

### One layout for 121 and Ten Up One Down
* Good, because both games use the same sections and derivations.

### Separate pages
* Bad, because the two layouts would be identical.

## Evidence / More Information
Decided: 2026-11-19

* `docs/superpowers/specs/2026-11-18-checkout-statistics-page-design.md`: owner-approved design.
* `docs/superpowers/plans/2026-11-18-checkout-statistics-page.md`: plan, executed natively.
