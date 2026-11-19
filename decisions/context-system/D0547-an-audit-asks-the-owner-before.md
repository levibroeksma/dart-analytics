---
id: D0547
status: accepted
date: 2026-11-10
origin: contemporaneous
original-date:
tags: [context-system, docs, context map, CLAUDE.md, skill, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# An audit asks the owner before it plans; fallow's scoring is a repo reference; the cloud environment allows `fallow.tools`

## Context and Problem Statement
the 2026-11-10 quality audit (PR #1307) wrote eight plans on two assumptions the owner had not seen, rebuilt fallow's formulas from probe projects because the docs host was blocked, and found its files by sweep because no pack named them.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "(1) New skill `auditing-the-codebase`, paired with `superpowers:brainstorming` and `superpowers:writing-plans` in root `CLAUDE.md`: an audit writes its findings spec first and puts every open owner decision in one `AskUserQuestion` before any plan is written. (2) New `.claude/skills/validate-app/references/fallow-scoring.md` holds the health-score penalties, the maintainability formula and the config keys that move the score, reached from `validate-app`. (3) The Context Map gains a "Tooling / quality audit" pack. (4) Cloud sessions for this repository run in a personal `dart-analytics` environment whose only extra allowed host is `fallow.tools`.".

### Consequences
an audit session stops once for owner input; when the owner is away it plans on the recommended defaults and reports the open decisions first. The scoring reference is a cache of an external page and names the formula version it matches (3); a fallow upgrade that changes `health_score.formula_version` makes it stale.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-10
