#!/usr/bin/env bash
# Fixture test for scripts/check-quality-benchmarks.sh. QUALITY_CURRENT and
# QUALITY_BENCHMARKS point the gate at fixtures, so no fallow run is needed.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$ROOT/scripts/check-quality-benchmarks.sh"
PASSED=0
FAILED=0
D="$(mktemp -d)"
trap 'rm -rf "$D"' EXIT

BASE_VALUES='{"health_score":87.6,"mi_average":91.0,"mi_lowest_file":76.9,"large_functions_src":114,"large_test_bodies":19,"max_cyclomatic":14,"dup_pct_weak":2.2,"dup_pct_semantic":18.3}'

# bench : write the benchmark fixture from BASE_VALUES
bench() {
  jq '{fallow:"0.0.0", rows:{
    health_score:{dir:"min",now:.health_score,target:95},
    mi_average:{dir:"min",now:.mi_average,target:91},
    mi_lowest_file:{dir:"min",now:.mi_lowest_file,target:80},
    large_functions_src:{dir:"max",now:.large_functions_src,target:20},
    large_test_bodies:{dir:"max",now:.large_test_bodies,target:0},
    max_cyclomatic:{dir:"max",now:.max_cyclomatic,target:14},
    dup_pct_weak:{dir:"max",now:.dup_pct_weak,target:1},
    dup_pct_semantic:{dir:"max",now:.dup_pct_semantic,target:12}}}' <<< "$BASE_VALUES" > "$D/bench.json"
}
# current <jq filter> : write the current-values fixture, BASE_VALUES changed by the filter
current() { jq "$1" <<< "$BASE_VALUES" > "$D/cur.json"; }

# expect <pass|fail> <name> <needle> [gate args]
expect() {
  local want="$1" name="$2" needle="$3" out code; shift 3
  out="$(QUALITY_CURRENT="$D/cur.json" QUALITY_BENCHMARKS="$D/bench.json" bash "$GATE" "$@" 2>&1)"; code=$?
  if { [ "$want" = pass ] && [ "$code" -eq 0 ]; } || { [ "$want" = fail ] && [ "$code" -ne 0 ] && grep -qF -- "$needle" <<< "$out"; }; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1)); echo "FAIL: $name (want $want${needle:+, \"$needle\"}, exit $code)" >&2; echo "$out" | sed 's/^/    /' >&2
  fi
}
# holds <name> <row> <value> : the benchmark fixture's `now` for the row
holds() {
  if [ "$(jq -r ".rows.$2.now" "$D/bench.json")" = "$3" ]; then PASSED=$((PASSED + 1)); else
    FAILED=$((FAILED + 1)); echo "FAIL: $1 (want $2 = $3, got $(jq -r ".rows.$2.now" "$D/bench.json"))" >&2; fi
}

bench; current '.'
expect pass "current equals benchmarks" ""

current '.health_score = 87.5'
expect fail "score dropped" "regressed: health_score 87.5 < 87.6"

current '.large_functions_src = 115'
expect fail "one more large function" "regressed: large_functions_src 115 > 114"

current '.health_score = 88.4'
expect fail "score improved past tolerance" "stale benchmark, tighten it: health_score"

current '.health_score = 87.9'
expect pass "score improved within tolerance" ""

current '.large_functions_src = 113'
expect fail "integer row improved" "stale benchmark, tighten it: large_functions_src"

bench; current '.health_score = 88.4'
expect pass "--update tightens an improved row" "" --update
holds "--update wrote the new value" health_score 88.4

bench; current '.health_score = 87.5'
expect fail "--update refuses a regression" "regressed: health_score 87.5 < 87.6" --update
holds "--update left the file alone" health_score 87.6

bench; current 'del(.dup_pct_weak)'
expect fail "missing current value" "missing value: dup_pct_weak"

echo "check-quality-benchmarks tests: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
