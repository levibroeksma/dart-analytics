---
id: D0161
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, font]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# New `scripts/check-style-tokens.sh` bans `font-medium`, `{...rest}`, and raw

## Context and Problem Statement
Mechanizes the Style non-negotiables in app/CLAUDE.md (D108/D126/D128), previously enforced only by human review of the diff

## Decision Drivers
* The Style non-negotiables in `app/CLAUDE.md` were enforced only by human review of the diff.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "New `scripts/check-style-tokens.sh` bans `font-medium`, `{...rest}`, and raw `bg-bg*`/`text-fg*` palette utilities across `app/src/**/*.{astro,css}`", because Mechanizes the Style non-negotiables in app/CLAUDE.md (D108/D126/D128), previously enforced only by human review of the diff.

### Consequences
* Neutral, because the plan wires the script into `.husky/pre-commit` and the `quality.yml` workflow, and adds a pointer in `app/CLAUDE.md` and a row in the Context Map mechanical-guards table.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The plan's Task 6 added a fixture check: append a `font-medium` line, expect `FAIL`, restore the file. That check no longer holds, because D428 removed the `font-medium` ban and `scripts/check-style-tokens.sh` now allows it.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-28
Referenced by D0428's `Supersedes:` line.

* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 5.4): rebuilt Consequences.
* `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (Task 6): rebuilt Consequences and Confirmation.
* Commit `1351996f` (PR #56, 2026-07-28; adds `scripts/check-style-tokens.sh` and the D161 row): rebuilt Decision Drivers.
