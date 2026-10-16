import {
  GAME_CARDS,
  cardForRuleset,
} from "@lib/game/rulesets/games-visibility";
import { startedAgo } from "@utils/started-ago";
import { summarizeProgress } from "@modules/game/session-progress.module";
import type { SessionActiveData } from "@client/api/types";
import type { SessionProgress } from "@modules/types";
import type {
  DeckDirection,
  DeckSlot,
  DeckSlotState,
  GameCardDescriptor,
  LocalGame,
  ResumeCard,
  ResumeDeckContext,
  ResumeDeckPhase,
} from "@lib/types";

const SWIPE_THRESHOLD_PX = 40;
const MAX_VISIBLE_CARDS = 3;

/** When each step phase begins, in ms after `next()`/`prev()` (study §01). */
export const DECK_TIMINGS = { snapMs: 480, backMs: 520, idleMs: 1040 };

/**
 * Starts one deck step: records which card moves and which way, then walks
 * `go → snap → back → idle` on timers. Timers replace `animationend`, so no
 * swallowed event can strand the deck.
 */
function beginStep(
  deck: ResumeDeckContext,
  direction: DeckDirection,
  from: number,
) {
  deck.direction = direction;
  deck.from = from;
  deck.phase = "go";
  const at = (phase: ResumeDeckPhase, ms: number) =>
    setTimeout(() => {
      deck.phase = phase;
      if (phase === "idle") {
        deck.from = null;
        deck.direction = null;
        deck.animTimers = [];
      }
    }, ms);
  deck.animTimers = [
    at("snap", DECK_TIMINGS.snapMs),
    at("back", DECK_TIMINGS.backMs),
    at("idle", DECK_TIMINGS.idleMs),
  ];
}

/**
 * The state of the card moving through a step: `next` takes the old top
 * `leaving` then `parked` then `entering` the back slot; `prev` takes the
 * new top `staged` then `entering` the front.
 */
function moverState(
  direction: DeckDirection,
  phase: ResumeDeckPhase,
): DeckSlotState {
  if (phase === "back") return "entering";
  if (direction === "next") return phase === "go" ? "leaving" : "parked";
  return "staged";
}

function holdsSession(
  session: SessionActiveData,
  local: LocalGame | null,
): local is LocalGame {
  return (
    local !== null &&
    session.rulesetVersionKey !== null &&
    local.sessionId === session.sessionId &&
    local.rulesetVersionKey === session.rulesetVersionKey
  );
}

/**
 * The local `game` store's progress for a session, or null when the store holds
 * a different session or ruleset (or its fact log summarises to nothing).
 */
function localProgress(
  session: SessionActiveData,
  local: LocalGame | null,
): SessionProgress | null {
  if (!holdsSession(session, local) || session.rulesetVersionKey === null) {
    return null;
  }
  return summarizeProgress(session.rulesetVersionKey, local.configSnapshot, {
    stages: local.stages,
    turns: local.turns,
  });
}

function toResumeCard(
  session: SessionActiveData,
  card: GameCardDescriptor,
  local: LocalGame | null,
  now: Date,
): ResumeCard {
  const progress = localProgress(session, local) ?? session.progress;
  return {
    sessionId: session.sessionId,
    title: card.title,
    href: card.href,
    started: `STARTED ${startedAgo(session.startedAt, now)}`,
    local: holdsSession(session, local),
    detail: progress?.detail ?? "",
    big: progress?.big ?? null,
  };
}

/**
 * Turns active sessions into resume cards, newest-started first. Routine steps
 * and sessions whose ruleset has no game card are dropped. Progress comes from
 * the server; when the local `game` store holds that same session (matching id
 * and ruleset) its fact log is summarised instead, falling back to the
 * server's progress when it yields none. A card's `local` flag marks the
 * session the store holds, the only one the setup page can resume.
 */
export function toResumeCards(
  sessions: SessionActiveData[],
  local: LocalGame | null,
  now: Date,
  cards: readonly GameCardDescriptor[] = GAME_CARDS,
): ResumeCard[] {
  return sessions
    .filter((session) => !session.isRoutineStep)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .flatMap((session) => {
      const card = cardForRuleset(cards, session.rulesetVersionKey);
      if (!card || session.rulesetVersionKey === null) return [];
      return [toResumeCard(session, card, local, now)];
    });
}

/**
 * Home resume-deck state: the player's active sessions as a stack of cards
 * with the top one resumable.
 *
 * Cards come from the shared `activeSessions` store and are overlaid with the local `game`
 * store's progress for the session it holds. The deck stays hidden until the
 * load settles, and a failed fetch or an empty result keeps it hidden.
 * Up to three cards render as real stacked cards (`deckSlots()`). `next()`
 * flies the top card off, the rest step forward and the old top (or, past
 * three cards, the next hidden one) slides into the back slot; `prev()` is
 * the reverse. Input is ignored outside `idle`, and a drag that starts on a
 * button never swipes.
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
    from: null as number | null,
    direction: null as DeckDirection | null,
    animTimers: [] as ReturnType<typeof setTimeout>[],

    async init(this: ResumeDeckContext) {
      this.loading = true;
      await this.$store.activeSessions.load();
      this.failed = this.$store.activeSessions.failed;
      this.cards = toResumeCards(
        this.$store.activeSessions.sessions,
        this.$store.game,
        new Date(),
      );
      this.loading = false;
    },

    top(this: ResumeDeckContext) {
      return this.cards[this.index] ?? null;
    },

    position(this: ResumeDeckContext) {
      return `${this.index + 1} / ${this.cards.length}`;
    },

    deckSlots(this: ResumeDeckContext): DeckSlot[] {
      const count = this.cards.length;
      const visible = Math.min(count, MAX_VISIBLE_CARDS);
      const backDepth = (visible - 1) as DeckSlot["depth"];
      const at = (offset: number) => (this.index + offset) % count;
      const slot = (
        position: number,
        depth: number,
        state: DeckSlotState,
      ): DeckSlot => ({
        card: this.cards[position]!,
        depth: depth as DeckSlot["depth"],
        state,
      });
      if (this.phase === "idle" || this.from === null || !this.direction) {
        return Array.from({ length: visible }, (_, k) =>
          slot(at(k), k, "rest"),
        );
      }
      const mover = moverState(this.direction, this.phase);
      if (this.direction === "next") {
        const backState =
          at(visible - 1) === this.from
            ? mover
            : this.phase === "back"
              ? "entering"
              : "parked";
        const slots = Array.from({ length: visible }, (_, k) =>
          k === visible - 1
            ? slot(at(k), backState === "leaving" ? 0 : backDepth, backState)
            : slot(at(k), k, "rest"),
        );
        if (this.phase === "go" && at(visible - 1) !== this.from) {
          slots.push(slot(this.from, 0, "leaving"));
        }
        return slots;
      }
      const slots = Array.from({ length: visible - 1 }, (_, k) =>
        slot(at(k + 1), k + 1, "rest"),
      );
      const pushedOut = count > visible ? at(visible) : this.from;
      if (this.phase === "go") {
        slots.push(slot(pushedOut, backDepth, "exiting"));
        if (pushedOut !== this.from) slots.push(slot(this.from, 0, mover));
        return slots;
      }
      slots.push(slot(this.from, 0, mover));
      return slots;
    },

    visible(this: ResumeDeckContext) {
      return !this.failed && !this.loading && this.cards.length > 0;
    },

    next(this: ResumeDeckContext) {
      if (this.phase !== "idle" || this.cards.length <= 1) return;
      const from = this.index;
      this.index = (this.index + 1) % this.cards.length;
      beginStep(this, "next", from);
    },

    prev(this: ResumeDeckContext) {
      if (this.phase !== "idle" || this.cards.length <= 1) return;
      const count = this.cards.length;
      this.index = (this.index - 1 + count) % count;
      beginStep(this, "prev", this.index);
    },

    swipeStart(this: ResumeDeckContext, event: PointerEvent) {
      if ((event.target as Element | null)?.closest?.("button")) return;
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

    swipeCancel(this: ResumeDeckContext) {
      this.swipeX = null;
      this.swipeY = null;
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
