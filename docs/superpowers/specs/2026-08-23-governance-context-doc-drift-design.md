# Governance/Context-Doc Drift — Design

> **Scope:** close five open findings (F1, F3, F4, F6, F14) — all stale or dead
> metadata in the governance/context-system tree, no code risk. Bundled
> because each is a mechanical correction in the same family: a doc or
> config file asserting something that stopped being true.
> **Out of scope:** every other open finding in `FINDINGS.md`.

## F1 — drop unusable `gh` CLI allowlist entries

`.claude/settings.json`'s `permissions.allow` (lines 20-22) pre-approves
`Bash(gh pr view:*)`, `Bash(gh pr list:*)`, `Bash(gh pr diff:*)`. No `gh`
binary exists in the session container; GitHub access runs through the
`mcp__github__*` tools. Delete all three lines. No replacement — the MCP
tools need no shell allowlist entry.

## F3 — purge hardcoded decision-id/count references in `DECISIONS.md`

Three separate lines in `DECISIONS.md` state a decision-id or count that
drifts every time a new decision is appended, and two of the three already
disagree with each other and with the derived truth:

1. "How to add a decision" (`DECISIONS.md:47`): `` `D198` at time of writing ``
   parenthetical — drop it, keep only the derive command already on the same
   line.
2. ID-gap note (`DECISIONS.md:64`): `the highest is `D212`` and the "192
   decisions exist" lead-in — drop the hardcoded count and highest-id
   figures; reword to point at the derive command instead. Keep the
   20-never-issued id list (`D18 D19 D29 …`) — that list is a permanent
   historical fact, not a running count.
3. Front matter (`DECISIONS.md:5`): `updated: 2026-08-15 (D212)` — drop the
   `(D212)` parenthetical, keep the date.

Net effect: nothing in `DECISIONS.md` states a specific id or count that
tomorrow's decision invalidates. The derive command (`git grep -ohE
'^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | …`) is the only source of
truth for "what's the next id," stated once.

## F4 — delete dead `.graphifyignore` line

`.graphifyignore:6` ignores `.worktrees/`, a directory the "No git
worktrees" hard invariant (root `CLAUDE.md`) makes impossible to ever exist.
Delete the line.

## F6 — correct `00-File-Inventory.md`'s stale AGENT.md description

Two rows still describe `AGENT.md` as a "byte-identical mirror" of its
sibling `CLAUDE.md`, and `check-agent-mirrors.sh` as asserting that — both
predate D213, which inverted the gate to assert `AGENT.md` is a fixed
pointer stub redirecting to `CLAUDE.md` (confirmed against the script's
current `STUB` heredoc).

- `00-File-Inventory.md:172` (`check-agent-mirrors.sh` row) — reword to
  "every `CLAUDE.md` has an `AGENT.md` sibling holding the fixed pointer
  stub (D213)."
- `00-File-Inventory.md:233` (`AGENT.md` row) — reword to describe the stub
  content and its redirect purpose, dropping "Exact mirror … edit both
  together."

## F14 — register the two missing Context-Map-History rows

`docs/superpowers/specs/2026-08-21-guest-player-501-setup-ui-design.md`
(commit `7e355d3`) and its plan
`docs/superpowers/plans/2026-08-21-guest-player-501-setup-ui.md` (commit
`a66cd9f`) — both dated 2026-08-21 — never got an entry in
`00-Context-Map-History.md`. The file is append-only and newest-first by
version number, not chronologically re-sortable, so the fix is one new
version entry (next number after the current highest, 1.21.0) added at the
top, whose body registers both missing rows retroactively: names both
files, their actual date (2026-08-21), and states plainly that this entry
is a belated registration for a previously-completed task, not a new
change.

## Validation

Doc/config-only change set — no `app/` or `database/` touched. Run
`scripts/check-context-map.sh`, `scripts/check-doc-links.sh`,
`scripts/check-decision-ids.sh`, `scripts/check-findings-log.sh` (delete
the F1/F3/F4/F6/F14 blocks from `FINDINGS.md` and bump nothing else in the
front matter). Confirm `.claude/settings.json` is still valid JSON.
