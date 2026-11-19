---
id: D0129
status: accepted
date: 2026-07-22
origin: contemporaneous
original-date:
tags: [frontend/style]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Fallow `ignorePatterns` for unwired design-system Astro primitives under

## Context and Problem Statement
PR1 ships the kit + gates without deleting unused primitives fallow would flag

## Decision Drivers
* PR1 ships the design-system kit and its gates without deleting unused primitives, so fallow would flag them.

## Considered Options
* Ignore the unwired primitives in fallow until PR2 route adoption (chosen).

## Decision Outcome
Chosen option: "Fallow `ignorePatterns` for unwired design-system Astro primitives under `src/components/ui/` (and `CustomTabs.astro`) until PR2 route adoption; health `thresholdOverrides` for `CardWrapper`/`ScoreInput` templates", because PR1 ships the kit + gates without deleting unused primitives fallow would flag.

### Consequences
* Neutral, because the ignore is temporary. The handoff says PR2 either wires each ignored component into a page or deletes it, then removes the matching `ignorePatterns` and tightens the health overrides.

### Confidence
Rationale unknown — no source found.

### Revisit When
PR2 route adoption: the handoff asks PR2 to adopt or delete each ignored component and to record the superseding decision.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-22

* `docs/superpowers/plans/2026-07-22-ui-polish-pr2-handoff.md` (What PR1 already shipped, Must-do backlog 1): rebuilt Decision Drivers, Considered Options, Consequences and Revisit When.
* Commit `4ab73bf1` (PR #32, 2026-07-22; adds `app/.fallowrc.jsonc` and the D129 row): confirmed the config change.
* Retired by D130 (deletes the unwired primitives and removes the `ignorePatterns`).
