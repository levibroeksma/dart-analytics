# Fallow scoring reference

How fallow computes the numbers its gate and reports print. Source: `https://fallow.tools/docs/explanations/health/` (read 2026-11-10, formula version 3, fallow 3.42.0). The host is reachable from the `dart-analytics` cloud environment; re-read the page when `health_score.formula_version` in the JSON is not 3.

## Health score

`score = 100 − Σ penalties`, clamped to 0–100. Grades: A ≥ 85, B 70–84, C 55–69, D 40–54, F < 40.

| Penalty | Formula | Max |
| ------- | ------- | --- |
| Dead files | `dead_file_pct × 0.2` | 15 |
| Dead exports | `dead_export_pct × 0.2` | 15 |
| Complexity | `critical_complexity_pct × 4` | 20 |
| Maintainability | `maintainability_low_pct × 1.5` | 15 |
| Hotspots | `hotspot_count ÷ max(ceil(total_files × 0.01), 1) × 10` | 10 |
| Unused deps | `unused_deps_per_k_files × 0.5` | 25 |
| Circular deps | `circular_deps_per_k_files × 0.5` | 25 |
| Unit size | `functions_over_60_loc_per_k × 0.5` | 10 |
| Coupling | `coupling_high_pct × 0.5` | 5 |
| Duplication | `max(0, duplication_pct − 5)` | 10 |

- `coupling_high_pct` is the share of files whose fan-in is above `max(p95_fan_in, 10)`. It is a percentile, so it stays near 5 % (penalty ≈ 2.4) whatever is refactored.
- Hotspots need git history. `--score` alone leaves the penalty out; `--hotspots` adds it; a depth-1 clone (CI) has none. Compare scores only between runs with the same flags.
- A penalty key missing from the JSON means that analysis did not run. A zero can also mean a failed input: check `workspace_diagnostics[]` for `degrades_analysis: true`.

## What moves the score, what only hides a row

| Setting | Effect |
| ------- | ------ |
| `health.ignore` glob | Removes the file from the score and from every health finding. The documented way to exclude generated files and test suites. |
| `health.maxUnitSize`, `thresholdOverrides[].maxUnitSize` | Removes rows from the Large functions list only. The unit-size penalty still counts them. |
| `health.maxCyclomatic`, `maxCognitive`, `maxCrap` | Change which findings fail the gate. The score uses fixed calibration. |

## Unit size

A function over 60 lines is "very high risk". A `describe(...)` or `it(...)` callback is a function. An Astro `<template>` is one unit. A module-level object literal is not a unit; each method in it is scored alone.

`large_functions[]` is present in the JSON only while ≥ 3 % of functions are over 60 lines. To count them at any level: `round(vital_signs.functions_over_60_loc_per_k × summary.functions_analyzed ÷ 1000)` from `fallow health --score --file-scores --format json`.

## Maintainability index (per file)

```
dampening       = min(lines / 50, 1)
fan_out_penalty = min(ln(fan_out + 1) × 4, 15)
MI = 100 − complexity_density × 30 × dampening − dead_code_ratio × 20 − fan_out_penalty
```

Files with no functions are left out. Fan-out counts imported modules, not names: 1 import costs 2.8, 2 cost 4.4, 5 cost 7.2. A project where most files import two modules cannot average above ≈ 95.

## Commands

| Need | Command (in `app/`) |
| ---- | ------------------- |
| Score and penalties | `npx --no-install fallow health --score --format json -q 2>/dev/null \| jq .health_score` |
| Score, counts, per-file MI | add `--file-scores`; read `.vital_signs`, `.file_scores[]` |
| The functions that failed the gate | `bash ../scripts/fallow-gate.sh` (prints the `findings` array) |
| The 8 benchmark numbers against their recorded values | `bash ../scripts/check-quality-benchmarks.sh` (score read with `-c .fallowrc.score.jsonc`: tests excluded) |
| Clone groups per mode | `npx --no-install fallow dupes --mode <mild\|weak\|semantic> --format json --no-fragments -q` |
| One rule explained offline | `npx --no-install fallow explain <issue-type>` |

Fallow writes warnings to stderr: pipe stdout only into `jq`.
