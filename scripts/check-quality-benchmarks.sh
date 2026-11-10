#!/usr/bin/env bash
# Quality-benchmark ratchet. Reduces fallow's output to 8 numbers and compares
# them to scripts/quality-benchmarks.json. Each row's `now` only moves toward
# its `target`: a worse number fails ("regressed"), and so does a recorded
# number looser than reality ("stale benchmark, tighten it").
#   bash scripts/check-quality-benchmarks.sh            check
#   bash scripts/check-quality-benchmarks.sh --update   tighten improved rows
# QUALITY_CURRENT=<file> replaces the fallow runs with a JSON object of the 8
# current values; QUALITY_BENCHMARKS=<file> replaces the benchmark file.
#
# The score is read with `-c .fallowrc.score.jsonc --score`: production code
# only, no hotspot penalty, so a shallow CI clone and a full clone agree.
# Float rows may improve by up to 0.5 before the row counts as stale.
#
# fallow lists large functions only while at least 3 % of all functions are over
# 60 lines; if the list is absent, `large_test_bodies` is reported missing.
#
# WHAT THIS CANNOT CATCH: a regression that an equal improvement elsewhere
# offsets inside one row; a long `describe` block (tests are scored only by
# `large_test_bodies`, the `it`/`test` callbacks over 60 lines); a hand edit
# that loosens a `now` (review the diff of the benchmark file).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BENCH="${QUALITY_BENCHMARKS:-$ROOT/scripts/quality-benchmarks.json}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallow() { (cd "$ROOT/app" && npx --no-install fallow "$@" 2>/dev/null); }

if [ -n "${QUALITY_CURRENT:-}" ]; then
  cp "$QUALITY_CURRENT" "$TMP/cur.json"
else
  fallow health --score --file-scores --format json -q -c .fallowrc.score.jsonc > "$TMP/score.json"
  fallow health --score --file-scores --format json -q > "$TMP/all.json"
  for m in weak semantic; do fallow dupes --mode "$m" --format json --no-fragments -q > "$TMP/dupes-$m.json"; done
  jq -n --slurpfile s "$TMP/score.json" --slurpfile a "$TMP/all.json" \
    --slurpfile w "$TMP/dupes-weak.json" --slurpfile m "$TMP/dupes-semantic.json" '
    def up1: (. * 10 | ceil) / 10;
    {
      health_score: $s[0].health_score.score,
      mi_average: $s[0].vital_signs.maintainability_avg,
      mi_lowest_file: ([$s[0].file_scores[].maintainability_index] | min),
      large_functions_src: ($s[0].vital_signs.functions_over_60_loc_per_k * $s[0].summary.functions_analyzed / 1000 | round),
      large_test_bodies: (if ($a[0] | has("large_functions")) then ([$a[0].large_functions[] | select((.path | startswith("tests/")) and (.name | test("^(it|test)[.(]")))] | length) else null end),
      max_cyclomatic: $a[0].vital_signs.cyclomatic_population.functions.max,
      dup_pct_weak: ($w[0].stats.duplication_percentage | up1),
      dup_pct_semantic: ($m[0].stats.duplication_percentage | up1)
    }' > "$TMP/cur.json" || { echo "check-quality-benchmarks: unreadable fallow output" >&2; exit 1; }
fi

jq -r --slurpfile cur "$TMP/cur.json" '
  ["health_score", "mi_average", "mi_lowest_file", "dup_pct_weak", "dup_pct_semantic"] as $floats
  | .rows | to_entries[] | .key as $k | .value as $row | $cur[0][$k] as $c
  | (if ($floats | index($k)) then 0.5 else 0 end) as $tol
  | if $c == null then "missing value: \($k)"
    elif $row.dir == "min" and $c < $row.now then "regressed: \($k) \($c) < \($row.now)"
    elif $row.dir == "max" and $c > $row.now then "regressed: \($k) \($c) > \($row.now)"
    elif $row.dir == "min" and $c > $row.now + $tol then "stale benchmark, tighten it: \($k) (benchmark \($row.now), now \($c)); run: bash scripts/check-quality-benchmarks.sh --update"
    elif $row.dir == "max" and $c < $row.now - $tol then "stale benchmark, tighten it: \($k) (benchmark \($row.now), now \($c)); run: bash scripts/check-quality-benchmarks.sh --update"
    else empty end' "$BENCH" > "$TMP/issues.txt" || { echo "check-quality-benchmarks: unreadable benchmark file" >&2; exit 1; }

if [ "${1:-}" = "--update" ]; then
  if grep -qE '^(regressed|missing value)' "$TMP/issues.txt"; then
    grep -E '^(regressed|missing value)' "$TMP/issues.txt" >&2
    echo "check-quality-benchmarks: --update refused, a row got worse" >&2
    exit 1
  fi
  jq --slurpfile cur "$TMP/cur.json" '.rows |= with_entries(.value.now = $cur[0][.key])' "$BENCH" > "$TMP/new.json" && cp "$TMP/new.json" "$BENCH"
  echo "check-quality-benchmarks: benchmarks tightened"
  exit 0
fi

if [ -s "$TMP/issues.txt" ]; then cat "$TMP/issues.txt" >&2; exit 1; fi
echo "check-quality-benchmarks: ok ($(jq '.rows | length' "$BENCH") rows, score $(jq '.health_score' "$TMP/cur.json"), target $(jq '.rows.health_score.target' "$BENCH"))"
