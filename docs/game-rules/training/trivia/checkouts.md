# Checkout trivia

Current version: none (V1 in design)

## Features

Version vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Reason |
| --- | --- | --- |
| Target pool 41–170 | V1 | |
| Targets 2–40 in the pool | Dropped | Every number below 41 finishes in at most two darts and the twenty even ones finish in one, which makes the range too obvious to drill (`09-Training/02-Trivia.md` §Question Pool and Configuration) |
| Filter by two-dart or three-dart finish | V1 | |
| Filter by custom range (clamped to 41–170) | V1 | |
| Question count 10 to pool size, default 25 | V1 | |
| Keypad entry: single, double, treble, outer bull, inner bull | V1 | |
| Not possible: declaring a Bogey target unfinishable | V1 | |
| Back undoes one entered dart per tap | V1 | |
| Auto-advance the moment a route validly finishes | V1 | |
| Completion gate on the last question | V1 | |
| Summary tiers: Preferred, Valid alternate, Incorrect, Correctly declared impossible | V1 | |
| Preferred-route explanation behind an info button | V1 | |
| Explanation text for every routable target | V2+ | Wanted, unscheduled: roughly 123 entries of new darts-strategy writing that exists nowhere in the repo; the mechanism ships without them and an unauthored target shows a placeholder instead of the info button |
| Time pressure / decision-speed training | Dropped | V1 is untimed throughout and carries no timer field anywhere; a speed layer would be a separate design on top of this one, not a retrofit |
| Persisted attempt history | Deferred | Blocker: a trivia tool sits outside the `game_types` model entirely, so there is no schema, session or API route to persist a set against — see Persistence |
| Integration with training routines | Deferred | Blocker: `09-Training/01-Routines.md`'s `CHECKOUT` exercise type does not exist; its exercises are duration-bound while a set's natural unit is question count, and its only non-dart-input precedent evaluates nothing |

## Identity

Knowing which route to throw is a large part of darts — in 501 and in the
checkout games, Ten Up One Down and 121. What matters is knowing which order
survives a miss: a route that leaves you another dart, at the bull or at a
better setup, rather than one that strands you.

This is a flashcard drill for exactly that recall, off the board. It
deliberately excludes the board itself: nothing is thrown, nothing is timed, and
nothing is kept between sessions.

## Objective

A correct answer is a dart sequence that finishes the shown target exactly, with
the last dart a double or the inner bull — or, on a Bogey, the declaration that
no route exists.

The player is working on **accuracy of recall**, not speed. V1 is untimed
throughout.

## Question model

- Questions are drawn from the targets **41–170**, 130 numbers in all: 59 that
  finish in two darts, 64 in three, and 7 Bogeys — 159, 162, 163, 165, 166, 168
  and 169 — that cannot be finished at all.
- One question is one target number, shown on its own.
- A target usually admits several valid routes. One of them is the **Preferred**
  route; the rest are **Valid alternate**. A Bogey admits none.

## Answer & feedback

The player answers on a keypad: pick a ring — single, double, treble, outer bull
or inner bull — then a number, which fills one dart of the display. Outer and
inner bull stay separate options because two targets, 125 and 135, need the
outer bull's 25 specifically.

```
-- target --

    121

-- display --

D1 - D2 - D3

-- input--

|   S   |  D  |  T   |
----------------------
| 1  | 2   | 3  | 4  |
| 5  | 6   | 7  | 8  |
| 9  | 10  | 11 | 12 |
| 13 | 14  | 15 | 16 |
| 17 | 18  | 19 | 20 |
----------------------
| back | bull | no CO |
```

**Not possible** is a whole-answer declaration and is offered only before the
first dart of a question is entered, never as a mid-entry escape.

**Back** undoes one dart per tap — twice undoes two, three times undoes three —
and only within the current question.

**No feedback during the set.** A route that finishes validly ends the question
immediately, however many darts it took; three darts without a finish ends it
unresolved. Either way the next target appears with nothing said about the
answer. Everything is shown at the end.

## Set structure

- One set is the configured question count: **10** up to whatever the filters
  leave, default **25**.
- Targets are drawn as a random subset without replacement.
- The dart-count and range filters compose. Narrowing to two-dart or three-dart
  finishes excludes Bogeys by construction, since a Bogey has no dart count to
  match; a range keeps any Bogeys inside it, because recognising an unfinishable
  number within a drilled range is the realistic case.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Questions | Default **25** (min **10**, max the filtered pool size) | Editable |
| Dart count | Both two- and three-dart finishes | Editable |
| Range | 41–170, clamped to those bounds | Editable |

If the filters leave fewer than 10 targets, the question count clamps down to
that smaller size rather than blocking configuration.

## Ends when

The last question of the set is answered. A confirmation modal stands in front
of it, so a stray tap on the final entry cannot end the set by accident. There
is no clock and no way to fail out early.

## Result

A summary listing every question: the target, the darts entered (or "declared
impossible"), and its tier.

- **Preferred** and **Correctly declared impossible** — teal, no info button.
- **Valid alternate** — amber, with an info button explaining why the preferred
  route is preferred.
- **Incorrect** — red, showing the correct route, with the same info button —
  except on a Bogey, which has no preferred-route content to show.

```
Completed

N correct vs N mistakes

-----------------------
List of all answers given

-----------------------
# correct answer are teal (UI color)
target: 41
answer S9 D16
-----------------------
# correct but not preferable are amber + info button
target: 74
answer: T60 D7
info: prefered route is T14 D16, because on miss hitting S14 -> S20 D20
-----------------------
# incorrect answers are red + correct answer below
target: 134
answer: T20 T20 D8
correct answer: T20 T16 D16
info: prefered route is T20 T16 D16 for hitting ...
-----------------------
```

## Persistence

**Nothing survives the session.** No `game_types` row, no runtime rows, no
history — the Quick Subtract precedent (D261), which this tool follows rather
than re-decides. The set's per-question outcomes live only in the page's own
state while it is open.

## Later versions

### Variants

- **Explanation text** for every routable target, phased in behind the info
  button the V1 mechanism already ships.

### Other

- Persisted attempt history, once a tool outside the `game_types` model has
  somewhere to persist to.
- A place inside the training routines, if a `CHECKOUT` exercise type ever
  becomes real — a fresh decision against the code that exists then, not a seam
  kept open now.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Bogey** | V1 | A target that no dart sequence can finish: 159, 162, 163, 165, 166, 168, 169. |
| **Preferred** | V1 | The answer matches the route the checkout chart gives for that target. |
| **Valid alternate** | V1 | The answer finishes the target exactly on a double or the inner bull, but by a different route. |
| **Incorrect** | V1 | Three darts without a valid finish, a route that does not finish, or "not possible" on a target that has one. |
| **Correctly declared impossible** | V1 | "Not possible" answered on a Bogey. |

## Open questions

- Which of the ~123 routable targets get their explanation written first, and by
  what order of usefulness.
