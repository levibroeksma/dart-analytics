# Elimination statistics page — design

Status: draft for owner approval · Date: 2026-11-24

## Intent

The ELIMINATION family is next after MARKS (D566). Its games are Killer (`KILLER_V1`), Follow the Leader (`FOLLOW_THE_LEADER_V1`) and Prisoner (`PRISONER_V1`). All three are 1v1 only: each seats exactly two, the opponent is a guest, and none supports DartBot. Today they show only the heatmap layout. As with Ace, Checkout and Marks, the owner wants the page to **measure improvement over time**, comparing each figure with the previous period. The owner asked for this page to be designed like Marks, without a question round (2026-11-24). This document's calls are therefore the author's, listed at the end.

Every outcome depends on both seats' darts, so the section replays the whole session from `v_game_replay`, as Marks does. No migration is needed.

## Goals

- **A new server section, `elimination`**, for the three games. It replays each session through the game's own fold: `foldKillerState`, `foldFollowTheLeaderState` or `foldPrisonerState`. Per bucket it emits the owner's figures. **Units are stated per field.**
  - **Common:**
    - `games`: sessions.
    - `finished`: sessions whose fold is `COMPLETE`.
    - `wins`: finished sessions the owner's side won.
    - `darts`: owner darts.
    - `livesLost`: lives (Killer, Follow the Leader) the owner's seat lost, summed over sessions. Prisoner reports 0.
  - **Killer:**
    - `killerGames`: sessions where the owner became a Killer.
    - `dartsToKiller`: the summed `dartsToKiller` over those sessions, in darts.
    - `livesTaken`: lives the owner took.
  - **Follow the Leader:**
    - `matchVisits`: owner visits thrown at a standing target the owner did not set.
    - `matched`: those visits with a dart in the target's exact bed.
    - `matchDarts`: darts to the first matching dart, summed over matched visits.
    - `byBed`: `matchVisits` and `matched` split by the target's bed: Single, Double, Treble, Bull (outer or inner).
  - **Prisoner:**
    - Dart counts by the result `prisonerDartResults` gives: `advance`, `capture`, `advanceAndCapture`, `prison`, `miss`.
    - `reached`: the highest number completed per session, summed (0–20). A seat whose target is `n` has completed `n − 1`.
- **A dedicated Elimination layout** for the three versions, over the page Period select, in this order:
  1. Completion tile.
  2. **Four comparison tiles** for the selected game. Each shows the current period's value and its change against the preceding period of equal length. Win rate is common to all three:
     - **Win rate:** wins ÷ finished.
     - **Killer:**
       - **Darts to Killer:** `dartsToKiller` ÷ `killerGames`.
       - **Darts per life taken:** `darts` ÷ `livesTaken`. With none taken the tile shows "No lives taken".
       - **Lives lost per game:** `livesLost` ÷ `finished`.
     - **Follow the Leader:**
       - **Match rate:** `matched` ÷ `matchVisits`.
       - **Darts per match:** `matchDarts` ÷ `matched`.
       - **Lives lost per game:** `livesLost` ÷ `finished`.
     - **Prisoner:**
       - **Advance rate:** (`advance` + `advanceAndCapture`) ÷ `darts`.
       - **Prison rate:** `prison` ÷ `darts`.
       - **Numbers completed per game:** `reached` ÷ `finished`.
  3. **One card per game** over the current period:
     - **Killer:** none.
     - **Follow the Leader, match rate by bed:** rows Single, Double, Treble and Bull, each with match visits and match rate. A rate shows from `MIN_ROW_SAMPLE` (10) visits.
     - **Prisoner, dart results:** each result's share of darts, in the order Advance, Advance and capture, Capture, Prison, Miss.
  4. The heatmap and the session list.

## Non-goals

- Aim or hit rate per double or bed: darts carry no intent. A Follow the Leader match visit is aimed by the rules, but only the visit outcome is counted.
- Guest statistics. Opponent darts feed the fold only.
- Per-session trend charts, the order seats went out, and Prisoner's win type (completed 20 or last seat in).
- Statistics for DartBot or 3–4 seats: none of the games offers them.

## Anti-goals

- A figure that differs from the game screen or results modal for the same session: lives, lives taken, darts to Killer, captured and imprisoned must equal the fold's own seat fields.
- A second copy of any game's rules. The section calls each engine's fold and its exported helpers:
  - `bedOf` and `sameBed` decide a Follow the Leader match.
  - `prisonerDartResults` classifies a Prisoner dart.

  It never re-derives them.
- A change shown from too few: a change shows only when both periods have at least `MIN_TARGET_SAMPLE` (30) in that tile's denominator. Below that the tile shows its current value alone. All Time shows no change.
- Reading another player's history: only sessions the owner played are read.

## Data

- **No migration.** The section reads `v_game_replay` for the sessions `v_stats_session_facts` selects in the request's scope, as `marks` does through `findMarksFoldRows`. That query and the session grouping (`marksSessions`: snapshot decode, seats, the single `PLAYER` owner seat, skipped-session count) are made game-neutral and shared, not copied.
- **Turn facts carry `kept`.** A Follow the Leader keep turn must fold as the game folds it.
- **Owner seat:** the session's one `PLAYER` seat. A session with no such seat, or whose snapshot does not decode, is skipped and counted in `skippedSessions`, never guessed.
- **Classifying a visit or dart:** fold the turns before it and the turns through it, and read the owner seat (and Follow the Leader's `shared.target` and `leaderRef`) before and after. Marks does the same for darts.
- **Reads:** `elimination` is bucketable, but the page uses two un-bucketed reads (current and preceding window) through `comparisonSection` and `periodComparison`. The card reads over the current window.

## Constraints

- **Layout switch:**
  - Add a new `ELIMINATION_LAYOUTS` set holding `KILLER_V1`, `FOLLOW_THE_LEADER_V1` and `PRISONER_V1`. All three leave `HEATMAP_ONLY_LAYOUTS`.
  - Add a branch in `pages/statistics/index.astro`, and extend its fall-through condition.
- **Section registration:** register `elimination` in `section-registry.ts` with `games: ["KILLER", "FOLLOW_THE_LEADER", "PRISONER"]`, `computeSite: "server"`, `requires: ["board"]` and `includesAbandoned: false`.
- **Reuse:**
  - `StatTileRow.astro`, `AimTable.astro`.
  - `ratioTile`, `meanTile`, `comparisonSection`, `periodComparison`.
  - `formatRate`, `formatPointDelta`.
  - The Marks tile copy.
  - Per the rule of three (D513), the shared replay plumbing is extracted, not cloned.
- **Repo gates:**
  - A test per changed runtime `.ts`.
  - type-barrels, check-dupes, no inline comments.
  - astro check 0/0/0, format.
  - context-budget.
  - The quality ratchet.
  - Golden SQL snapshots.
- **Docs in the same change:**
  - `10-Statistics/01-Section-Catalog.md`: the section row, an Elimination layout paragraph, and the game rows.
  - `10-Statistics/00-Overview.md`, if it names the section list.
  - The File Inventory, the component inventory, and the context-map history.
  - A pending decision record in `decisions/api/`.
- Ask the owner about the design sync (D524) before the PR.

## Left to the builder

- File and factory names.
- Whether each game's metrics live in one module or one per game.
- Whether the tile sets and cards are one component switched by game, or one per game.

## Marked as the author's calls

- **Scope:** one section and one layout for all three games, with a per-game tile set, because their measures share nothing beyond the result.
- **Win rate** counts finished sessions only. Abandoned sessions are excluded section-wide.
- **Lives lost per game** divides by finished sessions. Prisoner has no lives tile: its "lives" are darts held, already covered by the Prison rate.
- **Darts to Killer** averages only the sessions where the owner became a Killer.
- **A Follow the Leader match visit** is an owner visit at a standing target the owner did not set. Opening, leader and keep turns are not match visits.
- **A matched visit** has any dart in the exact bed, even if a spare dart later reset the target. **Darts per match** counts up to and including the first matching dart.
- **The Bull row** joins the outer and inner bull targets.
- **Prisoner's Numbers completed** is the target reached less one, so 20 means the game was completed.
- **Killer has no card.** Its four tiles carry its measures; own-double hits that cost Killer status are not counted.
