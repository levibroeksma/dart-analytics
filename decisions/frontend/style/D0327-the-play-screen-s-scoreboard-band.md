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

# The play screen's scoreboard band is one shape, owned by the two shells

## Context and Problem Statement
three spellings were live for one region (issue #484): `max-h-2/5` on seven screens, `min-h-2/5 max-h-2/5` on five, and `h-2/5` on all nine `SplitScoreboard` calls, with nothing written down about which a new screen should copy. The third was not a third height but no height at all: `SplitScoreboard`'s root is `flex-1 min-h-0`, so `h-2/5` was inert for exactly the reason D326's `h-full` was, and the two-seat scoreboard has been growing to fill the play area rather than the 40% its author wrote. `min-h-2/5 max-h-2/5` is the spelling that survives on a `flex-1` item, so it is the one that becomes the rule. Owning it in the shells rather than naming a `global.css` primitive was chosen because the geometry is not a look a screen opts into — it is what these two components *are* when used as the region; a primitive class would have left the same 21 repetitions in place under a nicer name.

## Decision Drivers
* 3 spellings were live for one region (issue #484): `max-h-2/5` on 7 screens, `min-h-2/5 max-h-2/5` on 5, and `h-2/5` on all 9 `SplitScoreboard` calls.
* Nothing written down said which spelling a new screen should copy.
* `h-2/5` was inert on `SplitScoreboard`, whose root is `flex-1 min-h-0`, so the two-seat scoreboard filled the play area.
* `min-h-2/5 max-h-2/5` is the spelling that survives on a `flex-1` item.

## Considered Options
* Make `min-h-2/5 max-h-2/5` the rule and own it in the two shells (chosen).
* Name a `global.css` primitive class for the band (rejected).
* Keep the 3 per-screen spellings.

## Decision Outcome
Chosen option: "the region at the top of every play screen is `min-h-2/5 max-h-2/5` — 40% of the play area, identical for one seat and two. `SplitScoreboard.astro` carries it unconditionally; `SinglePlayerDisplay.astro` carries it behind a new `pinnedHeight?: boolean` prop defaulting to `true`, which only `SplitScoreboardHalf.astro` sets to `false` (its card is nested *inside* the band, not the band itself). All 21 call sites — twelve `SinglePlayerDisplay`, nine `SplitScoreboard` — drop their height class and pass none.".

### Consequences
two-seat play screens change visibly — the scoreboard stops filling the play area and sits at 40%, matching the one-seat screens and returning the space to the input surface. Estimated against the 501 two-seat column at 390×844 (the richest content: name, `text-4xl` number, label, checkout chips, three stat rows, leg pill and dot pager) the band's ~292px has roughly 55px of headroom, but that is arithmetic, not a measurement: this environment has no WebKit and its one Chromium build (MDM-managed Edge) crashes headless, so **the two-seat screens need an on-device look before this is trusted** — if a column overflows, the fix is the band's fraction or the column's content, not a per-screen class. `min-h-0` leaves `SplitScoreboard`'s base classes, superseded by `min-h-2/5`. The rule is prose in `07-Frontend/07-Style-Guide.md`; no gate can see an element's flex context.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The rule is prose in `07-Frontend/07-Style-Guide.md`; `scripts/check-style-tokens.sh` does not check it, because it has no notion of an element's flex context.

## Pros and Cons of the Options
### Shell-owned `min-h-2/5 max-h-2/5`
* Good, because the geometry is what these two components are when used as the region, not a look a screen opts into.
* Good, because the 21 repetitions disappear.

### `global.css` primitive class
* Bad, because it would leave the same 21 repetitions in place under a nicer name.

## Evidence / More Information
Decided: 2026-09-19
Referenced by D0432's `Supersedes:` line.

* Commit `ff5ad196` (2026-09-19; refs #280, #484): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation, and Pros and Cons.
* Partly superseded by D432 (the `pinnedHeight` clause only, per commit `d658a0d0`).
* Applied in: `docs/superpowers/specs/2026-10-08-game-play-redesign-design.md`, `docs/superpowers/plans/2026-10-08-game-play-redesign.md`.
