---
id: D0419
status: accepted
date: 2026-10-06
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, Tailwind, glass]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Glass utilities redesigned as four Tailwind compositions

## Context and Problem Statement
one requested glass look across the app, built from Tailwind's own scale rather than bespoke tokens.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`global.css` keeps exactly four glass utilities, each an `@apply` of stock Tailwind classes: `glass` (top-lit `bg-radial-[at_50%_0%]` white 5→10% wash, `border-y border-white/25`, `shadow-sm`, `backdrop-blur-sm`), `glass-tinted` (same, black wash), `glass-raised` and `glass-tinted-raised` (`shadow-md`, `backdrop-blur-md`). `glass-strong`, `glass-nav`, the `--glass*`/`--blur-glass*` tokens, `bg-glass*` colours and the unused `.stat-card` are removed. `BottomNav` uses `glass-raised` and its active `NavBtn` `glass-tinted-raised`; chart tooltips and `Select` option hover use `glass-tinted`; `.card-wrapper` blurs with `backdrop-blur-md`.", because one requested glass look across the app, built from Tailwind's own scale rather than bespoke tokens.

### Consequences
glass panels have top and bottom borders only, no side borders; the nav loses `saturate(180%)`. `.astro`/CSS carry no unit test (D101).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-06
Supersedes: D416 (`glass-nav` and `.nav-active` styling only).
