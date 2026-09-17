# Checkout trivia

An important part of darts, in perticular 501 and checkout games such as Ten Up One Down and 121, is nowing what routes to take. Important is to know which order is best in case you mis a trebble or single, ensuring your self another dart, e.g. at the bull, or better setup.

---

## V1 trivia

This should be a flashcard kind of game. The user is shown a number between 2 and 170 and has to answer with a valid checkout. There are cases where several options exists. One is not indefinitely the best, but there is a prefered route. At the end of a trivia game, the given answers are shown and if there is a better route, this is provided with an info button for reading an explanation on why this route would be preferable.

### Configurations / settings

User should be able to configure the game via the following options:

- amount of questions: 10 to 168 (max checkouts in the game): default 25 (random subset)
- default (all options randomized based on config amount) | only two dart checkouts | only three dart checkouts
- custom range: only checkouts between 70 - 116 or 121 - 170 etc.

### Interface

User enters via an interface looking something like below:

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

### Input flow

#### Input

User selects `single | double | tripple` on the first row, than selects a number, this fills the display for that dart.
On reaching a correct answer with less than 3 darts, the new target shows.
On filling in three darts, the next target shows, no direct feedback on success/failure. This shows at the end of the game.

#### Making corrections

User can use the back to correct a type, this can be tapped twice to go back 2, three times to go back 3 etc.

#### Completion gate

On the last answer, a modal should show, asking the user to submit, this ensures that a missed click on the last entry does not mean a fail unless the user submits manually.

### Summary

At the end of a game, the summary page shows. It shows correct answers vs. wrong answers and provides feedback on checkout paths that might work, but are not the prefered checkout routes. An info button provided the user with an explanation if desired.

The summary should look similar to the example below:

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
