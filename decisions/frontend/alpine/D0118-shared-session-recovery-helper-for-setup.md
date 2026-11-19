---
id: D0118
status: accepted
date: 2026-07-17
origin: contemporaneous
original-date:
tags: [frontend/alpine, recovery, session recovery]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Shared session recovery helper for setup & play

## Context and Problem Statement
Single implementation prevents table drift and UX loop where setup re-renders the modal twice. The spec puts one helper, `reconcileActiveSession`, behind both `.data.ts` factories so the decision tables cannot drift. A caller that treats `abandon_failed` like `no_active` would break the spec.

## Decision Drivers
* Setup and play must run the same decision table.
* Creating a session while an orphan is still ACTIVE violates `uq_sessions_single_active`.
* A setup re-render must not show the modal twice.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Shared session recovery helper for setup & play: identical decision table in `app/src/lib/game/session-recovery.ts` (no page-specific variants) reconciles local `sessionId` vs server ACTIVE SCORE_TRAINING session; returns `"match"` | `"no_active"` | `"abandon_failed"` — the latter blocks session creation instead of silently resetting (orphan still ACTIVE; create would violate `uq_sessions_single_active`); match shows Continue/Abandon modal on setup only; mismatch never shows a dialog", because Single implementation prevents table drift and UX loop where setup re-renders the modal twice.

### Consequences
* Neutral, because the literal `match` describes the reconciliation outcome. Setup shows Continue/Abandon on it, play resumes silently.
* Neutral, because the spec makes the active-session modal an overlay, not a page-level conditional, to avoid a re-render loop.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's testing notes require that setup and play produce the same abandon and reset outcomes for identical inputs.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-17

* `docs/superpowers/specs/2026-07-17-score-training-flow-redesign.md` (Shared D88 reconciliation, Match vs mismatch, abandon_failed, Testing): rebuilt Context, Drivers, Consequences and Confirmation.
* `docs/superpowers/plans/2026-07-17-score-training-flow-implementation.md` (the D118 ledger step): confirmed the decision wording.
* Commit `cd80aa80` (PR #29, 2026-07-21, adds the D118 row).
* Applied in: `docs/superpowers/specs/2026-07-22-hardening-first-deploy-design.md` (H3), `docs/superpowers/plans/2026-10-11-setup-session-mixin.md`. Partly changed by D460 (removes `abandon_failed`).
