---
id: D0261
status: accepted
date: 2026-09-09
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

# Trivia tools are plain OOP modules outside the GameEngine contract, not a new game type

## Context and Problem Statement
`docs/architecture/09-Training/02-Trivia.md` already resolved the shape `docs/game-rules/training/trivia/README.md` originally flagged as open ("no existing architecture pipeline covers this yet") for the family's first tool, Checkout Trivia — this decision extends that same precedent to Quick Subtract and records the one place it needed a carve-out: Checkout Trivia has no class, so it colocates fully in `lib/training/trivia/`, while Quick Subtract's `QuickSubtractGame` is a class and the OOP boundary rule takes it to `modules/training/trivia/` instead. The 26-file game-wiring pipeline (`09-Adding-A-Game.md`) is built for persisted, `game_types`-backed sessions; Quick Subtract is ephemeral, client-only practice with no persisted session, so routing it through that pipeline would invent a `game_types` row, a ruleset version, and a server-side validator for state nothing ever persists.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "A non-dartboard practice tool (Quick Subtract, the second tool under `docs/game-rules/training/trivia/` after Checkout Trivia) lives entirely outside the `game_types` model: no `game_types` row, no `rulesetVersionKey`, no `services/rulesets/registry.ts` validator, no `check-game-engines.sh` obligations. Its OOP piece (`modules/training/trivia/quick-subtract.module.ts`) stays under `src/modules/` per the OOP boundary (D85) but implements its own contract, not `GameEngine` — `07-Frontend/04-Modules-And-OOP.md`'s OOP Boundary table gains a `modules/training/trivia/*.module.ts` row, `02-Folder-Structure.md` gains a matching carve-out row (a single-route class still warrants `modules/`, unlike single-route plain functions), and a new "Non-Game Client Tools" section states the exception explicitly. `modules/ui/segment-timer.module.ts` gains an additive `direction: 'countdown' | 'countup'` option (default `'countdown'`) and a `getElapsed()` method so the same timer can measure elapsed time in a fixed-round session — the three existing countdown consumers (Score Training, TUOD, 121) pass no `direction` and are unaffected.".

### Consequences
`docs/superpowers/specs/2026-09-09-quick-subtract-trivia-design.md` names the deferred-persistence fact shape a future task would need (one fact per round, no stage/seat concept) so a later persistence task isn't boxed in by this decision. The next trivia tool follows this same precedent — and its class-vs-plain-function carve-out — rather than re-deciding it.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-09
