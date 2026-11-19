---
id: D0523
status: accepted
date: 2026-11-04
origin: contemporaneous
original-date:
tags: [frontend/style, token]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The design side is the Design System artifact; ready marks and merges drive the sync

## Context and Problem Statement
standalone Claude Design moved its design systems to artifacts and refuses `DesignSync` writes; the owner wants experiments in the artifact to reach nothing until marked ready, and manual syncing to be rare.

## Decision Drivers
* On 2026-11-04 the design system moved from standalone Claude Design to the Design System artifact, and `DesignSync` refuses writes ("moved to Claude") (spec "Intent").
* Experiments in the artifact must reach nothing until the owner marks them ready, and a sync must never run on every tinker (spec "Intent").
* An unready experiment reaching code, or an automatic publish overwriting the owner's unmarked work, counts as a failure even if the sync works (spec "Anti-goals").

## Considered Options
* Design to code runs automatically on the owner's ready mark, and code to design runs automatically after a merge (chosen; spec "Goals").
* A ready mark as a page feature, or as a comment, instead of a file in the artifact. The spec rejects both: the type offers no page feature and keeps comments composer-only (spec "Builder's calls").
* Run code to design from CI instead of at session start. The spec leaves this out because whether a CI job can authenticate to publish an artifact is unverified (spec "Builder's calls").

## Decision Outcome
Chosen option: "the D499 sync runs against the Design System artifact `https://claude.ai/artifact/A7QFuSqRwpqyoXUEm7XHsW` through the Artifact tool, replacing the closed Claude Design project and `DesignSync`. `project/tokens.json` is the design-side token source (`var` tokens only; values its format cannot hold are `code-only`); components live one folder per component. Design → code runs automatically on the owner's ready mark in `project/sync-ready.json`; code → design runs automatically after a merge, for tokens and assets only (components are design → code only). Both run from a session-start check in a background worktree and end in a PR the owner merges. Everything else keeps the per-item decision.".

### Consequences
`@utility` rules and keyframes leave the tokens area and are code-owned (`migrate-lock` drops their lock entries). The lock tracks `artifactUrl` and `lastChangeAt` instead of the project id and `updatedAt`. CI cannot run the sync; it needs a Claude session with artifact access.
* Neutral, because manual syncing stays available: "sync the design system" runs the full D499 per-item flow, one area at a time (spec "Triggers").

### Confidence
Rationale unknown — no source found.

### Revisit When
* A CI job can authenticate to publish an artifact: the spec says to revisit running code to design from CI then (spec "Builder's calls").

### Confirmation
The plan `docs/superpowers/plans/2026-11-04-design-system-artifact-sync.md` names the tests per task. The design-sync CLI tests exist today under `app/tests/scripts/design-sync/`: `tokens-json.test.ts`, `ready.test.ts`, `publish.test.ts`, `components.test.ts`, `cli.test.ts` and `lock.test.ts`.

## Pros and Cons of the Options
* Ready mark in `project/sync-ready.json`, credited to the chosen option: experiments in the artifact reach nothing until marked (spec "The ready mark").
* After-merge publish, credited to the chosen option: the merge is the approval, so no extra confirmation is needed (spec "Goals").
* Session-start check in a background worktree, credited to the chosen option: the first answer is not delayed and the session's own checkout is never touched (spec "Triggers").
* Owner-merged PRs, credited to the chosen option: the spec lists automatic merges as a non-goal (spec "Non-goals").

## Evidence / More Information
Decided: 2026-11-04
Supersedes: D499 in part (the Claude Design project and `DesignSync` as the design side; phase 1 manual-only).
* `docs/superpowers/specs/2026-11-04-design-system-artifact-sync-design.md` (status draft, 2026-11-04): rebuilt Decision Drivers, Considered Options, Pros and Cons, Revisit When ("Intent", "Goals", "Non-goals", "Anti-goals", "The ready mark", "Triggers", "Builder's calls").
* `docs/superpowers/plans/2026-11-04-design-system-artifact-sync.md`: rebuilt Confirmation (per-task test lists).
* Commit `e04130ce` ("docs(design-sync): skill, hook and D521 for the artifact sync"): adds the row as D521; commit `a660666d` ("Merge origin/main into chore/design-sync-assets; renumber design-sync decision D521 -> D523") renumbers it; its text is the existing Context, Decision Outcome and Consequences.
