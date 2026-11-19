---
id: D0130
status: accepted
date: 2026-07-22
origin: contemporaneous
original-date:
tags: [frontend/style, CSS]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Retire D129

## Context and Problem Statement
Fallow ignore was temporary until PR2 adoption-or-delete

## Decision Drivers
* The D129 ignore was temporary until PR2 adopted or deleted the unwired kit.
* The handoff lists `CustomTabs.astro` as a suspected scraped placeholder to delete or replace, not ship as is.

## Considered Options
* Delete the unwired `components/ui` primitives and `CustomTabs`, keep the route-wired ones (chosen).
* Wire each ignored component into a real page. The handoff offers this as the alternative to deleting.

## Decision Outcome
Chosen option: "Retire D129: delete unwired `components/ui` primitives + `CustomTabs`; keep only route-wired Modal/ConfirmDialog/LogoutButton/IsLoading/Link/CardWrapper; CSS primitives remain in `global.css`", because Fallow ignore was temporary until PR2 adoption-or-delete.

### Consequences
* Good, because fallow runs clean without the UI `ignorePatterns`.
* Neutral, because the `thresholdOverrides` for `CardWrapper` and `ScoreInput` stay; the plan revisits them after polish, and the commit message says they were retained.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The plan's Task 1 checks that each kept component still has an importer outside `components/ui`, lists `app/src/components/ui/` after deletion, and runs `npx fallow` in `app/`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-22

* `docs/superpowers/plans/2026-07-22-ui-polish-pr2.md` (Goal, Task 1): rebuilt Decision Drivers, Considered Options, Consequences and Confirmation.
* `docs/superpowers/plans/2026-07-22-ui-polish-pr2-handoff.md` (Must-do backlog 1): rebuilt Decision Drivers and Considered Options.
* Commit `9e2c281e` (PR #33, 2026-07-22; removes 25 lines from `app/.fallowrc.jsonc`): confirmed the config change.
