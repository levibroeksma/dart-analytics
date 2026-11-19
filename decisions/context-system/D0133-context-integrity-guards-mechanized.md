---
id: D0133
status: accepted
date: 2026-07-23
origin: contemporaneous
original-date:
tags: [context-system, docs, context map, CLAUDE.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Context-integrity guards mechanized

## Context and Problem Statement
Linking staleness and budget drift both slipped past every existing check — mechanize them per the D105/D110/D127 precedent, and stop the always-loaded router paying for redundancy

Per the spec's audit, the Context Map's budget estimates were about 2x understated (`00-Context-Map` rated `~1.5k` against a real `~3.5k`). Two stale references also slipped past every check.

## Decision Drivers
* Stale-reference and budget drift both passed every existing check.
* The D105, D110 and D127 precedent mechanizes discipline-only rules.
* The always-loaded root `CLAUDE.md` restated 5 Hard Invariants under Forbidden Actions.

## Considered Options
* Leave the drift unguarded (the state before this record).
* Auto-generate the budget numbers (rejected in the spec in favour of human-authored numbers plus a guard).
* Fix the drift and add two guard scripts that fail on breach (chosen).

## Decision Outcome
Chosen option: "Context-integrity guards mechanized: `scripts/check-doc-links.sh` validates every markdown link + path-like backtick reference across the canonical doc set (alias/base-aware, bare-identifier-skipping, `DECISIONS.md` history-refs and `docs/superpowers/` excluded), and `scripts/check-context-budget.sh` fails when the Context Map's per-file `~tokens` (strict) or per-pack `~Budget` (best-effort sum) drift >20%/>30% from a chars/4 estimate. Both added to Context-Maintenance step 5 and `checks.yml`. Same audit corrected two stale references (Alpine-Patterns `Timer`→`SegmentTimer`, Shared-Conventions barrel examples) and de-duplicated the always-loaded root `CLAUDE.md` (Forbidden Actions no longer restates Hard Invariants)", because Linking staleness and budget drift both slipped past every existing check — mechanize them per the D105/D110/D127 precedent, and stop the always-loaded router paying for redundancy.

### Consequences
* Good, because stale links and budget drift now fail a script instead of passing silently.
* Bad, because the per-pack `~Budget` check is best-effort: it sums only the `.md` files a pack lists and flags rows with other entries as `approx`.
* Neutral, because the budget guard never rewrites the Context Map. It prints the computed numbers, and a person updates the claimed ones.
* Neutral, because the root `CLAUDE.md` Forbidden Actions section drops about 6 duplicated lines.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-doc-links.sh` and `scripts/check-context-budget.sh` exist today, and `quality.yml` runs both. `quality.yml` also runs `scripts/test-check-context-budget.sh`. The spec requires each script to pass on `main` and to fail when a stale reference or stale budget returns.

## Pros and Cons of the Options
### Leave the drift unguarded
* Bad, because both drift classes already passed every existing check.

### Auto-generate the budget numbers
* Bad, because the spec rejects it in favour of human-authored numbers with a guard.

### Fix the drift and add two guards
* Good, because the guards fail on breach and name the failing row or reference.
* Bad, because the chars/4 estimate is a heuristic and pack budgets use a wider tolerance.

## Evidence / More Information
Decided: 2026-07-23

* `docs/superpowers/specs/2026-07-23-context-layer-hardening-design.md` (§ 1, § 3, § 4, § 6, § 7): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-23-context-layer-hardening.md` (Task 6): confirmed the row text.
* Commit `42eed0e1` (PR #36, 2026-07-23): added the scripts and wired them in.
