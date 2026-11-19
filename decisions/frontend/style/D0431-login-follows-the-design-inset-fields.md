---
id: D0431
status: accepted
date: 2026-10-08
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, glass, icon, font]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Login follows the design: inset fields, raised submit

## Context and Problem Statement
one condition for text and rings keeps `login.data.ts` unchanged; the design does not distinguish error kinds.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`/login` follows Claude Design `Login.dc.html`: `BaseLayout backdrop="home"`, a `glass` card at `rounded-board` with the new `shadow-card`, the 230×80 logo lockup, mono eyebrow labels that turn `accent-bright` while their field has focus, `.field-inset` fields, and a `sheet-raised` "Sign in" at `rounded-xl`. Any login error rings both fields with the new `.field-inset-error`, the same condition that shows the error text.", because one condition for text and rings keeps `login.data.ts` unchanged; the design does not distinguish error kinds.

### Consequences
no logic change and no new icon. `.astro` carries no unit test (D101); CSS is pinned in `brand-tokens.test.ts`. Deferred (GitHub issue): the unused Inter font link in `BaseLayout`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-08
