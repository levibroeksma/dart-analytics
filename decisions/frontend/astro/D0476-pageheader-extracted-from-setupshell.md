---
id: D0476
status: accepted
date: 2026-10-21
origin: contemporaneous
original-date:
tags: [frontend/astro, layout, page, slot]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `PageHeader` extracted from `SetupShell`

## Context and Problem Statement
the routine-detail redesign needs the same header as the setup screens plus a trailing action slot.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`components/layout/PageHeader.astro` (glass back link, centred title, optional `actions` slot) is the one page-header row; `SetupShell` and the routine-detail page both use it. Destructive-confirm styling: D477.", because the routine-detail redesign needs the same header as the setup screens plus a trailing action slot.

### Consequences
the style-token allowlist entry moved from `SetupShell` to `PageHeader`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-21
