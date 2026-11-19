---
id: D0444
status: accepted
date: 2026-10-11
origin: contemporaneous
original-date:
tags: [context-system, docs, gate, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A comment-only edit under a doc-sync trigger path owes no doc

## Context and Problem Statement
D317 left "this changed nothing any doc describes" as an argued case and named narrowing the gate in its own change as the remedy. The first case was a JSDoc-only amendment to `FiveOhOneSideState` in `app/src/modules/game/types.ts` (#913, issue #907): no file under `docs/architecture/`, `decisions/` or `docs/game-rules/` mentions `setsWon`, so the gate could only be satisfied by a doc edit that described nothing. A comment is not a surface the docs describe, and a per-change silencer would make the gate advisory on the changes it exists to catch, so the exemption is a property of the diff, not of the author's say-so.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`scripts/check-doc-sync.sh` drops a triggered `.ts` or `.astro` file from the failing set when its diff, read per file with `git diff -U0` against the merge base (or the index mid-commit), changes only blank lines and comment lines (openers `//`, `/*`, `*`). A file with any other changed line still fails as before. Explicit path arguments carry no diff and are never exempted, so the gate stays aimable at a fixture set. Amends D317; the trigger paths and the satisfier are unchanged.".

### Consequences
calibration re-run on the 21 first-parent merges reachable from `origin/main` (the clone's depth): old and new gate agree on all 21 (all pass), so no historical verdict flips. Fixtures prove the exemption bites both ways: a comment-only edit to `app/src/modules/game/types.ts` passes; the same file with an added export fails; with a `docs/architecture/` edit it passes; `check-doc-sync.sh app/src/services/x.ts` still fails. The classifier is line-prefix based, so a code line that begins with `*` or `//`, or a comment trailing code on a changed line, is judged by its first token; a code edit hidden in a line starting `*` would be missed, which no real source formatting produces. A JSDoc that changes a documented contract is still a doc change worth making, and nothing here stops a PR from making one.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-doc-sync.sh` carries the D444 comment-only exemption, built on a `COMMENT_LINE` pattern.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-11

* Commit `4220053b` (2026-10-11; edits `scripts/check-doc-sync.sh` with the exemption): rebuilt Confirmation.
* Commit `7a9c08ec` (2026-10-11; adds the D444 block): no section rebuilt from it.
