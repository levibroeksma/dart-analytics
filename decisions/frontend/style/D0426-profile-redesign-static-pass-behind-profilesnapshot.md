---
id: D0426
status: accepted
date: 2026-10-07
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, glass, font]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Profile redesign, static pass behind `profileSnapshot()`

## Context and Problem Statement
a design-led phase towards one look; these primitives are meant for later pages.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`/profile` follows the Claude Design `Profile.dc.html` mock. It uses the home backdrop, a Michroma header with a round `glass-button` logout, an identity row, and "Player settings" and "App mode" cards. The stats line binds to `profileSnapshot()` (`lib/profile/profile-snapshot.data.ts`), a fixture-only factory; initials come from the live display name. New shared primitives: `.accent-orb` (gradient + glow, the selected/avatar fill), `.accent-orb-halo`, `.field-inset` (sunken field with an accent focus ring) and `--strong-foreground`. The pickers become two-pill segmented tracks and drop their checkmarks; selection is shown by the fill and `aria-checked`. The display name gets a client-only `maxlength` of 24. The design's weight-500 text renders at 400, because `font-medium` is banned.", because a design-led phase towards one look; these primitives are meant for later pages.

### Consequences
the profile shows sample career totals until the data pass. A one-word display name gives one initial. `.astro`/CSS carry no unit test (D101); the `profileSnapshot()` helpers are tested.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-07
Referenced by D0428's `Supersedes:` line.
