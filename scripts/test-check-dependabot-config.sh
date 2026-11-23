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

# Review workflow: mutate_wf <name> <ruby expression on d>, then expect_wf_fail.
WF="$ROOT/.github/workflows/dependency-review.yml"
mutate_wf() {
  ruby -ryaml -e 'd = YAML.load_file(ARGV[0]); eval(ARGV[2]); File.write(ARGV[1], d.to_yaml)' \
    "$WF" "$TMP/$1.yml" "$2"
}
expect_wf_fail() {
  local out code
  out="$(REVIEW_WORKFLOW="$TMP/$1.yml" bash "$GATE" 2>&1)"; code=$?
  [ "$code" -ne 0 ] || { fail "$1 should fail"; return; }
  grep -qF -- "$2" <<< "$out" || fail "$1 failure should mention '$2'"
}
steps='d["jobs"].values.flat_map { |j| j["steps"] }'
claude="$steps.find { |s| s[\"uses\"].to_s.start_with?(\"anthropics/claude-code-action\") }"

mutate_wf wf-write 'd["permissions"]["contents"] = "write"'
expect_wf_fail wf-write permissions
mutate_wf wf-tag "$claude[\"uses\"] = \"anthropics/claude-code-action@v1\""
expect_wf_fail wf-tag SHA
mutate_wf wf-no-if 'd["jobs"].each_value { |j| j.delete("if") }'
expect_wf_fail wf-no-if 'dependabot[bot]'
mutate_wf wf-edit "$claude[\"with\"][\"claude_args\"] = $claude[\"with\"][\"claude_args\"].sub(\"Read,\", \"Read,Edit,\")"
expect_wf_fail wf-edit Edit
mutate_wf wf-write-tool "$claude[\"with\"][\"claude_args\"] = $claude[\"with\"][\"claude_args\"].sub(\"Read,\", \"Read,Write,\")"
expect_wf_fail wf-write-tool Write
mutate_wf wf-any-bot "$claude[\"with\"][\"allowed_bots\"] = \"*\""
expect_wf_fail wf-any-bot allowed_bots
mutate_wf wf-no-token "$claude[\"with\"].delete(\"github_token\")"
expect_wf_fail wf-no-token github_token
mutate_wf wf-auto-mode "$claude[\"with\"][\"claude_args\"] = $claude[\"with\"][\"claude_args\"].sub(\"--permission-mode default\", \"\")"
expect_wf_fail wf-auto-mode permission-mode
mutate_wf wf-any-fetch "$claude[\"with\"][\"claude_args\"] = $claude[\"with\"][\"claude_args\"].sub(\"Read,\", \"Read,WebFetch,\")"
expect_wf_fail wf-any-fetch WebFetch
mutate_wf wf-inline-deps "$claude[\"with\"][\"prompt\"] += \"\\n\\\${{ steps.metadata.outputs.updated-dependencies-json }}\""
expect_wf_fail wf-inline-deps prompt
mutate_wf wf-human-push 'd["jobs"].each_value { |j| j["if"] = "github.event.pull_request.user.login == '"'dependabot[bot]'"'" }'
expect_wf_fail wf-human-push github.actor

# Selector: select <json> <expected breaking value>.
SELECT="$ROOT/scripts/dependency-review-select.sh"
select_case() {
  local out
  out="$(bash "$SELECT" "$1" 2>&1)" || { fail "selector errored on $1: $out"; return; }
  [ "$out" = "breaking=$2" ] || fail "selector on $1: want breaking=$2, got '$out'"
}
dep() { printf '{"dependencyName":"%s","prevVersion":"%s","newVersion":"%s","updateType":"version-update:semver-%s"}' "$@"; }
select_case "[$(dep astro 6.3.0 7.0.0 major)]" true
select_case "[$(dep actions/checkout v4 v5 major)]" true
select_case "[$(dep drizzle-orm 0.45.2 0.46.0 minor)]" true
select_case "[$(dep drizzle-orm 0.45.2 0.45.3 patch)]" false
select_case "[$(dep alpinejs 3.15.12 3.16.0 minor)]" false
select_case "[$(dep clsx 2.1.1 2.1.2 patch),$(dep drizzle-orm 0.45.2 0.46.0 minor)]" true
select_case "[]" false
select_case '[{"dependencyName":"actions/setup-node","prevVersion":"4","newVersion":"5","updateType":null}]' true
select_case '[{"dependencyName":"actions/checkout","prevVersion":"v4.2.0","newVersion":"v5.0.0","updateType":null}]' true
select_case '[{"dependencyName":"clsx","prevVersion":"2.1.1","newVersion":"2.2.0","updateType":null}]' false
select_case "[$(dep tiny-lib 0.0.1 0.0.2 patch)]" true
select_case "[$(dep tiny-lib 0.1.1 0.1.2 patch)]" false

[ "$FAILED" -eq 0 ] || { echo "test-check-dependabot-config: $FAILED failure(s)" >&2; exit 1; }
echo "test-check-dependabot-config: ok"
