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

# Login follows the design: inset fields, raised submit

## Context and Problem Statement
one condition for text and rings keeps `login.data.ts` unchanged; the design does not distinguish error kinds.

## Decision Drivers
* Restyle `app/src/pages/login/index.astro` to the Claude Design `Login.dc.html` screens, as a markup and style pass only (spec, Goal).
* Leave `lib/auth/login.data.ts` unchanged (spec, Goal).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`/login` follows Claude Design `Login.dc.html`: `BaseLayout backdrop="home"`, a `glass` card at `rounded-board` with the new `shadow-card`, the 230×80 logo lockup, mono eyebrow labels that turn `accent-bright` while their field has focus, `.field-inset` fields, and a `sheet-raised` "Sign in" at `rounded-xl`. Any login error rings both fields with the new `.field-inset-error`, the same condition that shows the error text.", because one condition for text and rings keeps `login.data.ts` unchanged; the design does not distinguish error kinds.

### Consequences
no logic change and no new icon. `.astro` carries no unit test (D101); CSS is pinned in `brand-tokens.test.ts`. Deferred (GitHub issue): the unused Inter font link in `BaseLayout`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Spec § Testing: no new unit test (D101); the `login.data.ts` tests stay green and unchanged. Checks are `npm run validate:app`, the astro and style-token gate scripts, `npm run format:check` and a visual check of the default, focus and error states at 390×844.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-08

* Commit `99a86b62` (PR #836, 2026-10-08; adds the D431 row, the spec and the plan): origin of the existing Context, Decision Outcome and Consequences text.
* `docs/superpowers/specs/2026-10-08-login-redesign-design.md` (Goal, Scope, Form, Testing): rebuilt Decision Drivers, Consequences and Confirmation.
