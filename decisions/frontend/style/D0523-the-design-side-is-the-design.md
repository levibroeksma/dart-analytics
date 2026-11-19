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
<!-- backfill: pending -->

# The design side is the Design System artifact; ready marks and merges drive the sync

## Context and Problem Statement
standalone Claude Design moved its design systems to artifacts and refuses `DesignSync` writes; the owner wants experiments in the artifact to reach nothing until marked ready, and manual syncing to be rare.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the D499 sync runs against the Design System artifact `https://claude.ai/artifact/A7QFuSqRwpqyoXUEm7XHsW` through the Artifact tool, replacing the closed Claude Design project and `DesignSync`. `project/tokens.json` is the design-side token source (`var` tokens only; values its format cannot hold are `code-only`); components live one folder per component. Design → code runs automatically on the owner's ready mark in `project/sync-ready.json`; code → design runs automatically after a merge, for tokens and assets only (components are design → code only). Both run from a session-start check in a background worktree and end in a PR the owner merges. Everything else keeps the per-item decision.".

### Consequences
`@utility` rules and keyframes leave the tokens area and are code-owned (`migrate-lock` drops their lock entries). The lock tracks `artifactUrl` and `lastChangeAt` instead of the project id and `updatedAt`. CI cannot run the sync; it needs a Claude session with artifact access.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-04
Supersedes: D499 in part (the Claude Design project and `DesignSync` as the design side; phase 1 manual-only).
