---
id: D0543
status: accepted
date: 2026-11-10
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, scoring, checkout, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The Visit points kernel gains `visitPoints`; Ace V1 is the first caller

## Context and Problem Statement
Visit-points spec V2: a rule lands with its first caller. Ace's points need the round's target, which the total-only `points` cannot see; one new setting stays inside the fit rule. The ruleset's open questions (uniform draw, repeats) take its proposed reading.

## Decision Drivers
* The kernel carries only what its shipped engines use; a rule lands with its first caller (visit-points spec V2).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`VisitPointsRules` is `points(visitTotal)` or `visitPoints(darts, visitIndex)`, never both. `visitPoints` scores a closed visit from its darts and the seat's zero-based visit index, for a game whose scoring varies by round; `voids` and `goal` still apply to its result. Ace V1 binds it: each round's target is `seededPoolDraw(drawSeed, 1-20 + bull (25), round)`, uniform with repeats, and a dart earns 1/2/3 by ring on a number, 4/6 on the bull's rings. The config carries `rounds` (3-12) and a `drawSeed` minted per game and sent as a config override, as Random Checkout's (D424). Equal highest totals are a `TIE`, the shared win.".

### Consequences
Existing callers set `points` and fold as before. Ace is a `PER_SEAT` `DartGameSpec` on the game shell, 2-4 seats, darts only. A dart's stored `score` is its board score; Ace points, round targets and totals are derived on read.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/engine-kernels.txt` lists `ace.engine.module.ts` as `VISIT_POINTS | KERNEL_BOUND`, checked by `scripts/check-engine-kernels.sh`. `app/tests/modules/game/ace.engine.module.test.ts` covers the round-target draw, which does not depend on earlier rounds.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-10

* `docs/superpowers/specs/2026-10-27-visit-points-kernel-design.md` (V2): rebuilt Decision Drivers.
* Commit `e8fa0075` (PR #1295, "ACE_V1 engine on the Visit points kernel (engine-only)"): adds the original ledger block.
