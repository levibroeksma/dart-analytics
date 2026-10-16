import type { SeatFact, StarterStepOptions } from "@lib/types";

type PlayAgainStarterContext = {
  starterOpen: boolean;
  playAgainStarter: 0 | 1 | null;
  $store: { game: { seats: readonly SeatFact[] } };
  playAgain(): unknown;
};

/**
 * Play Again's who-throws-first step for a play page (spread into its
 * factory). `requestPlayAgain()` replays straight away solo and opens the
 * step with two seats. The step always offers the player as side 0; the
 * winning side is mapped back to its seat in `playAgainStarter`, which
 * `runPlayAgain` seats first.
 */
export function playAgainStarterData() {
  return {
    starterOpen: false,
    playAgainStarter: null as 0 | 1 | null,

    requestPlayAgain(this: PlayAgainStarterContext) {
      if (this.$store.game.seats.length < 2) return this.playAgain();
      this.starterOpen = true;
    },

    playAgainStarterOptions(this: PlayAgainStarterContext): StarterStepOptions {
      const seats = this.$store.game.seats;
      const playerSeat = Math.max(
        0,
        seats.findIndex((seat) => seat.participantTypeKey === "PLAYER"),
      ) as 0 | 1;
      const otherSeat = (1 - playerSeat) as 0 | 1;
      return {
        sides: () => [
          seats[playerSeat]?.displayName || "You",
          seats[otherSeat]?.displayName ?? "",
        ],
        opponentIsBot: () => seats[otherSeat]?.participantTypeKey === "DARTBOT",
        onResolve: (side) => {
          this.playAgainStarter = side === 0 ? playerSeat : otherSeat;
          this.starterOpen = false;
          void this.playAgain();
        },
        onCancel: () => {
          this.starterOpen = false;
        },
      };
    },
  };
}
