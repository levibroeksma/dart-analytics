# Modal context rows — design

Date: 2026-10-10 · Status: approved in chat · Issue: #822 (last open part; legs bars, copy and accent glow already shipped on `feat/modal-sheets`) · Parent spec: `2026-10-08-modal-sheets-design.md` · Source: Claude Design `Modals.dc.html`

## Intent

Mid-game sheets (leave, finish, continue) show where the player is, so they can confirm without closing the sheet to check. The design mock has one inlay row — `501 · Leg 2 · Round 7` left, `141` right — that the modal-sheets work left unbuilt because no call site fed it data.

## Goals

- One context row on every sheet listed below: game, leg, round on the left (dot-separated), remaining score on the right.
- Each game shows its closest match for those four parts (table below).
- Any part with no data is left out, with its dot. No parts and no value → no row at all.

## Non-goals

- No server or API change. `SessionActive` stays as is.
- No button copy, layout or sheet-chrome change.
- No row on sheets not listed below (results, setup, guest name, blocked step, open routine — the last already has its own row).

## Anti-goals

- A row that shows a wrong or stale number. Missing beats wrong: on doubt, drop the part.
- A placeholder ("—", "0", "Leg ?") standing in for missing data.

## Sites

| Sheet | Component | Data source |
|---|---|---|
| Exit ("Leave game?") | `ExitModal.astro` in `GameLayout` | `$store.game` (live fact log) |
| 501 match-finish confirm | `pages/games/501/play` | page state |
| 121 finish confirm | `pages/games/121/play` | page state |
| TUOD finish confirm | `pages/games/tuod/play` | page state |
| Score training finish confirm | `pages/games/score-training/play` | page state |
| Routine step finish confirms | `pages/training/routines/play` (finishing, scoring, 121 panels) | step's game state |
| Continue session | `ContinueSessionModal.astro` on setup pages | `$store.game` fact log on this device |

Exit covers every game that uses `GameLayout`; a game with no mapping below gets no row. On a routine, Exit shows the step's game line (e.g. `TUOD · Round 3 of 10`), not the routine line — `$store.game` holds no routine name or step count, and no store change is made for it (owner, 2026-10-10). A non-game routine step gets no row on Exit.

## Per-game line

| Game | Left parts | Right value |
|---|---|---|
| 501 | `501 · Leg n · Round n` | remaining |
| 121 | `121 · Attempt n · Round n` (round = visit within the attempt) | remaining in the attempt |
| TUOD | `TUOD · Round n of N` | current target |
| Score training | `Score training · Round n of N` (`Round n` under a minutes duration, as the play subtitle does) | total scored |
| Routine step | `<routine name> · Step n of N · Round n` | same value as the standalone game of that step (TUOD target, score-training total, 121 remaining in attempt) |

- Values belong to the seat currently throwing.
- "Round" counts from 1 and means the visit being thrown now, matching the existing play subtitles.

## Continue session

- `ContinueSessionModal.astro` is built on `Modal`, not `ConfirmDialog`; the row goes in its body directly.
- Derive parts by folding the stored stages/turns with the stored config snapshot, using the game's existing `fold*State` (e.g. `foldFiveOhOneState`). Never call the server for it.
- Fold only when `$store.game.sessionId` equals `activeSession.sessionId`. `reconcileActiveSession` already abandons a mismatched session, so in practice the log is either the right one or absent; when absent, the row is just the game name (`activeSession.gameTypeName`), or nothing if that is null.

## Guard against stale logs

`$store.game` is persisted, so it can hold an old session. A site renders a row only when the stored log belongs to the session in play (Exit: the page's live session; routine: the current step is a game step whose session is the one in the store). Otherwise no row.

## Decided in chat

- Content: game, leg, round, remaining (owner).
- Games without legs/remaining use the closest match (owner).
- Continue session reads the local log; missing parts are hidden (owner).
- Per-game mapping above (proposed, owner approved).

## Builder's calls (Claude's, not the owner's)

- Reuse the existing `ui/InlayRow.astro` and `ConfirmDialog`'s `context` slot; `ExitModal` forwards a context row into the slot.
- Put the derivation in one pure module (e.g. `modules/game/session-context.module.ts`): input = game key, config snapshot, stages, turns (+ routine name/step for routines); output = `{ parts: string[]; value: string | null }`. Every site renders from it, so Exit, finish and Continue can't disagree. Unit-tested per game, including the empty and partial cases.
- `InlayRow` must drop an empty part and its dot (it renders every part today); the row hides when parts and value are both empty.
- Exit sits in `GameLayout`'s own Alpine scope, so it reads `$store.game`, not page state.
- Routine step value matches the standalone game's value (builder check, Q3).
- Stale-log guard above (builder check, Q2). On routines it needs one non-persisted field, `$store.trainingSession.gameSessionId`, set when a game step opens and cleared when it closes — a guard flag only; the routine name and step count still stay out of the store.
- Each mapped game already has a pure `fold*State`; the module maps folded state to parts, no engine refactor.

## Left to the builder

- Exact module name and file layout, within the repo's file-location gates.
- Whether finish confirms read the shared module or the page's existing getters, as long as output matches.
- Docs: style guide §dialogs note, decision entry in `decisions/frontend/style.md`, context-maintenance.
