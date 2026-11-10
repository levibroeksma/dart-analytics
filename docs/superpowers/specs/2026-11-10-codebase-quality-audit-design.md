# Codebase Quality Audit — Findings, Benchmarks, Plan Index

Date: 2026-11-10 · Tool: `fallow 3.42.0` run in `app/` at `HEAD` of `main` · Non-canonical (D312).

**Hard rule for every plan below:** nothing visible or functional changes. Same HTML, same API bodies, same persisted facts, same test count (551 files, 11 295 passed, 4 skipped).

## 1. Measured baseline

| Metric | Command (in `app/`) | Now |
| ------ | ------------------- | --- |
| Health score, tests scored, no hotspots | `npx fallow health --score --format json` | 87.6 |
| Health score incl. hotspots (local full clone only) | `npx fallow` | 86.2 |
| Penalties | same | unit_size 10.0 (capped), coupling 2.4, hotspots 1.4, all others 0 |
| Maintainability index (MI), average | `npx fallow` summary line | 91.2 |
| Lowest file MI in `src/` | `--file-scores` | 76.9 (`routine-play.data.ts`) |
| Functions > 60 lines | `large_functions` | 774: tests 659 (639 `describe`, 20 `it`), `src/` 113, `scripts/` 2 |
| Max cyclomatic (function) | `vital_signs` | 14 (gate is 20) |
| Dead files / dead exports / cycles / unused deps | `npx fallow` | 0 / 0 / 0 / 0 |
| Clone groups, `mild` (the gated mode) | `npx fallow dupes` | 3 groups, 79 lines |
| Duplication, `weak` | `npx fallow dupes --mode weak` | 53 groups, 2.2 % |
| Duplication, `semantic` | `npx fallow dupes --mode semantic` | 637 groups, 18.3 % |
| Pre-commit wall time (any commit) | `time .husky/pre-commit` | ≈ 110 s (type-barrels 66 s, tag-seed fixtures 23 s) |

## 2. What "95" can mean

Two fallow numbers look like a maintainability score. Only one can reach 95.

- **MI average (91.2) cannot reach 95.** Formula (fallow CLI reference): `100 − density×30 − dead×20 − min(ln(fan_out+1)×4, 15)`. The import term alone averages 5.2 here: a file with 2 imports loses 4.4, and 94 % of files import ≥ 1 module. With zero complexity everywhere the average would be ≈ 94.8. Raising it means merging files, which hurts the code.
- **Health score (87.6) can reach 95.** It is `100 − Σ penalties`. Measured on a synthetic project: `unit_size = min(functions_over_60_LOC_per_1000 ÷ 2, 10)`. Coupling (2.4) is driven by fan-in percentiles and did not move with any config or split tried. So: **95 needs ≤ 5.2 large functions per 1 000**.

**Target: health score ≥ 95.0. MI gets a floor (average never drops; no `src/` file under 80).**

### Owner decision 1 — are test `describe` blocks "functions"?

639 of the 774 large functions are `describe(...)` callbacks. Config overrides (`thresholdOverrides.maxUnitSize`) do not change the score; only `health.ignore` does.

- **A (recommended):** score production code only, via a second config `app/.fallowrc.score.jsonc` (`extends` the gate config, adds `tests/**` and generated `src/db/schema.ts` to `health.ignore`). The main gate config still analyses tests. Tests get their own ratchet: `it`/`test` bodies > 60 lines, 20 → 0. Then `src/` must go from 114 to ≤ 24 large functions. Plans 5–7 do that.
- **B:** keep tests scored. Needs ≤ ~105 large functions in total, so ~560 `describe` blocks must be flattened or split as well: ≈ 90 000 test lines re-indented for no behaviour gain.

Plans assume A. Under B, plan 2's config file is dropped and a ninth plan (flatten test `describe` wrappers) is added.

### Milestones (score config, option A)

| After plan | Large functions in `src/` | Expected score |
| ---------- | ------------------------- | -------------- |
| 2 (gate only) | 114 | 87.6 |
| 5 | ≤ 87 | ≈ 88.7 |
| 6 | ≤ 41 | ≈ 93.4 |
| 7 | ≤ 20 | ≥ 95.0 |

The 95 margin is thin (coupling 2.4 leaves 2.6 for unit size). If coupling moves, the remaining ≤ 20 templates are the reserve.

## 3. Defects and dead checks found

| # | Where | Finding | Severity | Plan |
| - | ----- | ------- | -------- | ---- |
| 1 | `scripts/check-dupes.sh` | Pins `fallow@3.38.0`; it reports 0 clone groups where 3.42.0 (what `fallow-gate.sh` runs) reports 3. The ratchet passes with an empty baseline while clones exist. | High | 1 |
| 2 | `app/package.json`, `fallow-gate.sh` | `fallow` is not a dependency. `npx fallow` takes the newest release on every run, so the gate's rules change without a commit. | High | 1 |
| 3 | `app/.fallowrc.jsonc` | Both `thresholdOverrides` are stale (templates are not CRAP-scored); 4 `ignoreDependencies` hide nothing (`jose`, `@resvg/resvg-js`, `culori`, `opentype.js`); `neon` is an unlisted binary warned on every run. | Low | 1 |
| 4 | `fallow health` | The hotspot penalty needs git history; CI checks out depth 1, a full clone does not. Local and CI scores differ (86.2 vs 87.6). | Medium | 2 (gate uses `--score`, no hotspots) |
| 5 | `.claude/hooks/block-main-commit.py` | Command boundary is `\A` or `;&|`. A multi-line command (`git add .⏎git commit …`) and `git -C . commit` are not seen. Husky still blocks the commit, but nothing blocks the push form. No fixture test exists for this hook. | Medium | 3 |
| 6 | `.github/workflows/checks.yml`, `integration.yml` | `pull_request: branches: [main]`: a PR stacked on a task branch (allowed, one deep) runs no quality job. | Medium | 3 |
| 7 | `scripts/__pycache__/` | A `.pyc` is committed; `.gitignore` has no `__pycache__/`. | Low | 3 |
| 8 | `scripts/` | 7 scripts are mode 644, the rest 755. Harmless (all run via `bash`), inconsistent. | Low | 3 |
| 9 | `scripts/split-decisions.sh`, `verify-decision-split.sh`, `decision-front-matter.txt` | One-time tooling for the 2026-08-02 ledger split; wired nowhere (29 KB). | Low | 3 |
| 10 | `.husky/pre-commit` | Runs all 25 gates on every commit, including a docs-only one: ≈ 110 s. | Medium | 4 |
| 11 | Gate lists | Four hand-kept lists (pre-commit, `quality.yml`, `run-all-gates` skill, `edit-gate.py`) with nothing checking they agree. `check-dupes.sh` is in CI and the skill but not pre-commit, by accident or design: unstated. | Medium | 4 |
| 12 | `deploy.yml` → `quality.yml` | On `push` to `main` the diff-based gates (`check-test-coverage`, `check-doc-sync`) compare `main` to itself and always pass. Costs nothing; noted, not planned. | Info | — |
| 13 | `scripts/check-constraint-mirror.sh`, `check-refinement-coverage.sh` | Both state they only prove an anchor/manifest exists; the real check is a vitest file. They are honest and cheap (< 0.1 s). Keep. | Info | — |

## 4. Code reduction opportunities

| Area | Evidence | Plan |
| ---- | -------- | ---- |
| 3 `mild` clone groups | `schedule.service.ts:133/158`, `routine-summary.module.ts:261/289`, `DurationField.astro` / `DurationSoloFields.astro` Props | 1 |
| 27 long service / repository / module functions | § 5 list | 5 |
| 46 Alpine `x-data` factories and stores written as one function (up to 1 118 lines) | § 5 list | 6 |
| 41 Astro templates > 60 lines; `DartBoard.astro` holds a 272-line block twice | § 5 list | 7 |
| 14 near-identical `pages/games/*/play/index.astro` (24 lines × 14) | `dupes --mode semantic` | 7 |

## 5. Plan index

Run in order. Each plan is one branch and one PR. Plans 1–4 are small and independent of the owner decision except plan 2.

| # | Plan file (`docs/superpowers/plans/`) | Outcome | Hard check |
| - | ------------------------------------- | ------- | ---------- |
| 1 | `2026-11-10-quality-1-fallow-pin-and-hygiene.md` | One pinned fallow; ratchet sees clones; 3 clones gone; config has no stale rows | `check-dupes: ok (0 file sets)` with 3.42.0 |
| 2 | `2026-11-10-quality-2-benchmark-gate.md` | `scripts/quality-benchmarks.json` + ratchet gate in CI | gate fails on any regression and on a stale (too loose) row |
| 3 | `2026-11-10-quality-3-hook-and-ci-defects.md` | Findings 5–9 fixed | new hook fixture test; stacked PR shows `quality` |
| 4 | `2026-11-10-quality-4-gate-wiring.md` | Path-scoped pre-commit; wiring gate | docs-only commit < 15 s |
| 5 | `2026-11-10-quality-5-long-functions.md` | 27 long functions split | `large_functions_src ≤ 87` |
| 6 | `2026-11-10-quality-6-alpine-factories.md` | 46 factories/stores composed from method groups | `large_functions_src ≤ 41`, score ≥ 93 |
| 7 | `2026-11-10-quality-7-astro-templates.md` | ≥ 21 templates split; play pages share one shell | built HTML byte-identical; score ≥ 95.0 |
| 8 | `2026-11-10-quality-8-skills-and-guardrails.md` | 3 skills, 1 hook, changed-files audit gate | fixture tests; skill pointer gate |

## 6. Considered, not planned

- Flattening test `describe` blocks (option B above).
- Moving the root `D-E-extract*.json` data files (544 KB): named in append-only decisions and read by `app/scripts/dartbot-*.ts`.
- Rewriting `check-type-barrels.sh` (66 s) in one pass: plan 4 scopes it by path instead.
- A `duplicates.threshold` in the main config: plan 2 ratchets duplication per mode, which is stricter.
