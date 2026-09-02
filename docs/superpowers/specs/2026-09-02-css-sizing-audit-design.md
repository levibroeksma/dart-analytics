# Design: Split-scoreboard sizing audit (F15)

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes FINDINGS.md F15. One task: a mechanical, spec-driven CSS cleanup
across nine interface files plus one grid layout component. Not a
behavior change per the CSS spec's own flex/grid sizing rules — the
finding's own framing, and the reason this is safe to do without the
real-device verification the original bug report needed.

## Task 1 — drop the inert `h-full`, drop the dead `flex-1`

Every one of the nine game interfaces
(`app/src/components/layout/games/interfaces/*.astro`) passes
`class="max-h-2/5 h-full"` or `class="min-h-2/5 max-h-2/5 h-full"` to a
`SinglePlayerDisplay`/`SplitScoreboardHalf` (via `SplitScoreboard`) call —
verified current across all nine: `AroundTheClock.astro:24`,
`Bobs27.astro:27`, `DoublesTraining.astro:25`, `FiveOhOne.astro:26`,
`OneTwentyOne.astro:24`, `ScoreTraining.astro:24`, `Shanghai.astro:25`,
`SinglesTraining.astro:25`, `TenUpOneDown.astro:24`. (Each file's own 1v1
`SplitScoreboard` call site already reads plain `h-2/5`, unaffected —
`FiveOhOne.astro:76`'s fix from the original bug report already excluded
`h-full`; this task's own `FiveOhOne.astro:26` is the separate solo-mode
call site the original fix didn't touch.)

`SinglePlayerDisplay.astro:35`'s own base classes always include `flex-1`
(`cn("flex-1 min-h-0 glass rounded-lg", classNameProp)`), so every caller's
`h-full` lands on a flex item whose `flex-basis: 0%` (from `flex-1`)
already makes a percentage `height` inert per spec — cross-axis stretch
(the flex container's default `align-items: stretch`) already gives the
item its height. Dropping `h-full` at all nine call sites is a no-op
today and removes the one thing that could go wrong if a future edit
changes the parent's `align-items`.

Fix: at each of the nine call sites, drop `h-full` — `class="max-h-2/5"`
(or `class="min-h-2/5 max-h-2/5"` for the four that carry the extra
lower bound).

`SplitScoreboardHalf.astro`'s own root div separately carries a dead
`flex-1` (`SplitScoreboardHalf.astro:53`, inside `cn("flex flex-col gap-1
items-center min-h-0 flex-1", classNameProp)`): its parent,
`SplitScoreboard.astro:47`, is `grid grid-cols-2 divide-x divide-border
flex-1 min-h-0 rounded-lg` — `display: grid`, where `flex-*` properties on
a grid item have no effect at all. The column's actual height comes from
grid-row stretch (the grid's own default `align-items: stretch`), same
mechanism as the flex case above, different layout mode.

Fix: drop `flex-1` from `SplitScoreboardHalf.astro`'s root `cn(...)` call
— `cn("flex flex-col gap-1 items-center min-h-0", classNameProp)`.

## Testing

- No WebKit engine is available in this environment (D101's own
  constraint, restated in the original finding) — this cannot be verified
  against the real-device overlap the original bug report described, and
  this task does not claim to. Verification here is CSS-spec conformance
  (a flex/grid item with 100% cross-axis stretch has a definite size with
  or without an explicit percentage height/no-op `flex-1`) plus a visual
  smoke check in this environment's Chromium across all nine game
  interfaces (`npm run dev`, open each game's play screen solo and 1v1,
  confirm no layout shift against pre-change screenshots).
- No unit test exists or is added for `.astro` markup per D101
  (`app/CLAUDE.md`'s Test-Driven Development section) — out of scope for
  this project's test suite.

## Non-goals

No change to the `glass`/`backdrop-filter` stack the original production
overlap was actually traced to and already fixed (out of scope; that fix
already shipped). No change to `SinglePlayerDisplay.astro`'s or
`SplitScoreboard.astro`'s own base `flex-1`/`grid` classes — only the
caller-supplied inert `h-full` and the callee's dead `flex-1` are
removed. No on-device iOS/WebKit verification — flagged as an open gap
this task cannot close in this environment, matching the original
finding's own caveat.
