#!/usr/bin/env bash
# Guard: .github/dependabot.yml keeps the values the dependency-update spec
# pins (docs/superpowers/specs/2026-11-19-dependency-updates-design.md): npm in
# /app and github-actions in /, weekly Monday 06:00 Europe/Amsterdam, a 2-day
# cooldown, at most 5 open PRs, and minor+patch grouped with majors left
# ungrouped. Also guards .github/workflows/dependency-review.yml: read +
# PR-comment permissions only, Dependabot-only jobs, SHA-pinned actions, the
# Claude step on the workflow token, in default permission mode, limited to
# read, domain-scoped fetch and comment tools, and to the dependabot bot.
# Override the files with DEPENDABOT_FILE and REVIEW_WORKFLOW (relative paths
# resolve from the repo root). Runs from any cwd. Parses YAML with Ruby's stdlib.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
resolve() { case "$1" in /*) echo "$1" ;; *) echo "$ROOT/$1" ;; esac; }
DEPENDABOT_FILE="$(resolve "${DEPENDABOT_FILE:-.github/dependabot.yml}")"
REVIEW_WORKFLOW="$(resolve "${REVIEW_WORKFLOW:-.github/workflows/dependency-review.yml}")"

ruby -ryaml - "$DEPENDABOT_FILE" <<'RUBY'
path = ARGV[0]
errs = []
unless File.file?(path)
  warn "check-dependabot-config: #{path} not found"
  exit 1
end
d = YAML.load_file(path) || {}
errs << "version must be 2" unless d["version"] == 2

want = { "npm" => "/app", "github-actions" => "/" }
updates = d["updates"] || []
eco = updates.map { |u| u["package-ecosystem"] }
want.each_key { |e| errs << "missing ecosystem #{e}" unless eco.include?(e) }
(eco - want.keys).each { |e| errs << "unexpected ecosystem #{e}" }

updates.each do |u|
  e = u["package-ecosystem"]
  next unless want.key?(e)
  errs << "#{e}: directory must be #{want[e]}" unless u["directory"] == want[e]
  s = u["schedule"] || {}
  { "interval" => "weekly", "day" => "monday", "time" => "06:00", "timezone" => "Europe/Amsterdam" }.each do |k, v|
    errs << "#{e}: schedule #{k} must be #{v}" unless s[k] == v
  end
  days = (u["cooldown"] || {})["default-days"]
  errs << "#{e}: cooldown default-days must be 2" unless days == 2
  limit = u["open-pull-requests-limit"]
  errs << "#{e}: open-pull-requests-limit must be 5" unless limit == 5
  groups = u["groups"] || {}
  errs << "#{e}: needs one minor+patch group" unless groups.size == 1
  groups.each do |name, g|
    types = (g["update-types"] || []).sort
    errs << "#{e}: group #{name} must not include major" if types.include?("major")
    errs << "#{e}: group #{name} update-types must be [minor, patch]" unless types == %w[minor patch]
  end
end

errs.each { |m| warn "check-dependabot-config: #{m}" }
exit(errs.empty? ? 0 : 1)
RUBY
dep_status=$?

ruby -ryaml - "$REVIEW_WORKFLOW" <<'RUBY'
path = ARGV[0]
errs = []
unless File.file?(path)
  warn "check-dependabot-config: #{path} not found"
  exit 1
end
d = YAML.load_file(path) || {}
want_perms = { "contents" => "read", "pull-requests" => "write" }
errs << "workflow permissions must be exactly #{want_perms}" unless d["permissions"] == want_perms

tools = ["Read", "Grep", "Glob", "WebFetch(domain:github.com)", "WebFetch(domain:www.npmjs.com)",
         "WebFetch(domain:registry.npmjs.org)", "Bash(gh pr comment:*)", "Bash(gh pr view:*)"]
claude_seen = false
(d["jobs"] || {}).each do |name, j|
  cond = j["if"].to_s
  errs << "job #{name}: if must restrict to dependabot[bot]" unless cond.include?("pull_request.user.login == 'dependabot[bot]'")
  errs << "job #{name}: if must also require github.actor == 'dependabot[bot]'" unless cond.include?("github.actor == 'dependabot[bot]'")
  errs << "job #{name}: must not override permissions" if j.key?("permissions")
  (j["steps"] || []).each do |s|
    u = s["uses"].to_s
    next if u.empty? || u.start_with?("./")
    errs << "job #{name}: #{u} must be pinned to a 40-hex commit SHA" unless u =~ /@[0-9a-f]{40}\z/
    next unless u.start_with?("anthropics/claude-code-action@")
    claude_seen = true
    w = s["with"] || {}
    errs << "claude step: allowed_bots must be dependabot[bot]" unless w["allowed_bots"] == "dependabot[bot]"
    errs << "claude step: must not set anthropic_api_key (free tier only)" if w.key?("anthropic_api_key")
    errs << "claude step: github_token must be ${{ github.token }} (no OIDC app token)" unless w["github_token"] == "${{ github.token }}"
    errs << "claude step: prompt must not interpolate step outputs; pass them through a file" if w["prompt"].to_s.include?("${{ steps.")
    errs << "claude step: claude_args must set --permission-mode default" unless w["claude_args"].to_s =~ /--permission-mode\s+default\b/
    m = w["claude_args"].to_s.match(/--allowedTools\s+"([^"]*)"/)
    if m.nil?
      errs << "claude step: claude_args must set --allowedTools"
    else
      (m[1].split(",").map(&:strip) - tools).each { |t| errs << "claude step: tool #{t} is not allowed" }
    end
  end
end
errs << "no anthropics/claude-code-action step found" unless claude_seen

errs.each { |m| warn "check-dependabot-config: #{m}" }
exit(errs.empty? ? 0 : 1)
RUBY
wf_status=$?
[ "$dep_status" -eq 0 ] && [ "$wf_status" -eq 0 ]
