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
<!-- backfill: pending -->

# Shared session recovery helper for setup & play

## Context and Problem Statement
Single implementation prevents table drift and UX loop where setup re-renders the modal twice

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Shared session recovery helper for setup & play: identical decision table in `app/src/lib/game/session-recovery.ts` (no page-specific variants) reconciles local `sessionId` vs server ACTIVE SCORE_TRAINING session; returns `"match"` | `"no_active"` | `"abandon_failed"` — the latter blocks session creation instead of silently resetting (orphan still ACTIVE; create would violate `uq_sessions_single_active`); match shows Continue/Abandon modal on setup only; mismatch never shows a dialog", because Single implementation prevents table drift and UX loop where setup re-renders the modal twice.

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-17
