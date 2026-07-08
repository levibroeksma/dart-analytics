# Conversation designing Dart Analytics Architecture

## Prompt

You’re a senior data architect and have vast experience in designing and optimising relational databases and data normalisation.

Your job is to find a solution to the clients goals, find edge cases and ensure that all wishes are met, resulting in a robust DB design.

I want to start a /brainstorming session for designing a DB using neon.tech. Ask me questions, one by one, to create a clear spec sheet and ERD for building a robust DB for reliable data computing and create insightful, computed statistics for tracking progress.

I have a darts app which can be used to keep scores in a variety of different game types. It is still in development and more games will be added still.

The focus is measuring the progression of the user while playing games over time.

For each finished game the game data should be saved. Opponent data is in most cases irrelevant, since these do not influence the users personal data. The only opponent related data that is relevant is if the user won or lost.

For each game, I expect to have a row in a corresponding table. Which have a user_id as FK. For stats, DB views can be used to compute data relevant based on the api request. For quicker queries indexes can be used.

The tech stack I use is Astro.js, TypeScript and Alpine.js. I have a proxy API (src/pages/api) handling the DB communication with neon.tech. For performance purposes, I use client side api calls, first loading a skeleton, hydrating data on resolve.

The application is hosted via a free tier of Netlify. But I am considering to move this to cloudflare since the free tier of Netlify is hosted in the US, while the DB is hosted in Europe.

Start brainstorming to create a design en specs for this idea

## Response

Excellent starting point. Before discussing tables, I'd like to establish one architectural principle because it will affect almost every design decision afterward.

Your stated goal is **not just storing games**, but **tracking player progression over months or years**, while supporting many game modes that don't exist yet.

That means we should optimize for:

- **Historical correctness** (old games never change)
- **Extensibility** (new game types without migrations every month)
- **Fast statistics**
- **Low operational complexity** (you're a solo developer)
- **PostgreSQL best practices** (Neon is PostgreSQL)

One thing I already would challenge:

> "For each game, I expect to have a row in a corresponding table."

This may or may not be the best architecture.

There are generally three approaches:

1. **One table per game type**

- `x01_games`
- `cricket_games`
- `around_the_clock_games`
- etc.
  Pros:
- Strong typing
- Simple queries
- Easy constraints
  Cons:
- Harder to build cross-game statistics
- More migrations
- Lots of duplicated columns

1. **One generic games table + detail tables** ⭐ (my initial recommendation)

```
games
------
id
user_id
game_type
started_at
finished_at
won
duration_ms
...

x01_game_details
----------------
game_id
starting_score
checkout_score
...

cricket_game_details
--------------------
game_id
...

```

Pros:

- One source of truth
- Cross-game statistics become easy
- Easy timeline/history
- Extensible

1. **Generic JSONB**

```
games

metadata JSONB

```

Very flexible, but much harder to analyze efficiently. I would avoid making JSONB your primary model if statistics are a major goal.

---

## Another architectural recommendation

I would **not** build the statistics by querying raw game tables every time.

Instead I'd think in three layers:

```
Raw game data
        │
        ▼
Materialized/statistical views
        │
        ▼
API

```

That gives you:

- raw immutable data
- reusable SQL
- simple API
- easier optimization later

---

## What I think we should design

I suggest we design this in phases.

#### Phase 1

Requirements

#### Phase 2

Core entities

#### Phase 3

Game abstraction

#### Phase 4

Per-game storage

#### Phase 5

Throw storage

#### Phase 6

Statistics model

#### Phase 7

Indexes

#### Phase 8

Views

#### Phase 9

Future-proofing

#### Phase 10

ERD

---

## First question (only one)

This is probably the single most important architectural decision.

#### During a game, what level of detail do you ultimately want to preserve?

For example, imagine a player throws:

```
T20
T20
D20

```

Do you want to store only the final game summary like:

```
Average = 72.4
Checkout = 40
Won = true

```

or also every visit:

```
Visit 1
--------
T20
T20
D20

Visit 2
--------
S20
S20
S20

...

```

or literally every dart:

```
Dart #1
T20

Dart #2
T20

Dart #3
D20

...

```

My recommendation, especially since your long-term goal is player progression, is to store **every individual dart**. It increases storage somewhat, but it unlocks analyses that are impossible to reconstruct later, such as:

- First dart average
- Third dart average
- Missed doubles by target
- Accuracy per bed (20, 19, 18, etc.)
- Heat maps
- Preferred checkout routes
- Pressure performance
- Performance after a miss
- Consistency over time
- Visit scoring distributions
- Practice recommendations
- AI-powered coaching in the future

Storage requirements remain very manageable: even hundreds of thousands of darts occupy only tens to a few hundreds of megabytes in PostgreSQL, which is well within Neon's capabilities for a personal stats application.

So my first question is:

> **Do you envision storing every individual dart that is thrown, or only aggregated game results?** This decision will fundamentally shape the database design.

---

## Prompt

I would go for storing each individual dart

## Response

I agree with that choice. If your application's primary value is long-term progression and analytics, **storing every individual dart is the strongest foundation**.

It follows an important data engineering principle:

> **Store facts, compute metrics.**

A dart is a fact. An average, checkout percentage, or first-nine average is a metric that can always be recalculated. If you only store the metrics, you'll inevitably think of new statistics later that you can no longer derive.

#### What this unlocks

With every dart recorded, you can calculate things like:

- Traditional statistics
  - 3-dart average
  - First 9 average
  - Highest score
  - Checkout %
  - Double hit %
  - Ton+, 140+, 180 counts
- Progression
  - Rolling averages over the last 10/25/50 games
  - Monthly improvement
  - Improvement per starting score (301 vs 501 vs 701)
- Accuracy
  - Hit rate per target number (20, 19, 18, etc.)
  - Hit rate per multiplier (single, double, treble, bull)
  - Miss patterns
- Advanced analytics (future)
  - Preferred checkout routes
  - Expected vs actual checkout success
  - Clutch performance (legs that determine the match)
  - Consistency (variance between visits)
  - Personalized practice recommendations

All of these become SQL views or materialized views rather than requiring schema changes.

---

## One recommendation already

I would **avoid storing "score = 60" as the primary piece of data**.

Instead, each dart should represent **what the player aimed at and what was actually hit**, because those are different concepts.

For example:

| Dart | Intended | Hit |
| ---- | -------- | --- |
| 1    | T20      | T20 |
| 2    | T20      | S20 |
| 3    | D20      | D5  |

From that you can always compute the score:

```
60
20
10

```

This distinction enables much richer analytics, such as "How often do I miss T20 into S20?" or "How accurate am I on doubles?"

If your app doesn't currently record the intended target, we can design the schema to make it nullable and support it later without breaking compatibility.

---

## Next question

This one has a major impact on normalization and future extensibility.

**What exactly constitutes a "game" in your application?**

For example, in X01 games:

- Is a game always a single leg?
- Can a game consist of multiple legs?
- Can it consist of multiple sets?
- Can there be multiple players (even if you only persist the current user's detailed data)?
- Is the winner determined after one leg or after several legs?

Understanding this hierarchy is important because a darts match often looks like:

```
Match
├── Set 1
│   ├── Leg 1
│   ├── Leg 2
│   └── Leg 3
├── Set 2
│   ├── Leg 1
│   └── Leg 2

```

If your app currently saves a "game" but later introduces best-of-5 legs or sets, we'd rather design for that now than refactor the schema later.

---

## Prompt

Currently I have 4 game types: 10-up-1-down (tuod), singles training, score training and 501.

Each game is configurable. E.g. per game:

Tuod:

Starting target always 41, on finish in 3 darts up target with 10, on miss, reduce by 1.

Config: fixed amount of rounds (default = 10), or timed (countdown, default 10 minutes, min 5 minutes, max 30 minutes)

501:

Config: legs/sets (default = 3 legs), sets are always 5 legs per set)

Further: always double out. Possible to play alone, against guest or against a DartBot

Score training:

Config: rounds/timed, same as tuod.

Singles training:

Config:

High>low (bull>20,19…)

Low>high (1,2,3 … bull)

Random.

3 modes: normal = 3 darts per target, no conditions.

Hard = 3 darts per target, 1 mandatory hit per target. 3 misses = game over

Extreme = same as hard but 2 mandatory hits per target.

## Response

This is excellent context. I think we're already uncovering one of the key architectural insights.

## Observation: You don't actually have "games"

From a data modeling perspective, you have **game engines** that can be configured into many different sessions.

For example:

```
501
 ├── Solo
 ├── vs Guest
 ├── vs DartBot
 ├── Best of 3 legs
 ├── Best of 5 sets
 ├── Best of 7 legs
 └── ...

```

Those are all instances of the same engine with different configurations.

Likewise:

```
Singles Training
 ├── High → Low
 ├── Low → High
 ├── Random
 ├── Normal
 ├── Hard
 ├── Extreme
 ├── Timed
 └── Fixed rounds

```

This tells me the configuration should be **data**, not **schema**.

---

## I would separate three concepts

Instead of thinking in terms of four game tables, I'd model:

```
GameType
---------
501
Singles Training
Score Training
TUOD

↓

GameSession
-----------
One played session

↓

Configuration
-------------
The settings used for this session

↓

Events
------
Every dart
Every visit
Leg finished
Round finished
etc.

```

That architecture scales extremely well when you later add Cricket, Around the Clock, Bob's 27, etc.

---

## Another thing I noticed

You mentioned:

> "Each finished game the game data should be saved."

I would actually recommend saving **every started session**, with a status such as:

```
IN_PROGRESS
COMPLETED
ABANDONED
CRASHED

```

Why?

Imagine:

- app crashes
- phone battery dies
- user rage quits
- browser closes

Those are all useful events. You can choose to exclude unfinished sessions from statistics, but having them recorded gives you options and supports features like resuming a game.

---

## I also think we should distinguish between "game state" and "statistics"

For example, in TUOD:

```
Current target = 71

```

That value should **not** be recalculated from darts every time. It's part of the session's state and should be stored.

Whereas:

```
Average score

```

Should almost never be stored, because it can be derived.

A useful rule of thumb is:

- Store **facts** (what happened).
- Store **state** (where the game currently is).
- Compute **statistics** (averages, percentages, trends).

---

## My current mental model

Without diving into table definitions yet, I see something like:

```
users

game_types

game_sessions
    |
    +-- session_configuration
    |
    +-- legs
            |
            +-- visits
                    |
                    +-- darts

```

The exact structure may vary for different game types (e.g. TUOD doesn't naturally have legs), but a common `game_session` entity can tie everything together.

---

## Next question (this one is arguably the most important)

You mentioned that the app's primary purpose is **tracking improvement over time**.

So I want to understand what **unit of analysis** you care about.

Imagine a user asks:

> "Show me how I've improved over the last six months."

What statistics would you want on that dashboard?

Not just the obvious ones like average, but **every metric you think would be valuable**, even if it seems ambitious.

For example:

- 3-dart average
- First 9 average
- Checkout %
- Double hit %
- Highest checkout
- Number of 180s
- Number of 140+
- Accuracy on T20
- Accuracy on doubles
- Average darts per leg
- Win rate vs DartBot
- Improvement by month
- Favorite doubles
- Miss patterns
- ...

The more complete this wishlist is now, the easier it will be to design a schema that supports all of it without requiring disruptive changes later.

---

## Prompt

All of these are important, but also anti patterns such as:

- worst doubles
- worst singles
- recovery after a bad dart
- switch accuracy after hitting a double on the inside
- inside vs outside on doubles
- left vs right misses
- finished on which dart (1st/2nd/3rd)

and perhaps more, but this is what comes to mind now.

## Response

This answer actually changes my recommendation in a significant way.

The database should **not** be designed around games. It should be designed around **throws**, with games acting as contextual containers.

The reason is that nearly every advanced statistic you listed depends on the _characteristics_ of individual darts, not just their score.

For example:

- **Worst doubles** → every attempt at a double target, including misses.
- **Recovery after a bad dart** → sequence analysis (dart _n_ influences dart _n+1_).
- **Left vs right misses** → directional miss information.
- **Inside vs outside misses** → spatial miss classification.
- **Finished on 1st/2nd/3rd dart** → position within the visit.
- **Switch accuracy** → what target was aimed at after the previous dart.

These cannot be reconstructed from just score values.

---

## I think your database should follow an event-sourcing mindset

Not event sourcing in the software architecture sense, but in the data modeling sense.

Every dart becomes an immutable event:

```
Session
    ↓
Leg (optional)
    ↓
Visit
    ↓
Dart

```

The dart is the atomic fact.

Everything else is computed.

---

## One thing I would **definitely** add

Currently a dart is usually represented as:

```
T20

```

or

```
D16

```

I don't think that's sufficient if analytics are your long-term differentiator.

Instead, I'd model each dart with attributes such as:

```
Targeted segment
----------------
20

Targeted multiplier
-------------------
Triple

Actual segment
--------------
20

Actual multiplier
-----------------
Single

Miss direction
--------------
Inside
Outside
Left
Right
High
Low

Was intended checkout?
----------------------
Yes

Bust?
------
No

Dart number in visit
--------------------
2

Visit number
------------
14

Timestamp
---------
...

```

Notice how this stores _facts_ rather than opinions.

Then you can derive metrics like:

- Treble accuracy
- Double accuracy
- Bull accuracy
- Miss heatmaps
- Left/right bias
- Inside/outside bias
- Checkout pressure
- First dart tendencies
- Switching behaviour

without changing the schema.

---

## I also see an opportunity

If you're planning to introduce a **DartBot**, you'll likely want it to improve over time. A rich throw history enables the bot to model realistic player behavior or even tailor practice recommendations based on a user's weaknesses.

---

## One architectural concern I'd like to resolve early

Some of the information we've discussed isn't automatically knowable.

For example:

```
Player throws at D20

Hits D5

```

The database cannot infer:

- Was that an inside miss?
- An outside miss?
- Left?
- Right?
- Was the player actually aiming at D20, or intentionally at D5?

Those require information from the scoring interface.

## My next question

**How does your UI currently record a dart?**

For example, if I throw a dart at T20 and hit S20, what does the UI know?

Does it only know:

```
S20

```

Or does it also know:

```
Intended: T20
Actual: S20

```

Or could it even know:

```
Intended: T20
Actual: S20
Miss: Inside

```

The answer will determine whether the database should _store_ those analytical attributes directly or whether they need to be inferred—or whether the UI needs to be enhanced to capture them. This is one of the most important decisions for the long-term analytical capabilities of your application.

---

## Prompt

For training games this can be solved via a modal questioning which was targeted, what was hit and than derive if that was left or right. However, for example when playing a game of 501 against a guest, it doesn’t always have to be for training and can be for fun. Than I don’t want honour in every single dart I throw. So I might need to add a setting for defining if I am training or just plying for fun

## Response

I actually think you've just identified a feature that should become a **first-class concept** in the application rather than just a setting.

The distinction isn't between **training games** and **501 games**. It's between **analytics fidelity levels**.

## The problem

There are two competing goals:

**Maximum analytics**

```
Aim: D20
Hit: D5
Miss: Inside

→ Amazing statistics
→ Slower gameplay

```

versus

**Fast scoring**

```
D5

→ Extremely fast
→ Limited analytics

```

If you force the first, people won't use it during casual matches.

If you only support the second, you'll never be able to provide the advanced insights you envision.

---

## I would introduce "Data Capture Mode"

Instead of a boolean like:

```
training = true

```

I'd make it an enum:

| Mode     | Description   | Data captured                                               |
| -------- | ------------- | ----------------------------------------------------------- |
| Quick    | Casual play   | Only what is needed to score the game                       |
| Standard | Default       | Every dart that hits the board                              |
| Analysis | Coaching mode | Intended target, actual hit, miss direction, optional notes |

This is independent of the game type.

For example:

| Game              | Capture mode |
| ----------------- | ------------ |
| 501 vs friend     | Quick        |
| 501 solo practice | Analysis     |
| TUOD              | Analysis     |
| Singles training  | Analysis     |
| Score training    | Standard     |

---

## Why I wouldn't call it "training"

Imagine in two years you add:

- AI coaching
- Weekly challenges
- League matches
- Online matches

Someone might play a serious league match and still want full analytics.

Likewise, they might play TUOD casually and not care about analytics.

The capture fidelity is independent of the game.

---

## I would also make every analytical field nullable

For example:

| Column              | Nullable |
| ------------------- | -------- |
| intended_segment    | ✅       |
| intended_multiplier | ✅       |
| miss_direction      | ✅       |
| miss_distance       | ✅       |

Then a casual game looks like:

```
Hit: T20

```

while an analysis game looks like:

```
Target: T20
Hit: S20
Miss: Inside

```

The same schema supports both.

---

## Another idea

I wouldn't prompt after every dart.

I'd make the default flow as frictionless as possible and only request extra information **when it's valuable**.

For example:

#### User enters

```
S20

```

Normally, that's all that's needed.

But if the session is in **Analysis** mode and the entered score doesn't match the expected target (e.g., the target was T20), the UI can open a quick modal:

```
You hit S20.

Where did you miss?

○ Inside
○ Outside
○ Left
○ Right
○ High
○ Low

```

One tap, and the game continues.

Most darts in training games will be hits, so no modal appears.

This minimizes interruptions while still capturing valuable data.

---

## One more observation

You've mentioned wanting statistics like:

- Recovery after a bad dart
- Preferred checkout routes
- Switch accuracy
- Inside vs outside misses
- Left/right misses

These are all examples of **sequence-based analytics**. That means the order of darts is just as important as the darts themselves.

I'd therefore ensure each dart records:

- Session
- Leg (if applicable)
- Visit number
- Dart number within the visit (1, 2, or 3)
- Timestamp (optional but useful)

With those, you can analyze patterns such as "What does the player typically throw after missing inside on D16?" without additional schema changes.

---

## My next question

This is the one that will shape the ERD more than any other:

**Do you want the database to be able to replay an entire game from start to finish using only the stored data?**

In other words, if the UI were completely deleted, should it be possible to reconstruct every visit, every score change, every checkout attempt, every bust, and every game state purely from the database?

My recommendation is **yes**. Designing for replayability tends to produce a robust, future-proof schema because every state transition is derivable from stored facts rather than hidden in application logic. It also enables features like game replays, debugging, synchronization across devices, and validating scoring logic.

---

## Prompt

I hadn’t thought about it, but than: yes

## Response

Perfect. That answer significantly narrows the design space, and I think we're converging on a very robust architecture.

## New design principle

We should treat the database as **the source of truth**, not merely a place to archive results.

That means:

> **Given only the database, we should be able to reconstruct exactly what happened during any game.**

This has several advantages beyond statistics:

- 🐛 Debug scoring bugs ("Why did this game end incorrectly?")
- ⏪ Replay completed games
- 📈 Recompute newly invented statistics years later
- 🔄 Synchronize games across devices
- 🤖 Train future AI coaching or DartBot improvements
- 🧪 Validate scoring logic after code changes

---

## This also changes what should be stored

Many people build darts apps like this:

```
Game
-----
Current score
Average
Highest score
Checkout %
...

```

I would **not**.

Instead, I would think in terms of **immutable facts**.

For example:

```
Session started

↓

Visit 1

↓

Dart 1
Target: T20
Hit: T20

↓

Dart 2
Target: T20
Hit: T20

↓

Dart 3
Target: D20
Hit: D20

↓

Leg finished

↓

Session finished

```

Everything else becomes derivable.

---

## One thing I would still store

There is one exception to the "derive everything" philosophy: **configuration**.

A session should permanently store things like:

```
501

Configuration
-------------
Starting score = 501
Double out = true
Legs = 5
Sets = 1
Opponent = DartBot
Capture mode = Analysis

```

These values define the rules under which the game was played. They should never change afterward.

---

## I also want to challenge one assumption

Earlier, you said:

> "For each finished game, I expect to have a row in a corresponding table."

After what we've discussed, I actually think **one central** `game_sessions` **table** is a stronger design.

For example:

```
game_sessions
--------------
id
user_id
game_type_id
configuration_id
status
started_at
finished_at
winner
capture_mode
...

```

Then, game-specific data lives in related tables where necessary (e.g., X01 leg structure versus TUOD rounds). This gives you:

- A single history timeline for all games.
- Cross-game analytics without `UNION` queries.
- Simpler API endpoints like `/api/history`, `/api/stats`, and `/api/progress`.
- Easier addition of new game types in the future.

---

## I think we should define a guiding philosophy before drawing the ERD

Here's what I would propose:

#### Level 1 — Immutable facts

Never edited after they're written.

- Sessions
- Darts
- Visits
- Legs
- Rounds
- Configuration
- Opponent type
- Capture mode

#### Level 2 — Derived views

Computed from Level 1.

- 3-dart average
- First 9 average
- Checkout %
- Win rate
- Recovery metrics
- Miss tendencies
- Rolling averages
- Monthly improvement
- Heat maps

#### Level 3 — Materialized views (optional)

For expensive or frequently requested calculations.

- Dashboard summaries
- Leaderboards
- Long-term progression graphs

This layered approach keeps the raw data immutable while allowing your analytics to evolve over time.

---

## Next question

This one is about **future-proofing** and will influence whether we normalize certain entities.

#### How do you envision users interacting with the app in the long term?

Which of these do you realistically expect to support?

- A. One account used by one player only.
- B. One account can contain multiple player profiles (e.g., family members).
- C. Friends can be invited and their results are stored too.
- D. Online multiplayer where every player has an account.
- E. Clubs or teams with shared statistics.
- F. Tournaments or leagues.

Even if some are only "maybe in 2–3 years," it's useful to know now. Certain capabilities (like multiple registered players in a match) are much easier to support if the schema anticipates them from the outset, while still keeping today's implementation simple.

---

## Prompt

A with options for D, E and F. The starting point of this application is personal use only. However, if it reaches results, I might want to commercialise it in the future, expanding it for multiple users and or teams. But I do not want to save data of multiple players within one account

## Response

That's exactly the kind of constraint I was hoping for. It leads to a design that's both simple today and scalable tomorrow.

## Design principle #1: One account = one player

I would **not** support multiple player profiles under a single account.

Instead:

```text
User Account
      │
      ▼
One Player
      │
      ▼
Many Game Sessions

```

This keeps every statistic unambiguous:

- Average
- Improvement
- Checkout %
- Practice history

All belong to one person.

---

## Future expansion

If you later commercialize the app, don't change this model. Instead, **add relationships between players**.

For example:

```text
User
 │
 ▼
Player
 │
 ├── Game Sessions
 │
 ├── Club Memberships
 │
 ├── Teams
 │
 └── Friends

```

Now you can add:

- Clubs
- Teams
- Leagues
- Online matches
- Rankings

without changing how a player's own data is stored.

---

## Another recommendation: Separate identity from gameplay

Even if they are effectively 1:1 today, I'd still distinguish:

```text
users
-----
id
email
password_hash
...

players
-------
id
user_id
display_name
handedness
country
created_at
...

```

Today, every `user` has exactly one `player`.

Tomorrow, if you integrate OAuth, subscriptions, or account management, the gameplay data remains attached to the `player`, not the authentication layer. This separation pays off surprisingly often.

---

## A major insight from everything we've discussed

Your app is **not primarily a scoring app**.

It's a **performance analytics platform for darts**, where scoring is the mechanism that generates data.

That distinction should influence the schema. I would optimize for analytical integrity first and scoring second.

---

## I'm starting to see the architectural layers

Here's the high-level model I currently have in mind:

```text
Identity
---------
users
players

Catalog
-------
game_types
game_modes
capture_modes

Gameplay
--------
game_sessions
session_configurations
legs
rounds
visits
darts

Analysis
--------
views
materialized views

Future
------
clubs
teams
matches
tournaments

```

Notice that nothing here is specific to 501, TUOD, or Singles Training. Those become data-driven through configuration and related entities.

---

## One recommendation I strongly believe in

I would **never** store computed statistics in the transactional tables.

For example, avoid columns like:

```sql
average
checkout_percentage
highest_checkout
tons
180s

```

Instead:

```
game_sessions
    ↓
darts
    ↓
SQL Views
    ↓
API

```

This keeps the source data clean and ensures that if you invent a new metric in two years, you can calculate it from existing data without backfilling stored aggregates.

---

## I think we have enough information to start the first draft of the ERD soon.

Before that, there's one remaining question that will influence normalization more than anything else.

## Next question

**How is a dart currently entered into the UI?**

For example, is it:

1. **Score-based**

- Tap `60`
- Tap `45`
- Tap `26`

1. **Segment-based**

- Tap `T20`
- Tap `S20`
- Tap `D16`

1. **Board-based**

- Tap the actual location on a dartboard image

1. Something else?

This is important because the database should ideally store data at the same granularity as the UI captures it. If, for example, the UI already knows the exact segment (`T20`, `D16`, `SBull`), we should avoid reducing that to just a numeric score. It also determines how easily you can later add features like miss-direction analysis, heat maps, or AI-assisted coaching without redesigning your data model.

---

## Prompt

Currently it is entered similar to a calculator. By hand the exact score for the visit is entered, e.g I geit s20 bull d3 this is entered as 76. This can be adjusted when it fits the design better

## Response

This is probably the most important design decision we've discussed so far, and it's one I'd recommend changing—even though it means more work.

## I would move away from visit-score entry

Today, your input is:

```text
76

```

The problem is that **76 isn't data—it's the result of data**.

You immediately lose:

- Which three darts were thrown
- Order of the darts
- Checkout attempts
- Misses
- Target switching
- Bed accuracy
- Recovery after misses
- Preferred routes
- Heatmaps
- Throw sequencing

There are many combinations that produce 76:

```text
T20 + S10 + D3

```

```text
S20 + Bull + D3

```

```text
T18 + D11

```

```text
20 + 20 + 36

```

All have completely different analytical value.

---

## I would redesign the scoring UI

I'd recommend making **the dart** the primary input instead of **the visit score**.

Something like:

```text
Visit

Dart 1
[T20]

Dart 2
[Bull]

Dart 3
[D3]

```

Then the UI automatically computes:

```text
Score = 76
Remaining = 425
Average
Etc.

```

The player never has to calculate anything manually, and you preserve the full history.

---

## This actually makes replay trivial

Because you know:

```text
Visit 12

Dart 1
T20

Dart 2
Bull

Dart 3
D3

```

The game engine can recompute the score exactly as the user experienced it.

---

## What about speed?

This is where UX matters.

You don't want users navigating deep menus between darts.

I would aim for something like a numpad or dartboard interface where entering three darts is almost as fast as entering a visit score.

For example:

```text
Treble
20

Treble
20

Double
20

```

Or even better:

```text
Tap T20
Tap Bull
Tap D3

```

Three taps, done.

With a well-designed UI, experienced players can enter darts extremely quickly.

---

## Even better: separate the input layer from the data layer

The UI doesn't have to expose only one input method.

Imagine supporting multiple **input strategies** that all produce the same stored data:

#### Quick score entry

```text
76

```

The app then asks:

> "Would you like to expand this visit for analytics?"

Most users skip it.

---

#### Dart entry

```text
T20
Bull
D3

```

Maximum detail.

---

#### Board tapping (future)

Tap the board three times.

---

#### Camera recognition (future)

Use computer vision to detect dart locations.

---

All of these should end up producing the **same canonical dart records** in the database.

This is a key architectural principle:

> **Multiple input methods, one canonical data model.**

---

## One thing I would add to the spec

I'd define two distinct concepts:

- **Capture method**: How the data entered the system (score input, segment input, board tap, camera, etc.).
- **Capture fidelity**: How much detail was ultimately recorded (quick, standard, analysis).

That gives you flexibility to evolve the UX without changing the underlying schema.

---

## Where I think we're heading

I believe the database should revolve around **five core entities**:

```text
Player
    │
    ▼
GameSession
    │
    ▼
Phase
    │
    ▼
Visit
    │
    ▼
Dart

```

Where **Phase** is intentionally generic:

- In 501, a phase is a **leg**.
- In TUOD, a phase is a **round**.
- In Score Training, a phase is a **round**.
- In Singles Training, a phase could represent a **target** or **round**, depending on how the game is structured.

Using a generic phase entity (or a common abstraction with game-specific detail tables) lets us avoid forcing every game into a "leg" model while still preserving ordered gameplay.

---

## My next question (the last major modeling question before drafting the ERD)

**Do you want to support versioning of game rules?**

For example:

- Today, TUOD increases by **10** on success.
- Six months later, you change the default to **5**.
- Old games should still be replayed and analyzed under the original rules.

Similarly:

- Today, Singles Training uses 3 darts per target.
- Later, you add a 5-dart variant.

My recommendation is **yes**. Every session should reference an immutable snapshot of the configuration (or rule set) that was active when it started. That way, historical games remain replayable and statistically correct even as you evolve the game logic and defaults over time. This aligns with the "database as the source of truth" philosophy we've been building throughout this brainstorming session.

---

## Prompt

For the UI infant to create an input where the user selects per dart if it was a single double or treble and the corresponding number when analytics mode is active, but uses the current quick text input for recreational games.

For the game rules, I don’t want to change rules, I want to be able to expand them. Configurations once added to production should stay, but it should be to expend on them in the future

## Response

I think those are both excellent decisions, and together they lead to an architecture that balances usability with long-term analytics.

## 1. Two input methods, one data model

This is exactly how I would approach it.

Think of the UI as an adapter rather than the source of truth.

```text
                 User Input

        Recreational          Analytics
        ------------          ---------
          "76"              T20  T20  D8
              │                 │
              └─────────┬───────┘
                        ▼
                Input Translator
                        ▼
               Canonical Game Model
                        ▼
                    PostgreSQL

```

The important point is that **the database shouldn't care how the data was entered**.

Instead, each session should have metadata like:

- `input_method = QUICK_SCORE | DART_ENTRY | BOARD | CAMERA`
- `capture_fidelity = QUICK | STANDARD | ANALYSIS`

The API can then enforce what is expected based on those settings.

---

## 2. Recreational games should intentionally have less data

This is a subtle but important distinction.

A recreational game isn't "missing" data—it **never captured** that data.

For example:

```
501
Input: 76

```

is a perfectly valid historical record.

It simply means:

> "The player chose not to record individual darts."

Your analytics layer should respect that and calculate only the statistics that are supported by the available data.

For example:

| Statistic           | Recreational | Analysis |
| ------------------- | ------------ | -------- |
| Win rate            | ✅           | ✅       |
| Average             | ✅           | ✅       |
| 180 count           | ❌ (unknown) | ✅       |
| Double accuracy     | ❌           | ✅       |
| Miss direction      | ❌           | ✅       |
| Checkout routes     | ❌           | ✅       |
| Recovery after miss | ❌           | ✅       |

Rather than treating unavailable metrics as zero, treat them as **unknown**.

---

## I also like your philosophy regarding rules

You said:

> I don't want to change rules. I want to expand them.

That's exactly the mindset I'd encourage.

Instead of versioning rules, think in terms of **capabilities**.

For example:

Today, Singles Training supports:

```
Mode
-----
Normal
Hard
Extreme

```

Later, you add:

```
Precision

```

No existing sessions change.

The new option simply becomes available for future sessions.

Likewise for TUOD:

Today:

```
Rounds
Timed

```

Later:

```
Target increment
Starting target
Adaptive difficulty

```

Existing sessions remain untouched because each session stores the exact configuration that was used when it started.

---

## One thing I would still recommend

Even if you never intend to change defaults, I would **persist the full configuration with every session**.

For example:

```
Game Session

game_type = TUOD

configuration

starting_target = 41
increase = 10
decrease = 1
mode = timed
duration = 600

```

Not because the rules will change, but because it makes each session **self-contained**. Historical replay, debugging, and analytics never need to ask, "What were the defaults at that time?"

---

## I think we've now defined the core philosophy

Here's the set of principles I'd use as the foundation for the design:

1. **Immutable facts over stored statistics**: Record what happened; derive metrics later.
2. **One account, one player**: Authentication and gameplay remain separate concerns.
3. **One central** `game_session` **entity**: Every played session, regardless of game type, shares a common lifecycle.
4. **Configuration is part of the session**: Store the exact settings used for that session.
5. **Multiple input methods**: Quick score entry for recreational play, dart-by-dart entry for analytics, with room for future input methods.
6. **Analytics are optional but first-class**: Advanced fields are nullable and only populated when captured.
7. **Replayability**: The database contains enough information to reconstruct any recorded session.
8. **Data-first extensibility**: New games and new configuration options are added without disrupting existing sessions.

---

## What comes next

I think we have enough information to move from brainstorming into design.

My proposal is to tackle the design in this order:

1. **Conceptual ERD**: Identify the core entities and their relationships, independent of implementation.
2. **Logical schema**: Define tables, keys, constraints, and normalization (targeting at least Third Normal Form, with selective denormalization only where it clearly benefits performance).
3. **Physical schema for Neon/PostgreSQL**: Choose data types, indexes, partitioning strategy (if needed), generated columns, and view/materialized view strategy.
4. **Analytics layer**: Specify which statistics are computed from SQL views, which deserve materialized views, and how the API should expose them efficiently.
5. **API contract**: Design the payloads between Astro, your proxy API, and Neon so that the frontend remains decoupled from the database.

I expect the resulting design to remain suitable not only for your current four game types, but also for future additions like Cricket, Bob's 27, Around the Clock, online matches, clubs, and tournaments without requiring a fundamental redesign.

---
