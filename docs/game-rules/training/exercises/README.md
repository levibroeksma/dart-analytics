# Exercises

This folder holds the raw rules of **exercise types** — the reusable units a
routine step configures (`WARM_UP`, `SWITCHING`, `DOUBLE_PATTERN`, `GAME`, …),
in the `docs/game-rules/templates/EXERCISE_TEMPLATE.md` shape.

An exercise type binds to an `ExerciseEngine` and is reused across routines
with different configuration (`docs/architecture/09-Training/01-Routines.md`
§3.4–3.5). Its rules live here once; a routine records only what it overrides.
Writing an exercise's rules inside each routine that uses it is the duplication
this split exists to prevent.

An exercise is **not** a game: it runs on an `ExerciseEngine`, its
`exercise_templates.game_type_id` may be `NULL`, and being playable standalone
does not change that. Warm-Up is seeded with `game_type_id NULL`
(`database/seeds/0015_warm_up_routine.sql`) and is used both standalone and as
a step inside Balanced Training.

Translation target: `09-Training/01-Routines.md` §Exercise Type / the
`ExerciseEngine` contract.

Authoring and amending are driven by the `authoring-game-rules` skill.
