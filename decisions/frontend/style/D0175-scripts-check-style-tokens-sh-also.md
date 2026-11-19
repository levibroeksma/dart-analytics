---
id: D0175
status: superseded
date: 2026-08-21
origin: contemporaneous
original-date:
tags: [frontend/style, style, Tailwind, safe-area]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0226
---
<!-- backfill: pending -->

# `scripts/check-style-tokens.sh` also bans Tailwind v3 prefix-important (`!utility`) and

## Context and Problem Statement
Agents repeatedly landed deprecated forms; prose in the Style Guide was not enough — same latency pattern as D161. Shipped id is D175, not D174 — D174 was already taken by the 2026-07-29 safe-area-inset decision

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`scripts/check-style-tokens.sh` also bans Tailwind v3 prefix-important (`!utility`) and leading-dash arbitrary negatives (`-prop-[…]`) in favor of v4 `utility!` / `prop-[-…]`".

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-31
