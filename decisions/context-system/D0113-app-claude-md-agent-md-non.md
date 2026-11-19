---
id: D0113
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, gate, AGENT.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `app/CLAUDE.md`/`AGENT.md` Non-Negotiable Rules gain an explicit `tsconfig.json` paths ↔

## Context and Problem Statement
Self-learning gate: Task 18 discovered `@lib` was declared in `tsconfig.json` but absent from `vitest.config.ts`, undetected until a test tried a genuine (non-`vi.mock`) import — user approved documenting the drift risk

## Decision Drivers
* A new alias used only inside `vi.mock(...)` factories can pass tests without real module resolution, so a missing alias stays invisible.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`app/CLAUDE.md`/`AGENT.md` Non-Negotiable Rules gain an explicit `tsconfig.json` paths ↔ `vitest.config.ts` alias sync requirement".

### Consequences
* Neutral, because the rule enters the `app/CLAUDE.md` Non-Negotiable Rules, dated 2026-07-16. It requires a new alias to resolve for a genuine non-mocked import before it counts as wired.
* Bad, because the rule is prose only. The 2026-07-28 spec lists it among rules "stated as binding but nothing fails a build if they're violated".

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-alias-sync.sh` fails when the two alias sets diverge. `.github/workflows/quality.yml` runs it, and `scripts/precommit-gates.tsv` lists it. `app/CLAUDE.md` still states the rule.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-16

* Commit `cd80aa80` (PR #29, 2026-07-21; `DECISIONS.md` row D113 and the `app/CLAUDE.md` diff): rebuilt Decision Drivers and Consequences.
* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 1): rebuilt Consequences.
* Commit `1351996f` (PR #56, 2026-07-28; adds `scripts/check-alias-sync.sh` under D158): rebuilt Confirmation.
