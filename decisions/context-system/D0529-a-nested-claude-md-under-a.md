---
id: D0529
status: accepted
date: 2026-11-06
origin: contemporaneous
original-date:
tags: [context-system, docs, CLAUDE.md, gate]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A nested `CLAUDE.md` under a doc-sync trigger path owes no doc

## Context and Problem Statement
a `CLAUDE.md` under `app/src/modules/*/` holds agent edit-time rules and file lists, not the architecture `docs/architecture/` describes. Adding `switching-chain` to the training module's file list (#1244) failed the gate with no doc to update; satisfying it would need an edit that describes nothing. D444 named narrowing the gate in its own change as the remedy.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`scripts/check-doc-sync.sh` drops any triggered path ending in `/CLAUDE.md` from the failing set. Every other triggered file, and every explicit path argument, is judged as before. Amends D317 and D444; trigger paths and satisfier are unchanged.".

### Consequences
calibration re-run on the 71 first-parent commits reachable from `origin/main` (the clone's depth): old and new gate agree on all 71, so no historical verdict flips. Fixtures: `check-doc-sync.sh app/src/modules/training/CLAUDE.md` still fails (explicit paths are never exempted); a staged edit to that file alone passes; the same edit with `app/src/modules/game/x.ts` code staged still fails on the code file. A `CLAUDE.md` that changes a rule other docs restate is still worth a doc edit, and nothing here stops one.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-doc-sync.sh` skips `*/CLAUDE.md` paths in its triggered set, and `.github/workflows/quality.yml` runs the script. The commit message and record list fixture runs: an explicit `check-doc-sync.sh app/src/modules/training/CLAUDE.md` still fails, and a staged edit to that file alone passes.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-06

* Commit `725c51cb` (PR #1249, 2026-11-06; edits `scripts/check-doc-sync.sh` and adds the D529 row): rebuilt Confirmation; source of the Context and Consequences text.
