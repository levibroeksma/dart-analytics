---
id: D0214
status: superseded
date: 2026-09-13
origin: contemporaneous
original-date:
tags: [context-system, context map, CLAUDE.md, gate, husky, pre-commit, branch, AGENT.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0107
superseded-by: D0273
---
<!-- backfill: pending -->

# A finding is logged, not fixed; acting on one needs permission

## Context and Problem Statement
an agent that found a defect mid-task had three bad options and no good one — widen the diff past its assignment, mention it in chat where the record dies with the session, or park it in `DECISIONS.md`'s Deferred list, where five deliberately-unbuilt features and a known-broken script were filed under one heading. Five live contradictions were sitting unrecorded in the repo when this was written, every one found incidentally during earlier tasks. D107's self-learning gate already encoded propose-then-confirm but only for `CLAUDE.md`/`AGENT.md` rule sharpenings, and half its target went dead when D213 reduced every `AGENT.md` to a pointer stub; a stale doc or a bug outside scope is not a rule sharpening, so it never fired for any of the five.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Anything an agent notices that its task was not asked to change is appended to a new root `FINDINGS.md` and named in the completion report, never fixed in the same pass; acting on a finding requires explicit user permission and becomes its own task on its own branch. The rule is a root `CLAUDE.md` Hard Invariant, the log is shape-guarded by `scripts/check-findings-log.sh` (gate 16, in `.husky/pre-commit` and `quality.yml`), and `context-maintenance` step 8 becomes the Findings gate. Findings are deleted when resolved, and ids come from a `highest-issued:` high-water mark rather than a scan.".

### Consequences
the per-session context floor rises from ~3.2k to ~3.4k tokens — the only floor increase in the change, accepted because a non-negotiable rule belongs where every task already reads. `FINDINGS.md` cannot grow into a provenance blob the way the pre-D213 context map did, because resolved entries are deleted rather than restatused; the cost is that a finding's history after deletion is git history alone, plus a `decisions/**` entry where the fix embodied a real choice. The gate proves the log's shape and that every cited evidence path still resolves; it cannot prove an agent logged instead of fixed, and no script can — the invariant carries that obligation. The log ships seeded with F1–F5 and none of them fixed, F3's one-word correction included: a rule that yields to convenience on its first pass is read as advisory forever after.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-19
Supersedes: D107
