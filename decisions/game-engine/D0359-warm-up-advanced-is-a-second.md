---
id: D0359
status: accepted
date: 2026-09-23
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Warm-Up Advanced is a second Warm-Up template, not a new ruleset or type

## Context and Problem Statement
the author wants the same warm-up with a smaller target; section targets are already template configuration (`WarmUpPhaseConfig`), and `dartboardHighlightPath` already outlines a single-number slice. A routine-step override would tie the variant to one routine; a template lets any custom routine pick it from the catalog.

## Decision Drivers
* The author wants the same warm-up with a smaller target (row added by commit `7ce9ff74`).
* Section targets are already template configuration (`WarmUpPhaseConfig`), and `dartboardHighlightPath` already outlines a single-number slice (same row).
* The spec's scope is the same `WARM_UP_V1` rules with only the section targets differing, offered by the routine builder through `v_exercise_template_catalog` (spec, § 1).

## Considered Options
* A routine-step override that changes the section targets (rejected in the Context).
* A second `WARM_UP` system template pinned to `WARM_UP_V1` (chosen).

## Decision Outcome
Chosen option: ""Warm-Up Advanced" (seed `0026`) is a second `WARM_UP` system template pinned to `WARM_UP_V1`. Its five sections keep Warm-Up's names and equal weights but each aims at one number — Upper 20, Lower 3, Right 6, Left 11 — then the bull. No engine, config schema, adapter or UI change.".

### Consequences
the routine builder lists two Warm-Up templates. A further variant is another template row. Rules: `docs/game-rules/training/exercises/warm-up.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`database/verification/0026_warm_up_advanced_seed_checks.sql` checks that the template is pinned, its config is exact, and the catalog lists both `WARM_UP` templates.

## Pros and Cons of the Options
### Routine-step override
* Bad, because it ties the variant to one routine (row added by commit `7ce9ff74`).

### Second template on `WARM_UP_V1`
* Good, because any custom routine can pick the variant from the catalog (same row).
* Good, because it needs no engine, config schema, adapter or UI change (same row; spec, § 1).

## Evidence / More Information
Decided: 2026-09-23

* Commit `7ce9ff74` (2026-09-23; adds the D359 row to `decisions/game-engine.md`): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/specs/2026-09-23-warm-up-advanced-design.md` (§ 1, § 4): rebuilt Decision Drivers and Confirmation.
