import { isGameTypeKey } from "@lib/game/rulesets/capabilities";
import { markersForTurns } from "@lib/game/board-input.data";
import { foldReplay, replayFacts } from "@lib/stats/replay-fold";
import { REPLAY_PRESENTERS } from "@lib/stats/replay-presenters";
import { replaySessionIdFromLocation } from "@lib/stats/replay-route";
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
 * Session replay page state (`10-Statistics/02-Replay.md`, D371 decisions
 * 8-9): the header and every loaded turn, read page by page through the
 * `replayPages` cache and folded from page 1 on every load. Registered
 * through `Alpine.store("replay", replayStore())`, so `init()` is the
 * sanctioned hydration hook -- `x-init` is forbidden repo-wide. The loaded
 * header and turns are also held raw in the closure, so the fold never
 * walks Alpine's reactive proxies.
 */
export function replayStore() {
  let queue: Promise<void> = Promise.resolve();
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
     * Reads `?session=` and loads the first page. No id, or one the replay
     * route's own `ReplaySessionIdParam` would reject, is `NOT_FOUND`, and
     * nothing is fetched: a malformed id never reaches a request path.
     */
    async init() {
      const sessionId = replaySessionIdFromLocation();
      if (
        sessionId === null ||
        !ReplaySessionIdParam.safeParse(sessionId).success
      ) {
        this.error = "NOT_FOUND";
        return;
      }
      this.sessionId = sessionId;
      await this.loadNext();
    },

    /** Queues the next page behind any load still running, so each cursor is read once and pages append in order. */
    loadNext(): Promise<void> {
      const next = queue.then(() => this.loadPage());
      queue = next;
      return next;
    },

    /** Reads the page after the loaded ones (the first when none is); a no-op once `nextCursor` is `null`. Never rejects. */
    async loadPage(): Promise<void> {
      const sessionId = this.sessionId;
      if (sessionId === null) return;
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
        this.append(page);
      } catch (cause) {
        this.error = loadErrorOf(cause);
      } finally {
        this.loading = false;
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

    /** The session's game presenter, or `null` for a game type this client does not know. */
    get presenter(): ReplayPresenter | null {
      const gameTypeKey = this.header?.gameTypeKey;
      return gameTypeKey !== undefined && isGameTypeKey(gameTypeKey)
        ? REPLAY_PRESENTERS[gameTypeKey]
        : null;
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

    /** Turn `index`'s presenter cells, `[]` when derived values are unavailable. */
    cellsOf(index: number): ReplayCell[] {
      const fold = this.fold;
      const presenter = this.presenter;
      const step = fold?.ok ? fold.steps[index] : undefined;
      if (!fold?.ok || presenter === null || step === undefined) return [];
      return presenter.turn(step, fold.snapshot);
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

    /** The loaded turns grouped by stage in play order, each under its heading; stages with no loaded turn are left out. */
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
      return header.stages
        .filter((stage) => rows.has(stage.stageId))
        .map((stage) => ({
          stageId: stage.stageId,
          heading: stageHeading(stage, header.stages),
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
