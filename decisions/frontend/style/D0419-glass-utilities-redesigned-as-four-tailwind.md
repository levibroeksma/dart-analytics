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

# Glass utilities redesigned as four Tailwind compositions

## Context and Problem Statement
one requested glass look across the app, built from Tailwind's own scale rather than bespoke tokens.

## Decision Drivers
* One requested glass look across the app.
* The utilities should build on Tailwind's own scale rather than bespoke tokens.

## Considered Options
* Four `@apply` compositions of stock Tailwind classes (chosen).
* The previous `glass-strong`, `glass-nav`, `--glass*`/`--blur-glass*` tokens and `bg-glass*` colours.

## Decision Outcome
Chosen option: "`global.css` keeps exactly four glass utilities, each an `@apply` of stock Tailwind classes: `glass` (top-lit `bg-radial-[at_50%_0%]` white 5→10% wash, `border-y border-white/25`, `shadow-sm`, `backdrop-blur-sm`), `glass-tinted` (same, black wash), `glass-raised` and `glass-tinted-raised` (`shadow-md`, `backdrop-blur-md`). `glass-strong`, `glass-nav`, the `--glass*`/`--blur-glass*` tokens, `bg-glass*` colours and the unused `.stat-card` are removed. `BottomNav` uses `glass-raised` and its active `NavBtn` `glass-tinted-raised`; chart tooltips and `Select` option hover use `glass-tinted`; `.card-wrapper` blurs with `backdrop-blur-md`.", because one requested glass look across the app, built from Tailwind's own scale rather than bespoke tokens.

### Consequences
glass panels have top and bottom borders only, no side borders; the nav loses `saturate(180%)`. `.astro`/CSS carry no unit test (D101).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Four Tailwind compositions
* Good, because the look comes from Tailwind's own scale, not bespoke tokens.
* Bad, because glass panels lose side borders and the nav loses `saturate(180%)`.

## Evidence / More Information
Decided: 2026-10-06
Supersedes: D416 (`glass-nav` and `.nav-active` styling only).

* Commit `02fb0458` (2026-10-06; commit message and `global.css` diff): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
