#!/usr/bin/env bash
# Fixture test for scripts/check-dependabot-config.sh: the committed config
# passes, and each mutated copy that breaks one spec value fails naming it.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$ROOT/scripts/check-dependabot-config.sh"
BASE="$ROOT/.github/dependabot.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unset DEPENDABOT_FILE REVIEW_WORKFLOW

FAILED=0
fail() { FAILED=$((FAILED + 1)); echo "FAIL: $1" >&2; }

(cd "$TMP" && bash "$GATE" >/dev/null 2>&1) || fail "committed config should pass"

# mutate <name> <ruby expression on d>: writes $TMP/<name>.yml from the committed config.
mutate() {
  ruby -ryaml -e 'd = YAML.load_file(ARGV[0]); eval(ARGV[2]); File.write(ARGV[1], d.to_yaml)' \
    "$BASE" "$TMP/$1.yml" "$2"
}

# expect_fail <name> <needle>: the gate fails on the fixture and names <needle>.
expect_fail() {
  local out code
  out="$(DEPENDABOT_FILE="$TMP/$1.yml" bash "$GATE" 2>&1)"; code=$?
  [ "$code" -ne 0 ] || { fail "$1 should fail"; return; }
  grep -qF -- "$2" <<< "$out" || fail "$1 failure should mention '$2'"
}

mutate cooldown 'd["updates"].each { |u| u["cooldown"]["default-days"] = 1 }'
expect_fail cooldown cooldown

mutate no-actions 'd["updates"].reject! { |u| u["package-ecosystem"] == "github-actions" }'
expect_fail no-actions github-actions

mutate group-major 'd["updates"].each { |u| u["groups"].each_value { |g| g["update-types"] = %w[major minor patch] } }'
expect_fail group-major major

mutate limit 'd["updates"].each { |u| u["open-pull-requests-limit"] = 10 }'
expect_fail limit open-pull-requests-limit

mutate timezone 'd["updates"].each { |u| u["schedule"]["timezone"] = "UTC" }'
expect_fail timezone timezone

[ "$FAILED" -eq 0 ] || { echo "test-check-dependabot-config: $FAILED failure(s)" >&2; exit 1; }
echo "test-check-dependabot-config: ok"
