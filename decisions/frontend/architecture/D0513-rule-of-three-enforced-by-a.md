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

# Rule of three, enforced by a clone-group ratchet

## Context and Problem Statement
the edit-time rules spec wanted "new clone group fails" without a second checkout. A committed baseline gives the same result, runs locally, and needs no merge-base diff in CI. Keying by file set rather than fragment hash means editing inside an existing clone does not read as new. The edit-time rules spec also notes that a percentage threshold cannot guarantee that a new clone group fails.

## Decision Drivers
* The edit-time rules spec wants a new clone group to fail the gate.
* A percentage threshold lets small clones hide and growth dilute it.
* The gate should run locally and need no second checkout in CI.

## Considered Options
* A duplication percentage threshold.
* A merge-base diff of `fallow dupes` output on head and base.
* A committed baseline keyed by the sorted file set of each clone group (chosen).
* A committed baseline keyed by fragment hash.

## Decision Outcome
Chosen option: "a third copy of a markup shape, type or logic block is extracted into a shared component/helper/type before it lands, and the other two copies migrate to it (`.claude/rules/reuse.md`, scoped to `app/src/**`). `scripts/check-dupes.sh` runs `fallow dupes` and keys each clone group by the sorted unique file set of its instances; `scripts/dupes-baseline.txt` holds `<count>\t<key>` rows. The gate fails when a key's count rises or a new key appears, and when a baseline count exceeds the current one (ratchet: the baseline only shrinks). It also fails if fallow omits groups. `bash scripts/check-dupes.sh --update` rewrites the baseline. CI runs it in `quality.yml` after the stale-usage gate.".

### Consequences
baseline starts at 114 groups across 70 file sets (4.9% duplicated lines). A clone added to a file set that already has groups raises its count and fails; an offsetting removal in the same set hides it. Each clone family has a `discovered-work` backlog issue; none were fixed here.

* Good, because the baseline gives the same "new group fails" result, runs locally, and needs no merge-base diff in CI.
* Bad, because an offsetting removal in the same file set hides a newly added clone.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/test-check-dupes.sh` runs fixture JSONs through the gate: an unchanged baseline passes, a new group fails, a removed group fails as stale, and `--update` then passes. CI runs both scripts in `.github/workflows/quality.yml`.

## Pros and Cons of the Options
### Percentage threshold

* Bad, because it cannot guarantee that a new clone group fails.

### Merge-base diff

* Bad, because it needs a second checkout in CI.

### Committed baseline keyed by file set (chosen)

* Good, because editing inside an existing clone does not read as new.

### Baseline keyed by fragment hash

* Bad, because editing inside an existing clone would read as new.

## Evidence / More Information
Decided: 2026-10-30

* `docs/superpowers/specs/2026-10-29-edit-time-rules-design.md` (Goal, clone ratchet section): rebuilt Context, Decision Drivers and Considered Options; the spec proposed the merge-base diff.
* `docs/superpowers/plans/2026-10-30-edit-time-rules.md` (Task 3, "Plan's call vs spec"): rebuilt Considered Options, Confirmation and Pros and Cons.
* Commit `ad3c3615` (PR #1163; adds the `decisions/frontend/architecture.md` row): rebuilt Consequences.
* Applied in: `docs/superpowers/specs/2026-10-31-duplication-backlog-design.md`, `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4a.md`, `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4b.md`, `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4c.md`.
