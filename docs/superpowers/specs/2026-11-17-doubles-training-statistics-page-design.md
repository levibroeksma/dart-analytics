# Doubles Training statistics page — design

Status: draft for owner approval · Date: 2026-11-17

## Intent

`DOUBLES_TRAINING_V1` renders only the heatmap layout today (`HeatmapStatsOverview.astro`). The owner wants a dedicated page that answers: which doubles do I hit, which is my best, where do I miss, and how close are the misses. It follows the 501 page pattern (`X01StatsOverview.astro`, pure derivation under `lib/stats/`, Alpine factories under `lib/stats/sections/`). It reads the 20 mm near-miss rule shipped in #1341 (D560).

## Goals

- One **Doubles accuracy** card over the page Period select (the same approach applies to every statistics page): a row per double (D1 to D20) and the bull, as on the 501 doubles card.
- Per row: darts, hit rate, misses split **left / right** (plus up / down, see below), misses split **inside / within / outside** the wire, and **near miss / loose** darts under the 20 mm rule.
- A **favourite double** line: the double with the highest hit rate in the Period.
- Heatmap (with its target picker) and the session list stay below the card.
- Every number is derived at read time from existing sections. No migration, no new endpoint, no new section id.

## Non-goals

- The `training-result` headline, `session-result`, `volume` and `confusion` cards. The completion tile stays as on today's page.
- Weakest double, per-session trends, comparison against a previous period.
- New geometry or a new near-miss rule.

## Anti-goals

- A second copy of the sector, band or near-miss logic: the card only sums and joins what `miss-direction`, `loose-darts` and `target-accuracy` already return.
- A rate shown from too few darts.

## Data

Three un-bucketed requests over the page Period for the page's game, through `periodSection` (reloads on `rangeKey`, `game`, `variation`; stale responses dropped): `target-accuracy` (attempts, hits per target), `miss-direction` (sector 0 to 7 and radial band per target), `loose-darts` (on target, near miss, loose per target). Metrics are keyed by `TargetKey`; the card joins them by key and keeps only double targets plus the bull.

## Card rules

- Hit rate: `hits / attempts`. A row with fewer than `MIN_ROW_SAMPLE` (10) darts shows its count only.
- Favourite double: highest hit rate among rows with at least `MIN_TARGET_SAMPLE` (30) darts. Ties go to the row with more darts, then the lower number. No qualifying row shows "not enough darts yet".
- Left and right: miss sectors from the aimed bed's reference point, board upright as seen from the throw. Sectors 5, 6, 7 are left; 1, 2, 3 are right; 0 is high, 4 is low. This is the same sector frame as the 501 doubles card and its Across/Down drift wording.
- Inside / within / outside: the existing `miss-direction` radial bands for the double.
- Near miss and loose: counts from `loose-darts` per double; a miss without a landing point is in neither (the unmeasured rule of D560).
- The footer states the dart count and the near-miss threshold (20 mm).

## Constraints

- Layout switch: `DOUBLES_TRAINING_V1` leaves `HEATMAP_ONLY_LAYOUTS` and gets its own entry in `DEDICATED_STATS_LAYOUTS` or a new layout set, with `pages/statistics/index.astro` rendering the new overview.
- Shared markup reuses `AimCardSection`, `AimCard`, `AimTable` where they fit; the rule of three (D513) applies.
- Repo gates: test per changed runtime `.ts`, type-barrels, check-dupes, no inline comments, astro check 0/0/0, format, context-budget, and the quality ratchet (`mi_average` floor 91.05 sits only about 0.003 under the current value, so new `lib/stats/` files may trip it; owner decision #1327).
- Docs in the same change: `01-Section-Catalog.md` Doubles Training layout paragraph, `00-File-Inventory.md`, component inventory, context-map history, and a new decision in `decisions/` (next free id).

## Left to the builder

- File and factory names, and whether one Alpine scope fetches the three sections or each fetches its own.
- The table column layout at phone width.

## Marked as the author's calls

- Left / right, the layout (card above heatmap and session list), the 30 and 10 dart floors, the tie-break, the headline and the other cards left out.
- The bull row is the double bull, `INNER_BULL:25`, labelled "Bull" (`targetLabel`); the outer bull is not a Doubles Training target. Rows are the 20 `DOUBLE:n` keys plus `INNER_BULL:25`.
- Showing up and down beside left and right, because the sector data carries them at no cost.
- Following the Period select for all three requests, per the owner's rule for every statistics page.
