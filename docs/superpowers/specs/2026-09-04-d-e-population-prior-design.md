# Design: D-E population prior fold

## Problem

`08-DartBot.md` records D-E as open: `fitProfile()` needs a population prior
to shrink toward at `n = 0`, measured from real player darts. The doc
dictates the extract query and the fold recipe ("parse the `NUMERIC`
columns, run each row through `missMargin()`, take the stddev along and
across the bed axis, the mean as bias, and the tail beyond 3σ as
`outlierRate`"), and states the fold is "a `scripts/` one-off, not an app
read path... Output is aggregate only — no row survives the script."

The human-run extract now exists at `D-E-extract.md` (repo root, 328 rows,
`intended_target_number` / `intended_zone_key` / `location_x` /
`location_y`, `PLAYER`-only per the query's `participant_type_id = 1`
filter). This design covers only folding that extract into the measured
prior and recording it — not refitting `LEVEL_SKILL_TABLE`, not
`fitProfile()` itself (phase 10, unbuilt), not the level-picker UI.

## Components

- **`app/src/modules/dartbot/population-prior.module.ts`** — pure function
  `foldPopulationPrior(rows: MissMarginInput[]): PopulationPrior`. Reuses
  `zoneCentroid()` for each row's centre (same exclusion as `missMargin()`:
  null centre or unset landing point drops the row) rather than
  reimplementing board geometry.
- **`PopulationPrior`** (new type, `app/src/modules/dartbot/types.ts`):
  `{ sigmaAlongMm, sigmaAcrossMm, biasXMm, biasYMm, outlierRate, sampleSize,
  excludedCount }`. No `outlierSigmaMm` — the doc's recipe never asks for
  it, so no formula is invented for it here.
- **`app/scripts/dartbot-population-prior.ts`** — one-off: reads
  `D-E-extract.md`, takes the **last** fenced ```` ```json ```` block (the
  file holds two query runs; the first uses the doc's literal
  `intended_zone_id`, unusable by `missMargin()`, which needs a
  `DartZoneKey` string — the second joins `dart_zones` for
  `intended_zone_key` and is the one to fold), camel-cases fields, calls the
  module, prints the result.

## Algorithm (the three points the doc leaves open)

- **Along/across axis**: unrotated board x/y — across = x, along = y — no
  per-target rotation. Matches `throw-engine.module.ts`'s `scatterOffset()`,
  where `covarianceRotationDegrees` is 0 for every hand-set level today, so
  bias and scatter already apply in board coordinates directly. A future
  refit that starts using nonzero rotation doesn't change this fold — it
  would just measure a population-level rotation too, which is out of
  scope here since D-E only asks for sigma/bias/outlier.
- **Bias**: mean `dx`/`dy` per axis, pooled across all rows.
- **Sigma**: sample stddev (n−1) of `dx`/`dy` around that mean, per axis.
- **`outlierRate`**: fraction of rows whose raw distance from their own
  centroid exceeds `3 × sqrt(sigmaAlong² + sigmaAcross²)` — one scalar
  "3σ" threshold for a two-axis scatter.

## Output

Running the script against the real extract:

```json
{
  "sigmaAlongMm": 27.53,
  "sigmaAcrossMm": 20.12,
  "biasXMm": -5.0,
  "biasYMm": 3.14,
  "outlierRate": 0.003,
  "sampleSize": 328,
  "excludedCount": 0
}
```

This closes D-E in `08-DartBot.md`: move it from "Still open" into the
resolved table with these numbers, noting the sample is thin (328 darts)
and confined almost entirely to `DOUBLE`/`INNER_BULL` intents in this
extract — a sample-composition caveat worth stating alongside the numbers,
not a reason to withhold them.

## Testing (TDD, red before green)

- `app/tests/modules/dartbot/population-prior.module.test.ts` — bias/sigma
  arithmetic against hand-computed synthetic offsets, outlier threshold,
  row exclusion (bare `SINGLE`, unset landing point), empty-input zero
  case.
- `app/tests/scripts/dartbot-population-prior.test.ts` — extracting the
  last (not first) fenced JSON block, camel-casing + numeric coercion of
  the extract's string-typed `NUMERIC` columns, null passthrough.

## Non-goals

- `LEVEL_SKILL_TABLE` refit, `fitProfile()`, D-K, and the level-picker
  average/checkout UI — all separate, undesigned work per the earlier scope
  check.
