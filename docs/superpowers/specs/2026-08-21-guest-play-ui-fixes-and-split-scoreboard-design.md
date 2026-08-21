# Guest-play UI fixes + split scoreboard — design

Date: 2026-08-21
Status: approved for planning

## Context

PR #154 shipped the add-guest control on the 501 setup screen. Screenshot
review found three small defects there, plus a bigger gap: the play page
still shows only the active seat, never both seats at once, so a 1v1 match
has no way to see the opponent's score. This spec covers both, plus a
repo-wide cleanup this work surfaced (unnecessary Tailwind `!important`
usage).

## 1. Setup-page fixes

`AddGuestButton.astro` (dashed add-circle) and `GuestSection.astro` (guest
avatar + remove badge), both under
`components/layout/games/setup/`.

- **Dashed outline too faint.** `border-2` → `border-6`, `border-tab-border`
  (a muted token, and used with implicit low contrast) → `border-accent`,
  full opacity (no `/NN` suffix).
- **Icon sizing backwards.** The remove badge currently sets `size-4` on the
  `Button` itself (fixed 16px square, `p-0`) with a smaller `size-2.5` icon
  inside. Correct shape: no fixed size on the button, `p-0.5` padding, and
  `size-4` on `CrossIcon` — the button's footprint follows the icon plus
  padding, and the icon centers via `Button.astro`'s existing
  `items-center justify-center`.
- **Only 1v1 is supported today** (D220/D221 multi-seat work landed for
  every engine, but guest-adding UI exists only on 501's setup screen, and
  only one guest seat is meaningful there — PLAYER + one GUEST = 2 seats).
  `AddGuestButton` must disappear once a guest exists, not just past 3:
  `x-show="guests.length < 3"` → `x-show="guests.length < 1"`. `addGuest()`
  in `five-oh-one-setup.data.ts` also gets a guard
  (`if (this.guests.length >= 1) return;`) so the cap holds even if
  something calls it directly, not just via the hidden button.

### New `Button.astro` variant: `dashed`

The add-guest circle's look (thick dashed accent border, transparent
background, muted icon) doesn't fit any existing variant
(`primary`/`secondary`/`ghost`/`error`). Rather than force it via override
classes, add a fourth variant:

```
dashed: "border-accent border-dashed bg-transparent text-muted-foreground"
```

`AddGuestButton.astro` becomes:

```astro
<Button
  type="button"
  variant="dashed"
  icon
  ariaLabel="Add guest"
  @click="showAddGuestModal = true"
  class="rounded-full p-3 border-6"
>
  <PlusIcon class="size-8" slot="iconBefore" />
</Button>
```

No `!` anywhere: `rounded-full` overrides the base `rounded-md` and
`p-3` overrides `icon`'s default `p-2.5` through plain Tailwind-class
precedence — `cn()` (`twMerge(clsx(...))`) already resolves both by
ordering, since `class` is merged last. `border-6` overrides the base
`border` (width) the same way; it stays a call-site class rather than
baked into the variant since only one border-width is meaningfully
different from the base, and keeping it at the call site keeps the variant
purely about color/style, not shape.

`GuestSection.astro`'s remove badge keeps `variant="ghost"`; its call-site
class drops the `!` suffixes: `class="absolute -top-1 -right-1 p-0.5 rounded-full bg-tab-card text-accent"`,
`CrossIcon` becomes `class="size-4"`.

## 2. Ban the Tailwind important modifier

Auditing every `!`-suffixed class in the repo (7 files:
`GameCard.astro`, `SetupShell.astro`, `FiveOhOneSetupForm.astro`,
`ScoreTrainingSetupForm.astro`, `pages/games/index.astro`,
`AddGuestButton.astro`, `GuestSection.astro`) found every single case is a
same-category Tailwind utility conflict (`rounded-md` vs `rounded-full`,
`bg-white` vs `bg-accent`, `flex-col` vs `flex-row`, …) — exactly what
`cn()`'s `twMerge` already resolves by class order. None of the existing
usages fight non-Tailwind CSS specificity (`global.css`'s `.btn`/`.btn-*`
classes only set transitions/shadows/hover backgrounds, never
padding/radius/border that a utility class would need to beat). The `!`
modifier was never structurally necessary anywhere it's currently used.

**Decision:** forbid the important modifier entirely — prefix (`!utility`,
already banned by D175) and suffix (`utility!`, currently the *sanctioned*
v4 form per D175) alike. Compose overrides as plain classes through
`cn()`'s merge ordering; when a primitive's own defaults are too far from
what's needed (a genuinely different shape/variant, not just one
conflicting utility), extend that primitive's variant/prop surface instead
(as `Button.astro`'s new `dashed` variant does above) rather than layering
overrides.

This supersedes D175's suffix-form endorsement — a new decision block goes
in `decisions/frontend/style.md`, citing `Supersedes: D175`.

Docs to update:
- `app/CLAUDE.md` — "Style non-negotiables": replace the suffix-important
  line with "No important modifier at all (prefix or suffix) — compose
  through `cn()`'s merge ordering, or extend the primitive's own
  variant/prop surface when its defaults conflict."
- `07-Frontend/07-Style-Guide.md` — the "Tailwind v4 class syntax" section
  (lines 206-215) and the anti-patterns table row (`Prefix important
  !utility | Suffix important utility!`) both get rewritten: no important
  modifier, either form, is the rule now.
- `scripts/check-style-tokens.sh` — extend the existing prefix-`!` check
  (`PREFIX_IMPORTANT`) to also flag the suffix form, and rename/relabel its
  output accordingly. This gate runs across all of `app/src`, so it only
  goes green once every existing `!` usage (all 7 files above, including
  the two migrated in section 1) is gone — migrating them is part of this
  same change, not a follow-up.

## 3. Split scoreboard (play page)

### Scope

Every multi-seat-capable engine (all 9 — the prior multi-seat architecture
work already made seat/participant data generic across all of them), not
just 501. Practically, only 501 can reach 2 seats today (it's the only
setup screen with guest-adding UI); every other engine keeps rendering
exactly as it does now until its own setup screen gets guest UI (still on
the deferred list). This is forward-compatible plumbing: no visual change
for any engine's existing 1-seat play, and a working 2-seat display the
moment a second seat becomes reachable.

### Component: `SplitScoreboard.astro`

New shared component,
`components/layout/games/SplitScoreboard.astro` (alongside
`SinglePlayerDisplay.astro`, which it wraps rather than replaces). Renders
two seat halves side by side (`grid grid-cols-2`, a vertical divider), each
half built from:

- **Header** — avatar + name (reusing the existing avatar markup shared by
  `UserIconDisplay.astro` and `GuestSection.astro`'s inline guest avatar)
  plus a small active-turn dot, shown when that seat is
  `activeSeat(facts, seats, stageOwnership)` (already generic, exported by
  `seat-rota.module.ts` — no new derivation logic needed for whose turn it
  is).
- **Optional leg-pill slot** — top corner, filled only where the engine has
  a legs/best-of concept. Today that's 501 alone (`FiveOhOneState.sides[].legsWon`);
  every other engine leaves the slot empty, same as the leg-wins concept
  simply not existing for them.
- **Body** — the existing `SinglePlayerDisplay` big score/target number,
  reused as-is (it already renders one number well).
- **Optional checkout-chip row** — the existing `checkoutHint()` string
  (`checkoutPathFor(...).join(" ")`), rendered as separate chips (one per
  path segment: e.g. `T20`, `9`, `D16`) instead of one line. Filled by 501
  and OneTwentyOne, the only two engines with a `checkoutHint()`; every
  other engine's slot stays empty.
- **Progress** — each engine's own existing per-game `StatRow` set
  (501: avg/previous/darts; Bobs27: target; Shanghai: round/target;
  SinglesTraining: misses/singles/doubles/trebles; etc.), unchanged in
  content, just parameterized by seat instead of implicitly "the" player.
- **Optional stage-progress dots** — bottom of each half, one dot per
  stage, filled for stages already played. Only meaningful where the
  engine's config exposes a fixed target stage count (today: 501's
  `legsToWin`); scoped identically to the leg-pill for the same reason —
  an open-ended session (no fixed target) has nothing to bound the dot
  count to.

### Wiring

Each engine's interface `.astro` (`FiveOhOne.astro`, `Bobs27.astro`, …)
branches on `state().seats.length`:

- `1` seat → today's unchanged single `SinglePlayerDisplay` call, byte-for-byte
  the same as now.
- `2` seats → `SplitScoreboard`, passing each seat's own progress markup
  into two named slots (`seatA` / `seatB`).

### Data layer

Every `*-play.data.ts` gets seat-parameterized siblings of its existing
derived getters — e.g. 501's `remainingScore()` becomes
`remainingScore(seatRef: string)`, filtering `$store.game.turns` /
`state().seats` by that ref instead of implicitly using
`state().activeParticipantRef`. No-arg call sites are preserved by having
the existing no-arg getter delegate to the seat-parameterized one with the
active seat's ref, so today's single-seat markup (and its tests) don't
change. This is a derived-data change only — no new persisted state; the
underlying per-seat fact log already exists for every engine from the
prior multi-seat work.

### Out of scope

- Guest-adding UI on the other 8 setup screens (still deferred — this spec
  only makes the *play page* ready for when that lands).
- More than 2 seats (2v2, etc.) — the shell is a two-column layout, not an
  N-up grid; a 3+-seat layout is a separate design.
- A second swipeable stats screen per seat — the dot pager is stage
  progress, not a page carousel.

## Testing

- Setup fixes: extend
  `app/tests/lib/game/five-oh-one-setup.data.test.ts` for the `addGuest()`
  hard cap; `.astro` markup changes get no unit test (D101) — verified by
  `npm run check` plus a manual dev-server pass.
- `Button.astro`'s new `dashed` variant: no dedicated test file exists for
  `Button.astro` today (D101 — `.astro` markup isn't unit-tested); covered
  the same way as its other three variants, by `npm run check` and manual
  verification.
- Split scoreboard: each engine's new seat-parameterized getters get tests
  mirroring the existing no-arg getter tests, plus new 2-seat cases
  (verifying seat A's stats don't leak into seat B's).
- `check-style-tokens.sh`'s extended suffix-`!` check is itself gate
  coverage — no separate test needed, it runs pre-commit and in CI.

## Rollout

Given the size (9 engines' play data + interfaces, plus the setup fixes and
the important-modifier migration), the implementation plan splits into:
setup fixes + important-modifier migration first (small, self-contained),
then the shared `SplitScoreboard` shell wired into 501 (proves the pattern
end-to-end against the one engine that can actually reach 2 seats today),
then one task per remaining engine (Bobs27, OneTwentyOne, Shanghai,
AroundTheClock, TenUpOneDown, SinglesTraining, DoublesTraining,
ScoreTraining).
