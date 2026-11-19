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
<!-- backfill: pending -->

# Follow the Leader: Stop and Keep/Set in both input modes, undo on the prompt

## Context and Problem Statement
the prompt and Stop lived only in the tap pad, which a VISUAL_BOARD session hides, so a board session could never stop or keep; the prompt also hid the pad's undo.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "The target banner, leader badge, off-hand notice and the Keep/Set prompt move from `FollowTheLeaderRecreationalInput` into `interfaces/FollowTheLeader.astro`, so a VISUAL_BOARD session shows them too; the prompt carries an undo key; a board session gets a Stop key in the board's bottom row (Undo / Bounce out / Stop), through a `BoardInputPanel` `actions` slot that `SeatedPlayScreen` forwards as `boardActions`. While the prompt shows, the tap pad and the board are hidden (`showTapPad()`, `showBoard()`, passed to `BoardInputPanel` through `SeatedPlayScreen`'s `boardShowExpr`) and `commitDart` records no dart. The pad's bottom row is a fixed BULL / MISS / STOP grid with STOP disabled until a match. The per-seat Target tile is dropped; the target is shared and shown in the subtitle and banner.", because the prompt and Stop lived only in the tap pad, which a VISUAL_BOARD session hides, so a board session could never stop or keep; the prompt also hid the pad's undo.

### Consequences
no migration; capabilities unchanged. Refines D510's play UI.

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
