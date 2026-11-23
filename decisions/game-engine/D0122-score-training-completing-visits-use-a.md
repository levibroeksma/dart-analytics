---
id: D0122
status: accepted
date: 2026-07-21
origin: contemporaneous
original-date:
tags: [game-engine, engine, Score Training, undo]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Score Training completing visits use a client-side `pendingFinishScore` + finish-confirm

## Context and Problem Statement
Lets players correct the last score before irreversible completion upload

## Decision Drivers
* The left keypad control showed an undo icon but cleared typed digits, so players could not correct a mistaken submitted visit.
* A completing visit flipped straight to the results modal and upload, with no chance to fix the last score.
* Turns for an active session live only in `$store.game.turns` until batch upload, so the fix can stay client-only.

## Considered Options
* Pending-completion gate in the play factory (chosen).
* Record the visit, then roll it back on cancel.
* An engine draft API.

## Decision Outcome
Chosen option: "Score Training completing visits use a client-side `pendingFinishScore` + finish-confirm modal before results/upload; Cancel restores the score into `visitInput` without committing; Confirm commits then reuses the D119 hard-gate. In-play undo pops the last committed turn (store + engine; resume-safe engine rebuild when the instance has no local visits).", because Lets players correct the last score before irreversible completion upload.

### Consequences
* Good, because players can correct the last score before the upload.
* Neutral, because the change needs no schema or API change.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/score-training-play.data.test.ts` covers the gate: a completing `submitVisit` stashes the pending score without committing or uploading, and never records the finishing visit before confirm.

## Pros and Cons of the Options
### Pending-completion gate in the play factory
* Good, because a completing visit is never committed before confirm, so no rollback is needed.

### Record then roll back
Rationale unknown — no source found. The spec names this alternative but not why it was rejected.

### Engine draft API
Rationale unknown — no source found. The spec names this alternative but not why it was rejected.

## Evidence / More Information
Decided: 2026-07-21

* `docs/superpowers/specs/2026-07-21-score-training-undo-finish-confirm-design.md` (Context, Behavior, Scope, Success criteria): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-07-21-score-training-undo-finish-confirm.md` (Task 6): the plan adds the D122 row.
* Commit `2e1c55e2` (2026-07-21; its title names the PR31 rebase): adds the D122 row to `DECISIONS.md`.
* Applied in: `docs/superpowers/plans/2026-07-21-modal-confirm-dialog.md`.
