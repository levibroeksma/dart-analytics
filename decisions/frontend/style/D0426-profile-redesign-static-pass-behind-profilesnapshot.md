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

# Profile redesign, static pass behind `profileSnapshot()`

## Context and Problem Statement
a design-led phase towards one look; these primitives are meant for later pages.

## Decision Drivers
* A design-led phase moves the app towards one look, and the new primitives are meant for later pages.
* The stats line under the name shows fixture values; a later data pass swaps them without touching markup.

## Considered Options
* Restyle `/profile` to the `Profile.dc.html` mock, with fixture stats behind `profileSnapshot()` (chosen).

## Decision Outcome
Chosen option: "`/profile` follows the Claude Design `Profile.dc.html` mock. It uses the home backdrop, a Michroma header with a round `glass-button` logout, an identity row, and "Player settings" and "App mode" cards. The stats line binds to `profileSnapshot()` (`lib/profile/profile-snapshot.data.ts`), a fixture-only factory; initials come from the live display name. New shared primitives: `.accent-orb` (gradient + glow, the selected/avatar fill), `.accent-orb-halo`, `.field-inset` (sunken field with an accent focus ring) and `--strong-foreground`. The pickers become two-pill segmented tracks and drop their checkmarks; selection is shown by the fill and `aria-checked`. The display name gets a client-only `maxlength` of 24. The design's weight-500 text renders at 400, because `font-medium` is banned.", because a design-led phase towards one look; these primitives are meant for later pages.

### Consequences
the profile shows sample career totals until the data pass. A one-word display name gives one initial. `.astro`/CSS carry no unit test (D101); the `profileSnapshot()` helpers are tested.

* Good, because the shared primitives (`.accent-orb`, `.field-inset`, `--strong-foreground`) land in `global.css` for later pages.
* Neutral, because the spec accepts other pages picking up the changed tokens.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`profileSnapshot()` helpers are tested in `app/tests/lib/profile/profile-snapshot.data.test.ts` (`formatStatsLine`, `initials`, snapshot shape). Markup is verified by `npm run validate:app`, `scripts/check-astro-conventions.sh` and a visual check at 390px against both design frames. `.astro`/CSS carry no unit test (D101).

## Pros and Cons of the Options
### Static pass behind `profileSnapshot()`
* Good, because the data pass can replace the constant without touching markup; the shape is the contract.
* Bad, because the profile shows sample totals until then.

## Evidence / More Information
Decided: 2026-10-07
Referenced by D0428's `Supersedes:` line.

* `docs/superpowers/specs/2026-10-07-profile-redesign-design.md` (Goal, Scope, Units 1–4, Testing, Implementation notes): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Commit `94ab38a5` (PR #813, 2026-10-07; adds the D426 row).
* Partly superseded by D428 (the 500→400 rendering note).
