# Amend Mode

A rules file already exists and a mode, variant, setting or format has turned
up that the original pass never considered. The file must absorb it without
drifting from its own style.

## 1. Read the whole file first

Its heading set, Glossary terminology, table columns and existing `Reason`
phrasing are the style contract. Match the file, not the template. A template
is how a *new* file starts, never a reformatting instruction for an old one.

## 2. Read `Current version:`

This decides what the amendment may be:

- `none (V1 in design)` → the new mode is a V1 candidate. Run the V1 cut test
  on it like any other feature.
- `V1 (shipped …)` or later → **the new mode cannot be V1.** V1 is history. It
  takes `V2` (being built now) or `V2+` (wanted, unscheduled). The cut test is
  not re-run on shipped scope; reopening V1 is a retrospective edit, which the
  permanent-register rule exists to prevent.

Verify it: `Current version:` is the claim, the engine in `app/` is the check.

## 3. Classify

First the routing question — *does this stay in this file, and may it be
written at all?* Exactly one applies:

- **Additive** — a new mode, variant, setting or format alongside what exists.
  Proceed.
- **Training-only** — the mode exists only when a game runs as a routine step.
  Run the routing test in §Training-only rules below *before writing
  anything*; the answer decides which file is even being amended.
- **New entry point** — the subject becomes playable somewhere it was not
  (typically an exercise gaining `standalone`). Amend `Entry points:` and
  answer the three questions in §New entry points. **Do not move the file.**
- **Execution-model change** — it must become a game, or stop being one.
  **Stop:** decision block first, then `git mv`. See §Execution-model changes.
- **Changes a shipped rule** — different behaviour for something already
  built. **Stop.** This is an architecture decision, not a notes edit. It needs
  a block in the file `DECISIONS.md`'s routing table names —
  `decisions/game-engine.md` for game rules and engines,
  `decisions/architecture.md` for the domain model, `decisions/database.md`
  when a seeded row or migration is involved. Never assume the domain; read the
  routing table. The doc edit lands in the same PR, citing the decision id.

Then the attributes. These **stack** on the routing verdict and on each other:

- **Seat-conditional** — applies only at some player counts. Needs an `Applies
  to` value and a token-prefixed statement. An additive `V2` mode that is
  1v1-only is both.
- **Answers an open question** — step 5.
- **Touches capture** — step 6.

## 4. Place it in every slot at once

| Slot | What lands |
| --- | --- |
| `Features` | one row: name, version, applies-to, reason |
| `Later versions` §Variants | the plain-language definition |
| `Glossary` | the term, its version, a one-line meaning |
| `Config & presets` | a row **only if** it is a setting the player picks |

A mode in `Features` with no `Glossary` term is a defect. The Glossary term
must appear verbatim inside the Features row name — `**First to N**` matches
the row `First to N legs`.

## 5. Resolve what it answers

If the amendment settles an entry under `## Open questions`, strike it in place
using the file's existing convention:

```markdown
- ~~Whether 501 moves to DETAILED_DARTS capture.~~ **Resolved:** VISUAL_BOARD
  already records per-dart facts (see Known limitations).
```

Never delete the question. `501.md` already does this; follow it.

## 6. Re-check `Capture`

Games and exercises. A new mode that changes what a dart means, what a stage
is, or what gets derived invalidates the existing answers. If it does, `Capture`
is amended in the same pass — a mode whose state shape cannot be persisted is
not a valid amendment at any version.

## 7. Do not bump `Current version:`

That is the implementation PR's job, when a version actually ships. An
amendment plans; it does not ship.

## 8. Run the gate

```bash
bash scripts/check-game-rules.sh
```

---

## Diff discipline

The amendment **adds rows and entries**. It does not reformat tables, reorder
features, reword untouched rows, or regenerate the file. A rules-file diff
touching lines unrelated to the new mode is wrong — revert those hunks.

---

## Training-only rules

A game used as a routine step wants different scoring there than it has
standalone.

**It cannot be a mode the game engine owns.** `09-Training/01-Routines.md` §2
states a `GameEngine` must remain independent of the exercise system, and §10
that the game engine does not know it is being used by an exercise. An
`if (insideRoutine)` branch violates both.

The routing test:

> Is this a rule of the game itself, or a rule of the training around it?

- **Of the game** → an ordinary **game variant** in the game's ruleset,
  selectable by anyone. The routine reaches it through exercise configuration
  (`game: { type, … }`, §11) and the engine never learns why it was chosen.
  Preferred — no new doc, no duplication.
- **Of the training** → its own **exercise type** under
  `training/exercises/`, wrapping the game. The exercise doc owns the override;
  the game's ruleset is not touched.
- **Neither fits** → the engine genuinely must behave differently by context.
  That is an architecture change: decision block before any doc edit.

**The test is not "would anyone play this standalone?"** That answers a
different axis and produces a game ruleset for something that should never have
had a `game_types` row.

Record the verdict and its reason in the amended file, so the next amendment
does not re-litigate it.

---

## New entry points

The common case: a mode written as a training-only exercise should now be
playable on its own. **This is an entry-point change, not a migration.** The
file stays under `training/exercises/`; its execution model is untouched;
`Entry points:` gains `standalone`.

It is still a feature — a `Features` row, a version (`V2`/`V2+`, never `V1`
once `Current version:` shows V1 shipped) and a reason. And it is
**incomplete** until three things are answered in the same pass, because a
routine step inherits all three and a standalone session has no routine:

| Question | Where the routine step got it |
| --- | --- |
| What does the config screen show? | `routine_steps.configuration` / the exercise template's defaults |
| What ends the session? | the duration the routine allocated it (§5) |
| What result does the player see? | the training summary |

Two of those become `### Ends when` and `### Result`; the third is a non-empty
`Config & presets`. Warm-Up would answer that its five 60-second phases are its
own bound — but that must be *written*, not inferred from the seed.

---

## Execution-model changes

Only when the subject needs a seeded `game_types` row and a `GameEngine` does
it become a game. Then:

1. **A decision block first.** A new seeded lookup row and a new engine are
   architecture, not a notes edit. Seeded ids are SMALLINT and the database
   never generates them, so the row is a migration/seed decision too.
2. `git mv docs/game-rules/training/exercises/<x>.md docs/game-rules/rulesets/<x>.md`
   — history preserved.
3. Re-shape to `GAME_RULESET_TEMPLATE.md`, carrying `Current version:`,
   `Entry points:` and the full defer list across unchanged.
4. **No pointer stub** at the old path. Git history is the trail; a stub is a
   second source of truth.

The reverse — a game demoted to an exercise — follows the same steps in the
other direction and is equally a decision: it retires a `game_types` row that
configuration snapshots may already hold copies of.
