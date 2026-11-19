---
id: D0395
status: accepted
date: 2026-10-03
origin: contemporaneous
original-date:
tags: [context-system, gate, CI]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `fallow-gate.sh` annotates the `dupes` clause; `db:drift:ci` reads `DATABASE_URL` from the environment

## Context and Problem Statement
issues #504 and #721. A clean run reports ~80+ clone groups and exits 0, yet the count sat under "Failed:" and sent a session deduplicating unrelated code (#292). `db:drift` loaded `.env` unconditionally, so a container with only `DATABASE_URL` stopped there.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "when fallow's `Failed:` line names `dupes (N clone groups)` and `app/.fallowrc.jsonc` sets no `duplicates.threshold` (or 0), `scripts/fallow-gate.sh` prints one line saying the clause is informational. `app/package.json` gains `db:drift:ci` (`tsx scripts/check-migration-drift.ts`, no `--env-file`), the sibling of `db:status:ci`.".

### Consequences
the threshold is read from the config, so the note drops out if a limit is ever set. fallow's own output is unchanged. `validate:app` still calls `db:drift`; a headless run uses `db:drift:ci` for that step. Closes #504, #721.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/fallow-gate.sh` prints the informational-clause note, and `app/package.json` defines `db:drift:ci` as `tsx scripts/check-migration-drift.ts`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-03

* Commit `9b0c74bb` (2026-10-03; edits `scripts/fallow-gate.sh` and `app/package.json`; closes issues #504 and #721): rebuilt Confirmation.
