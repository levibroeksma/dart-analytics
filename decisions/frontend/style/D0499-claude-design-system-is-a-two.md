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

# Claude Design system is a two-way peer of `global.css`

## Context and Problem Statement
most of the design system already matches the code; drift needs surfacing and a per-item decision, not a port.

## Decision Drivers
* Most of the design system already lives in the code, because it was derived from this repo on 2026-10-09; the goal is not a big port (spec "Intent").
* The owner decides each mismatch; applying either side without per-item confirmation counts as a failure (spec "Goals", "Anti-goals").
* Standalone Claude Design closes on 2026-12-14, and the survival of the project and `DesignSync` is unverified (spec "Constraints").

## Considered Options
* Reconcile item by item with the owner choosing the winning side, one area at a time: tokens, then assets, then components (chosen; spec "Scope").
* Port the design system's React components. The spec lists this as a non-goal: the app is Astro and Alpine, and code is never copied line for line (spec "Non-goals").
* Replace either side wholesale. The spec names this an anti-goal (spec "Anti-goals").
* Ship the automatic triggers at once. The spec defers them to phase 2 until the owner confirms the project and `DesignSync` keep working (spec "Triggers").

## Decision Outcome
Chosen option: "the Claude Design project "Darts Analytics Design System" (`92d6fa0d-31bc-4ef3-9737-a4854ce14886`) and the code are reconciled item by item, by the owner, one area at a time (tokens → assets → components). Code wins → the design system is updated through `DesignSync`; design wins → the code changes through the normal branch, test and PR flow. The `syncing-design-system` skill runs it; `app/scripts/design-sync/` (`npm run design:sync -- diff|record`) compares a scratch mirror of the remote area with the code and classifies each item against the committed lock `docs/design-system/design-sync.lock.json`. Mismatches come from comparing the two sides directly; the lock only proposes a direction and remembers accepted divergences. Phase 1 is manual only: the session-start notice and the task-end step wait until the owner confirms the project survives the 2026-12-14 closure of standalone Claude Design.", because most of the design system already matches the code; drift needs surfacing and a per-item decision, not a port.

### Consequences
CI cannot run the sync (it needs a claude.ai login in a Claude session); a session without design access skips with one line and loses nothing, since the next run diffs both sides again. React components are never copied; component pairs are compared by looks and behaviour, by hand.

### Confidence
Rationale unknown — no source found.

### Revisit When
* The owner confirms the project and `DesignSync` survive the 2026-12-14 closure of standalone Claude Design: phase 2 (session-start notice and task-end step) waits for it (spec "Triggers", "Constraints").

### Confirmation
The plan `docs/superpowers/plans/2026-10-26-design-system-sync.md` names the CLI tests. `app/tests/scripts/design-sync/tokens.test.ts` and `lock.test.ts` exist today.

## Pros and Cons of the Options
* Per-item decisions, credited to the chosen option: nothing applies silently, and a stale lock can at worst produce a wrong proposal (spec "The baseline").
* Manual-only phase 1, credited to the chosen option: it waits for the owner to confirm the project and `DesignSync` survive the 2026-12-14 closure before any automatic trigger is built (spec "Triggers").
* Access gate, credited to the chosen option: a session without design access skips with one line and loses nothing, because the next run diffs both sides again (spec "Access gate").
* Lock as a direction hint, credited to the chosen option: mismatches always come from comparing the two sides directly (spec "The baseline").

## Evidence / More Information
Decided: 2026-10-26
Supersedes: D428 in part (the token-source clause only — `Brand Style.dc.html` is no longer the sole source of token values).
Referenced by D0523's `Supersedes:` line.
* `docs/superpowers/specs/2026-10-26-design-system-sync-design.md` (draft, 2026-10-26; D523 later supersedes its Claude Design parts): rebuilt Decision Drivers, Considered Options, Pros and Cons, Revisit When ("Intent", "Goals", "Non-goals", "Anti-goals", "The baseline", "Access gate", "Triggers", "Constraints").
* `docs/superpowers/plans/2026-10-26-design-system-sync.md`: rebuilt Confirmation (test names).
* Commit `6004dba8` ("docs(design-sync): D498, history, style guide, router row"): adds the row as D498; commit `26cf069f` renumbers it to D499. Its text is the existing Context, Decision Outcome and Consequences.
