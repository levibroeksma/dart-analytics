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
<!-- backfill: pending -->

# Follow the Leader V1 is playable: two-seat floor and cap, Stop and Keep/Set play UI, results, card

## Context and Problem Statement
the rules file seats two for V1; a finished game is immutable once saved, so undo stops at the end as it does for every seated board game.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`SEAT_FLOORS` and `SEAT_CAPS` in `session-seats.service.ts` both hold `FOLLOW_THE_LEADER_V1` at 2. A `followTheLeader` summarizer in `session-progress.module.ts` shows `1v1 · Follow the Leader` with the active seat's lives (`LIVES`), and `FOLLOW_THE_LEADER_V1` joins `HEATMAP_ONLY_LAYOUTS`. Setup (`follow-the-leader-setup.data.ts`, `FollowTheLeaderSetupForm`) is the preset controller with locked rows and no per-seat options; `startBlockedExpr="!canStart()"` holds Start until a guest is seated, and the first thrower is the seat order. Play (`follow-the-leader-play.data.ts`, `FollowTheLeaderRecreationalInput`) shows the exact-bed target, a leader badge and the off-hand notice on the opening dart; after a match the pad offers **Stop** (the shell's STOP visit action), and at a leader's turn with `keepAllowed` a **Keep / Set** prompt replaces the pad (Keep writes the KEEP action, Set reveals the pad). Undo is refused once the game is finished, as in Killer. Results (`follow-the-leader-results.ts`, `FollowTheLeaderResults`) show lives left per seat with the winner and the out order. The card sits in `CLASSICS` as "Follow the Leader" / "Hit the bed they set, or lose a life."", because the rules file seats two for V1; a finished game is immutable once saved, so undo stops at the end as it does for every seated board game.

### Consequences
no migration. `follow-the-leader.md` is now `V1 (shipped 2026-10-30)`. Three or more seats, DartBot and the other deferred rows stay deferred. Spec: `docs/superpowers/specs/2026-10-29-follow-the-leader-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-30
