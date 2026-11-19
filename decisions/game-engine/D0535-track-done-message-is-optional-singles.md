---
id: D0535
status: accepted
date: 2026-11-08
origin: contemporaneous
original-date:
tags: [game-engine, scoring]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Track done message is optional; Singles Training refuses at the match level only

## Context and Problem Statement
#1243. The removed messages and the Singles seat branch were unreachable. A seeded random-play test pins that Singles never refuses a dart while the match is in progress (HARD/EXTREME ends the match at once and seats run in lockstep). Bob's 27 with three seats reaches the seat branch (an out seat keeps its turn while the match runs), which `bobs27.golden.test.ts` already pins.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`TrackRules.doneMessage` is optional; `applyTrackDart` throws it only when set. Target Scoring and Switching's Chain set none, since their seats never leave `IN_PROGRESS` and the exercise shell refuses a finished exercise first. Singles Training's `refusal` checks the match status alone. Bob's 27 and Shanghai keep `seatedRefusal`.".

### Consequences
`scoringTrackRules(config, onDart)` loses its message parameter. The other "never finishes" Track exercises (Hit Count, SwitchBlade, Doubles Lock, Halve-It) still set a message and could drop it the same way.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/singles-training.golden.test.ts` ("refusal order") drives seeded random play and expects no refusal while the match is in progress; `app/tests/modules/game/bobs27.golden.test.ts` pins the Bob's 27 seat branch.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-08
Supersedes: none. Narrows D528's `seatedRefusal` to Bob's 27 and Shanghai.

* Commit `1d387092` (#1243, #1280; adds the D535 row and the refusal-order test): rebuilt Confirmation.
