import { isGameTypeKey } from "@lib/game/rulesets/capabilities";
import { markersForTurns } from "@lib/game/board-input.data";
import { foldReplay } from "@lib/stats/replay-fold";
import {
  REPLAY_PRESENTERS,
  STEP_REPLAY_PRESENTERS,
} from "@lib/stats/replay-presenters";
import { isDartExerciseKind } from "@lib/stats/section-registry";
import {
  resolveStepAdapter,
  stepAdapterKey,
} from "@lib/training/routines/adapters/step-adapter.registry";
import { replayFacts } from "@modules/stats/replay.module";
import { dartLabel } from "@modules/stats/sections/checkout-path.module";
import { fetchSessionReplay, StatisticsApiError } from "@client/api/statistics";
import { readReplayPage } from "@client/stats-cache/cache";
import { ReplaySessionIdParam } from "@client/api/types";
import type { ReplayPageSchemaData } from "@client/api/types";
import type {
  BoardMarker,
  ReplayCell,
  ReplayCurveRow,
  ReplayFold,
  ReplayLoadError,
  ReplayPresenter,
  ReplaySessionLine,
  ReplayStageGroup,
  ReplayTurnView,
} from "@lib/types";
import type { StageTypeKey, TurnFact } from "@modules/types";

type ReplayHeader = NonNullable<ReplayPageSchemaData["header"]>;
type ReplayTurn = ReplayPageSchemaData["turns"][number];
type ReplayStage = ReplayHeader["stages"][number];

/** The word each stage type's heading reads as. */
const STAGE_LABELS: Record<StageTypeKey, string> = {
  MATCH: "Match",
  SET: "Set",
  LEG: "Leg",
  ROUND: "Round",
  EXERCISE_BLOCK: "Block",
  EXERCISE_SECTION: "Section",
};

const ERROR_MESSAGES: Record<ReplayLoadError, string> = {
  NOT_FOUND: "This session could not be found.",
  FAILED: "The replay could not be loaded.",
};

function stageLabel(stage: ReplayStage): string {
  const word =
    STAGE_LABELS[stage.stageTypeKey as StageTypeKey] ?? stage.stageTypeKey;
  return `${word} ${stage.sequence}`;
}

/**
 * A stage's heading: its ancestors' labels, then its own (`Set 1 · Leg 2`).
 * The walk is bounded by the stage count, so a malformed parent loop cannot
 * spin.
 */
function stageHeading(
  stage: ReplayStage,
  stages: readonly ReplayStage[],
): string {
  const labels: string[] = [];
  let current: ReplayStage | undefined = stage;
  while (current && labels.length < stages.length) {
    labels.unshift(stageLabel(current));
    const parentId: string | null = current.parentStageId;
    current =
      parentId === null
        ? undefined
        : stages.find((candidate) => candidate.stageId === parentId);
  }
  return labels.join(" · ");
}

/** The route's `NOT_FOUND` gate reads as `NOT_FOUND`; every other failure as `FAILED`. */
function loadErrorOf(cause: unknown): ReplayLoadError {
  return cause instanceof StatisticsApiError && cause.code === "NOT_FOUND"
    ? "NOT_FOUND"
    : "FAILED";
}

/** A stored turn as the engine fact its darts are labelled and placed from. */
function turnFactOf(turn: ReplayTurn): TurnFact {
  return replayFacts([], [turn]).turns[0]!;
}

/**
 * Session replay state (`10-Statistics/02-Replay.md`, D371 decision 8,
 * D414): the header and every loaded turn of the session a replay card
 * opened, read page by page through the `replayPages` cache and folded from
 * page 1 on every load. Registered through
 * `Alpine.store("replay", replayStore())`. The loaded header and turns are
 * also held raw in the closure, so the fold never walks Alpine's reactive
 * proxies. Each `open()` starts a new generation; a page from an earlier
 * one is dropped.
 */
export function replayStore() {
  let queue: Promise<void> = Promise.resolve();
  let generation = 0;
  let loadedHeader: ReplayHeader | null = null;
  let loadedTurns: ReplayTurn[] = [];

  return {
    sessionId: null as string | null,
    header: null as ReplayHeader | null,
    turns: [] as ReplayTurn[],
    nextCursor: null as string | null,
    fold: null as ReplayFold | null,
    loading: false,
    error: null as ReplayLoadError | null,
    selectedIndex: null as number | null,

    /**
     * Clears the previous session and loads `sessionId`'s first page. An id
     * the replay route's own `ReplaySessionIdParam` would reject is
     * `NOT_FOUND`, and nothing is fetched: a malformed id never reaches a
     * request path.
     */
    async open(sessionId: string) {
      generation += 1;
      queue = Promise.resolve();
      loadedHeader = null;
      loadedTurns = [];
      Object.assign(this, {
        sessionId: null,
        header: null,
        turns: [],
        nextCursor: null,
        fold: null,
        loading: false,
        error: null,
        selectedIndex: null,
      });
      if (!ReplaySessionIdParam.safeParse(sessionId).success) {
        this.error = "NOT_FOUND";
        return;
      }
      this.sessionId = sessionId;
      await this.loadNext();
    },

    /** Queues the next page behind any load still running, so each cursor is read once and pages append in order. */
    loadNext(): Promise<void> {
      const mine = generation;
      const next = queue.then(() => this.loadPage(mine));
      queue = next;
      return next;
    },

    /** Reads the page after the loaded ones (the first when none is); a no-op once `nextCursor` is `null` or a newer `open()` has started. Never rejects. */
    async loadPage(mine: number): Promise<void> {
      const sessionId = this.sessionId;
      if (sessionId === null || mine !== generation) return;
      const cursor = loadedHeader === null ? undefined : this.nextCursor;
      if (cursor === null) return;
      this.loading = true;
      this.error = null;
      try {
        const page = await readReplayPage<ReplayPageSchemaData>(
          sessionId,
          cursor,
          () => fetchSessionReplay(sessionId, { cursor }),
        );
        if (mine === generation) this.append(page);
      } catch (cause) {
        if (mine === generation) this.error = loadErrorOf(cause);
      } finally {
        if (mine === generation) this.loading = false;
      }
    },

    /**
     * Appends `page`'s turns and refolds every loaded turn from page 1.
     * @throws when the first page carries no header.
     */
    append(page: ReplayPageSchemaData) {
      const header = loadedHeader ?? page.header;
      if (header === null) {
        throw new Error("The first replay page carries no header.");
      }
      loadedHeader = header;
      loadedTurns = [...loadedTurns, ...page.turns];
      this.header = header;
      this.turns = loadedTurns;
      this.nextCursor = page.nextCursor;
      this.fold = foldReplay(header, loadedTurns);
    },

    /** Picks the turn whose darts the board marks. */
    select(index: number) {
      this.selectedIndex = index;
    },

    /**
     * The session's own presenter (D372 decision 11): a game
     * session (`gameTypeKey` set) picks `REPLAY_PRESENTERS`, a non-game
     * routine step picks `STEP_REPLAY_PRESENTERS` off its
     * `exerciseTypeKey`. `null` for a game type or exercise kind this
     * client does not know.
     */
    get presenter(): ReplayPresenter | null {
      const header = this.header;
      if (header === null) return null;
      if (header.gameTypeKey !== null) {
        return isGameTypeKey(header.gameTypeKey)
          ? REPLAY_PRESENTERS[header.gameTypeKey]
          : null;
      }
      return isDartExerciseKind(header.exerciseTypeKey)
        ? STEP_REPLAY_PRESENTERS[header.exerciseTypeKey]
        : null;
    },

    /**
     * A step replay's title: its adapter's `headerLabel`, capitalized; the
     * raw exercise type when no adapter matches. Resolved here, not in the
     * prerendered page's frontmatter, because the adapter registry imports
     * the play controllers, whose auth client draws a random id at module
     * scope — which the Workers prerenderer rejects.
     */
    get exerciseTitle(): string | null {
      const header = this.header;
      if (header === null) return null;
      const label = resolveStepAdapter(
        stepAdapterKey({
          exerciseTypeKey: header.exerciseTypeKey,
          gameRulesetVersionKey: header.rulesetVersionKey,
        }),
      )?.headerLabel;
      return label === undefined
        ? header.exerciseTypeKey
        : label.charAt(0).toUpperCase() + label.slice(1);
    },

    /** Whether the page can show derived values: the fold ran and the game has a presenter. */
    get derivedAvailable(): boolean {
      return this.fold?.ok === true && this.presenter !== null;
    },

    get errorMessage(): string {
      return this.error === null ? "" : ERROR_MESSAGES[this.error];
    },

    participantName(participantId: string): string {
      return (
        this.header?.participants.find(
          (participant) => participant.participantId === participantId,
        )?.displayName ?? ""
      );
    },

    /**
     * Turn `index`'s presenter cells, `[]` when derived values are
     * unavailable or the presenter throws on that turn: one bad turn is
     * skipped, never guessed, and never breaks the list.
     */
    cellsOf(index: number): ReplayCell[] {
      const fold = this.fold;
      const presenter = this.presenter;
      const step = fold?.ok ? fold.steps[index] : undefined;
      if (!fold?.ok || presenter === null || step === undefined) return [];
      try {
        return presenter.turn(step, fold.snapshot);
      } catch {
        return [];
      }
    },

    /**
     * Turn `index` as its row shows it: the stored darts and visit total,
     * plus the presenter's cells only when derived values are available.
     * @throws RangeError for an index that names no loaded turn.
     */
    turnView(index: number): ReplayTurnView {
      const turn = this.turns[index];
      if (!turn) throw new RangeError(`No turn ${index} in this replay.`);
      return {
        index,
        seat: this.participantName(turn.participantId),
        darts: turnFactOf(turn).darts.map((dart) => ({
          dartNumber: dart.sequence,
          label: dartLabel(dart),
        })),
        total: turn.turnTotalScore,
        cells: this.cellsOf(index),
      };
    },

    /**
     * The loaded turns grouped by stage in play order, each under its
     * heading; stages with no loaded turn are left out. A session whose only
     * stage is an `EXERCISE_BLOCK` gets no heading (`null`): "Block 1" names
     * nothing the page does not already show.
     */
    get stageGroups(): ReplayStageGroup[] {
      const header = this.header;
      if (header === null) return [];
      const rows = new Map<string, ReplayTurnView[]>();
      this.turns.forEach((turn, index) => {
        rows.set(turn.stageId, [
          ...(rows.get(turn.stageId) ?? []),
          this.turnView(index),
        ]);
      });
      const loneBlock =
        header.stages.length === 1 &&
        header.stages[0]!.stageTypeKey === "EXERCISE_BLOCK";
      return header.stages
        .filter((stage) => rows.has(stage.stageId))
        .map((stage) => ({
          stageId: stage.stageId,
          heading: loneBlock ? null : stageHeading(stage, header.stages),
          rows: rows.get(stage.stageId)!,
        }));
    },

    /**
     * The presenter's session line, only once every page is loaded -- it
     * reads the last loaded turn -- and only when derived values are
     * available.
     */
    get sessionLine(): ReplaySessionLine | null {
      const fold = this.fold;
      const presenter = this.presenter;
      if (this.nextCursor !== null || !fold?.ok || presenter === null) {
        return null;
      }
      return presenter.session(fold.steps, fold.snapshot);
    },

    /** The session line's score curves (Bob's 27), each bar a percent of the highest score drawn; a score below zero draws none. */
    get curveRows(): ReplayCurveRow[] {
      const curves = this.sessionLine?.curves ?? [];
      const highest = Math.max(1, ...curves.flatMap((curve) => curve.points));
      return curves.map((curve) => ({
        participantId: curve.participantId,
        seat: this.participantName(curve.participantId),
        points: curve.points.map((score, index) => ({
          visit: index + 1,
          score,
          widthPercent: (Math.max(0, score) / highest) * 100,
        })),
      }));
    },

    /** The selected turn's located darts on the board; none for a turn-total-only turn or an unseen dart. */
    get selectedMarkers(): BoardMarker[] {
      const turn =
        this.selectedIndex === null
          ? undefined
          : this.turns[this.selectedIndex];
      return turn ? markersForTurns([turnFactOf(turn)]) : [];
    },
  };
}
