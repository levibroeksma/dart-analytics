import type { FollowTheLeaderSnapshot, Seated } from "@lib/types";
import { registerEngineFactory } from "./engine.registry";
import { NO_INTENT, endedRefusal, openVisit } from "./turn-log.module";
import { eliminationWinner } from "./match-outcome.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { foldElimination } from "./elimination-kernel.module";
import {
  bedOf,
  keepAllowed,
  resolveVisit,
  sameBed,
} from "./follow-the-leader-policy";
import type {
  DartGameSpec,
  DartGameVisitActions,
  EliminationRules,
} from "./interfaces";
import type {
  BedFact,
  DartObservation,
  EliminationSeat,
  EngineFacts,
  FollowTheLeaderAction,
  FollowTheLeaderExt,
  FollowTheLeaderSeatState,
  FollowTheLeaderShared,
  FollowTheLeaderState,
  TurnFact,
} from "./types";

type Config = Seated<FollowTheLeaderSnapshot>;
type Input = DartObservation | FollowTheLeaderAction;

const GAME_ENDED = endedRefusal("game has ended");
const STOP_REFUSED = "Stop needs a match first";
const KEEP_REFUSED = "Keep not allowed";
const MATCH_DARTS = 3;
const SETTING_DARTS = 1;

/** Follow the Leader V1 as Elimination rules: three lives, every effect resolved when a visit closes (`resolveVisit`), and a re-throw seat held by `retryRef`. */
function followTheLeaderRules(
  config: FollowTheLeaderSnapshot,
): EliminationRules<FollowTheLeaderExt, FollowTheLeaderShared> {
  return {
    startingLives: config.lives,
    initExt: () => ({}),
    onDart: () => [],
    initShared: () => ({
      target: null,
      leaderRef: null,
      failed: [],
      retryRef: null,
    }),
    onVisitClose: resolveVisit,
    activeOverride: (_seats, shared) => shared.retryRef,
  };
}

function toSeat(
  seat: EliminationSeat<FollowTheLeaderExt>,
): FollowTheLeaderSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    lives: seat.lives,
    out: seat.out,
  };
}

function phaseOf(
  shared: FollowTheLeaderShared,
  activeRef: string,
): FollowTheLeaderState["phase"] {
  if (shared.target === null) return "OPENING";
  return shared.leaderRef === activeRef ? "LEAD" : "MATCH";
}

/** Whether any of `darts` landed in `target`'s bed. */
function hitsBed(
  darts: readonly DartObservation[],
  target: BedFact | null,
): boolean {
  if (target === null) return false;
  return darts.some((dart) => {
    const bed = bedOf(dart);
    return bed !== null && sameBed(bed, target);
  });
}

/**
 * Folds the whole fact log into Follow the Leader's state via the
 * Elimination kernel; a turn counts as closed only once `completedAt` is set.
 * Keep is offered only between visits and never to a leader owed a re-throw.
 */
export function foldFollowTheLeaderState(
  facts: EngineFacts,
  config: Config,
): FollowTheLeaderState {
  const match = foldElimination(
    facts.turns,
    config.seats,
    followTheLeaderRules(config),
  );
  const { shared, activeParticipantRef } = match;
  const open = openVisit(facts.turns);
  const phase = phaseOf(shared, activeParticipantRef);
  const matched = open !== null && hitsBed(open.darts, shared.target);
  const between =
    open === null && match.status === "IN_PROGRESS" && shared.retryRef === null;
  return {
    activeParticipantRef,
    status: match.status,
    winningSideKey: match.winningSideKey,
    outOrder: match.outOrder,
    seats: match.seats.map(toSeat),
    target: shared.target,
    leaderRef: shared.leaderRef,
    phase,
    matched,
    canStop: phase === "MATCH" && matched,
    keepAllowed:
      between && keepAllowed(match.seats, shared, activeParticipantRef),
  };
}

/** How many darts a visit in `phase` holds: three for a matcher, one for a setting turn. */
function visitDarts(phase: FollowTheLeaderState["phase"]): number {
  return phase === "MATCH" ? MATCH_DARTS : SETTING_DARTS;
}

function isAction(input: Input): input is FollowTheLeaderAction {
  return "kind" in input;
}

/** The darts of the matcher visit `input` would close, or null when it closes none. */
function closingDarts(
  state: FollowTheLeaderState,
  input: Input,
  open: TurnFact | null,
): readonly DartObservation[] | null {
  const darts = open?.darts ?? [];
  if (isAction(input))
    return input.kind === "STOP" && state.canStop ? darts : null;
  const after = [...darts, input];
  return after.length === MATCH_DARTS ? after : null;
}

/** Whether closing the active matcher's visit on `darts` leaves one side standing. */
function closeEndsGame(
  state: FollowTheLeaderState,
  darts: readonly DartObservation[],
): boolean {
  const seats = state.seats.map((seat) => ({ ...seat, ext: {} }));
  const outcome = resolveVisit(
    { participantRef: state.activeParticipantRef, darts, kept: false },
    seats,
    {
      target: state.target,
      leaderRef: state.leaderRef,
      failed: [],
      retryRef: null,
    },
  );
  const after = seats.map((seat) => {
    const delta = outcome.changes
      .filter((change) => change.participantRef === seat.participantRef)
      .reduce((sum, change) => sum + (change.livesDelta ?? 0), 0);
    return {
      sideKey: seat.sideKey,
      failed: seat.out || seat.lives + delta <= 0,
    };
  });
  return eliminationWinner(after) !== null;
}

/** Stop closes a matcher's open visit once it has matched; Keep passes a leader's turn when every other seat failed. */
const visitActions: DartGameVisitActions<
  Config,
  FollowTheLeaderState,
  FollowTheLeaderAction
> = {
  isAction,
  refusal(state, action) {
    if (state.status !== "IN_PROGRESS") return GAME_ENDED;
    if (action.kind === "STOP") return state.canStop ? null : STOP_REFUSED;
    return state.keepAllowed ? null : KEEP_REFUSED;
  },
  effect: (action) => (action.kind === "STOP" ? "CLOSE_VISIT" : "KEEP_TURN"),
  closedByAction: (turn, before) =>
    before.phase === "MATCH" && turn.darts.length < MATCH_DARTS,
};

/**
 * Follow the Leader's rules for the dart engine shell over one `SHARED`
 * stage (`follow-the-leader.md`): a matcher's visit holds up to three darts
 * and may stop after a match; an opening or leader turn holds one dart.
 */
const followTheLeaderSpec: DartGameSpec<
  Config,
  FollowTheLeaderState,
  FollowTheLeaderAction
> = {
  rulesetVersionKey: "FOLLOW_THE_LEADER_V1",
  stageOwnership: "SHARED",
  fold: foldFollowTheLeaderState,
  refusal: (state) => (state.status === "IN_PROGRESS" ? null : GAME_ENDED),
  intent: () => NO_INTENT,
  isVisitOpen: (turn, state) =>
    turn.completedAt === null &&
    state.status === "IN_PROGRESS" &&
    turn.darts.length < visitDarts(state.phase),
  wouldComplete: (state, input, _config, open) => {
    if (state.status !== "IN_PROGRESS" || state.phase !== "MATCH") return false;
    const darts = closingDarts(state, input, open);
    return darts !== null && closeEndsGame(state, darts);
  },
  visitActions,
};

/** Follow the Leader engine (Pattern 18), built by the dart engine shell on the Elimination kernel. */
export class FollowTheLeaderEngine extends dartGameEngineClass(
  followTheLeaderSpec,
) {}

export const followTheLeaderEngineFactory = dartGameEngineFactory(
  followTheLeaderSpec,
  FollowTheLeaderEngine,
);

registerEngineFactory(followTheLeaderEngineFactory);
