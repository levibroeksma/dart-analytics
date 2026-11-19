---
id: D0327
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, primitive, surface]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The play screen's scoreboard band is one shape, owned by the two shells

## Context and Problem Statement
three spellings were live for one region (issue #484): `max-h-2/5` on seven screens, `min-h-2/5 max-h-2/5` on five, and `h-2/5` on all nine `SplitScoreboard` calls, with nothing written down about which a new screen should copy. The third was not a third height but no height at all: `SplitScoreboard`'s root is `flex-1 min-h-0`, so `h-2/5` was inert for exactly the reason D326's `h-full` was, and the two-seat scoreboard has been growing to fill the play area rather than the 40% its author wrote. `min-h-2/5 max-h-2/5` is the spelling that survives on a `flex-1` item, so it is the one that becomes the rule. Owning it in the shells rather than naming a `global.css` primitive was chosen because the geometry is not a look a screen opts into — it is what these two components *are* when used as the region; a primitive class would have left the same 21 repetitions in place under a nicer name.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the region at the top of every play screen is `min-h-2/5 max-h-2/5` — 40% of the play area, identical for one seat and two. `SplitScoreboard.astro` carries it unconditionally; `SinglePlayerDisplay.astro` carries it behind a new `pinnedHeight?: boolean` prop defaulting to `true`, which only `SplitScoreboardHalf.astro` sets to `false` (its card is nested *inside* the band, not the band itself). All 21 call sites — twelve `SinglePlayerDisplay`, nine `SplitScoreboard` — drop their height class and pass none.".

### Consequences
two-seat play screens change visibly — the scoreboard stops filling the play area and sits at 40%, matching the one-seat screens and returning the space to the input surface. Estimated against the 501 two-seat column at 390×844 (the richest content: name, `text-4xl` number, label, checkout chips, three stat rows, leg pill and dot pager) the band's ~292px has roughly 55px of headroom, but that is arithmetic, not a measurement: this environment has no WebKit and its one Chromium build (MDM-managed Edge) crashes headless, so **the two-seat screens need an on-device look before this is trusted** — if a column overflows, the fix is the band's fraction or the column's content, not a per-screen class. `min-h-0` leaves `SplitScoreboard`'s base classes, superseded by `min-h-2/5`. The rule is prose in `07-Frontend/07-Style-Guide.md`; no gate can see an element's flex context.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-19
Referenced by D0432's `Supersedes:` line.
