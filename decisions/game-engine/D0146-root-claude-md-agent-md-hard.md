---
id: D0146
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain an engine-only task scope rule

## Context and Problem Statement
Two engines shipped keeping only a derived score and discarding the per-dart facts needed to persist them, and a third emitted an intention pair a schema CHECK rejects, none caught until the fifth PR's review (C1, C2, I1, I2)

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Root `CLAUDE.md`/`AGENT.md` Hard Invariants gain an engine-only task scope rule: the spec must name the capture/input mode, stage type, and `turns`/`darts` mapping — proving the state shape can be persisted — before implementation; deferring persistence is allowed, an unpersistable shape is not".

### Consequences
* Neutral, because the commit that adds D146 puts the rule in the root `CLAUDE.md` and `AGENT.md` Hard Invariants, with 3 rules from a game-engine PR review.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-26

* Commit `cd464a3f` (2026-07-26; adds D145-D148 and the three root rules): rebuilt Consequences.
