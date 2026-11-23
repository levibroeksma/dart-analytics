---
id: D0422
status: accepted
date: 2026-10-06
origin: contemporaneous
original-date:
tags: [game-engine, engine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Solo Tactics is a close-out drill; dual-purpose is an auto rule until Multiplayer

## Context and Problem Statement
with no points the player choice never beats the auto rule, so storing it buys nothing until Multiplayer.

## Decision Drivers
* A solo run has no points, no win or loss and no opponent, so the rules file's open question on a solo win condition resolves to none.
* A double or treble on 15-20 must mark something useful in V1, with the player choice deferred to Multiplayer.
* The rule is derived from dart facts alone, so V1 needs no migration.

## Considered Options
* Store a player choice for dual-purpose darts in V1.
* Apply an auto rule: a double or treble marks its number while open, else its category (chosen).

## Decision Outcome
Chosen option: "`TACTICS` / `TACTICS_V1` (seed `0034`) ships solo only, with no win condition, as Cricket (D421). Objectives 20–15, Bull, Doubles, Triples are an engine constant. A double/treble on 15–20 marks its number while open, else the Doubles/Triples category; a double/treble on 1–14 marks the category; the bull never feeds D/T. Cap 3 per objective; overflow is discarded. All derived from dart facts — no migration, no stored choice.", because with no points the player choice never beats the auto rule, so storing it buys nothing until Multiplayer.

### Consequences
the player choice, multiplayer, points and a Tactics stats view are a later version. Rules: `docs/game-rules/rulesets/tactics.md`. Spec: `docs/superpowers/specs/2026-10-06-tactics-v1-design.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/tactics.engine.module.test.ts` and `app/tests/modules/game/tactics.golden.test.ts` check the engine. The spec lists the mark table and the auto rule among the engine tests.

## Pros and Cons of the Options
### Store a player choice
* Bad, because with no points the choice never beats the auto rule, so storing it buys nothing until Multiplayer.

### Auto rule
* Good, because an open number takes 2-3 marks from the dart and a category takes 1, so the rule is never worse than the choice.
* Good, because Slop lets any other double or treble feed the category.

## Evidence / More Information
Decided: 2026-10-06

* `docs/superpowers/specs/2026-10-06-tactics-v1-design.md` (§ 1, Testing): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
* Commit `055ed6d5` (2026-10-06; adds the D422 row): confirmed the dual-purpose resolution.
* Applied in: `docs/superpowers/specs/2026-10-23-tactics-v2-design.md`, `docs/superpowers/plans/2026-10-06-tactics-v1.md`.
