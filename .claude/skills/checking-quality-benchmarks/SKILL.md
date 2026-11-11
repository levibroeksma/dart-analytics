---
name: checking-quality-benchmarks
description: Use when the fallow gate, the clone ratchet or the quality-benchmark gate fails, or before a PR that touched app/src — reads the real violator and says whether to fix code or tighten a benchmark.
---

# Checking Quality Benchmarks

What each number means and what can move it: `.claude/skills/validate-app/references/fallow-scoring.md`. Run `bash scripts/check-quality-benchmarks.sh` from the repo root.

## Reading a failure

| Output | Meaning | Do |
| ------ | ------- | -- |
| `regressed: <row> <now> … <recorded>` | this branch made the row worse | fix the code; never edit `now` by hand |
| `stale benchmark, tighten it: <row>` | this branch improved the row | `bash scripts/check-quality-benchmarks.sh --update`, commit the file |
| `missing value: <row>` | fallow's JSON lost a key | check the pinned version and `fallow-scoring.md`; do not delete the row |
| `new clone group: <files>` (`check-dupes.sh`) | a copy was added | fold it; at two copies make them differ honestly; never add a baseline row |
| `Failed: … start with <file>` (fallow gate) | fallow's suggestion, not the violator | read the `health gate:` block `fallow-gate.sh` prints after it |

## Which row, which fix

| Row | Goes wrong when | Fix |
| --- | --------------- | --- |
| `large_functions_src` | a function, or a whole `.astro` file, passes 60 lines | extract a helper, a method group, a child component, a lookup table or a row mapper |
| `large_test_bodies` | an `it`/`test` callback passes 60 lines | split the case; move a long expected value to a snapshot file |
| `health_score` | follows `large_functions_src` | fix that row |
| `mi_average`, `mi_lowest_file` | a file gains complexity or imports | split the dense function; do not merge files to cut imports |
| `dup_pct_weak`, `dup_pct_semantic` | look-alike code was added | share at three copies (D513); below that, see whether the code can be data |
| `max_cyclomatic` | a function gains branches | lookup table or early returns |

## Facts that save a wrong turn

- The score is read with `-c .fallowrc.score.jsonc --score`: tests and `src/db/schema.ts` are out; hotspots are not part of it.
- `health.maxUnitSize` and `thresholdOverrides` hide list rows; they do not move the score. Do not reach for config.
- fallow counts a whole `.astro` file as one unit, frontmatter and doc comment included.
- A module-level object of methods is not a unit; a function returning one literal is.
