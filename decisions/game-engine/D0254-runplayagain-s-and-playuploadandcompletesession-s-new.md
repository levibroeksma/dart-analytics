---
id: D0254
status: accepted
date: 2026-09-03
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, 501, Score Training]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `runPlayAgain`'s and `playUploadAndCompleteSession`'s new optional callbacks take no context parameter; callers close over their own `this`

## Context and Problem Statement
`onAbandoned`, added one task earlier in the same plan for `playAbandonAndExit`, already proved this shape works and needs no cast — `playAbandonAndExit(this, () => this.timer?.stop())` compiles cleanly because `this` inside the arrow keeps its full concrete type. Widening the two newer functions' callbacks to accept a parameter instead would either require a cast at every one of the 7 new call sites (501/121/Score Training/TUOD × 1-2 callbacks each) or a second, wider generic type parameter threaded through `runPlayAgain`/`playUploadAndCompleteSession` purely to type one optional callback — both more machinery than the problem needs, when the closure the caller already has access to solves it for free. Full plan: `docs/superpowers/plans/2026-09-03-play-data-lifecycle-dedup.md`.

## Decision Drivers
* The plan's drafted `(context) => …` callback shape does not type-check against the generic `PlayLifecycleContext` (commit `d9caddd8` message).
* The callbacks read and write fields that only each ruleset's concrete `*PlayContext` declares (the Decision Outcome row added by commit `d9caddd8`).

## Considered Options
* Callbacks take a `context` parameter typed to the generic `PlayLifecycleContext`, as the plan drafted (plan, Task 3 produces line).
* Callbacks take a `context` parameter, with a cast at each call site or a second generic type parameter (row added by commit `d9caddd8`).
* Context-free callbacks that close over the caller's `this` (chosen).

## Decision Outcome
Chosen option: "Extending `runPlayAgain` with `resetLocalState`/`afterEngineReady` and `playUploadAndCompleteSession` with `resolveFinalState` (so 501/121/Score Training/TUOD's own `playAgain`/`uploadAndCompleteSession` could adopt them) needed each callback to read and write fields these 4 rulesets each declare on their own concrete `*PlayContext` type (`pendingCheckoutScore`, `timer`, `scoreInput`, …) — none of which exist on the generic `PlayLifecycleContext<TConfig, TEngine, TResults>` the shared functions are written against. Typing a callback parameter as `(context: PlayLifecycleContext<...>) => void` erases those fields at the call site — TypeScript contextually types the parameter to the generic interface, not to the wider concrete type the caller actually passed as `context` — so the plan that specified this extraction drafted exactly that shape and it does not type-check. The functions instead take context-free callbacks (`resetLocalState?: () => void`, `afterEngineReady?: (engine: TEngine) => void`, and `playAbandonAndExit`'s pre-existing `onAbandoned?: () => void` from Task 2 of the same plan) — every call site is a method on the concrete `*PlayContext` already, so its own arrow function closes over `this` (typed to the concrete class) instead of receiving a parameter typed to the generic base.".

### Consequences
any future ruleset adopting `runPlayAgain`'s `resetLocalState`/`afterEngineReady` or `playUploadAndCompleteSession`'s `resolveFinalState` follows the same closure-over-`this` shape, not a passed-context parameter — a future contributor reaching for `(context) => …` here should expect the same type error this decision worked around, not assume the plan's original draft was ever viable. `playAbandonAndExit`'s `onAbandoned` is unchanged (it already had this shape); no other `play-lifecycle.ts` export was touched.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`npm run check` (`astro check`) type-checks the callback signatures in `app/src/lib/game/play-lifecycle.ts`: `resetLocalState?: () => void`, `afterEngineReady?: (engine: TEngine) => void` and `resolveFinalState`. A `(context) => …` callback that erases the concrete type fails there.

## Pros and Cons of the Options
### Callbacks take a generic `context` parameter
* Bad, because the plan's draft of this shape does not type-check (commit `d9caddd8` message).

### Context parameter with a cast or a second generic
* Bad, because it needs more machinery than the problem needs: a cast at each of the 7 new call sites, or a second generic threaded through the shared functions (row added by commit `d9caddd8`).

### Context-free callbacks that close over `this`
* Good, because `this` inside the arrow keeps its full concrete type, so no cast is needed (row added by commit `d9caddd8`).

## Evidence / More Information
Decided: 2026-09-03

* Commit `d9caddd8` (2026-09-03; adds the D254 row to `decisions/game-engine.md`): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-09-03-play-data-lifecycle-dedup.md` (Task 2 and Task 3 interface lines): rebuilt Considered Options.
* `docs/superpowers/specs/2026-09-03-play-data-lifecycle-dedup-design.md` (Approach): names the generic-extraction shape the callbacks sit in; no section rebuilt.
* `app/package.json` (`check` script): rebuilt Confirmation.
