# Paused screen: glass play button and tips (#1210)

This document describes the new paused view for countdown games, routine steps and Quick Subtract. The reader is the engineer who plans and builds it. The Design System artifact decides the visual choices (D524). Where the artifact is silent, this document marks the choice.

## Intent

Today a paused timed game or routine step shows a 6rem raised glass circle with a blue play icon. The circle replaces the input area. The title bar and the scoreboard stay on screen. The owner wants a calm rest screen instead. It shows one large glass play symbol in the middle of the page. A short tip above it helps the player train better.

Success: on pause, the player sees only the tip and the play button; one tap resumes. The tip differs between pauses and fits the current game or exercise.

## Goals

- On pause, hide the title bar and the score or scoreboard section. Only the paused view shows.
- Show a large play button at the exact centre of the viewport. A tip card of any length never moves it.
- Show a tip card above the button. Centre the card vertically between the top of the page and the top of the button. The gap above the card then equals the gap below it.
- Pick one tip at random on every pause, from the tips for the current game or exercise plus the general tips.
- Apply the view everywhere `CountdownResumePrompt` appears:
  - `SeatedPlayScreen`: Around the Clock, 121, Score Training and Ten Up One Down, standalone and as routine game steps;
  - routine exercise steps in `pages/training/routines/play/index.astro`;
  - Quick Subtract.

## Non-goals

- Tips based on the player's own statistics. The owner wants this later; it gets its own issue.
- A pause for games that have no countdown.
- Tip edits from the UI or the database. The list lives in code.

## Anti-goals

- The play button shifts with the tip length or the screen height.
- Any blue on the button, or a circle behind it (the owner rejected today's look).
- A paused screen that still shows the score, so the player keeps reading numbers instead of resting.

## Decided by the owner

- **Button look (mockup option B).** The play shape is the artifact's `project/assets/icons/play.svg` path. The raised-glass material (`--raised-bg`, a white 8→16% radial) fills it. Light edges, like the raised material's top and bottom edges, outline it. It has no circle and no blue. In the approved mockup it was 112px on a 260px-wide phone. My call: `7rem` (`size-28`), which is the same proportion on a 390pt screen.
- **Layout.** The title bar and the score section are hidden. The button sits at the exact viewport centre. The tip card sits in the space above it, centred vertically, with equal gaps above and below.
- **Edges (my call, from the approved mockup).** The button is an inline SVG of the `play.svg` path, 24×24 view box. The fill is a radial gradient from white 30% at the top to white 12%. The stroke is 0.5 units wide, a vertical gradient from white 70% at the top through 10% in the middle to 35% at the bottom. A soft dark drop shadow sits below it. Map these values to the raised-glass tokens where they exist; any new value becomes a token first.
- **Tip card.** Glass card material (`--glass-bg` with the glass edges), `rounded-2xl`, a mono uppercase sky eyebrow `TIP`, and the tip as one or two short sentences in body text (`text-muted`). This follows the artifact's surfaces and type rules.
- **Tips source.** A fixed, hand-written list in code, matched by game or routine step, plus general tips.

## Facts from the code

- Play pages use `layouts/GameLayout.astro`. Its title bar (`:59-98`) is a `shrink-0` block above a scrolling `<main>`. The pause control sits in the `header-end` slot. Play pages have no bottom nav.
- While paused, the pause control is disabled, so the resume button is the only way back.
- Paused flags: `$store.game.timerPaused` (games and routine game steps), `paused() && !game` (routine exercise steps), `status === 'running' && paused` (Quick Subtract).
- Keys available at pause time:
  - games: `$store.game.rulesetVersionKey` (`AROUND_THE_CLOCK_V2`, `121_V2`, `SCORE_TRAINING_V1`, `TUOD_V1`, and earlier versions);
  - routine exercise steps: `adapter.key` from `STEP_ADAPTERS` (`WARM_UP`, `SWITCHING`, `SWITCHING_CHAIN`, `DOUBLE_PATTERN`, `TARGET_SCORING`, `SCORE_THRESHOLD`, `BULLSEYE_CHECKOUT`, `BULL_UP`, `CHECKOUT_SEQUENCE`, `RANDOM_CHECKOUT`, `HIT_COUNT`, `SWITCHBLADE`, `DOUBLES_LOCK`, `HALVE_IT`, `DOUBLES_SNAKES_LADDERS`);
  - Quick Subtract: no key in scope, so it passes a literal.
- No tips content or random-pick helper exists yet.

## Tips content

- One general list of about 8 tips, and about 3 tips per game family and per routine exercise key listed above, plus Quick Subtract.
- A game key matches by family: the ruleset version key without its `_V<n>` suffix, so a new version keeps its tips.
- An unknown key gets the general tips only.
- The pick prefers the current key's tips. In 2 of 3 picks it takes a key tip, otherwise a general tip (owner decision).
- The pick never shows the same tip twice in a row. Each of the 3 places remembers its last tip for the page's lifetime (owner decision).
- When a key has no tips, the pick uses the general list.
- While the view is shown, the tip changes to another one on a timer (owner decision). Each new tip follows the same pick rules, so it never repeats the tip before it.
- The display time depends on the tip's length, so the player has time to read it (owner decision). My call: 2.5 seconds plus 60 ms per character, at least 5 seconds and at most 12 seconds. A 120-character tip then shows for about 10 seconds. Keep the numbers in one place, so they are easy to tune.
- My call: the change is a 300 ms opacity cross-fade with `--ease-out`. With reduced motion, the text swaps without a fade. The rotation stops when the player resumes.
- My call: each tip is at most 120 characters, so the card stays at 1–3 lines above the button on a short screen. A unit test enforces the limit.
- Copy follows the artifact's content rules: second person, terse, one or two sentences, full stop, no emoji. The agent drafts the tips; the owner reviews the wording in the PR.

## Left to the builder

- How the view hides the title bar and the scoreboard. A fixed full-viewport overlay that paints the screen background over them is one way. Hiding them through the shared paused flag is another. Either is fine if the button lands at the viewport centre.
- File and function names, and how the random pick is made testable.

## Calls I made (check these)

- The button is `7rem`.
- Leaving the game while paused means resuming first, because the title bar with its exit button is hidden. The pause control was already disabled while paused.
- A routine game step uses its game's tips, not a routine step key.
- A new tip is picked on every pause and then rotates on the timer.

## Acceptance

- In each of the 3 places, pausing shows only the tip card and the play button. Tapping the button resumes, and the title bar and score return.
- The button's centre equals the viewport centre for a 1-line and a 4-line tip.
- The tip comes from the current key's list or the general list. A unit test covers the matching and the family rule.
- The button keeps `aria-label="Resume timer"` and the existing disabled contract.
- Unit tests cover the 2-in-3 preference, the no-repeat rule, the 120-character limit and the display-time formula.
- While paused, the tip changes after its display time. The rotation stops on resume.
- Statistics-based tips are filed as a follow-up issue.
