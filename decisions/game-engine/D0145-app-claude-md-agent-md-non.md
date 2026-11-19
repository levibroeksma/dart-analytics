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

# `app/CLAUDE.md`/`AGENT.md` Non-Negotiable Rules gain a "Game engines" rule

## Context and Problem Statement
The contract lived only in code and Pattern 18 prose; a sixth engine would have had precedent to imitate but no rule text to check against (review P2)

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`app/CLAUDE.md`/`AGENT.md` Non-Negotiable Rules gain a "Game engines" rule: every `*.engine.module.ts` implements the `GameEngine` contract (Pattern 18) — validated config snapshot bound to a `rulesetVersionKey`, owned `EngineFacts` log, minted `clientKey`/`sequence`/`completedAt`, `create(config, prior)` rehydration, pure `wouldComplete(input)`, `undo()` an exact inverse of `record()` over `facts()` including any opened stage — and never stores a derivable value; `scripts/check-game-engines.sh` must pass", because The contract lived only in code and Pattern 18 prose; a sixth engine would have had precedent to imitate but no rule text to check against (review P2).

### Consequences
* Good, because a sixth engine gets rule text to check against rather than only precedent in code and Pattern 18 prose.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-game-engines.sh` must pass; it runs as a step in `.github/workflows/quality.yml`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-26

* Commit `cd464a3f` (2026-07-26; adds D145-D148): rebuilt Consequences and Confirmation. Its message calls the rule an "app/CLAUDE.md GameEngine-contract rule (Pattern 18)".
