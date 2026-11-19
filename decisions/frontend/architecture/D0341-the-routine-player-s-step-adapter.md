---
id: D0341
status: accepted
date: 2026-09-20
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

# The routine player's step-adapter registry is a `lib/` extension point, not a `modules/` one

## Context and Problem Statement
A `GAME:*` adapter's `open` wraps that game's own play-data factory (`tuodPlay`, `scoreTrainingPlay`, `oneTwentyOnePlay`) so the step's completion advances the routine (`gameStep()`, `game-step.data.ts`) — and every one of those play factories imports `@client/api`. `07-Frontend/04-Modules-And-OOP.md`'s OOP boundary forbids `@client/api` inside anything under `modules/`, so a class-based registry there was never an option once a single adapter needed to reach a play factory; object literals under `lib/`, alongside the routine's other `*.data.ts` files, carry no such restriction. This is the same reasoning `04-Modules-And-OOP.md`'s "Prefer functions" rows already use for `modules/training/routines/*.module.ts` and `modules/stats/*.module.ts` — a family that is a unit gets one home, chosen by what it must import, not by whether classes exist in it. The step-kind generalisation spec first placed the registry at `modules/training/routines/step-adapter.registry.ts`. The plan moved it under `lib/` for the reason above.

## Decision Drivers
* Modules under `app/src/modules/` never import `@client/api`; anything that wraps a play factory lives under `app/src/lib/`.
* A `GAME:*` adapter wraps a play factory, and every play factory imports `@client/api`.
* The family of adapters should have one home, chosen by what it must import.

## Considered Options
* Put the registry in `modules/training/routines/`, as the spec's § 5.1 sketched.
* Put the registry in `app/src/lib/training/routines/adapters/` as object literals (chosen).

## Decision Outcome
Chosen option: "`app/src/lib/training/routines/adapters/` holds one `StepAdapter` object literal per routine step kind (`WARM_UP`/`SWITCHING`/`DOUBLE_PATTERN`/`` `GAME:${rulesetVersionKey}` ``), collected in a `STEP_ADAPTERS` map and resolved by `resolveStepAdapter`/`stepAdapterKey`. `routine-play.data.ts` holds one `adapter` field and delegates every per-kind branch (open/facts/completesOwnSession/summarise/close) to whichever adapter `stepAdapterKey()` resolves, replacing four separate engine-typed fields and inline kind-branching. The registry lives under `lib/`, not `modules/`.".

### Consequences
`StepAdapter` is an interface, not a base class — every concrete adapter is a plain object (three are literals; `game.adapter.ts`'s `gameAdapter()` is a factory function returning one), so nothing here is "classes outside `modules/`", which the OOP boundary still forbids. The three non-game adapters hold no reference to `@client/api` at all — only `game.adapter.ts` does, through the play factories it wraps — so the registry's placement is set by its most demanding member, not its average one. A fifth step kind that needed no `@client/api` access at all would still belong here, for the family's sake, not split out to `modules/`.

* Good, because the `GAME:*` adapter can wrap play factories without breaking the OOP boundary on `@client/api` inside `modules/`.
* Neutral, because the registry's placement follows its most demanding member, the game adapter, not the three adapters that need no `@client/api`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/training/routines/adapters/step-adapter.registry.test.ts` asserts that every step kind and seeded `GAME:<key>` resolves to an adapter. The plan names this test as the check on the adapter tables.

## Pros and Cons of the Options
### Registry under `modules/training/routines/`

* Bad, because one adapter must reach a play factory that imports `@client/api`, which `modules/` forbids.

### Registry under `lib/training/routines/adapters/` (chosen)

* Good, because `lib/` carries no `@client/api` restriction and sits beside the routine's other `*.data.ts` files.

## Evidence / More Information
Decided: 2026-09-20

* `docs/superpowers/plans/2026-09-18-routine-step-kind-generalisation.md` (Architecture, Global Constraints, Resolved judgement calls § 5.1): rebuilt Context, Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/specs/2026-09-18-routine-step-kind-generalisation-design.md` (§ 5.1): rebuilt Context and Considered Options; the spec proposed the `modules/` location.
* Commit `38947f7a` (PR #534, 2026-09-20; adds the `decisions/frontend/architecture.md` row).
