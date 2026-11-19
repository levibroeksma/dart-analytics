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

# design-sync reads `px` as `rem` and keeps non-theme aliases

## Context and Problem Statement
px/rem spellings of one length were reported as mismatches; `--title-foreground` and `--caption-foreground` were hidden from the sync.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`normaliseCss` spells every `px` length as `rem` (16px base). A `var(--x)` declaration is a passthrough, and dropped from the tokens diff, only inside `@theme` with a Tailwind namespace name (`--color-`, `--radius-`, …) ending in the referenced suffix; aliases in `:root` stay comparable.", because px/rem spellings of one length were reported as mismatches; `--title-foreground` and `--caption-foreground` were hidden from the sync.

### Consequences
`--title-foreground` and `--caption-foreground` now diff and need a re-record on the next sync run (#1132). A px that slips into the design side no longer shows as drift. Refines D499, D504.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/scripts/design-sync/tokens.test.ts` asserts that `normaliseCss("20px")` equals `normaliseCss("1.25rem")`; commit `d353426c` added 23 test lines there.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-06
* Commit `d353426c` (2026-11-06, "fix: design-sync reads px as rem and keeps :root colour aliases (#1132 #1133)"): adds the D530 row, whose text is the existing Context, Decision Outcome and Consequences; rebuilt Confirmation from its diff.
