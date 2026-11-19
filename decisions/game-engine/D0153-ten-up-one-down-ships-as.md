---
id: D0153
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, GameEngine, checkout, bust, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Ten Up One Down ships as the sixth engine on the `GameEngine` contract

## Context and Problem Statement
`TUOD_V1` was seeded with two presets but had no schema, engine or validator, so it listed in the preset picker and could not start a session (whole-branch review, Minor)

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Ten Up One Down ships as the sixth engine on the `GameEngine` contract: `TuodConfig` (`.strict()`, matching both seeded presets key-for-key), `TuodEngine` (RECREATIONAL + QUICK_SCORE, one `EXERCISE_BLOCK`, one turn per attempt carrying the checked-out target or `0`, ladder folded from those turns), and `tuodValidator`. Success requires the finishing dart to be a double, never a count of darts thrown at one; a bust is a failed attempt. V1 ships no ladder floor, so `record()` refuses a checkout claimed on a target below 2 rather than inventing one. The three quick-score validators' shared batch rules move to `services/rulesets/quick-score.validator.ts`", because `TUOD_V1` was seeded with two presets but had no schema, engine or validator, so it listed in the preset picker and could not start a session (whole-branch review, Minor).

### Consequences
* Good, because the shared batch rules of the three quick-score validators move to `services/rulesets/quick-score.validator.ts` (commit `42457a1d`: "shared quick-score validator rules extracted for 501 / Score Training").

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

* Commit `42457a1d` (2026-07-26; adds the sixth engine): rebuilt Consequences. Its message lists `TuodConfig`, `TuodEngine`, `tuodValidator`, the success rule and the missing ladder floor.
* Applied in: `docs/superpowers/specs/2026-08-20-tuod-frontend-design.md`, `docs/superpowers/specs/2026-08-20-tuod-analytics-design.md`.
