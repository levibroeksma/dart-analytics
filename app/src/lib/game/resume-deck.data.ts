import { fetchActiveSessions } from "@client/api/sessions";
import { GAME_CARDS } from "@lib/game/rulesets/games-visibility";
import { startedAgo } from "@utils/started-ago";
import { summarizeProgress } from "@modules/game/session-progress.module";
import type { SessionActiveData } from "@client/api/types";
import type {
  GameCardDescriptor,
  LocalGame,
  ResumeCard,
  ResumeDeckContext,
  ResumeDeckPhase,
} from "@lib/types";

const SWIPE_THRESHOLD_PX = 40;
const MAX_STACK_LAYERS = 2;

/**
 * Turns active sessions into resume cards, newest-started first. Routine steps
 * and sessions whose ruleset has no game card are dropped. Progress comes from
 * the server; when the local `game` store holds that same session (matching id
 * and ruleset) its fact log is summarised instead, falling back to the
 * server's progress when it yields none.
 */
export function toResumeCards(
  sessions: SessionActiveData[],
  local: LocalGame | null,
  now: Date,
  cards: readonly GameCardDescriptor[] = GAME_CARDS,
): ResumeCard[] {
  return sessions
    .filter((session) => !session.isRoutineStep)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .flatMap((session) => {
      const card = cards.find(
        (game) => game.rulesetVersionKey === session.rulesetVersionKey,
      );
      if (!card || session.rulesetVersionKey === null) return [];
      const overlay =
        local?.sessionId === session.sessionId &&
        local.rulesetVersionKey === session.rulesetVersionKey
          ? summarizeProgress(session.rulesetVersionKey, local.configSnapshot, {
              stages: local.stages,
              turns: local.turns,
            })
          : null;
      const progress = overlay ?? session.progress;
      return [
        {
          sessionId: session.sessionId,
          title: card.title,
          href: card.href,
          started: `STARTED ${startedAgo(session.startedAt, now)}`,
          detail: progress?.detail ?? "",
          big: progress?.big ?? null,
        },
      ];
    });
}

/**
 * Home resume-deck state: the player's active sessions as a stack of cards
 * with the top one resumable.
 *
 * Cards load once from the server and are overlaid with the local `game`
 * store's progress for the session it holds. A failed fetch hides the deck.
 * `phase` drives the swap animation: `next()` sends the top card `out`, and
 * `settle()` (bound to `animationend`) advances the index, `rise`s the next
 * card, then returns to `idle`; `prev()` brings the previous card `in`. Input
 * is ignored outside `idle`.
 */
export function resumeDeck() {
  return {
    cards: [] as ResumeCard[],
    index: 0,
    phase: "idle" as ResumeDeckPhase,
    loading: true,
    failed: false,
    swipeX: null as number | null,
    swipeY: null as number | null,

    async init(this: ResumeDeckContext) {
      this.loading = true;
      try {
        this.cards = toResumeCards(
          await fetchActiveSessions(),
          this.$store.game,
          new Date(),
        );
      } catch {
        this.failed = true;
      } finally {
        this.loading = false;
      }
    },

    top(this: ResumeDeckContext) {
      return this.cards[this.index] ?? null;
    },

    position(this: ResumeDeckContext) {
      return `${this.index + 1} / ${this.cards.length}`;
    },

    layers(this: ResumeDeckContext) {
      return Math.min(Math.max(this.cards.length - 1, 0), MAX_STACK_LAYERS);
    },

    visible(this: ResumeDeckContext) {
      return !this.failed && (this.loading || this.cards.length > 0);
    },

    next(this: ResumeDeckContext) {
      if (this.phase !== "idle" || this.cards.length <= 1) return;
      this.phase = "out";
    },

    prev(this: ResumeDeckContext) {
      if (this.phase !== "idle" || this.cards.length <= 1) return;
      const count = this.cards.length;
      this.index = (this.index - 1 + count) % count;
      this.phase = "in";
    },

    settle(this: ResumeDeckContext) {
      if (this.phase === "out") {
        this.index = (this.index + 1) % this.cards.length;
        this.phase = "rise";
      } else if (this.phase === "rise" || this.phase === "in") {
        this.phase = "idle";
      }
    },

    swipeStart(this: ResumeDeckContext, event: PointerEvent) {
      this.swipeX = event.clientX;
      this.swipeY = event.clientY;
    },

    swipeEnd(this: ResumeDeckContext, event: PointerEvent) {
      const startX = this.swipeX;
      const startY = this.swipeY;
      this.swipeX = null;
      this.swipeY = null;
      if (startX === null || startY === null) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) {
        return;
      }
      if (dx < 0) this.next();
      else this.prev();
    },

    resume(this: ResumeDeckContext) {
      const card = this.top();
      if (card) this.navigate(card.href);
    },

    navigate(path: string) {
      globalThis.location.href = path;
    },
  };
}
