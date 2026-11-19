---
id: D0513
status: accepted
date: 2026-10-30
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
<!-- backfill: pending -->

# Rule of three, enforced by a clone-group ratchet

## Context and Problem Statement
the edit-time rules spec wanted "new clone group fails" without a second checkout. A committed baseline gives the same result, runs locally, and needs no merge-base diff in CI. Keying by file set rather than fragment hash means editing inside an existing clone does not read as new.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "a third copy of a markup shape, type or logic block is extracted into a shared component/helper/type before it lands, and the other two copies migrate to it (`.claude/rules/reuse.md`, scoped to `app/src/**`). `scripts/check-dupes.sh` runs `fallow dupes` and keys each clone group by the sorted unique file set of its instances; `scripts/dupes-baseline.txt` holds `<count>\t<key>` rows. The gate fails when a key's count rises or a new key appears, and when a baseline count exceeds the current one (ratchet: the baseline only shrinks). It also fails if fallow omits groups. `bash scripts/check-dupes.sh --update` rewrites the baseline. CI runs it in `quality.yml` after the stale-usage gate.".

### Consequences
baseline starts at 114 groups across 70 file sets (4.9% duplicated lines). A clone added to a file set that already has groups raises its count and fails; an offsetting removal in the same set hides it. Each clone family has a `discovered-work` backlog issue; none were fixed here.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-30
