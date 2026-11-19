---
id: D0013
status: accepted
date:
origin: contemporaneous
original-date:
tags: [architecture, configuration, snapshot]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Configuration chain `game_type → ruleset_version → snapshot`

## Context and Problem Statement
Template edits must not rewrite history. The ledger row cites design conversation prompts P21–25 and carries no further reasoning.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Configuration chain `game_type → ruleset_version → snapshot`; runtime copies config, never FK-references templates", because Template edits must not rewrite history.

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Source: P21–25

* Commit `8b23f90e` (2026-07-11; adds `architecture/DECISIONS.md`, a one-line-per-decision ledger distilled from design prompts 1–85 and dated sessions): rebuilt Context.
