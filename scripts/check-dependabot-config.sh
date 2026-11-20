#!/usr/bin/env bash
# Guard: .github/dependabot.yml keeps the values the dependency-update spec
# pins (docs/superpowers/specs/2026-11-19-dependency-updates-design.md): npm in
# /app and github-actions in /, weekly Monday 06:00 Europe/Amsterdam, a 2-day
# cooldown, at most 5 open PRs, and minor+patch grouped with majors left
# ungrouped. Override the file with DEPENDABOT_FILE (relative paths resolve
# from the repo root). Runs from any cwd. Parses YAML with Ruby's stdlib.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
resolve() { case "$1" in /*) echo "$1" ;; *) echo "$ROOT/$1" ;; esac; }
DEPENDABOT_FILE="$(resolve "${DEPENDABOT_FILE:-.github/dependabot.yml}")"

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
