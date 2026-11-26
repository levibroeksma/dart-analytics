---
id: pending
status: accepted
date: 2026-11-26
origin: contemporaneous
original-date:
tags: [testing, test, coverage]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The test-coverage gate exempts pure renames and whole-block moves

## Context and Problem Statement
D0224's gate demands a covering-test edit for every runtime source change. In the Elimination statistics session (2026-11-25), a pure rename (`resolveVisit` to `resolvePrisonerVisit`) and a move of Marks' session grouping into `replay.module.ts` changed no behaviour, yet each commit was blocked until a test was touched. The tests added to satisfy it passed at once and pinned nothing new.

## Decision Drivers
* A test edit owed for no behaviour change becomes filler, which weakens the signal the gate gives.
* The exemption must stay derived, never a per-file silencer (D0224).
* Repointing a call at another existing function, or reading another property, must still count as a behaviour change.

## Considered Options
* Keep the gate as it is.
* A per-file or per-commit silencer.
* Derived exemptions for pure renames and whole-block moves (chosen).

## Decision Outcome
Chosen option: "`scripts/check_test_coverage.py` exempts a changed file when (a) its runtime tokens differ from the base only by a one-to-one identifier mapping, with no new name already present and no old name left, and every renamed name is declared (function, class, enum or variable) under its old name before and its new name now in some changed file; or (b) it only lost lines, import statements aside, and every lost line was added to another changed file, whose own covering test is still owed. Fixture mode never exempts, and `scripts/test-check-test-coverage.sh` proves both exemptions and their refusals (a parameter rename, a rename plus a logic edit, a move whose new home's test is untouched).".

### Consequences
D0224's rule and its no-silencer stance stand; only these two derived exemptions are added. The gate prints each exempt file.

* Good, because renames and extractions no longer force filler test edits.
* Bad, because a renamed parameter or property still owes a test edit (the declaration check is deliberately narrow).
* Neutral, because a moved block's new home still owes its own test edit, so the behaviour is asserted once, where it now lives.

### Confidence
Medium — the token and line comparisons are heuristics, conservative by construction.

### Revisit When
A real behaviour change slips through as a "rename" or "move", or the narrow declaration check blocks common refactors.

### Confirmation
`scripts/test-check-test-coverage.sh` covers both exemptions and three refusals, and runs in `quality.yml`'s structure job.

## Pros and Cons of the Options
### Keep the gate as it is
* Bad, because pure refactors keep producing filler tests.

### A silencer
* Bad, because D0224 rejected it: it gets used on exactly the changes the gate exists to catch.

### Derived exemptions
* Good, because nothing is listed by hand, so nothing can rot.
* Bad, because the heuristics add code to the gate.

## Evidence / More Information
Decided: 2026-11-26

* Session retro 2026-11-26, item 5 (owner-approved).
