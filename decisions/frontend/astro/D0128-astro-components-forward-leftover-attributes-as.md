---
id: D0128
status: accepted
date: 2026-07-22
origin: contemporaneous
original-date:
tags: [frontend/astro, props]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Astro components forward leftover attributes as `...props` / `{...props}`

## Context and Problem Statement
One consistent rest-spread name across UI primitives
The style-alignment spec's component audit (§ 4b) checks rest-spread naming. It found stragglers that destructure or spread leftover attributes as `...rest` and renames them to `...props`. The reserved word `class` still renames to `classNameProp`.

## Decision Drivers
* One consistent rest-spread name across UI primitives.

## Considered Options
* Name the spread `...props` / `{...props}` (chosen).
* Name the spread `...rest` / `{...rest}`. The audit treats it as a violation.

## Decision Outcome
Chosen option: "Astro components forward leftover attributes as `...props` / `{...props}` — never `...rest` / `{...rest}`", because One consistent rest-spread name across UI primitives.

### Consequences
* Neutral, because the reserved word `class` still renames to `classNameProp`.
* Neutral, because the spec documents the rule in `05-Astro-Components.md` and the agent rules.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-style-tokens.sh` fails on `{...rest}` in `app/src/**/*.astro`.

## Pros and Cons of the Options
### `...props`
* Good, because every UI primitive forwards leftover attributes under one name.

### `...rest`
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-22

* `docs/superpowers/specs/2026-07-22-style-guide-alignment-design.md` (decision table, § 4b audit checklist): rebuilt Context, Decision Drivers, Consequences and Considered Options.
* `docs/superpowers/plans/2026-07-22-style-guide-alignment.md` (Global Constraints, ledger step): rebuilt Context.
* The plan numbers this record D127; the ledger holds it as D128.
* Commit `4ab73bf1` (PR #32, 2026-07-22; adds the D128 row and the `...rest` purge): confirmed the origin.
* Applied in: `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (D161 adds `scripts/check-style-tokens.sh`, which bans `{...rest}`), `docs/superpowers/plans/2026-07-22-ui-polish-pr2-handoff.md`.
