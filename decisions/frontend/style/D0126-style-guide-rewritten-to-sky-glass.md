---
id: D0126
status: accepted
date: 2026-07-22
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, glass, surface, font]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Style guide rewritten to sky/glass/`surface`/`foreground` vocabulary matching finalized

## Context and Problem Statement
Docs had drifted from `global.css` and live UI

## Decision Drivers
* The canonical docs still described the prior contract (`bg-bg`, `text-fg`, a teal accent, `.surface`, `.badge*`, `.nav-item*`) while `global.css` and the Score Training UI used the sky/glass system.
* `10-Frontend-Agent-Guide.md` § 12 mirrored the old list, so agents would invent against dead names.
* `Button.astro` still used `font-medium`, which the guide forbids.

## Considered Options
* Full rewrite of `07-Style-Guide.md` plus a mechanical audit of CSS and `.astro` files (the spec's "Approach 1", chosen).

## Decision Outcome
Chosen option: "Style guide rewritten to sky/glass/`surface`/`foreground` vocabulary matching finalized Score Training UI; legacy `fg`/`bg-bg`/old `.surface`/`.nav-item`/`.badge` doc contract retired; `font-medium` ban retained", because Docs had drifted from `global.css` and live UI.

### Consequences
* Good, because `10-Frontend-Agent-Guide.md` § 12 and a Style non-negotiables block in `app/CLAUDE.md` and `app/AGENT.md` carry the condensed new vocabulary.
* Neutral, because during the PR the finalized Score Training UI is the design intent and CSS changes to match; afterwards `global.css` is the runtime source of truth if guide and CSS disagree.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec names `scripts/check-context-map.sh`, `scripts/check-file-locations.sh` and `scripts/check-agent-mirrors.sh`. The `app/CLAUDE.md` and `app/AGENT.md` mirrors must stay byte-identical.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-22
Referenced by D0428's `Supersedes:` line.

* `docs/superpowers/specs/2026-07-22-style-guide-alignment-design.md` (Context, Decisions locked in brainstorming, § 1–3): rebuilt Context, Decision Drivers, Considered Options, Consequences and Confirmation.
* Commit `4ab73bf1` (PR #32, 2026-07-22; adds the D126 row): confirmed the guide rewrite shipped in that PR.
* Applied in: `docs/superpowers/plans/2026-07-22-style-guide-alignment.md`, `docs/superpowers/plans/2026-07-22-ui-polish-pr2-handoff.md`.
