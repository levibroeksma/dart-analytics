---
id: D0145
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, GameEngine, undo]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `app/CLAUDE.md`/`AGENT.md` Non-Negotiable Rules gain a "Game engines" rule

## Context and Problem Statement
The contract lived only in code and Pattern 18 prose; a sixth engine would have had precedent to imitate but no rule text to check against (review P2)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`app/CLAUDE.md`/`AGENT.md` Non-Negotiable Rules gain a "Game engines" rule: every `*.engine.module.ts` implements the `GameEngine` contract (Pattern 18) — validated config snapshot bound to a `rulesetVersionKey`, owned `EngineFacts` log, minted `clientKey`/`sequence`/`completedAt`, `create(config, prior)` rehydration, pure `wouldComplete(input)`, `undo()` an exact inverse of `record()` over `facts()` including any opened stage — and never stores a derivable value; `scripts/check-game-engines.sh` must pass", because The contract lived only in code and Pattern 18 prose; a sixth engine would have had precedent to imitate but no rule text to check against (review P2).

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-26
