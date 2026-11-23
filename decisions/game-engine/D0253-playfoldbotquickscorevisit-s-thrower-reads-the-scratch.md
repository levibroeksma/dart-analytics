---
id: D0253
status: accepted
date: 2026-09-02
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, checkout, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `playFoldBotQuickScoreVisit`'s thrower reads the scratch engine's own live state, not a zero-arg closure

## Context and Problem Statement
`08-DartBot.md`'s Guiding Principle forbids the adapter or DartBot computing a score to re-target between darts; the scratch engine's own `state()` is the only place that number legitimately exists mid-visit under `QUICK_SCORE`. Every existing zero-arg thrower closure in `app/tests/lib/game/play-lifecycle.test.ts` (`() => TREBLE_TWENTY`) stays assignable to the widened one-parameter type — TypeScript permits a function declaring fewer parameters to satisfy a type expecting more — so no existing test needed editing; one new test (`app/tests/lib/game/play-lifecycle.test.ts`, "passes the scratch engine's own live state to throwDart before every dart") proves the scratch engine's state is actually threaded through and not just accepted syntactically.

## Decision Drivers
* `X01Strategy` needs the checkout route for the remaining score after each simulated dart. Under `QUICK_SCORE` the real engine hears about no dart mid-visit, so only the scratch engine knows that score (plan, Architecture).
* `modules/dartbot/*` may not import ruleset math, so the page adapter computes `checkoutPath` and the strategy never does (plan, Global Constraints).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "D252 predicted no change to the fold beyond its first live consumer's own conversion of `totalScore` into a ruleset-specific visit input. That held for the return type, but not for the `throwDart` parameter: `X01Strategy` needs the checkout route for whatever the remaining score actually is *after* each simulated dart, and under `QUICK_SCORE` the real engine is never told about a dart mid-visit — only the scratch engine `playFoldBotQuickScoreVisit` already builds knows it. So `throwDart` widens from `() => DartObservation` to `(state: TState) => DartObservation`, and the loop body changes from `throwDart()` to `throwDart(scratch.state())`. `TState` is already part of the function's existing generic signature, so no new type parameter or cast is needed — only the concrete factory (`fiveOhOneEngineFactory`, not the type-erased `getEngineFactory` registry) has to be passed in at the call site for `TState` to infer as `FiveOhOneState` rather than `unknown`.".

### Consequences
`BotQuickScoreThrower<TState>` is a new named type in `app/src/lib/game/types.ts`, replacing the inline `() => DartObservation` annotation `playFoldBotQuickScoreVisit` and its callers used. `five-oh-one-play.data.ts`'s `throwBotQuickScoreDart(state, botSeat, dartIndex)` is the first caller to read the widened parameter; any future `QUICK_SCORE` bot strategy that also needs to re-target mid-visit (121, Ten Up One Down) reads the same `state()` rather than inventing a second mechanism. Full plan: `docs/superpowers/plans/2026-09-02-dartbot-7-x01-strategy.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/play-lifecycle.test.ts` holds the test "passes the scratch engine's own live state to throwDart before every dart".

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-02

* `docs/superpowers/plans/2026-09-02-dartbot-7-x01-strategy.md` (Architecture, Global Constraints, Task 4): rebuilt Decision Drivers and Confirmation.
* Commit `252a035b` (2026-09-02; adds the D253 row): no section rebuilt.
