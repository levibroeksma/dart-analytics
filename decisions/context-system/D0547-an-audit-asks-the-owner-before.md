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

# An audit asks the owner before it plans; fallow's scoring is a repo reference; the cloud environment allows `fallow.tools`

## Context and Problem Statement
the 2026-11-10 quality audit (PR #1307) wrote eight plans on two assumptions the owner had not seen, rebuilt fallow's formulas from probe projects because the docs host was blocked, and found its files by sweep because no pack named them.

## Decision Drivers
* The commit message names retro items 1, 3 and 7 from the 2026-11-10 quality audit: owner decisions come before plans, fallow's score formulas live in one reference file, and the Context Map names the files a tooling audit loads.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "(1) New skill `auditing-the-codebase`, paired with `superpowers:brainstorming` and `superpowers:writing-plans` in root `CLAUDE.md`: an audit writes its findings spec first and puts every open owner decision in one `AskUserQuestion` before any plan is written. (2) New `.claude/skills/validate-app/references/fallow-scoring.md` holds the health-score penalties, the maintainability formula and the config keys that move the score, reached from `validate-app`. (3) The Context Map gains a "Tooling / quality audit" pack. (4) Cloud sessions for this repository run in a personal `dart-analytics` environment whose only extra allowed host is `fallow.tools`.".

### Consequences
an audit session stops once for owner input; when the owner is away it plans on the recommended defaults and reports the open decisions first. The scoring reference is a cache of an external page and names the formula version it matches (3); a fallow upgrade that changes `health_score.formula_version` makes it stale.

### Confidence
Rationale unknown — no source found.

### Revisit When
The record says a fallow upgrade that changes `health_score.formula_version` makes the scoring reference stale.

### Confirmation
`.claude/skills/auditing-the-codebase/SKILL.md`, `.claude/skills/validate-app/references/fallow-scoring.md` and the "Tooling / quality audit" row in `docs/architecture/00-Context-Map.md` exist today.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-10

* Commit `1f1179a8` (2026-11-10; adds the skill, `fallow-scoring.md`, the Context Map pack and the D547 row; the PR #1307 audit it follows is named in the Context): rebuilt Decision Drivers (the commit message), Confirmation and Revisit When; source of the Context and Consequences text.
