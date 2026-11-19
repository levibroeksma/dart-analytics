---
id: D0516
status: accepted
date: 2026-10-31
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Play factories compose shared play-screen parts

## Context and Problem Statement
ten factories carried near-identical `init`/`commitDart`/`undoVisit`/bot-loop members; the clone groups were the largest family in the D513 baseline. Parts keep each factory's own members visible while the shared body lives once. Flags would rebuild the divergence inside one function. The duplication backlog spec measured about 60% of the clones in the 15 `app/src/lib/game/*-play.data.ts` factories.

## Decision Drivers
* Drift is the bigger risk than a deep restructure: a rule change to a play screen should be made once.
* Alpine binds by string and `astro check` does not see a renamed method, so each factory's public surface must stay identical.
* The spec names a base that needs per-game flags (a "god factory") as a failure.

## Considered Options
* Composable spread parts, with variation through separate parts, typed callbacks or later-declared overrides (chosen).
* One shared base with per-game boolean flags.
* Leave the clone groups; the D513 ratchet only blocks new ones.

## Decision Outcome
Chosen option: "visual-board play factories (around-the-clock, baseball, bobs27, cricket, doubles-training, follow-the-leader, killer, shanghai, singles-training, tactics) spread shared parts from `app/src/lib/game/play-screen.data.ts` — `playScreenState`, `boardPlayActions`, `botVisualBoardData`, `playScreenActions`, `timedPlayData` — instead of re-declaring lifecycle members. Variation goes through separate parts, typed callbacks (`afterInit`) or later-declared overrides, never boolean flags. The factory-surface snapshot plus the page-bindings test guard the Alpine template contract.".

### Consequences
spread order is fixed (later keys override earlier), an overridden `init` calls through to the part's `init` or uses `afterInit`, and parts hold no getters. A change to a part is covered by the snapshot of every factory's key surface. The duplication baseline under D513 dropped by the clone groups that spanned these files.

* Good, because the shared lifecycle body lives once while each factory's own members stay visible.
* Bad, because a game override declared before a spread is silently replaced by the shared member (plan Review Focus 2).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/factory-surface.test.ts` freezes each factory's key set and kinds, and `app/tests/lib/game/page-bindings.test.ts` checks that page expressions resolve to factory keys. `app/tests/lib/game/play-screen.data.test.ts` covers the parts. `scripts/check-dupes.sh` reports baseline rows that can be lowered, and the plan then updates the baseline with `--update`.

## Pros and Cons of the Options
### Composable spread parts (chosen)

* Good, because composition keeps each factory's members visible; per-factory optional capabilities are separate spreads.

### One shared base with per-game flags

* Bad, because flags would rebuild the divergence inside one function.

### Leave the clone groups

* Bad, because the ratchet leaves the existing backlog in place and each copy is a place a fix lands in one game and not the others.

## Evidence / More Information
Decided: 2026-10-31

* `docs/superpowers/specs/2026-10-31-duplication-backlog-design.md` (Intent, Anti-goals, Phase 0, Phase 1): rebuilt Context, Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-10-31-duplication-backlog-phase-0-1.md` (Architecture, Global Constraints, Review Focus, Task 4, Task 9): rebuilt Decision Drivers, Consequences and Confirmation.
* Commit `f601b5bc` (PR #1197, 2026-10-31; adds the `decisions/frontend/architecture.md` row): rebuilt Consequences.
