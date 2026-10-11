# Setup session mixin (#914, task C)

## Goal

Remove the setup-state fields, session-recovery methods and context-type
fields copy-pasted across the five setup controllers, so recovery behaviour and
the page scope contract cannot drift. No visible or behavioural change.

Task C of three under #914 (A: `GameSetupPage`, merged #918; B: closed as a
removal, #922).

## Evidence

- `createPresetSetupController` and the hand-written `fiveOhOneSetup`,
  `scoreTrainingSetup`, `oneTwentyOneSetup`, `tuodSetup` each declare the same
  13 state fields and the same `reconcile`, `retryReconciliation`,
  `continueSession`, `abandonSession`, `removeGuest`, `removeBot` bodies. They
  differ only in the game type key and the play URL. Fallow: 20-line clone, 5
  instances, plus related 13-23 line groups.
- `types.ts` repeats the 13 fields, the `$store` shape and the six method
  signatures in `PresetSetupContext`, `TuodSetupContext`,
  `ScoreTrainingSetupContext`, `FiveOhOneSetupContext`,
  `OneTwentyOneSetupContext`.
- `GameSetupPage` reads `showActiveSessionModal`, `activeSession`,
  `reconciliationFailed`, `loadingReconciliation`, `retryReconciliation()`; a
  controller missing one breaks the page silently.

## Design

### `createSetupSession` (`app/src/lib/game/setup-session.ts`)

```ts
createSetupSession<Ctx extends SetupSessionContext>({
  gameTypeKey: string,
  playHref: string,
})
```

Returns a plain object: the 13 state fields (`loading`, `error`,
`activeSession`, `showActiveSessionModal`, `loadingReconciliation`,
`reconciliationFailed`, `guests`, `showAddGuestModal`, `newGuestName`, `bot`,
`showOpponentChooser`, `pendingBotLevel`, `showBotLevelPicker`) and the
methods `reconcile`, `retryReconciliation`, `continueSession`,
`abandonSession`, `removeGuest`, `removeBot`. Bodies move verbatim from the
current controllers; `gameTypeKey` and `playHref` replace the per-file
constants. Methods take `this: SetupSessionContext` and touch only base
fields.

Each controller spreads it into its returned literal:
`...createSetupSession({ gameTypeKey, playHref })`. Alpine sees the same
object shape as before.

### `SetupSessionContext` (`types.ts`)

One exported type: the 13 fields, `$store` (`game.sessionId`,
`game.startSession`, `game.reset`, `settings.captureModeKey`,
`settings.inputModeKey`) and the six method signatures. The five context types
become `SetupSessionContext & { …game-specific… }`. `PresetSetupContext`
keeps its `init`, `addGuest`, `addBot`, `start` signatures. Exported types
stay in the barrel (`check-type-barrels.sh`).

### Untouched

Every `start()` and `init()`. `addGuest`/`addBot` in TUOD, Score Training and
121 (they force ROUNDS/TARGET). The `SESSION_ALREADY_ACTIVE` catch inside
`start()` and the `init()` catch block: sharing them would edit `start()`/
`init()`. 501, Score Training, 121, TUOD stay opted out of
`createPresetSetupController` (D216 and the 121 rewrite decisions).

## Out of scope

Folding `init`/`start` error handling, any opt-out change, play-side
controllers, markup.

## Verification

- TDD: `tests/lib/game/setup-session.test.ts` covers reconcile `match`,
  `abandon_failed` and other branches; retry (success and loading reset on
  throw); continue (hides modal, sets href); abandon (success resets store and
  clears session; failure sets error; `loading` guard; no-op without active
  session); `removeGuest`; `removeBot`; fresh state per call (no shared
  arrays between instances).
- Existing per-game `*-setup.data.test.ts` pass unchanged.
- `npm test`, `npm --prefix app run check`, `format:check`,
  `bash scripts/fallow-gate.sh` (clone group gone), repo gate scripts via
  `run-all-gates`.
- Docs: `00-File-Inventory.md` row; `09-Adding-A-Game.md` setup-controller
  section names the mixin; one decision; context-maintenance pass.

## Review focus

- Two controller instances must not share `guests`/`bot` state (factory call
  per instance).
- `playHref` per game still matches the route (`/games/501/play`,
  `/games/121/play`, `/games/score-training/play`, `/games/tuod/play`).
- `abandonSession` while `loading` stays a no-op.
