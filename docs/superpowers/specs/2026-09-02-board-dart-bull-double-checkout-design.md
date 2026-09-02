# Design: Board-dart bull-as-double checkout fix for 501 and 121 (F44)

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes FINDINGS.md F44. Issue #207 fixed TUOD's board-dart (VISUAL_BOARD)
checkout logic to recognize a closing dart on the inner bull as a double —
`visitOutcome` now tests `lastZoneKey === "DOUBLE" || lastZoneKey ===
"INNER_BULL"` (`tuod.engine.module.ts:111`). `five-oh-one.engine.module.ts`
and `one-twenty-one.engine.module.ts` share the identical rule
(`resolveCheckoutAttempt` from `checkout-bust.module.ts`) but each has two
call sites still testing `=== "DOUBLE"` alone — verified current:

- `five-oh-one.engine.module.ts:453` (`settleVisit`, `hitZoneKey ===
  "DOUBLE"`) and `:511` (`dartChecksOutFinalLeg`, `resolved.zoneKey ===
  "DOUBLE"`).
- `one-twenty-one.engine.module.ts:501` (`lastDart.hitZoneKey ===
  "DOUBLE"`) and `:640` (`resolved.zoneKey === "DOUBLE"`).

In VISUAL_BOARD capture, a 501 or 121 player finishing a leg/visit with
their last dart on the bullseye (remainder exactly 50) is scored as a
bust instead of a checkout — the same defect issue #207 reported for
TUOD, unreported for these two games until now. QUICK_SCORE keypad
capture is unaffected in both (checkout is confirmed by an explicit
user-supplied double flag, not derived from a zone key).

Two independent tasks (different engine files, same one-line fix), one
per game — bundled as one spec, splittable at review/PR time.

## Task 1 — 501

`five-oh-one.engine.module.ts:453`:

```ts
hitZoneKey === "DOUBLE" || hitZoneKey === "INNER_BULL",
```

`five-oh-one.engine.module.ts:511`:

```ts
resolved.zoneKey === "DOUBLE" || resolved.zoneKey === "INNER_BULL",
```

## Task 2 — 121

`one-twenty-one.engine.module.ts:501`:

```ts
lastDart.hitZoneKey === "DOUBLE" || lastDart.hitZoneKey === "INNER_BULL",
```

`one-twenty-one.engine.module.ts:640`:

```ts
resolved.zoneKey === "DOUBLE" || resolved.zoneKey === "INNER_BULL",
```

## Testing

Mirror the two regression cases already added to
`app/tests/modules/game/tuod.engine.module.test.ts` for issue #207 (an
`INNER_BULL`-observation fixture, asserted to check out rather than bust)
into each game's own test file:

- Task 1: `app/tests/modules/game/five-oh-one.engine.module.test.ts` —
  one case per fixed call site (a board-dart visit finishing on
  `INNER_BULL` via `settleVisit`'s path, and a final-leg finish via
  `dartChecksOutFinalLeg`'s path).
- Task 2: `app/tests/modules/game/one-twenty-one.engine.module.test.ts` —
  same two-case shape, adapted to 121's own visit/final-leg structure.

## Non-goals

No change to `checkout-bust.module.ts`'s `resolveCheckoutAttempt` itself
— it already takes the double-flag as a boolean parameter; only the two
games' own call sites computing that boolean are wrong. No change to
QUICK_SCORE capture (unaffected). No change to TUOD's already-fixed
`visitOutcome` (used only as the reference pattern).
