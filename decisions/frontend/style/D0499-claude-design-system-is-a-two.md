---
id: D0499
status: accepted
date: 2026-10-26
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, token]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Claude Design system is a two-way peer of `global.css`

## Context and Problem Statement
most of the design system already matches the code; drift needs surfacing and a per-item decision, not a port.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the Claude Design project "Darts Analytics Design System" (`92d6fa0d-31bc-4ef3-9737-a4854ce14886`) and the code are reconciled item by item, by the owner, one area at a time (tokens → assets → components). Code wins → the design system is updated through `DesignSync`; design wins → the code changes through the normal branch, test and PR flow. The `syncing-design-system` skill runs it; `app/scripts/design-sync/` (`npm run design:sync -- diff|record`) compares a scratch mirror of the remote area with the code and classifies each item against the committed lock `docs/design-system/design-sync.lock.json`. Mismatches come from comparing the two sides directly; the lock only proposes a direction and remembers accepted divergences. Phase 1 is manual only: the session-start notice and the task-end step wait until the owner confirms the project survives the 2026-12-14 closure of standalone Claude Design.", because most of the design system already matches the code; drift needs surfacing and a per-item decision, not a port.

### Consequences
CI cannot run the sync (it needs a claude.ai login in a Claude session); a session without design access skips with one line and loses nothing, since the next run diffs both sides again. React components are never copied; component pairs are compared by looks and behaviour, by hand.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-26
Supersedes: D428 in part (the token-source clause only — `Brand Style.dc.html` is no longer the sole source of token values).
Referenced by D0523's `Supersedes:` line.
