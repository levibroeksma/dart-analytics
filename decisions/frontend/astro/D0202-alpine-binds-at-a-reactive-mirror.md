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

# Alpine binds at a reactive mirror of the board controller, never at the controller

## Context and Problem Statement
`boardInput()` is a pure module that keeps `active`, `point` and `placement` in closure variables behind getters. Alpine's reactivity records reads of properties on its own proxies, so a getter over a closure variable is not a tracked dependency: `move()` updated state nothing could depend on. The magnifier appeared on press and then froze — right position, permanently stale content — for the whole drag, which is the exact defect this decision exists to prevent recurring.
The decision came out of the owner's first play-through of the visual board, which showed three defects. The first was the frozen magnifier: `BoardMagnifier.astro` bound at the pure controller.

## Decision Drivers
* Alpine tracks reads on its own proxies, so getters over closure variables are not dependencies.
* The frozen-magnifier defect must not recur.

## Considered Options
* Publish a plain `board: BoardView` field and bind views there, re-copied after every controller call (chosen).
* Bind views at the pure controller's getters, the shipped behaviour that froze the magnifier.

## Decision Outcome
Chosen option: "`boardInputData()` publishes a plain `board: BoardView` field and re-copies the controller's readings onto it after every `press`/`move`/`release`/`cancel`/`commitUnseen` call. `BoardMagnifier.astro` binds exclusively at `board`; no view may dereference `input`.".

### Consequences
Every new controller call site must sync, or the view silently stops updating again; the sync is centralised in one `syncBoard()` for that reason. The failure is invisible to Vitest, which never runs Alpine's reactivity — `tests/lib/game/board-input.data.test.ts` guards the mirror's freshness (a snapshot re-read after `move` must differ), and the browser-level behaviour was confirmed by driving the real Alpine build with a pointer drag. The same trap applies to any future pure controller handed to a template.
* Good, because the magnifier follows the drag: both its read and its inner transform track.
* Bad, because every new controller call site must sync the mirror, or the view silently stops updating.
* Bad, because Vitest never runs Alpine's reactivity, so a stale view is invisible to unit tests.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/board-input.data.test.ts` has a test that the view snapshot refreshes on `move`, so the magnifier does not freeze at the press position. The commit also drove the real Alpine build with a pointer drag in Chromium.

## Pros and Cons of the Options
### Reactive `board` mirror
* Good, because Alpine tracks plain properties on its own proxy.
* Bad, because call sites must sync it.

### Bind at the controller
* Bad, because getters over closure variables are not tracked, and the view freezes.

## Evidence / More Information
Decided: 2026-08-09

* Commit `8f6cd566` (2026-08-09; adds D201 and D202 in `decisions/frontend/astro.md`): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons. No spec or plan names this record.
* Related: D199 (press-drag-release mechanism) and D201 (visual session shows the board), recorded in the same commit.
