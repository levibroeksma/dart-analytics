# Quality 2 — Hard benchmarks from fallow output

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A committed benchmark file and one gate script that fails CI when any fallow quality number gets worse, and when a recorded number is looser than reality.

**Architecture:** `scripts/check-quality-benchmarks.sh` runs fallow three times (score config, default config, dupes per mode), reduces the JSON to 8 numbers, and compares them to `scripts/quality-benchmarks.json`. It is a ratchet like `check-dupes.sh`: numbers only move toward the target. The score is computed with `--score` (no hotspot penalty) so a shallow CI clone and a full local clone agree.

**Tech Stack:** bash, jq, fallow 3.42.0 (pinned by plan 1).

**Spec:** `docs/superpowers/specs/2026-11-10-codebase-quality-audit-design.md` § 1–2. Needs plan 1 merged. Assumes owner decision 1 = A.

## Global Constraints

- No file under `app/src` or `app/tests` changes.
- The script never downloads: `npx --no-install fallow`.
- Same conventions as `check-dupes.sh`: header comment states what the gate cannot catch; env overrides replace the fallow runs for fixtures.
- New script and data file get File Inventory rows; the gate is added to `quality.yml` and the `run-all-gates` skill in the same PR.
- Finish with `context-maintenance`, `run-all-gates`, `finishing-a-dart-branch`.

## Review Focus

- Fallow prints warnings on stderr: the script must read stdout only, or `jq` fails on line 1.
- `large_functions` disappears from the JSON when fewer than 3 % of functions are large: counts must come from `vital_signs.functions_over_60_loc_per_k × summary.functions_analyzed ÷ 1000`, rounded.
- A float compare in bash is wrong for `87.6`: compare in `jq`.
- A benchmark edited by hand to a looser value must fail review, not the gate: `--update` refuses to loosen and prints the row.
- A missing key in the JSON (fallow schema change) must fail, not pass as `null`.

---

### Task 1: Score-only config

**Files:**
- Create: `app/.fallowrc.score.jsonc`

- [ ] **Step 1:** Write:

```jsonc
{
  // Score production code only (owner decision, spec § 2). The gate config still analyses tests.
  "extends": "./.fallowrc.jsonc",
  "health": {
    "ignore": ["src/middleware.ts", "src/lib/auth/verify-jwt.ts", "src/db/schema.ts", "tests/**"]
  }
}
```

- [ ] **Step 2: Verify.** `cd app && npx --no-install fallow health --score --file-scores --format json -q -c .fallowrc.score.jsonc 2>/dev/null | jq '.health_score.score, .summary.functions_analyzed'` → `87.6` and a number near `4880`.

### Task 2: Benchmark file

**Files:**
- Create: `scripts/quality-benchmarks.json`

- [ ] **Step 1:** Write it with the values the commands print today (expected values shown; record what you measure after plan 1):

```json
{
  "fallow": "3.42.0",
  "rows": {
    "health_score":            { "dir": "min", "now": 87.6, "target": 95.0 },
    "mi_average":              { "dir": "min", "now": 91.1, "target": 91.1 },
    "mi_lowest_file":          { "dir": "min", "now": 76.9, "target": 80.0 },
    "large_functions_src":     { "dir": "max", "now": 114,  "target": 20 },
    "large_test_bodies":       { "dir": "max", "now": 20,   "target": 0 },
    "max_cyclomatic":          { "dir": "max", "now": 14,   "target": 14 },
    "dup_pct_weak":            { "dir": "max", "now": 2.2,  "target": 1.0 },
    "dup_pct_semantic":        { "dir": "max", "now": 18.4, "target": 12.0 }
  }
}
```

Row sources: `health_score`, `mi_average` (`vital_signs.maintainability_avg`), `mi_lowest_file` (min of `file_scores[].maintainability_index`), `large_functions_src` (formula in Review Focus) from the score config; `large_test_bodies` (count of `large_functions[]` with `path` starting `tests/` and `name` matching `^(it|test)\(`) and `max_cyclomatic` (`vital_signs.cyclomatic_population.functions.max`) from the default config; `dup_pct_*` from `fallow dupes --mode <m> --format json --no-fragments -q` → `.stats.duplication_percentage`, rounded up to one decimal.

### Task 3: The gate, test first

**Files:**
- Create: `scripts/test-check-quality-benchmarks.sh`, `scripts/check-quality-benchmarks.sh`

**Interfaces:**
- `bash scripts/check-quality-benchmarks.sh` → exit 0 and `check-quality-benchmarks: ok (8 rows, score <n>, target 95.0)`; exit 1 with one line per failing row.
- `bash scripts/check-quality-benchmarks.sh --update` → rewrites each `now` that improved; refuses (exit 1) if any row got worse.
- Env: `QUALITY_CURRENT=<file>` replaces the fallow runs with a JSON object of the 8 current values; `QUALITY_BENCHMARKS=<file>` replaces the benchmark file.

- [ ] **Step 1: Write the fixture test** (same shape as `scripts/test-check-dupes.sh`), 8 cases:
  1. current = benchmarks → exit 0.
  2. `health_score` 87.5 vs 87.6 → exit 1, stderr has `regressed: health_score 87.5 < 87.6`.
  3. `large_functions_src` 115 vs 114 → exit 1, `regressed: large_functions_src 115 > 114`.
  4. `health_score` 88.4 vs 87.6 → exit 1, `stale benchmark, tighten it: health_score`.
  5. `health_score` 87.9 vs 87.6 → exit 0 (tolerance 0.5 for the three float `min` rows; integer rows have none).
  6. `--update` on case 4 → exit 0, file now holds 88.4.
  7. `--update` on case 2 → exit 1, file unchanged.
  8. current lacks `dup_pct_weak` → exit 1, `missing value: dup_pct_weak`.
- [ ] **Step 2:** Run it. Expected: fails, script not found.
- [ ] **Step 3:** Write `check-quality-benchmarks.sh`. All comparison in one `jq` program; the three fallow runs write to a temp dir with `2>/dev/null`.
- [ ] **Step 4: Verify.** `bash scripts/test-check-quality-benchmarks.sh` → `8 passed, 0 failed`. `bash scripts/check-quality-benchmarks.sh` → `ok (8 rows, …)`.
- [ ] **Step 5:** Commit.

### Task 4: Wire it

**Files:**
- Modify: `.github/workflows/quality.yml` (`app` job, after `Clone-group ratchet`)
- Modify: `.claude/skills/run-all-gates/SKILL.md` ("If `app/` changed" list), `.claude/skills/validate-app/SKILL.md`
- Modify: `docs/architecture/00-File-Inventory.md`, `decisions/context-system.md`

- [ ] **Step 1:** Add the step:

```yaml
      - name: Quality-benchmark ratchet
        working-directory: ${{ github.workspace }}
        run: bash scripts/check-quality-benchmarks.sh && bash scripts/test-check-quality-benchmarks.sh
```

- [ ] **Step 2:** Add the decision (next id from `scripts/next-decision-id.sh`): the 8 rows, the target 95.0, score config scope, "a PR that improves a row runs `--update` in the same PR".
- [ ] **Step 3: Verify.** `bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-skill-pointers.sh` → all `OK`. Push; the PR's `quality / app` job shows the new step green.
