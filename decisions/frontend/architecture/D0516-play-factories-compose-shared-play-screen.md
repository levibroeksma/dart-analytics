---
id: D0516
status: accepted
date: 2026-10-31
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Play factories compose shared play-screen parts

## Context and Problem Statement
ten factories carried near-identical `init`/`commitDart`/`undoVisit`/bot-loop members; the clone groups were the largest family in the D513 baseline. Parts keep each factory's own members visible while the shared body lives once. Flags would rebuild the divergence inside one function.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "visual-board play factories (around-the-clock, baseball, bobs27, cricket, doubles-training, follow-the-leader, killer, shanghai, singles-training, tactics) spread shared parts from `app/src/lib/game/play-screen.data.ts` — `playScreenState`, `boardPlayActions`, `botVisualBoardData`, `playScreenActions`, `timedPlayData` — instead of re-declaring lifecycle members. Variation goes through separate parts, typed callbacks (`afterInit`) or later-declared overrides, never boolean flags. The factory-surface snapshot plus the page-bindings test guard the Alpine template contract.".

### Consequences
spread order is fixed (later keys override earlier), an overridden `init` calls through to the part's `init` or uses `afterInit`, and parts hold no getters. A change to a part is covered by the snapshot of every factory's key surface. The duplication baseline under D513 dropped by the clone groups that spanned these files.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-31
