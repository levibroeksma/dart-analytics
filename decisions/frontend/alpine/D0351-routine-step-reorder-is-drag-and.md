---
id: D0351
status: accepted
date: 2026-09-21
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0337
superseded-by:
---

# Routine step reorder is drag-and-drop via `@alpinejs/sort`; the move buttons are removed

## Context and Problem Statement
the builder moved into `RoutineFormModal.astro`, where horizontal room is scarcer than on the standalone page D337 was written for — two square buttons per row crowded the exercise name enough to truncate it. D337 left the package "a deferred option, not rejected outright — a future UI pass could still adopt it"; this is that pass. The 12-step cap that made drag's speed advantage marginal still holds, so the argument here is layout, not speed.

## Decision Drivers
* The builder lives in `RoutineFormModal.astro`, where horizontal room is scarcer than on the standalone page.
* Two square buttons per row truncate the exercise name.
* The 12-step cap still holds, so the argument is layout, not speed.

## Considered Options
* Keep the move-up and move-down button pair (the D337 choice).
* Adopt `@alpinejs/sort` and drop the buttons.

## Decision Outcome
Chosen option: "`@alpinejs/sort` (with `@types/alpinejs__sort`, since the package ships no declarations) is added to `app/package.json` and registered in `app/src/lib/client/alpine/app.factory.ts`. `RoutineStepRow.astro` drops both move `IconBtn`s for a six-dot grip carrying `x-sort:handle`, and the builder's `<ol>` carries `x-sort="moveStep($item, $position)"`. `routineBuilder()`'s `moveUp`/`moveDown` are replaced by one `moveStep(key, position)`; `BuilderStep` gains a draft-local `key` (`crypto.randomUUID()`) so `x-for` keys survive a drag and a routine holding the same exercise twice keeps the two rows distinct.".

### Consequences
D337's accessibility concern is now owed and not yet paid — a pointer drag is the only reorder affordance, which strands keyboard and screen-reader users. Captured as discovered work rather than fixed in this pass; `x-sort` supports a programmatic handle, so a keyboard affordance is additive. `BuilderStep.key` is draft-local and never sent: `payload()` continues to map only `exerciseTemplateId`/`durationTypeKey`/`durationValue`, so the write contract (D306, refined by D321) is untouched.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The commit updates `app/tests/lib/training/routines/routine-builder.data.test.ts` alongside the `moveStep` change. The record sets no other check.

## Pros and Cons of the Options
### Keep the move buttons
* Bad, because two square buttons per row crowd the exercise name enough to truncate it in the modal.

### Drag via `@alpinejs/sort`
* Good, because the exercise name gets the button width back.
* Bad, because a pointer drag is the only reorder affordance, which strands keyboard and screen-reader users.

## Evidence / More Information
Decided: 2026-09-21
Supersedes: D337

* Commit `b043075e` (2026-09-21; message and the `decisions/frontend/alpine.md` row): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
