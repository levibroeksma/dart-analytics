---
id: D0202
status: accepted
date: 2026-08-09
origin: contemporaneous
original-date:
tags: [frontend/astro]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Alpine binds at a reactive mirror of the board controller, never at the controller

## Context and Problem Statement
`boardInput()` is a pure module that keeps `active`, `point` and `placement` in closure variables behind getters. Alpine's reactivity records reads of properties on its own proxies, so a getter over a closure variable is not a tracked dependency: `move()` updated state nothing could depend on. The magnifier appeared on press and then froze — right position, permanently stale content — for the whole drag, which is the exact defect this decision exists to prevent recurring.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`boardInputData()` publishes a plain `board: BoardView` field and re-copies the controller's readings onto it after every `press`/`move`/`release`/`cancel`/`commitUnseen` call. `BoardMagnifier.astro` binds exclusively at `board`; no view may dereference `input`.".

### Consequences
Every new controller call site must sync, or the view silently stops updating again; the sync is centralised in one `syncBoard()` for that reason. The failure is invisible to Vitest, which never runs Alpine's reactivity — `tests/lib/game/board-input.data.test.ts` guards the mirror's freshness (a snapshot re-read after `move` must differ), and the browser-level behaviour was confirmed by driving the real Alpine build with a pointer drag. The same trap applies to any future pure controller handed to a template.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-09
