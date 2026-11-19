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
<!-- backfill: pending -->

# The routine player's step-adapter registry is a `lib/` extension point, not a `modules/` one

## Context and Problem Statement
A `GAME:*` adapter's `open` wraps that game's own play-data factory (`tuodPlay`, `scoreTrainingPlay`, `oneTwentyOnePlay`) so the step's completion advances the routine (`gameStep()`, `game-step.data.ts`) — and every one of those play factories imports `@client/api`. `07-Frontend/04-Modules-And-OOP.md`'s OOP boundary forbids `@client/api` inside anything under `modules/`, so a class-based registry there was never an option once a single adapter needed to reach a play factory; object literals under `lib/`, alongside the routine's other `*.data.ts` files, carry no such restriction. This is the same reasoning `04-Modules-And-OOP.md`'s "Prefer functions" rows already use for `modules/training/routines/*.module.ts` and `modules/stats/*.module.ts` — a family that is a unit gets one home, chosen by what it must import, not by whether classes exist in it.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`app/src/lib/training/routines/adapters/` holds one `StepAdapter` object literal per routine step kind (`WARM_UP`/`SWITCHING`/`DOUBLE_PATTERN`/`` `GAME:${rulesetVersionKey}` ``), collected in a `STEP_ADAPTERS` map and resolved by `resolveStepAdapter`/`stepAdapterKey`. `routine-play.data.ts` holds one `adapter` field and delegates every per-kind branch (open/facts/completesOwnSession/summarise/close) to whichever adapter `stepAdapterKey()` resolves, replacing four separate engine-typed fields and inline kind-branching. The registry lives under `lib/`, not `modules/`.".

### Consequences
`StepAdapter` is an interface, not a base class — every concrete adapter is a plain object (three are literals; `game.adapter.ts`'s `gameAdapter()` is a factory function returning one), so nothing here is "classes outside `modules/`", which the OOP boundary still forbids. The three non-game adapters hold no reference to `@client/api` at all — only `game.adapter.ts` does, through the play factories it wraps — so the registry's placement is set by its most demanding member, not its average one. A fifth step kind that needed no `@client/api` access at all would still belong here, for the family's sake, not split out to `modules/`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-20
