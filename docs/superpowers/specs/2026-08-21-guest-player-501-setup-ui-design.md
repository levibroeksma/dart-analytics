# Guest-Player Add Button — 501 Setup UI

> **Scope:** the setup-screen drawing spec the prior architecture design (`2026-08-20-guest-player-x01-design.md`) deferred — an add-guest control and modal on the 501 setup screen, and the participant-array composition that carries chosen guests into `POST /api/sessions`.
> **Out of scope:** the other 8 setup screens (their engines/API reject a second seat — see below), play/results screen changes, 2v2 pairing, reusable guest rosters, DartBot.

## Why only 501

`services/session-seats.service.ts`'s `rejectSeatRequest` hard-rejects more than one seat unless `rulesetVersionKey === "501_V1"`, and none of the other 8 engines declare `PER_SEAT` stage ownership. Adding the button to those setup screens would render a control whose submission always 400s. The prior design explicitly deferred "wiring the other eight engines" as separate work; this spec does not open that scope.

## Components

**`app/src/icons/plus.svg`** (new) — a thick plus, heavier stroke than the existing `cross.svg`, `size-8` at the button's scale.

**`AddGuestButton.astro`** (new, `components/layout/games/setup/`) — circle button matching `UserIconDisplay`'s avatar circle: `p-3 w-fit rounded-full border-2 border-dashed border-tab-border`, `PlusIcon` at `size-8 text-muted-foreground`, no label. Wrapped in the same `flex flex-col items-center` shell as `UserIconDisplay` with an invisible name-slot placeholder, so its circle top-aligns with the row instead of sitting lower once a labelled icon is beside it. `@click="showAddGuestModal = true"`. `x-show="guests.length < 3"` (3 guest seats + 1 owner = `MAX_SEATS`).

**Guest icon + remove badge** — `UserIconDisplay` reused unchanged (same sky-ring style as the owner; seats are told apart by name/ref, not color), wrapped in `relative`:
```astro
<div class="relative">
  <UserIconDisplay name={g.displayName} nameExpr={`guests[${i}].displayName`} />
  <button type="button" aria-label={`Remove ${g.displayName}`} @click={`removeGuest(${i})`}
    class="absolute -top-1 -right-1 size-4 rounded-full bg-tab-card text-accent flex items-center justify-center">
    <CrossIcon class="size-2.5" />
  </button>
</div>
```

**`GuestNameModal.astro`** (new) — `Modal` shell (`titleId`, `dismissible={false}` while a name is mid-entry is unnecessary; use default dismissible with `onDismiss="showAddGuestModal = false; newGuestName = ''"`) + `Input` (`x-model="newGuestName"`, `maxlength="24"`) + footer: `Cancel` (secondary, closes and clears) / `Add` (primary, `:disabled="!newGuestName.trim()"`, `@click="addGuest()"`).

**`UserSection.astro`** — new `allowGuests?: boolean = false` prop. When true: owner `UserIconDisplay` → `x-for="(g, i) in guests"` guest block → `AddGuestButton` → `GuestNameModal` (`x-if="showAddGuestModal"`). When false (all 8 other setup forms, unchanged callers): renders exactly what it renders today — no new markup, no new Alpine references, so those pages' controllers need no changes.

**`FiveOhOneSetupForm.astro`** — passes `allowGuests` to `UserSection`.

## State (`five-oh-one-setup.data.ts`)

Added to `fiveOhOneSetup()`, alongside the existing `loading`/`error`/etc.:
```ts
guests: [] as { displayName: string }[],
showAddGuestModal: false,
newGuestName: "",

addGuest(this: FiveOhOneSetupContext) {
  const name = this.newGuestName.trim();
  if (!name) return;
  this.guests.push({ displayName: name });
  this.newGuestName = "";
  this.showAddGuestModal = false;
},

removeGuest(this: FiveOhOneSetupContext, index: number) {
  this.guests.splice(index, 1);
},
```
In-memory only — no persistence, cleared implicitly by navigation (success) or reload. `FiveOhOneSetupContext` (in `./types`) gains `guests`, `showAddGuestModal`, `newGuestName`.

## Session-create composition

`start()` builds `participants` only when guests exist, so the solo path is unchanged:
```ts
const participants = this.guests.length
  ? [
      { participantTypeKey: "PLAYER" as const, sideKey: "A" },
      ...this.guests.map((g, i) => ({
        participantTypeKey: "GUEST" as const,
        displayName: g.displayName,
        sideKey: String.fromCharCode(66 + i),
      })),
    ]
  : undefined;

const session = await createSession({ ..., participants });
```
`session.participants` (server-minted refs) flows unchanged through the existing `startSessionInput()`, which already builds `seats` from whatever `participants` array the response carries.

## Errors

No new error path. `addGuest()` trims and no-ops on blank; the `Add` button is also `:disabled` on blank, so an unnamed guest can never reach `start()`. Duplicate guest names are allowed (per the architecture design — seats are told apart by ref, not name), so no dedupe check. The guest count is capped client-side at 3 (`AddGuestButton`'s `x-show`), matching the server's 4-seat max, so `rejectSeatRequest`'s rejections have no live UI path left to trigger; `start()`'s existing generic catch (`"Could not start the session. Try again."`) is sufficient if it ever did.

## Testing

`app/tests/lib/game/five-oh-one-setup.data.test.ts` (existing, extended):
- `addGuest()` trims, ignores blank/whitespace-only input, pushes `{displayName}`, closes the modal, clears `newGuestName`
- `removeGuest(i)` splices the correct entry
- `start()` with `guests: []` sends `participants: undefined` (regression guard — solo path byte-identical to today)
- `start()` with guests sends `participants` = `[{PLAYER, sideKey: "A"}, ...{GUEST, displayName, sideKey}]` in push order, sides `B`/`C`/`D`

`.astro` files (`UserSection`, `AddGuestButton`, `GuestNameModal`) get no unit test, per D101 — there is no Astro-component test runner in this project, and none of the added branching is complex enough to warrant extracting a separately-testable helper.

## Notes

- Reuses `Modal.astro`, `Input.astro`, `Button.astro`, `UserIconDisplay.astro` — no new primitives beyond `plus.svg`, `AddGuestButton.astro`, `GuestNameModal.astro`.
- `MAX_SEATS = 4` and the 501-only guard already live in `services/session-seats.service.ts` (D-doc-owned); this spec does not touch them, only respects them client-side.
- Wiring the other 8 engines/setup screens remains explicitly deferred, same as the prior design.
