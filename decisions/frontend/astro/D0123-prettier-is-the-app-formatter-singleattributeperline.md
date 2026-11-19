---
id: D0123
status: accepted
date: 2026-07-21
origin: contemporaneous
original-date:
tags: [frontend/astro, .astro]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Prettier is the `app/` formatter (`singleAttributePerLine`)

## Context and Problem Statement
FOUC-safe Alpine markup, consistent authoring, mechanical drift prevention
Several authoring preferences were missing from the agent guides, documented but unenforced, or half-applied. Template comments mixed `<!-- -->` with the preferred form, `x-show` and `x-cloak` pairing had no PR check, and Prettier had no project config. The design spec chose docs, a shell convention gate and Prettier, matching the existing `scripts/check-*.sh` pattern.

## Decision Drivers
* FOUC-safe Alpine markup: every `x-show` carries `x-cloak`.
* Consistent authoring: one comment style and one attribute-per-line format.
* Mechanical drift prevention through a formatter and a CI gate.

## Considered Options
* Docs, a shell convention gate and Prettier (chosen).
* An ESLint or other new lint stack. The spec lists it as out of scope.
* A separate rule for the already-canonical `x-cloak` pairing. The spec skips it and adds only the missing CI gate.

## Decision Outcome
Chosen option: "Prettier is the `app/` formatter (`singleAttributePerLine`); `.astro` template comments are `{/* */}` only; CI enforces `x-show`↔`x-cloak` and bans template `<!-- -->` via `scripts/check-astro-conventions.sh`; TS inline body comments banned under `app/src/**/*.ts` (JSDoc-above; agent-enforced)", because FOUC-safe Alpine markup, consistent authoring, mechanical drift prevention.

### Consequences
* Good, because `scripts/check-astro-conventions.sh` and `npm run format:check` fail CI on violations.
* Bad, because Prettier may reflow more than attributes; the spec accepts that as the cost of a single formatter.
* Bad, because the convention gate is approximate: it scans tags, not a full Astro AST.
* Neutral, because TS inline body comments and the blank line before frontmatter `// Title` headers are agent-enforced, with no CI check.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
CI runs `npm run format:check` in `.github/workflows/quality.yml` and `scripts/check-astro-conventions.sh`, which checks `x-show` and `x-cloak` pairing and bans template `<!-- -->`. The TS inline-comment ban is agent-enforced.

## Pros and Cons of the Options
### Docs, shell gate and Prettier
* Good, because it matches the existing `scripts/check-*.sh` pattern.
* Bad, because Prettier reflows more than attributes and the gate is approximate.

### ESLint or a new lint stack
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-21

* `docs/superpowers/specs/2026-07-21-astro-ts-comment-format-gates-design.md` (Context, § 1 to 5): rebuilt Context, Decision Drivers, Considered Options, Consequences and Confirmation.
* `docs/superpowers/plans/2026-07-21-astro-ts-comment-format-gates.md`: the implementation plan for the gates.
* Commit `1f3ee77b` (2026-07-21; adds the D123 row and the docs changes): confirmed the origin.
* Applied in: `docs/superpowers/plans/2026-07-21-modal-confirm-dialog.md`, `docs/superpowers/plans/2026-07-22-ui-polish-pr2.md`.
