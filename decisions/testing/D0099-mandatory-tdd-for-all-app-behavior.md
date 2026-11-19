---
id: D0099
status: accepted
date: 2026-07-15
origin: contemporaneous
original-date:
tags: [testing, test, TDD, Vitest]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Mandatory TDD for all `app/` behavior

## Context and Problem Statement
Prevents untested client auth and API wiring; sole procedure in `app/CLAUDE.md`. The commit that adds D99 also adds a TDD section to `app/CLAUDE.md`. It requires red→green→refactor for every `app/` behavior change. It forbids skipping TDD by marking UI tasks "manual only".

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Mandatory TDD for all `app/` behavior: Vitest, colocated `*.test.ts`, red→green→ refactor; `npm test` in `validate:app`", because Prevents untested client auth and API wiring; sole procedure in `app/CLAUDE.md`.

### Consequences
* Neutral, because `npm test` joins the `validate:app` sequence between `npx fallow` and `astro check`.
* Neutral, because D101 reverses the colocation clause of this decision the same day.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`npm test` runs in `validate:app`. `app/CLAUDE.md` forbids committing production code before its failing test, except greenfield scaffold commits that only add test infrastructure.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-15

* Commit `2904b646` (2026-07-15; `DECISIONS.md` row D99 and the `app/CLAUDE.md` TDD section): rebuilt Context and Confirmation, and the `validate:app` bullet in Consequences.
* `docs/superpowers/specs/2026-07-15-test-and-variant-conventions-design.md` (Context): rebuilt the D101 bullet in Consequences.
* Applied in: `docs/superpowers/specs/2026-07-15-logout-button-design.md`, `docs/superpowers/specs/2026-07-16-frontend-conventions-hardening-design.md`.
