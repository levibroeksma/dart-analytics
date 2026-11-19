---
id: D0465
status: accepted
date: 2026-10-17
origin: contemporaneous
original-date:
tags: [game-engine, 501, Score Training, undo, leg, visit, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# QUICK_SCORE bot darts index by visit, not by dart

## Context and Problem Statement
`QUICK_SCORE` turns persist `darts: []`, so a dart count stayed 0 and every bot visit replayed draws 0–2 — the same landing every visit, a bot stuck on one double for a whole leg. A turn count is still derived from `(seed, facts)`, so undo re-throws identically.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "under `QUICK_SCORE`, the bot's next `dartIndex` is its prior turn count × darts per visit (`botQuickScoreDartIndex`, `app/src/lib/game/play-bot-seat.ts`), used by 501, 121, TUOD and Score Training. `VISUAL_BOARD` keeps `botDartIndex`'s dart count.".

### Consequences
each `QUICK_SCORE` visit owns a fixed three-index block; a visit ended early leaves its unused indices unspent. Stored `QUICK_SCORE` sessions persist no darts, so no replay changes. `08-DartBot.md` §Determinism and Replay names both paths.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-17

* Commit `a86e8657` (2026-10-17): adds the original ledger block and the fix; its message names the bug (`botDartIndex` stayed 0 for `darts: []` turns) and the four callers. No section rebuilt.
