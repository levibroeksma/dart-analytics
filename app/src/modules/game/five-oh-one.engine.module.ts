import type {
  FiveOhOneAnySnapshot,
  FiveOhOneSnapshot,
  FiveOhOneV2Snapshot,
  SeatFact,
  Seated,
} from "@lib/types";
import { newClientKey } from "./client-key.module";
import { activeSeat, seatOf } from "./seat-rota.module";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { resolveCheckoutAttempt } from "./checkout-bust.module";
import { registerEngineFactory } from "./engine.registry";
import { foldMatch, matchFormatOf } from "./match-format.module";
import {
  appendResolvedDart,
  cloneTurns,
  isDartObservationInput,
  openVisit,
  resolveObservation,
  undoStagedTurn,
} from "./turn-log.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  FiveOhOneInput,
  FiveOhOneSeatState,
  FiveOhOneState,
  FiveOhOneVisitInput,
  FiveOhOneVisitOutcome,
  LegResult,
  StageFact,
  TurnFact,
} from "./types";

const DARTS_PER_VISIT = 3;

/**
 * Builds the root `LEG` stage for leg `sequence`, used when sets are off: its
 * `parentClientKey` is null and its `sequence` is its position in the match.
 */
function legStage(sequence: number): StageFact {
  return {
    clientKey: `leg-${sequence}`,
    stageTypeKey: "LEG",
    parentClientKey: null,
    sequence,
  };
}

/** Builds the root `SET` stage for set `sequence`; its legs name it as their parent. */
function setStage(sequence: number): StageFact {
  return {
    clientKey: `set-${sequence}`,
    stageTypeKey: "SET",
    parentClientKey: null,
    sequence,
  };
}

/** Builds the `LEG` stage numbered `sequence` inside set `setSequence`. */
function setLegStage(setSequence: number, sequence: number): StageFact {
  return {
    clientKey: `set-${setSequence}-leg-${sequence}`,
    stageTypeKey: "LEG",
    parentClientKey: `set-${setSequence}`,
    sequence,
  };
}

/** The stages a fresh match opens on: one root leg, or set 1 and its first leg. */
function openingStages(config: FiveOhOneAnySnapshot): StageFact[] {
  return matchFormatOf(config).sets === null
    ? [legStage(1)]
    : [setStage(1), setLegStage(1, 1)];
}

/** A visit score is playable only as a whole number in `0..maxVisitScore`. */
function isPlayableVisitScore(
  scoreAttempted: number,
  maxVisitScore: number,
): boolean {
  return (
    Number.isInteger(scoreAttempted) &&
    scoreAttempted >= 0 &&
    scoreAttempted <= maxVisitScore
  );
}

export function initialFiveOhOneState(
  config: Seated<FiveOhOneAnySnapshot>,
): FiveOhOneState {
  const sideKeys = sidesOf(config.seats);
  const fold = foldMatch(matchFormatOf(config), sideKeys, []);
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    sides: sideKeys.map((sideKey) => ({
      sideKey,
      legsWon: 0,
      setsWon: 0,
    })),
    seats: config.seats.map((seat) => ({
      participantRef: seat.participantRef,
      sideKey: seat.sideKey,
      remainingScore: config.startingScore,
    })),
    sets: fold.sets,
    decidingSet: fold.decidingSet,
    suddenDeath: fold.suddenDeath,
  };
}

/** Every distinct side in the session, in first-seat order. */
function sidesOf(seats: readonly SeatFact[]): string[] {
  return [...new Set(seats.map((seat) => seat.sideKey))];
}

/**
 * Resolves one visit against the remaining score of the leg in play, under the
 * bust matrix in precedence order: an overshoot busts; leaving exactly 1 busts
 * because 1 cannot be finished on a double (D1 is 2); reaching exactly 0 busts
 * unless the visit declares `finishedOnDouble`. A bust scores 0 and leaves the
 * remaining score untouched.
 */
export function resolveFiveOhOneVisit(
  remainingScore: number,
  input: FiveOhOneVisitInput,
): FiveOhOneVisitOutcome {
  const outcome = resolveCheckoutAttempt(
    remainingScore,
    input.scoreAttempted,
    input.finishedOnDouble === true,
  );

  if (outcome.busted) {
    return {
      isBust: true,
      scored: 0,
      wonLeg: false,
      remainingAfter: remainingScore,
    };
  }

  return {
    isBust: false,
    scored: input.scoreAttempted,
    wonLeg: outcome.checkedOut,
    remainingAfter: outcome.remainingAfter,
  };
}

/**
 * Why the reported dart counts are impossible for the visit that is being
 * recorded, or null when they are consistent with it. Only a claimed checkout
 * is checked: on any other visit the counts describe nothing the checkout
 * chart can contradict, so they are carried without comment.
 */
function checkoutDartsRejectionFor(
  remainingScore: number,
  input: FiveOhOneVisitInput,
  config: FiveOhOneAnySnapshot,
): string | null {
  if (input.finishedOnDouble !== true) return null;
  return checkoutDartsRejection(
    remainingScore,
    input.dartsUsed,
    input.dartsAtDouble,
    config.maxDartsPerTurn,
  );
}

/**
 * One leg's visits, in the order they were thrown. Turn `sequence` is the
 * order of record within the stage, so sorting on it replays the leg exactly
 * as it was played, whatever order the fact log happens to hold.
 */
function legVisitsOf(
  facts: EngineFacts,
  stage: StageFact,
): readonly TurnFact[] {
  return facts.turns
    .filter((turn) => turn.stageClientKey === stage.clientKey)
    .slice()
    .sort((a, b) => a.sequence - b.sequence);
}

/**
 * Replays one leg into `remaining`, which every seat re-enters at
 * `startingScore` because a seat's remaining score is folded from that leg's
 * own turns and a fresh leg has none. Answers the seat that checked out, or
 * null while the leg is still open. A turn's `totalScore` is what actually
 * counted, so a bust replays as a scoreless visit and only a genuine checkout
 * can take a seat to zero — which is why a zeroing visit is safe to treat as
 * a checkout on replay.
 */
function foldLeg(
  visits: readonly TurnFact[],
  config: Seated<FiveOhOneAnySnapshot>,
  remaining: Map<string, number>,
): SeatFact | null {
  for (const seat of config.seats) {
    remaining.set(seat.participantRef, config.startingScore);
  }

  for (const visit of visits) {
    const seat = seatOf(visit, config.seats);
    const before = remaining.get(seat.participantRef) ?? config.startingScore;
    const after = before - visit.totalScore;
    remaining.set(seat.participantRef, after);
    if (after === 0) return seat;
  }

  return null;
}

function legDartsFor(
  participantRef: string,
  visits: readonly TurnFact[],
  maxDartsPerTurn: number,
): number {
  return visits
    .filter((visit) => visit.participantRef === participantRef)
    .reduce(
      (sum, visit) =>
        sum + (visit.darts.length > 0 ? visit.darts.length : maxDartsPerTurn),
      0,
    );
}

export function legResultsOf(
  facts: EngineFacts,
  config: Seated<FiveOhOneAnySnapshot>,
): LegResult[] {
  const remaining = new Map<string, number>();
  const results: LegResult[] = [];

  for (const stage of facts.stages) {
    if (stage.stageTypeKey !== "LEG") continue;
    const visits = legVisitsOf(facts, stage);
    const winner = foldLeg(visits, config, remaining);
    if (winner === null) continue;

    results.push({
      sideKey: winner.sideKey,
      participantRef: winner.participantRef,
      darts: legDartsFor(winner.participantRef, visits, config.maxDartsPerTurn),
    });
  }

  return results;
}

/**
 * Projects the folded leg into each seat's reported score. Once a side has
 * won the match every seat on it reports zero: the match ended on that side's
 * checkout, and the fold stops before any later leg could move it.
 */
function seatStatesOf(
  config: Seated<FiveOhOneAnySnapshot>,
  remaining: ReadonlyMap<string, number>,
  winningSideKey: string | null,
): readonly FiveOhOneSeatState[] {
  return config.seats.map((seat) => ({
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    remainingScore:
      seat.sideKey === winningSideKey
        ? 0
        : (remaining.get(seat.participantRef) ?? config.startingScore),
  }));
}

type LegFold = {
  winnersBySet: string[][];
  remaining: Map<string, number>;
};

/**
 * Folds every LEG in play order, grouping winners by their SET parent (root
 * legs form one group). A V1 snapshot (flat legacy log) stops folding at the
 * leg that decides the match and ignores any later stage, leaving the losing
 * seats' remaining scores as that leg left them. A V2 snapshot treats any LEG
 * or SET after the deciding leg as corrupt.
 * @throws when the tree contradicts the format: a LEG naming an unknown set,
 *   a SET under a sets-off format, a root LEG under a sets-on format, or a
 *   stage after the match was decided (V2 only).
 */
function foldLegs(
  facts: EngineFacts,
  config: Seated<FiveOhOneAnySnapshot>,
): LegFold {
  const setsOn = matchFormatOf(config).sets !== null;
  const remaining = new Map(
    config.seats.map((seat) => [seat.participantRef, config.startingScore]),
  );
  const winnersBySet: string[][] = [];
  const groupOf = new Map<string | null, number>();
  const legacy = "legsToWin" in config;
  const format = matchFormatOf(config);
  const sideKeys = sidesOf(config.seats);
  let decided = false;

  for (const stage of facts.stages) {
    if (decided) {
      if (legacy) break;
      throw new Error("501: stages recorded after the match was won.");
    }
    if (stage.stageTypeKey === "SET") {
      if (!setsOn) {
        throw new Error(
          `501: set ${stage.clientKey} recorded while sets are off.`,
        );
      }
      groupOf.set(stage.clientKey, winnersBySet.push([]) - 1);
      continue;
    }
    if (stage.parentClientKey === null && setsOn) {
      throw new Error(
        `501: root leg ${stage.clientKey} recorded while sets are on.`,
      );
    }
    let group = groupOf.get(stage.parentClientKey);
    if (group === undefined) {
      if (stage.parentClientKey !== null) {
        throw new Error(
          `501: leg ${stage.clientKey} names unknown set ${stage.parentClientKey}.`,
        );
      }
      group = winnersBySet.push([]) - 1;
      groupOf.set(null, group);
    }
    const winner = foldLeg(legVisitsOf(facts, stage), config, remaining);
    if (winner) {
      winnersBySet[group]!.push(winner.sideKey);
      decided = foldMatch(format, sideKeys, winnersBySet).winner !== null;
    }
  }

  return { winnersBySet, remaining };
}

/**
 * Folds the whole fact log into the session's state.
 *
 * A leg is SHARED: one stage holds every seat's interleaved visits, and the
 * checkout that ends it resets every seat. The session reaches `WON` when
 * `foldMatch` names a winner (match-format.module.ts), so legs are counted per
 * side and the fold stops at the leg that decides the match.
 */
export function foldFiveOhOneState(
  facts: EngineFacts,
  config: Seated<FiveOhOneAnySnapshot>,
): FiveOhOneState {
  const sideKeys = sidesOf(config.seats);
  const { winnersBySet, remaining } = foldLegs(facts, config);
  const fold = foldMatch(matchFormatOf(config), sideKeys, winnersBySet);
  if (fold.sets.slice(0, -1).some((set) => set.winner === null)) {
    throw new Error("501: a set was opened before the previous set was won.");
  }
  const currentSet = fold.sets.at(-1)!;

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "SHARED")
      .participantRef,
    status: fold.winner === null ? "IN_PROGRESS" : "WON",
    winningSideKey: fold.winner,
    sides: sideKeys.map((sideKey) => ({
      sideKey,
      legsWon: currentSet.legsWon[sideKey] ?? 0,
      setsWon: fold.setsWon[sideKey] ?? 0,
    })),
    seats: seatStatesOf(config, remaining, fold.winner),
    sets: fold.sets,
    decidingSet: fold.decidingSet,
    suddenDeath: fold.suddenDeath,
  };
}

/**
 * 501: a match in the format `matchFormatOf(config)` names, each leg started
 * at `startingScore` and won by a visit whose final dart lands in a double.
 * The engine owns the fact log — one `LEG` stage per leg (under a `SET` stage
 * when sets are on) and one turn per visit, carrying the visit total with no
 * dart rows because 501 is a quick-score game. Every seat's
 * `remainingScore` and every side's `legsWon` are derived by folding those
 * turns through `foldFiveOhOneState`, never accumulated: a bust turn stores
 * `totalScore: 0`, so replaying the log reproduces the leg exactly.
 */
export class FiveOhOneEngine implements GameEngine<
  FiveOhOneInput,
  FiveOhOneState
> {
  readonly stageOwnership = "SHARED" as const;
  private readonly stages: StageFact[];
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<FiveOhOneAnySnapshot>,
    prior?: EngineFacts,
    readonly rulesetVersionKey: "501_V1" | "501_V2" = "501_V1",
  ) {
    this.stages =
      prior && prior.stages.length > 0
        ? prior.stages.map((stage) => ({ ...stage }))
        : openingStages(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  /**
   * The whole session's state, folded from the fact log by the same function
   * the play page reads, so the engine and the scoreboard can never disagree
   * about whose throw it is or what any seat has left.
   */
  private deriveState(): FiveOhOneState {
    return foldFiveOhOneState(
      { stages: this.stages, turns: this.turns },
      this.config,
    );
  }

  /**
   * The remaining score of the seat about to throw — what a keypad total or
   * the next dart is resolved against.
   */
  private activeRemaining(state: FiveOhOneState): number {
    const seat = state.seats.find(
      (candidate) => candidate.participantRef === state.activeParticipantRef,
    );
    return seat?.remainingScore ?? this.config.startingScore;
  }

  private openLeg(): StageFact {
    const stage = this.stages.filter((s) => s.stageTypeKey === "LEG").at(-1);
    if (!stage) {
      throw new Error("A 501 engine always has an open leg stage.");
    }
    return stage;
  }

  /** Opens the next leg after a leg win: a new set when the fold closed the current one. */
  private openNextLeg(state: FiveOhOneState): void {
    if (matchFormatOf(this.config).sets === null) {
      this.stages.push(legStage(this.stages.length + 1));
      return;
    }
    const openSet = this.stages.filter((s) => s.stageTypeKey === "SET").at(-1)!;
    if ((state.sets.at(-1)?.winner ?? null) !== null) {
      const next = openSet.sequence + 1;
      this.stages.push(setStage(next), setLegStage(next, 1));
      return;
    }
    const legsInSet = this.stages.filter(
      (s) => s.parentClientKey === openSet.clientKey,
    ).length;
    this.stages.push(setLegStage(openSet.sequence, legsInSet + 1));
  }

  /** Whether a checkout by the active seat would win the match (`foldMatch`). */
  private checkoutWinsMatch(before: FiveOhOneState): boolean {
    const seat = before.seats.find(
      (candidate) => candidate.participantRef === before.activeParticipantRef,
    );
    if (!seat) return false;
    const { winnersBySet } = foldLegs(
      { stages: this.stages, turns: this.turns },
      this.config,
    );
    const groups = winnersBySet.map((group) => [...group]);
    if (groups.length === 0) groups.push([]);
    groups.at(-1)!.push(seat.sideKey);
    return (
      foldMatch(matchFormatOf(this.config), sidesOf(this.config.seats), groups)
        .winner !== null
    );
  }

  private turnCountIn(stageClientKey: string): number {
    return this.turns.filter((turn) => turn.stageClientKey === stageClientKey)
      .length;
  }

  /**
   * The leg's starting score minus the counted total of every earlier turn in
   * the same leg THAT SEAT threw — the score `visit` opened against, before
   * any of its own darts. Other seats' visits in the same shared leg never
   * move this seat's score.
   */
  private remainingBeforeVisit(visit: TurnFact): number {
    const scoredBefore = this.turns
      .filter(
        (turn) =>
          turn.stageClientKey === visit.stageClientKey &&
          turn.participantRef === visit.participantRef &&
          turn.sequence < visit.sequence,
      )
      .reduce((sum, turn) => sum + turn.totalScore, 0);
    return this.config.startingScore - scoredBefore;
  }

  /**
   * Appends one visit to the open leg, then opens the next leg's stage when
   * that visit won a leg and the match continues. Stages and turns move
   * together so the log never holds a turn without its stage.
   * @throws when the score is out of range or the session has already ended;
   *   the fact log is left untouched.
   */
  record(input: FiveOhOneInput): FiveOhOneState {
    if (isDartObservationInput(input)) {
      return this.recordDart(input);
    }
    return this.recordVisitTotal(input);
  }

  /**
   * @throws when a dart-based visit is still open — a whole-visit total and a
   *   part-thrown board visit are not composable, so this refuses loudly
   *   rather than guess how to merge them. A clean visit boundary (no open
   *   board visit) always accepts a keypad total, so the keypad stays usable
   *   as the accessible alternative from any resting state.
   */
  private recordVisitTotal(input: FiveOhOneVisitInput): FiveOhOneState {
    if (openVisit(this.turns) !== null) {
      throw new Error(
        "Finish the open visit on the board before entering a keypad total.",
      );
    }
    if (
      !isPlayableVisitScore(input.scoreAttempted, this.config.maxVisitScore)
    ) {
      throw new Error(
        `Enter a score between 0 and ${this.config.maxVisitScore}.`,
      );
    }

    const before = this.deriveState();
    const remaining = this.activeRemaining(before);
    const dartsRejection = checkoutDartsRejectionFor(
      remaining,
      input,
      this.config,
    );
    if (dartsRejection) throw new Error(dartsRejection);
    if (before.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a visit once the session is complete; undo first to correct it.",
      );
    }

    const outcome = resolveFiveOhOneVisit(remaining, input);
    const leg = this.openLeg();
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: leg.clientKey,
      participantRef: before.activeParticipantRef,
      sequence: this.turnCountIn(leg.clientKey) + 1,
      completedAt: new Date().toISOString(),
      totalScore: outcome.scored,
      darts: [],
    });

    const settled = this.deriveState();
    if (!outcome.wonLeg || settled.status !== "IN_PROGRESS") return settled;

    this.openNextLeg(settled);
    return this.deriveState();
  }

  /**
   * Records one dart. The visit closes when it busts, when it checks out on a
   * double, or on the third dart.
   *
   * A busted visit keeps its dart rows and their real board scores while
   * `totalScore` goes to 0 — counted zero, thrown non-zero. That divergence is
   * the fact that makes bust rate computable, and it is why `totalScore` is
   * not simply the sum of the visit's darts here.
   *
   * Completion is checked before anything is written, mirroring
   * `recordVisitTotal`: the fold that rejects a throw into a won session used
   * to run after the dart was already pushed, so the refusal left the dart —
   * and possibly a whole new visit — behind in the log it claimed not to have
   * touched.
   *
   * @throws when the session is already complete; the fact log is left untouched.
   */
  private recordDart(observation: DartObservation): FiveOhOneState {
    if (this.deriveState().status !== "IN_PROGRESS") {
      throw new Error("Cannot record a visit once the session is complete");
    }

    const resolved = resolveObservation(observation);
    const visit = openVisit(this.turns) ?? this.openNewVisit();

    appendResolvedDart(visit, observation, resolved);

    const checkedOut = this.settleVisit(visit, resolved.zoneKey);

    const settled = this.deriveState();
    if (!checkedOut || settled.status === "WON") return settled;

    this.openNextLeg(settled);
    return this.deriveState();
  }

  /** Appends an empty visit to the open leg and returns it. */
  private openNewVisit(): TurnFact {
    const leg = this.openLeg();
    const visit: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: leg.clientKey,
      participantRef: this.deriveState().activeParticipantRef,
      sequence: this.turnCountIn(leg.clientKey) + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(visit);
    return visit;
  }

  /**
   * Applies the bust and checkout rules to a visit that just took a dart, and
   * stamps `completedAt` when the visit resolves.
   *
   * A busted visit keeps its dart rows and their real board scores while
   * `totalScore` goes to 0 — counted zero, thrown non-zero. That divergence is
   * the fact that makes bust rate computable, and it is why `totalScore` is
   * not simply the sum of the visit's darts.
   * @returns whether the visit checked out on a double.
   */
  private settleVisit(visit: TurnFact, hitZoneKey: DartZoneKey): boolean {
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const { checkedOut, busted } = resolveCheckoutAttempt(
      this.remainingBeforeVisit(visit),
      thrown,
      hitZoneKey === "DOUBLE" || hitZoneKey === "INNER_BULL",
    );

    if (busted) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
      return false;
    }

    visit.totalScore = thrown;
    if (checkedOut || visit.darts.length === DARTS_PER_VISIT) {
      visit.completedAt = new Date().toISOString();
    }

    return checkedOut;
  }

  /**
   * Pops the last recorded visit, including one replayed from persisted facts,
   * and removes the leg stage that visit opened. The stage only goes when the
   * popped turn belonged to an earlier leg — that is exactly the case where
   * `record()` appended a stage — so undoing a visit played inside a new leg
   * leaves that leg open.
   *
   * Dispatches on the shape of the last recorded turn: `record()` and
   * `wouldComplete()` already discriminate their input by shape, and both
   * shapes can appear in one session's log, so undo — which has no input to
   * read a shape from — reads the shape of what `record()`
   * actually wrote instead. A turn built from a keypad total always has
   * `darts: []`; a turn built from a board dart always holds at least one
   * dart from the moment it exists in the log (`recordDart` opens a visit and
   * appends its first dart in the same call, so a zero-dart board turn is
   * never observable outside that call). One dart goes at a time when the
   * last turn holds darts: popping a visit's only dart pops the visit itself,
   * by the same rule; popping one of several darts instead clears
   * `completedAt` and recomputes `totalScore` from the darts left behind,
   * reopening the visit.
   * @returns true if a dart or a visit was removed; false if there was
   *   nothing to undo.
   */
  undo(): boolean {
    return undoStagedTurn(this.turns, this.stages);
  }

  /**
   * Whether the dart under consideration would check out the final leg — the
   * one 501 way a session can complete on a single dart, independent of how
   * many darts the open visit already holds.
   */
  private dartChecksOutFinalLeg(
    observation: DartObservation,
    before: FiveOhOneState,
  ): boolean {
    const resolved = resolveObservation(observation);

    const { checkedOut } = resolveCheckoutAttempt(
      this.activeRemaining(before),
      resolved.score,
      resolved.zoneKey === "DOUBLE" || resolved.zoneKey === "INNER_BULL",
    );
    if (!checkedOut) return false;

    return this.checkoutWinsMatch(before);
  }

  /**
   * Answers the finish-confirm gate under `VISUAL_BOARD` without touching the
   * fact log. A dart that checks out the final leg completes the session —
   * the one way a 501 session can complete, whatever the open visit's dart
   * count. A dart count alone never completes a 501 session, so every other
   * case answers false.
   */
  private wouldCompleteDart(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

    return this.dartChecksOutFinalLeg(observation, before);
  }

  /**
   * Answers the finish-confirm gate without touching the fact log. Only the
   * checkout that wins the match (`foldMatch`) completes the session — a
   * checkout that merely wins a leg does not — and a visit `record()` would
   * reject never completes it either, dart counts the checkout chart
   * contradicts included: this predicate answers, it never throws.
   */
  wouldComplete(input: FiveOhOneInput): boolean {
    if (isDartObservationInput(input)) {
      return this.wouldCompleteDart(input);
    }

    if (openVisit(this.turns) !== null) return false;
    if (
      !isPlayableVisitScore(input.scoreAttempted, this.config.maxVisitScore)
    ) {
      return false;
    }

    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

    const remaining = this.activeRemaining(before);
    if (checkoutDartsRejectionFor(remaining, input, this.config) !== null) {
      return false;
    }

    const outcome = resolveFiveOhOneVisit(remaining, input);
    if (!outcome.wonLeg) return false;

    return this.checkoutWinsMatch(before);
  }

  isComplete(): boolean {
    return this.deriveState().status === "WON";
  }

  state(): FiveOhOneState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return {
      stages: this.stages.map((stage) => ({ ...stage })),
      turns: cloneTurns(this.turns),
    };
  }
}

export const fiveOhOneEngineFactory: GameEngineFactory<
  Seated<FiveOhOneSnapshot>,
  FiveOhOneInput,
  FiveOhOneState
> = {
  rulesetVersionKey: "501_V1",
  stageOwnership: "SHARED",
  create(config: Seated<FiveOhOneSnapshot>, prior?: EngineFacts) {
    return new FiveOhOneEngine(config, prior, "501_V1");
  },
};

registerEngineFactory(fiveOhOneEngineFactory);

export const fiveOhOneV2EngineFactory: GameEngineFactory<
  Seated<FiveOhOneV2Snapshot>,
  FiveOhOneInput,
  FiveOhOneState
> = {
  rulesetVersionKey: "501_V2",
  stageOwnership: "SHARED",
  create(config: Seated<FiveOhOneV2Snapshot>, prior?: EngineFacts) {
    return new FiveOhOneEngine(config, prior, "501_V2");
  },
};

registerEngineFactory(fiveOhOneV2EngineFactory);
