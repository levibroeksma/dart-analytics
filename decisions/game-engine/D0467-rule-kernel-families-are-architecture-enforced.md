---
id: D0467
status: accepted
date: 2026-10-17
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Rule-kernel families are architecture, enforced by registry and gates

## Context and Problem Statement
the families were a spec-level plan (`docs/superpowers/specs/2026-10-15-rule-kernels-design.md`, `2026-10-17-track-kernel-design.md`); specs are non-canonical, so nothing stopped a new engine from bypassing them. A registry plus two gates makes the placement checkable at commit time, and the `Kernel:` header puts it in front of whoever authors the rules, before any spec.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "every game and exercise engine belongs to one rule-kernel family — TRACK, CHECKOUT, VISIT_POINTS, MARKS, ELIMINATION — or is HAND_WRITTEN. The canonical statement is Pattern 18 §Rule-kernel families. `scripts/engine-kernels.txt` lists every engine with its kernel and status (KERNEL_BOUND, PENDING, HAND_WRITTEN); `scripts/check-engine-kernels.sh` fails an unlisted engine, a stale row, a KERNEL_BOUND engine without its kernel import, and a row that disagrees with the rules file's new `Kernel:` header, which `scripts/check-game-rules.sh` requires on every game and exercise. Adding a family or moving a game between families takes a decision entry.".

### Consequences
a new engine cannot land without a registry row; each kernel migration PR flips its row from PENDING to KERNEL_BOUND. The header is `Kernel:`, not `Family:`, because `Family` is already a Tags axis. Initial assignments follow the umbrella spec §5 as amended by the Track spec §5 (Prisoner, Hare and Hounds → ELIMINATION; Neighbours, A1 Routine → MARKS; Bullseye 500, Golf, DOLF → VISIT_POINTS; Bullseye Checkout → CHECKOUT; Bull-Up → HAND_WRITTEN).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-17
