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

# Trivia tools are plain OOP modules outside the GameEngine contract, not a new game type

## Context and Problem Statement
`docs/architecture/09-Training/02-Trivia.md` already resolved the shape `docs/game-rules/training/trivia/README.md` originally flagged as open ("no existing architecture pipeline covers this yet") for the family's first tool, Checkout Trivia — this decision extends that same precedent to Quick Subtract and records the one place it needed a carve-out: Checkout Trivia has no class, so it colocates fully in `lib/training/trivia/`, while Quick Subtract's `QuickSubtractGame` is a class and the OOP boundary rule takes it to `modules/training/trivia/` instead. The 26-file game-wiring pipeline (`09-Adding-A-Game.md`) is built for persisted, `game_types`-backed sessions; Quick Subtract is ephemeral, client-only practice with no persisted session, so routing it through that pipeline would invent a `game_types` row, a ruleset version, and a server-side validator for state nothing ever persists.

## Decision Drivers
* The 26-file game-wiring pipeline suits persisted, `game_types`-backed sessions, and Quick Subtract is ephemeral, client-only practice.
* Routing it through that pipeline would invent a `game_types` row, a ruleset version and a server-side validator for state nothing persists.
* `QuickSubtractGame` is a class, and the OOP-boundary rule puts every class-based module under `src/modules/`, regardless of route count.

## Considered Options
* Wire Quick Subtract through the game pipeline as a new game type with a `GameEngine`.
* Keep it outside the pipeline as a plain OOP module with its own contract (chosen).
* Colocate the class under `lib/trivia/`, as Checkout Trivia does for its plain functions.

## Decision Outcome
Chosen option: "A non-dartboard practice tool (Quick Subtract, the second tool under `docs/game-rules/training/trivia/` after Checkout Trivia) lives entirely outside the `game_types` model: no `game_types` row, no `rulesetVersionKey`, no `services/rulesets/registry.ts` validator, no `check-game-engines.sh` obligations. Its OOP piece (`modules/training/trivia/quick-subtract.module.ts`) stays under `src/modules/` per the OOP boundary (D85) but implements its own contract, not `GameEngine` — `07-Frontend/04-Modules-And-OOP.md`'s OOP Boundary table gains a `modules/training/trivia/*.module.ts` row, `02-Folder-Structure.md` gains a matching carve-out row (a single-route class still warrants `modules/`, unlike single-route plain functions), and a new "Non-Game Client Tools" section states the exception explicitly. `modules/ui/segment-timer.module.ts` gains an additive `direction: 'countdown' | 'countup'` option (default `'countdown'`) and a `getElapsed()` method so the same timer can measure elapsed time in a fixed-round session — the three existing countdown consumers (Score Training, TUOD, 121) pass no `direction` and are unaffected.".

### Consequences
`docs/superpowers/specs/2026-09-09-quick-subtract-trivia-design.md` names the deferred-persistence fact shape a future task would need (one fact per round, no stage/seat concept) so a later persistence task isn't boxed in by this decision. The next trivia tool follows this same precedent — and its class-vs-plain-function carve-out — rather than re-deciding it.

* Good, because Quick Subtract needs no `game_types` row, ruleset version or registry validator for state nothing persists.
* Neutral, because `segment-timer.module.ts` gains an additive `direction` option and `getElapsed()`, and the 3 existing countdown consumers pass no `direction` and are unaffected.

### Confidence
Rationale unknown — no source found.

### Revisit When
Persistence is ever added to Quick Subtract. The spec then has `QuickSubtractGame` gain a `facts()` getter returning one fact per round.

### Confirmation
The spec lists unit tests for `quick-subtract.module`, `dart-scores.module` and `quick-subtract-play.data`, plus new countup cases in `segment-timer.module.test.ts` with the existing countdown cases unchanged.

## Pros and Cons of the Options
### Wire through the game pipeline
* Bad, because it invents a `game_types` row, a ruleset version and a server-side validator for state nothing persists.

### Plain OOP module outside the pipeline
* Good, because no `game_types` row, `rulesetVersionKey`, registry validator or `check-game-engines.sh` obligation exists for an ephemeral tool.
* Good, because the class stays under `src/modules/`, as the OOP boundary (D85) requires.

### Colocate the class under `lib/trivia/`
* Bad, because the spec places the OOP-boundary rule above the "2+ routes" folder warrant, which governs plain-function code only.

## Evidence / More Information
Decided: 2026-09-09

* `docs/superpowers/specs/2026-09-09-quick-subtract-trivia-design.md` (Relationship to the Trivia architecture doc, Scope decisions, Architecture, Testing, Documentation impact): rebuilt Decision Drivers, Considered Options, Pros and Cons, Revisit When and Confirmation.
* `docs/superpowers/plans/2026-09-09-quick-subtract-trivia.md` (Step 4, "Add decision D261"): rebuilt the decision text.
* Commit `db4dd4b9` (PR #254, adds the D261 row): confirmed the decision text.
* Applied in: `docs/superpowers/specs/2026-09-11-training-page-and-balanced-training-design.md` (keeps D261's precedent after the route move), `docs/superpowers/plans/2026-09-17-p1-training-taxonomy.md` (drafts a decision that refines D261).
