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

# A finding is logged, not fixed; acting on one needs permission

## Context and Problem Statement
an agent that found a defect mid-task had three bad options and no good one — widen the diff past its assignment, mention it in chat where the record dies with the session, or park it in `DECISIONS.md`'s Deferred list, where five deliberately-unbuilt features and a known-broken script were filed under one heading. Five live contradictions were sitting unrecorded in the repo when this was written, every one found incidentally during earlier tasks. D107's self-learning gate already encoded propose-then-confirm but only for `CLAUDE.md`/`AGENT.md` rule sharpenings, and half its target went dead when D213 reduced every `AGENT.md` to a pointer stub; a stale doc or a bug outside scope is not a rule sharpening, so it never fired for any of the five.

## Decision Drivers
* An agent that finds a defect mid-task has no sanctioned place to record it (spec, Problem).
* The Deferred list files deliberately unbuilt features and a known-broken script under one heading, although the two states are opposite (spec, Problem).

## Considered Options
* Fix the finding in the same pass (spec, Problem).
* Mention it in chat and move on (spec, Problem).
* Park it in `DECISIONS.md`'s Deferred list (spec, Problem).
* A CI job that compares a PR's file list with a plan's declared task scope (rejected; spec, Scope).
* A root `FINDINGS.md` log, a Hard Invariant and a shape gate (chosen).

## Decision Outcome
Chosen option: "Anything an agent notices that its task was not asked to change is appended to a new root `FINDINGS.md` and named in the completion report, never fixed in the same pass; acting on a finding requires explicit user permission and becomes its own task on its own branch. The rule is a root `CLAUDE.md` Hard Invariant, the log is shape-guarded by `scripts/check-findings-log.sh` (gate 16, in `.husky/pre-commit` and `quality.yml`), and `context-maintenance` step 8 becomes the Findings gate. Findings are deleted when resolved, and ids come from a `highest-issued:` high-water mark rather than a scan.".

### Consequences
the per-session context floor rises from ~3.2k to ~3.4k tokens — the only floor increase in the change, accepted because a non-negotiable rule belongs where every task already reads. `FINDINGS.md` cannot grow into a provenance blob the way the pre-D213 context map did, because resolved entries are deleted rather than restatused; the cost is that a finding's history after deletion is git history alone, plus a `decisions/**` entry where the fix embodied a real choice. The gate proves the log's shape and that every cited evidence path still resolves; it cannot prove an agent logged instead of fixed, and no script can — the invariant carries that obligation. The log ships seeded with F1–F5 and none of them fixed, F3's one-word correction included: a rule that yields to convenience on its first pass is read as advisory forever after.

* Good, because D107's propose-then-confirm intent carries over. It widens from rule sharpenings to every kind of finding, with a durable home instead of chat (spec § 4).
* Neutral, because the rule governs incidental discovery only. Work a task step names, including adjacent edits it genuinely requires, proceeds without extra permission (spec § 1).
* Neutral, because `DECISIONS.md`'s Deferred section gains the line "Unbuilt things defer here. Broken things go to `FINDINGS.md`." and the `check-context-map.sh` false positive moves to `FINDINGS.md` as `F5` (spec § 5).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `3ef734db` (PR #146) added `FINDINGS.md` and `scripts/check-findings-log.sh`. The script made 6 checks (spec § 3). They covered front matter with `highest-issued`, 7 required fields per block, unique ids, `Open` or `Raised` status, live `Evidence:` paths and ISO dates. Commit `7145e30e` (PR #312) removed both files, and D273 replaced them with GitHub issues under the `capturing-discovered-work` skill. The root `CLAUDE.md` Hard Invariant "Discovered work is not a work item" remains.

## Pros and Cons of the Options
### Fix the finding in the same pass
* Bad, because it widens the diff past the assignment and mixes unreviewed work into a reviewed change (spec, Problem).
* Bad, because it decides on the user's behalf that the finding is worth the risk (spec, Problem).

### Mention it in chat
* Bad, because the record dies with the session (spec, Problem).

### Park it in the Deferred list
* Bad, because it welds findings to an append-only permanent ledger whose lifecycle is the opposite of a finding's (spec, Problem).

### PR-scope CI job
* Bad, because plans do not enumerate every legitimately touched file, so the gate would fail honest work (spec, Scope).

### `FINDINGS.md` log with a Hard Invariant and a gate
* Good, because a closed finding is deleted, so the log cannot grow into a provenance blob (spec § 2).
* Bad, because it adds about 55 tokens to the per-session floor (spec § 1).
* Bad, because the gate proves the log is well-formed with live evidence, not that an agent logged instead of fixed (spec § 3).

## Evidence / More Information
Decided: 2026-08-19
Supersedes: D107

* `docs/superpowers/specs/2026-08-19-governance-design.md` (Problem, Scope, § 1–§ 5, Verification): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-08-19-governance.md` (Global Constraints; the gate task): confirmed the gate named in Confirmation.
* Commit `3ef734db` (PR #146, 2026-08-19; adds `FINDINGS.md`, the gate and the D214 block): rebuilt Confirmation.
* Commit `7145e30e` (PR #312, 2026-09-13; removes `FINDINGS.md` and the gate): rebuilt Confirmation.
* Superseded by D273.
