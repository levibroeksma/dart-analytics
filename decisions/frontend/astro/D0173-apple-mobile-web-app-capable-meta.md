---
id: D0173
status: accepted
date: 2026-07-29
origin: contemporaneous
original-date:
tags: [frontend/astro, PWA, manifest]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `apple-mobile-web-app-capable` meta tags + `app/public/manifest.json` (`scope`/`start_url

## Context and Problem Statement
No manifest or meta tags existed; "Add to Home Screen" produced an unconfigured Safari Web Clip that could break navigation out to Safari on an auth redirect
The iOS Home Screen auth spec found that Add to Home Screen produced an unconfigured Safari Web Clip, because the app had no `apple-mobile-web-app-capable` tag or manifest reference. The spec ships a PWA manifest and the meta tags in the same change as the same-origin auth proxy (D172), scoped to `/`.

## Decision Drivers
* An auth redirect could break navigation out to Safari.
* The spec treats the manifest and meta tags as required for a working installed-PWA login.

## Considered Options
* Declare the app as an installable standalone PWA with `manifest.json` and meta tags (chosen).
* Leave the unconfigured Web Clip. The spec records it as the current gap.

## Decision Outcome
Chosen option: "`apple-mobile-web-app-capable` meta tags + `app/public/manifest.json` (`scope`/`start_url: "/"`, `display: "standalone"`) declare the app as an installable PWA", because No manifest or meta tags existed; "Add to Home Screen" produced an unconfigured Safari Web Clip that could break navigation out to Safari on an auth redirect.

### Consequences
* Neutral, because `scope` and `start_url` pin to `/` and `display` is `standalone`.
* Neutral, because `BaseLayout.astro` carries the manifest link and the `apple-mobile-web-app` meta tags.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's verification plan includes a manual check on iOS that the installed app shows the `manifest.json` name. `app/public/manifest.json` exists, and `BaseLayout.astro` links it.

## Pros and Cons of the Options
### Standalone PWA manifest and meta tags
* Good, because navigation, including auth redirects, stays inside the installed app.

### Unconfigured Web Clip
* Bad, because an auth redirect could break navigation out to Safari.

## Evidence / More Information
Decided: 2026-07-29

* `docs/superpowers/specs/2026-07-29-ios-web-app-auth-design.md` (Problem, Goals, decision B6, ledger proposal, Verification Plan): rebuilt Context, Decision Drivers, Considered Options, Consequences and Confirmation.
* Commit `420c566b` (PR #59, 2026-07-30; adds the D173 row with the spec): confirmed the origin.
* `docs/superpowers/plans/2026-07-29-ios-web-app-auth.md` (Task 5): rebuilt Consequences.
