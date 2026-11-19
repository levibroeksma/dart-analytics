---
id: D0530
status: accepted
date: 2026-11-06
origin: contemporaneous
original-date:
tags: [frontend/style, Tailwind]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# design-sync reads `px` as `rem` and keeps non-theme aliases

## Context and Problem Statement
px/rem spellings of one length were reported as mismatches; `--title-foreground` and `--caption-foreground` were hidden from the sync.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`normaliseCss` spells every `px` length as `rem` (16px base). A `var(--x)` declaration is a passthrough, and dropped from the tokens diff, only inside `@theme` with a Tailwind namespace name (`--color-`, `--radius-`, …) ending in the referenced suffix; aliases in `:root` stay comparable.", because px/rem spellings of one length were reported as mismatches; `--title-foreground` and `--caption-foreground` were hidden from the sync.

### Consequences
`--title-foreground` and `--caption-foreground` now diff and need a re-record on the next sync run (#1132). A px that slips into the design side no longer shows as drift. Refines D499, D504.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-06
