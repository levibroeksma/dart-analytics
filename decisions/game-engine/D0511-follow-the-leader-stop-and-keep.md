---
id: D0511
status: accepted
date: 2026-10-30
origin: contemporaneous
original-date:
tags: [game-engine, undo]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Follow the Leader: Stop and Keep/Set in both input modes, undo on the prompt

## Context and Problem Statement
the prompt and Stop lived only in the tap pad, which a VISUAL_BOARD session hides, so a board session could never stop or keep; the prompt also hid the pad's undo.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "The target banner, leader badge, off-hand notice and the Keep/Set prompt move from `FollowTheLeaderRecreationalInput` into `interfaces/FollowTheLeader.astro`, so a VISUAL_BOARD session shows them too; the prompt carries an undo key; a board session gets a Stop key in the board's bottom row (Undo / Bounce out / Stop), through a `BoardInputPanel` `actions` slot that `SeatedPlayScreen` forwards as `boardActions`. While the prompt shows, the tap pad and the board are hidden (`showTapPad()`, `showBoard()`, passed to `BoardInputPanel` through `SeatedPlayScreen`'s `boardShowExpr`) and `commitDart` records no dart. The pad's bottom row is a fixed BULL / MISS / STOP grid with STOP disabled until a match. The per-seat Target tile is dropped; the target is shared and shown in the subtitle and banner.", because the prompt and Stop lived only in the tap pad, which a VISUAL_BOARD session hides, so a board session could never stop or keep; the prompt also hid the pad's undo.

### Consequences
no migration; capabilities unchanged. Refines D510's play UI.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/follow-the-leader-play.data.test.ts` checks the Keep prompt and play data.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-30

* Commit `4bcca4c5` (2026-10-30; adds the D511 row): rebuilt Confirmation.
* `docs/superpowers/specs/2026-10-29-follow-the-leader-design.md` (F1 and F5 rows, Play row): defines Keep/Set and Stop as stored facts; no section rebuilt.
