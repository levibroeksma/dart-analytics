---
id: D0105
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Zero-exception rule

## Context and Problem Statement
Prior colocation escape hatch relied on discipline alone, not enforcement. The 2026-07-16 spec reverses part of the earlier "Colocation vs Promotion" table in `02-Folder-Structure.md`, which let single-route `.data.ts` files colocate under `pages/<route>/`.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Keep the colocation escape hatch for single-route `.data.ts` files, enforced by discipline.
* Zero exceptions, with `lib/<domain>/` always the location, enforced mechanically (chosen).

## Decision Outcome
Chosen option: "Zero-exception rule: no `.ts` under `components/`/`pages/` except `pages/api/**`; `lib/<domain>/` always, named after `modules/`/`stores/` domain vocabulary; mechanically enforced via `scripts/check-file-locations.sh` (local + CI)", because Prior colocation escape hatch relied on discipline alone, not enforcement.

### Consequences
* Good, because `scripts/check-file-locations.sh` fails when a `.ts` file lands under `components/` or `pages/` outside `pages/api/**`. Discipline alone no longer keeps the tree clean.
* Neutral, because `lib/<domain>/` uses the same domain vocabulary as `modules/<domain>/` and `stores/<domain>.store.ts`, never a route or component-folder name.
* Neutral, because logic used by 2 or more routes that warrants store, form or module semantics goes to `stores/`, `forms/` or `modules/`.
* Neutral, because the spec removes the colocated `<route>.data.ts` line from the authoritative tree in `02-Folder-Structure.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-file-locations.sh` finds `.ts` files under `app/src/components` and `app/src/pages`, excluding `app/src/pages/api/`, and exits 1 on any hit. The 2026-07-16 plan (Task 9) wires it into root `CLAUDE.md`, `AGENT.md` and `.github/workflows/checks.yml`.

## Pros and Cons of the Options
### Colocation escape hatch
Rationale unknown — no source found beyond the ledger row, which says it relied on discipline alone.

### Zero-exception rule
* Good, because a script enforces it, wired into the root Context Maintenance protocol and CI.

## Evidence / More Information
Decided: 2026-07-16

* `docs/superpowers/specs/2026-07-16-frontend-conventions-hardening-design.md` (§ 3, Decisions Ledger): rebuilt Context, Considered Options, Consequences and Confirmation.
* `docs/superpowers/plans/2026-07-16-frontend-conventions-hardening.md` (Tasks 8, 9 and 13): rebuilt Confirmation.
* Commit `8205d64d` (PR #25, "Auth file reorg + frontend conventions hardening"): adds the D105 row.
* Applied in: `docs/superpowers/specs/2026-07-23-context-layer-hardening-design.md` and `docs/superpowers/specs/2026-07-22-hardening-first-deploy-design.md` cite it as precedent for mechanizing discipline-only rules.
