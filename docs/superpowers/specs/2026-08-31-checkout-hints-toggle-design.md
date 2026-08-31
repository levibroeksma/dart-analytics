# Checkout Hints Toggle — Design

Issue: #203

## Problem

501, 121, and TUOD compute a suggested checkout route (`checkoutPathFor`) but
only 501 and 121 display it, unconditionally. TUOD never displays it. Players
who want to work out their own route can't turn the hint off; TUOD players
never get one at all. Issue #203 asks for a setup-page toggle controlling
whether the hint is shown, across both recreational and analytics mode, for
all three game types.

## Decision: client-only preference, one shared toggle, default on

- **Storage:** `$persist`-only Alpine store, no backend. Same rationale
  already documented on `boardInputStore`'s `handedness` field: a per-device
  rendering preference, not gameplay data, stays out of `player_settings`
  and out of session `config_snapshot`. No migration, no Zod config-schema
  change, no API change.
- **Scope:** one shared boolean, not per-game-type. The issue frames this as
  a single personal preference ("help the player" vs. "make them think"),
  not a per-ruleset rule.
- **Default:** `true`. 501 and 121 already show the hint unconditionally
  today; defaulting on preserves current behavior for existing players.

## Components

### `stores/checkout-hints.store.ts` (new)

```ts
export function checkoutHintsStore(persist: PersistFactory) {
  return {
    enabled: persist<boolean>(true).as("checkoutHints.enabled"),
  };
}
```

Registered in `lib/client/alpine/register-stores.ts` next to `boardInput`
(same `persist` factory already threaded through).

### `components/forms/Switch.astro` (new)

Boolean switch primitive, adapted from the brand-conformant markup supplied
with the issue. Props: `label` (string), `hint?` (string), `class?`, rest
spread onto the native `<input>` (so `x-model`, `:disabled`, etc. bind the
same way `Input.astro` forwards attributes).

Token remap from the supplied markup to this repo's semantic tokens:

| Supplied class | Replacement | Why |
| --- | --- | --- |
| `bg-neutral-quaternary` | `bg-surface-overlay` | nested-well token (Style Guide "Surfaces") |
| `peer-focus:ring-brand-soft` | `peer-focus-visible:ring-accent-muted` | accent scale; focus-visible only, matching `.control`'s existing rule |
| `peer-checked:bg-brand` | `peer-checked:bg-accent` | accent scale |
| `after:bg-white` | `after:bg-foreground` | semantic token, same visual value in this dark-only theme |
| `text-heading` | `text-foreground` | no `text-heading` token exists |
| `peer-checked:after:border-buffer` | dropped | no `border` width was ever set on `after:`, so this was inert in the source markup; `border-buffer` isn't a token here either |
| `dark:peer-focus:ring-brand-soft` | dropped | this app is dark-only (no light/dark split) |
| `rtl:peer-checked:after:-translate-x-full` | kept as-is | valid scale-negative, no change needed |

Styling stays as static Tailwind classes composed inline (no new
`global.css` primitive) — this shape isn't shared by another component the
way `.control`/`.btn` are, matching how `Toggle.astro` is written.

### Setup forms

One `<Switch label="Show checkout hints" x-model="$store.checkoutHints.enabled" />`
added inside `SettingSectionShell` in:

- `components/layout/games/setup/FiveOhOneSetupForm.astro`
- `components/layout/games/setup/OneTwentyOneSetupForm.astro`
- `components/layout/games/setup/TuodSetupForm.astro`

### Gating the hint

`checkoutHint()` / `checkoutHintFor(seatRef)` in `five-oh-one-play.data.ts`
and `one-twenty-one-play.data.ts`: return `""` when
`this.$store.checkoutHints.enabled` is `false`, unchanged otherwise.

### TUOD: net-new hint display

TUOD has no hint display today — `checkoutPathFor` is only used internally
to decide whether a matched-target attempt opens the double-confirm dialog.
Adding the toggle for TUOD (named explicitly in the issue) requires adding
the hint itself first:

- `tuod-play.data.ts`: add `checkoutHint()` / `checkoutHintFor(seatRef)`,
  same shape as 501's, keyed off `currentTarget` instead of
  `remainingScore`, gated by the same store field.
- `TenUpOneDown.astro`: single-player progress slot gets a hint `<p>`
  (mirroring `FiveOhOne.astro`'s), and both `SplitScoreboard` seats gain a
  `checkoutExpr` (currently unset there — `SplitScoreboardHalf` already
  supports the prop).

## Testing

Vitest, per `app/CLAUDE.md` TDD requirement:

- `checkout-hints.store.ts` — new test under `app/tests/stores/`.
- `five-oh-one-play.data.ts`, `one-twenty-one-play.data.ts`,
  `tuod-play.data.ts` — cover the on/off branches of
  `checkoutHint`/`checkoutHintFor` in their existing test files.
- No test runner exists for `.astro` markup (D101) — `Switch.astro` and the
  setup-form/interface wiring are exercised only by existing/updated data
  factory tests plus manual verification in the dev server.

## Out of scope

- Syncing the preference across devices (would require the account-level
  `player_settings` route — rejected as too heavy for this issue).
- Per-game-type independent toggles.
- A new `global.css` primitive for the switch shape (only one consumer
  today).

## Finding (not fixed here)

`07-Frontend/08-Component-Inventory.md` and `07-Frontend/07-Style-Guide.md`
both reference `Checkbox.astro` / `Radio.astro` as the consumers of the
`.control` primitive class, but neither file exists in
`app/src/components/`. Logging to `FINDINGS.md` per the root `CLAUDE.md`
rule — not acted on in this task.
