---
id: D0510
status: accepted
date: 2026-10-30
origin: contemporaneous
original-date:
tags: [game-engine, undo, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Follow the Leader V1 is playable: two-seat floor and cap, Stop and Keep/Set play UI, results, card

## Context and Problem Statement
the rules file seats two for V1; a finished game is immutable once saved, so undo stops at the end as it does for every seated board game.

## Decision Drivers
* V1 seats exactly 2, as Killer: setup and the play screen seat two; kernel and tests cover 3-4 seats (spec F4, marked as needing confirmation).
* V1 has no DartBot seat and no career stats page (spec F6).
* A leader's keep is offered by an auto-prompt only when a keep is legal; Keep skips the dart pad and Set opens it (spec F1).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`SEAT_FLOORS` and `SEAT_CAPS` in `session-seats.service.ts` both hold `FOLLOW_THE_LEADER_V1` at 2. A `followTheLeader` summarizer in `session-progress.module.ts` shows `1v1 · Follow the Leader` with the active seat's lives (`LIVES`), and `FOLLOW_THE_LEADER_V1` joins `HEATMAP_ONLY_LAYOUTS`. Setup (`follow-the-leader-setup.data.ts`, `FollowTheLeaderSetupForm`) is the preset controller with locked rows and no per-seat options; `startBlockedExpr="!canStart()"` holds Start until a guest is seated, and the first thrower is the seat order. Play (`follow-the-leader-play.data.ts`, `FollowTheLeaderRecreationalInput`) shows the exact-bed target, a leader badge and the off-hand notice on the opening dart; after a match the pad offers **Stop** (the shell's STOP visit action), and at a leader's turn with `keepAllowed` a **Keep / Set** prompt replaces the pad (Keep writes the KEEP action, Set reveals the pad). Undo is refused once the game is finished, as in Killer. Results (`follow-the-leader-results.ts`, `FollowTheLeaderResults`) show lives left per seat with the winner and the out order. The card sits in `CLASSICS` as "Follow the Leader" / "Hit the bed they set, or lose a life."", because the rules file seats two for V1; a finished game is immutable once saved, so undo stops at the end as it does for every seated board game.

### Consequences
no migration. `follow-the-leader.md` is now `V1 (shipped 2026-10-30)`. Three or more seats, DartBot and the other deferred rows stay deferred. Spec: `docs/superpowers/specs/2026-10-29-follow-the-leader-design.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/services/session-seats.service.test.ts` pins the 2-seat floor, `app/tests/lib/game/follow-the-leader-play.data.test.ts` covers Stop, Keep/Set and their undo, and `follow-the-leader-setup.data.test.ts` and `follow-the-leader-results.test.ts` cover setup and results.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-30

* `docs/superpowers/specs/2026-10-29-follow-the-leader-design.md` (§ 1 decisions F1, F4, F6): rebuilt Decision Drivers.
* `docs/superpowers/plans/2026-10-29-follow-the-leader.md` (PR 2 tasks): rebuilt Confirmation.
* Commit `92ba6663` (2026-10-30): adds the original ledger block with the playable UI.
