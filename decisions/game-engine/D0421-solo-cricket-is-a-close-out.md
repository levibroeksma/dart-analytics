---
id: D0421
status: accepted
date: 2026-10-06
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Solo Cricket is a close-out drill with no win condition

## Context and Problem Statement
with one seat there is no opponent to own a number against, so points, dead numbers and the score-compare win have nothing to act on (`docs/game-rules/rulesets/cricket.md`). Fewest darts to close out is the standard solo Cricket measure and a pure fold of dart facts.

## Decision Drivers
* A solo run has no win condition: the rules file's open question resolves to none, and the result is a measure, not a verdict.
* The engine is seat-aware from day one, so multiplayer adds seating and scoring instead of a rewrite.

## Considered Options
* Give solo Cricket points, dead numbers and a score-compare win.
* Ship a close-out drill with no win condition (chosen).

## Decision Outcome
Chosen option: "`CRICKET` / `CRICKET_V1` (seed `0033`) ships solo only. Objectives 20–15 + Bull are an engine constant. A dart adds marks (single 1, double 2, treble 3; outer bull 1, inner bull 2), capped at 3 per objective; overflow is discarded. The dart that closes the seventh objective ends the run immediately, mid-visit if need be. The result is darts thrown, MPR (capped marks ÷ darts × 3) and darts to close per objective — all derived, none stored. Darts carry no intent. The engine is seat-aware with one seat, so multiplayer adds seating and points, not a rewrite.".

### Consequences
multiplayer, points and Cut-throat are a new ruleset version. A Cricket trend section needs a `v_cricket_*` view and a migration. Rules: `docs/game-rules/rulesets/cricket.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/cricket.engine.module.test.ts` and `app/tests/modules/game/cricket.golden.test.ts` check the engine.

## Pros and Cons of the Options
### Points, dead numbers and a score-compare win
* Bad, because with one seat there is no opponent to own a number against, so these rules have nothing to act on.

### Close-out drill
* Good, because fewest darts to close out is the standard solo Cricket measure and a pure fold of dart facts.
* Good, because a seat-aware engine with one seat lets multiplayer add seating and points without a rewrite.

## Evidence / More Information
Decided: 2026-10-06

* `docs/superpowers/specs/2026-10-06-cricket-v1-design.md` (§ 1, § 3): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* Commit `0f1ef625` (2026-10-06; adds the D421 row and amends the spec): confirmed the solo-win resolution.
* Applied in: `docs/superpowers/specs/2026-10-06-tactics-v1-design.md`, `docs/superpowers/specs/2026-10-24-cricket-v2-design.md`.
