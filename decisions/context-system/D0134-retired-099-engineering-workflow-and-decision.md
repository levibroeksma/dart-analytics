---
id: D0134
status: accepted
date: 2026-07-23
origin: contemporaneous
original-date:
tags: [context-system, docs, context map, CLAUDE.md, PR, workflow]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Retired `099-engineering-workflow-and-decision-framework.md`

## Context and Problem Statement
Dual load wasted tokens for no unique authority; checklist already lived in the PR template

Per the plan, the workflow pack loaded both `03-Engineering-Workflow.md` and `099-engineering-workflow-and-decision-framework.md`, about 3.6k tokens. The PR checklist already sat in the PR template.

## Decision Drivers
* Loading both files wasted tokens.
* `099` held no unique authority.
* The actionable checklist already lived in `.github/pull_request_template.md`.

## Considered Options
* Keep both files in the workflow pack (the state before this record).
* Retire `099` and make `03` the sole workflow authority (chosen).

## Decision Outcome
Chosen option: "Retired `099-engineering-workflow-and-decision-framework.md`: it was a compressed duplicate of `03-Engineering-Workflow.md`; Context Map workflow pack / Authority Order #7 / `docs/CLAUDE.md` routing / architecture README now point at `03` alone; PR template checklist authority cites `03` while the actionable checkboxes remain inlined in `.github/pull_request_template.md`", because Dual load wasted tokens for no unique authority; checklist already lived in the PR template.

### Consequences
* Good, because the workflow pack budget drops from `~3.5k` to `~2.2k`, the plan's chars/4 figure for `03` alone.
* Neutral, because historical `docs/superpowers/plans/*` that mention `099` stay untouched.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Step 1 of the plan's Task 2 greps the canonical set for `099-engineering-workflow` references before the delete. The plan lands the retirement before `scripts/check-doc-links.sh` acceptance, so no dangling path-like reference remains. `docs/architecture/099-engineering-workflow-and-decision-framework.md` does not exist today.

## Pros and Cons of the Options
### Keep both files in the workflow pack
* Bad, because the pack loads a compressed duplicate for no unique authority.

### Retire `099`
* Good, because the pack loads one file, `03`, and the checklist stays inlined in the PR template.

## Evidence / More Information
Decided: 2026-07-23

* `docs/superpowers/plans/2026-07-23-context-layer-hardening.md` (Global Constraints, Task 2): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons. The plan authored D134; the design spec does not mention it.
* Commit `42eed0e1` (PR #36, 2026-07-23): retired the file and retargeted the Context Map, `docs/CLAUDE.md`, the architecture README and the PR template.
