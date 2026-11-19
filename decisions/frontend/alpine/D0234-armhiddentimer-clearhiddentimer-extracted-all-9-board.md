---
id: D0234
status: accepted
date: 2026-08-26
origin: contemporaneous
original-date:
tags: [frontend/alpine, state]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `armHiddenTimer`/`clearHiddenTimer` extracted; all 9 board-input games clear their markers on the shared timer

## Context and Problem Statement
501/121/TUOD/Score Training never had `hiddenTurnKey`/`hiddenTimer` state at all, so `BoardInputPanel.astro`'s markers — rendered unconditionally by every board-input game — never cleared for these four; a dart's marker sat on the board until the next visit's first dart overwrote the same slot. Extracting the primitive rather than forcing Score Training onto the full `playCommitDart` composite avoids reintroducing the exact class of bug D229 fixed (an unconditional post-record completion check tripping on an already-decided session).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`play-lifecycle.ts`'s reveal-then-clear timer logic is split into two exported primitives, `armHiddenTimer(context, turns)` and `clearHiddenTimer(context)`, factored out of `playCommitDart`/`playUndoVisit`/`runPlayAgain` with no behavior change for existing callers. 501, 121, and Ten Up One Down — whose `commitDart` was otherwise identical to `playCommitDart` (record → mirror → complete-check) — now delegate to it directly, the same way Bob's 27 already does (D233). Score Training calls `armHiddenTimer` directly from `recordDart` instead: its engine can already be complete before a dart is thrown (MINUTES-mode timer expiry via `expireTimer()`), so a post-record `isComplete()` check — which `playCommitDart` always runs — would upload and finish the session mid-visit, on the first dart of a fresh visit. All 9 board-input games now clear their board markers via `playVisitMarkers` on the same 1500ms timer.".

### Consequences
`FiveOhOnePlayContext`, `OneTwentyOnePlayContext`, `ScoreTrainingPlayContext`, and `TuodPlayContext` each gain their own `hiddenTurnKey`/`hiddenTimer`/`visitMarkers()` fields, extending the same hand-restated-shape pattern `FINDINGS.md`'s F29 already flags for 5 other `*PlayContext` types (now 9). `docs/architecture/07-Frontend/00-Overview.md`'s Visual Board Input section, which pre-dated most of the 9-game rollout, is corrected to state every ruleset supports `VISUAL_BOARD` and to describe the reveal-then-clear timer instead of the older "stays until the next visit's first dart" behavior.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-26
