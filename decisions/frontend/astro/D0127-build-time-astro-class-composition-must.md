---
id: D0127
status: accepted
date: 2026-07-22
origin: contemporaneous
original-date:
tags: [frontend/astro, .astro, cn(), class composition]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Build-time Astro class composition must use `cn()`

## Context and Problem Statement
Prevents new UI primitives from regressing on `05-Astro-Components.md`
The style-alignment spec audited the new UI primitives against rules already agreed in `05-Astro-Components.md`. Many used `class:list={[...]}` instead of `cn()`; `Button.astro`, `Alert.astro`, `Card.astro` and `Input.astro` are named examples. The plan converts 26 `.astro` files with `class:list` and adds a gate so the rule stays enforced.

## Decision Drivers
* Rules agreed in `05-Astro-Components.md` were already violated by new UI components.
* New UI primitives must not regress on the rule.

## Considered Options
* Add a shell gate that bans `class:list` and `.filter(Boolean).join(` in `app/src/**/*.astro` (chosen).

## Decision Outcome
Chosen option: "Build-time Astro class composition must use `cn()`; `class:list` and `.filter(Boolean).join` banned in `app/src/**/*.astro`, enforced by `scripts/check-astro-class-composition.sh` in Context Maintenance + GitHub `checks` workflow", because Prevents new UI primitives from regressing on `05-Astro-Components.md`.

### Consequences
* Good, because the gate fails with the violating paths when a banned pattern appears.
* Neutral, because the gate runs in the Context Maintenance checks and in CI on PRs to `main`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`bash scripts/check-astro-class-composition.sh` exits 0 when no `app/src/**/*.astro` file uses `class:list` or `.filter(Boolean).join(`. The plan wires it into `.github/workflows/checks.yml` and the Context Maintenance checks.

## Pros and Cons of the Options
### Shell gate
* Good, because it stops new primitives from regressing on `05-Astro-Components.md`.

## Evidence / More Information
Decided: 2026-07-22

* `docs/superpowers/specs/2026-07-22-style-guide-alignment-design.md` (Context, § 4b audit table): rebuilt Context, Decision Drivers and Considered Options.
* `docs/superpowers/plans/2026-07-22-style-guide-alignment.md` (Tasks 2 to 4, ledger step): rebuilt Consequences and Confirmation.
* The plan numbers this record D126; the ledger holds it as D127.
* Commit `4ab73bf1` (PR #32, 2026-07-22; adds the gate and the D127 row): confirmed the origin.
* Applied in: `docs/superpowers/specs/2026-07-23-context-layer-hardening-design.md` (cites D127 as precedent for mechanizing rules), `docs/superpowers/specs/2026-07-22-hardening-first-deploy-design.md`.
