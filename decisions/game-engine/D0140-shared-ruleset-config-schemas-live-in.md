---
id: D0140
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, turns]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Shared ruleset config schemas live in `app/src/lib/game/rulesets/`

## Context and Problem Statement
`lib/` is the only tree both runtimes may import; config vocabulary was otherwise translated by hand in two directions per game, and `.strict()` turns a seed/schema drift into a failed test instead of silently stripped keys (review ST3)

## Decision Drivers
* No engine consumed a configuration snapshot; all four new engines hardcoded their rules (review C1).
* Config vocabulary was translated by hand in two directions, with no shared schema between the browser and the server-side Zod schema (review ST3).
* `lib/` is the only tree both the Worker and the browser may import (plan, Approved decisions 2).

## Considered Options
* One shared schema and codec under `app/src/lib/game/rulesets/` (chosen).
* Keep server-side schemas in `services/rulesets/` and translate by hand in the browser (the state before this record).

## Decision Outcome
Chosen option: "Shared ruleset config schemas live in `app/src/lib/game/rulesets/` — one `.strict()` Zod object per ruleset version plus a snake_case↔camelCase codec — imported by both the Worker validator and the browser engine; the directory may import neither runtime".

### Consequences
* Neutral, because the schemas encode V1 scope only: values such as `HIGH_TO_LOW`, `RANDOM`, `NORMAL`, `HARD`, `DOUBLE_IN` and `MASTER_OUT` are not accepted.
* Neutral, because the plan corrects the seeds that ship those V2+ values (Task 11).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/rulesets/config-codec.test.ts` covers the codec. `scripts/check-refinement-coverage.sh` and `app/tests/lib/game/rulesets/refinement-contract.test.ts` bind every schema refinement in `types.ts` to executed boundary probes.

## Pros and Cons of the Options
### Shared schema and codec in `lib/game/rulesets/`
* Good, because one definition serves the Worker validator and the browser engine (plan Task 2).
* Bad, because V1-only schemas reject V2+ values that the seeds shipped, so the seeds needed correcting.

### Server-side schemas and hand translation
* Bad, because config vocabulary is translated by hand in two directions, and every new game triples that work (review ST3).

## Evidence / More Information
Decided: 2026-07-26

* `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (§ 1 C1, § 6 ST3): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-07-25-game-engine-contract-hardening.md` (Approved decisions 2, Task 2, Task 11): rebuilt Decision Drivers, Consequences and Pros and Cons.
* `scripts/check-refinement-coverage.sh` (D141): rebuilt Confirmation.
* Commit `8e46e453` (2026-07-26; "docs: record the game engine contract and persistence semantics"): adds the D140 row.
