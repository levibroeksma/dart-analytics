import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/sessions", () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
  createSession: vi.fn(),
}));

import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import {
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import { followTheLeaderEngineFactory } from "@modules/game/follow-the-leader.engine.module";
import { followTheLeaderPlay } from "@lib/game/follow-the-leader-play.data";
import type {
  FollowTheLeaderPlayContext,
  FollowTheLeaderSnapshot,
  Seated,
} from "@lib/types";
import type {
  DartObservation,
  DartZoneKey,
  StageFact,
  TurnFact,
} from "@modules/types";

const SEATS = [
  {
    participantRef: "p1",
    displayName: "You",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
  {
    participantRef: "p2",
    displayName: "Guest",
    sideKey: "B",
    participantTypeKey: "GUEST" as const,
  },
];

const SNAPSHOT = { lives: 3, seats: SEATS } as Seated<FollowTheLeaderSnapshot>;

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "FOLLOW_THE_LEADER",
  gameTypeName: "Follow the Leader",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "FOLLOW_THE_LEADER_V1",
  isRoutineStep: false,
  progress: null,
  startedAt: "now",
} as const;

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

type GameStub = FollowTheLeaderPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "FOLLOW_THE_LEADER_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: SNAPSHOT,
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
    stages: [STAGE],
    turns: [] as TurnFact[],
    idempotencyKey: null,
    loading: false,
    setSessionModes: vi.fn(),
    recordFacts: vi.fn(function (this: GameStub, facts) {
      this.stages = [...facts.stages];
      this.turns = [...facts.turns];
    }),
    reset: vi.fn(function (this: GameStub) {
      this.loading = false;
    }),
    ...overrides,
  };
}

function makeContext(gameOverrides: Partial<GameStub> = {}) {
  return {
    ...followTheLeaderPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    },
  } as FollowTheLeaderPlayContext;
}

async function started(gameOverrides: Partial<GameStub> = {}) {
  const ctx = makeContext(gameOverrides);
  await ctx.init.call(ctx);
  return ctx;
}

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartZoneKey,
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const t = (n: number) => dart(n, "TREBLE");
const miss = dart(null, "MISS");

async function throwAll(
  ctx: FollowTheLeaderPlayContext,
  darts: DartObservation[],
) {
  for (const observation of darts) await ctx.recordDart(observation);
}

const OPEN_T18_P2_FAILS = [t(18), miss, miss, miss];

async function atKeepPrompt() {
  const ctx = await started();
  await throwAll(ctx, OPEN_T18_P2_FAILS);
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(followTheLeaderEngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
  vi.mocked(appendBatch).mockResolvedValue({
    created: { stages: 1, turns: 1, darts: 1 },
  });
  vi.mocked(completeSession).mockResolvedValue({
    sessionId: "s1",
    statusKey: "COMPLETED",
    completedAt: "now",
  });
});

describe("followTheLeaderPlay target banner", () => {
  it.each([
    ["single", dart(20, "OUTER_SINGLE"), "Single 20"],
    ["double", dart(16, "DOUBLE"), "Double 16"],
    ["treble", t(18), "Treble 18"],
    ["outer bull", dart(25, "OUTER_BULL"), "Outer bull"],
    ["inner bull", dart(25, "INNER_BULL"), "Inner bull"],
  ])("reads a %s target", async (_name, observation, label) => {
    const ctx = await started();
    await ctx.recordDart(observation);
    expect(ctx.targetLabel()).toBe(label);
    expect(ctx.subtitle()).toBe(`TARGET: ${label}`);
  });

  it("is blank before a target is set", async () => {
    const ctx = await started();
    expect(ctx.targetLabel()).toBe("");
    expect(ctx.subtitle()).toBe("");
    expect(makeContext({ configSnapshot: null }).targetLabel()).toBe("");
  });

  it("names the leader once a target is set", async () => {
    const ctx = await started();
    expect(ctx.leaderName()).toBe("");
    await ctx.recordDart(t(18));
    expect(ctx.leaderName()).toBe("You");
    expect(ctx.statusLabelFor("p1")).toBe("LEADER");
    expect(ctx.statusLabelFor("p2")).toBe("—");
  });

  it("shows the off-hand instruction for the opening dart only", async () => {
    const ctx = await started();
    expect(ctx.phase()).toBe("OPENING");
    expect(ctx.openingNotice()).toMatch(/off hand/i);
    await ctx.recordDart(t(18));
    expect(ctx.phase()).toBe("MATCH");
    expect(ctx.openingNotice()).toBe("");
  });

  it("keeps the opening notice after an off-board opening dart", async () => {
    const ctx = await started();
    await ctx.recordDart(miss);
    expect(ctx.phase()).toBe("OPENING");
    expect(ctx.openingNotice()).not.toBe("");
  });

  it("exposes lives per seat and for the active seat", async () => {
    const ctx = await started();
    expect(ctx.livesLabel()).toBe("3");
    await throwAll(ctx, OPEN_T18_P2_FAILS);
    expect(ctx.livesLabelFor("p2")).toBe("2");
    expect(ctx.livesLabelFor("p1")).toBe("3");
  });
});

describe("followTheLeaderPlay entry", () => {
  it("records a number with the armed ring and resets the ring", async () => {
    const ctx = await started();
    ctx.setRing("TREBLE");
    expect(ctx.ring).toBe("TREBLE");
    await ctx.recordNumber(18);
    expect(ctx.ring).toBe("SINGLE");
    const [written] = ctx.$store.game.turns[0].darts;
    expect(written.hitTargetNumber).toBe(18);
    expect(written.hitZoneKey).toBe("TREBLE");
  });

  it("records the bull by ring and MISS as a miss", async () => {
    const ctx = await started();
    await ctx.recordBull();
    ctx.setRing("DOUBLE");
    await ctx.recordBull();
    await ctx.recordMiss();
    const darts = ctx.$store.game.turns.flatMap((turn) => turn.darts);
    expect(darts.map((entry) => entry.hitZoneKey)).toEqual([
      "OUTER_BULL",
      "INNER_BULL",
      "MISS",
    ]);
  });

  it("marks a dart in the target bed as a hit in the preview", async () => {
    const ctx = await started();
    await throwAll(ctx, [t(18), t(18), dart(18, "OUTER_SINGLE")]);
    expect(ctx.previewSegments().map((segment) => segment.status)).toEqual([
      "hit",
      "miss",
      "empty",
    ]);
  });
});

describe("followTheLeaderPlay stop", () => {
  it("refuses to stop before a match and records nothing", async () => {
    const ctx = await started();
    await ctx.recordDart(t(18));
    const record = vi.spyOn(ctx.engine!, "record");
    expect(ctx.canStop()).toBe(false);
    await ctx.stop();
    expect(record).not.toHaveBeenCalled();
    expect(ctx.$store.game.turns).toHaveLength(1);
    expect(ctx.error).not.toBe("");
  });

  it("records a STOP action once a dart matched", async () => {
    const ctx = await started();
    await throwAll(ctx, [t(18), t(18)]);
    expect(ctx.canStop()).toBe(true);
    const record = vi.spyOn(ctx.engine!, "record");
    await ctx.stop();
    expect(record).toHaveBeenCalledWith({ kind: "STOP" });
    expect(ctx.state()?.activeParticipantRef).toBe("p1");
    expect(ctx.livesLabelFor("p2")).toBe("3");
    expect(ctx.error).toBe("");
  });

  it("undoes a stop back to the open visit", async () => {
    const ctx = await started();
    await throwAll(ctx, [t(18), t(18)]);
    await ctx.stop();
    await ctx.undoVisit();
    expect(ctx.state()?.activeParticipantRef).toBe("p2");
    expect(ctx.canStop()).toBe(true);
  });
});

describe("followTheLeaderPlay paused timer", () => {
  it("records no stop or keep while the timer is paused", async () => {
    const ctx = await atKeepPrompt();
    ctx.$store.game.timerPaused = true;
    const record = vi.spyOn(ctx.engine!, "record");
    const turns = ctx.$store.game.turns;
    await ctx.keep();
    expect(record).not.toHaveBeenCalled();
    expect(ctx.$store.game.turns).toBe(turns);
    expect(ctx.showKeepPrompt()).toBe(true);
  });
});

describe("followTheLeaderPlay keep and set", () => {
  it("offers the prompt only when a keep is legal", async () => {
    const ctx = await started();
    expect(ctx.showKeepPrompt()).toBe(false);
    await ctx.recordDart(t(18));
    expect(ctx.showKeepPrompt()).toBe(false);
    await throwAll(ctx, [miss, miss, miss]);
    expect(ctx.keepAllowed()).toBe(true);
    expect(ctx.showKeepPrompt()).toBe(true);
    expect(ctx.showPad()).toBe(false);
  });

  it("hides the prompt when a matcher matched", async () => {
    const ctx = await started();
    await throwAll(ctx, [t(18), t(18)]);
    await ctx.stop();
    expect(ctx.state()?.phase).toBe("LEAD");
    expect(ctx.keepAllowed()).toBe(false);
    expect(ctx.showKeepPrompt()).toBe(false);
    expect(ctx.showPad()).toBe(true);
  });

  it("refuses keep when not allowed and records nothing", async () => {
    const ctx = await started();
    await ctx.recordDart(t(18));
    const record = vi.spyOn(ctx.engine!, "record");
    await ctx.keep();
    expect(record).not.toHaveBeenCalled();
    expect(ctx.$store.game.turns).toHaveLength(1);
    expect(ctx.error).not.toBe("");
  });

  it("records a KEEP action and passes the turn", async () => {
    const ctx = await atKeepPrompt();
    const record = vi.spyOn(ctx.engine!, "record");
    await ctx.keep();
    expect(record).toHaveBeenCalledWith({ kind: "KEEP" });
    expect(ctx.state()?.activeParticipantRef).toBe("p2");
    expect(ctx.targetLabel()).toBe("Treble 18");
    expect(ctx.showKeepPrompt()).toBe(false);
  });

  it("Set hides the prompt without recording and reveals the pad", async () => {
    const ctx = await atKeepPrompt();
    const turnsBefore = ctx.$store.game.turns.length;
    const record = vi.spyOn(ctx.engine!, "record");
    ctx.chooseSet();
    expect(record).not.toHaveBeenCalled();
    expect(ctx.$store.game.turns).toHaveLength(turnsBefore);
    expect(ctx.showKeepPrompt()).toBe(false);
    expect(ctx.showPad()).toBe(true);
  });

  it("resets the Set choice once the setting dart is thrown", async () => {
    const ctx = await atKeepPrompt();
    ctx.chooseSet();
    await ctx.recordDart(t(20));
    expect(ctx.setChosen).toBe(false);
    expect(ctx.targetLabel()).toBe("Treble 20");
  });

  it("restores the prompt when a keep is undone", async () => {
    const ctx = await atKeepPrompt();
    await ctx.keep();
    await ctx.undoVisit();
    expect(ctx.state()?.activeParticipantRef).toBe("p1");
    expect(ctx.keepAllowed()).toBe(true);
    expect(ctx.showKeepPrompt()).toBe(true);
  });

  it("restores the prompt when the undo follows a chosen Set", async () => {
    const ctx = await atKeepPrompt();
    await ctx.keep();
    ctx.setChosen = true;
    await ctx.undoVisit();
    expect(ctx.showKeepPrompt()).toBe(true);
  });

  it("restores the same phase and seat after a reload mid-visit", async () => {
    const first = await atKeepPrompt();
    await first.keep();
    await first.recordDart(t(18));
    const resumed = await started({ turns: first.$store.game.turns });
    expect(resumed.phase()).toBe(first.phase());
    expect(resumed.state()?.activeParticipantRef).toBe(
      first.state()?.activeParticipantRef,
    );
    expect(resumed.canStop()).toBe(true);
    expect(resumed.targetLabel()).toBe("Treble 18");
  });

  it("shows the prompt again after a reload at the leader's turn", async () => {
    const first = await atKeepPrompt();
    first.chooseSet();
    const resumed = await started({ turns: first.$store.game.turns });
    expect(resumed.phase()).toBe("LEAD");
    expect(resumed.showKeepPrompt()).toBe(true);
  });
});

describe("followTheLeaderPlay ending", () => {
  async function throughToLastLife() {
    const ctx = await started();
    await throwAll(ctx, OPEN_T18_P2_FAILS);
    await ctx.keep();
    await throwAll(ctx, [miss, miss, miss]);
    await ctx.keep();
    return ctx;
  }

  it("ends the game when the last life goes and stores the results", async () => {
    const ctx = await throughToLastLife();
    await throwAll(ctx, [miss, miss, miss]);
    expect(ctx.finished).toBe(true);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(ctx.resultsSnapshot).toEqual({
      status: "COMPLETE",
      winningSideKey: "A",
      outOrder: ["p2"],
      seats: [
        { participantRef: "p1", sideKey: "A", livesLeft: 3, out: false },
        { participantRef: "p2", sideKey: "B", livesLeft: 0, out: true },
      ],
    });
    expect(ctx.resultsTitle()).toBe("You wins!");
    expect(ctx.outOrderLabel()).toBe("Guest");
  });

  it("titles an unfinished session generically", () => {
    const ctx = makeContext();
    expect(ctx.resultsTitle()).toBe("Session complete");
    expect(ctx.outOrderLabel()).toBe("");
  });

  it("refuses to undo a finished game even when the save failed", async () => {
    vi.mocked(completeSession).mockRejectedValue(new Error("offline"));
    const ctx = await throughToLastLife();
    await throwAll(ctx, [miss, miss, miss]);
    expect(ctx.finished).toBe(true);
    expect(ctx.completionStatus).toBe("failed");
    const turns = ctx.$store.game.turns;

    await ctx.undoVisit();
    expect(ctx.finished).toBe(true);
    expect(ctx.$store.game.turns).toEqual(turns);
    expect(ctx.livesLabelFor("p2")).toBe("0");
  });

  it("undoes a dart before the game ends", async () => {
    const ctx = await started();
    await throwAll(ctx, [t(18), miss]);
    await ctx.undoVisit();
    expect(ctx.$store.game.turns).toHaveLength(1);
    expect(ctx.livesLabelFor("p2")).toBe("3");
    expect(ctx.finished).toBe(false);
  });

  it("refuses to undo once the finished game is saved", async () => {
    const ctx = await throughToLastLife();
    await throwAll(ctx, [miss, miss, miss]);
    expect(ctx.completionStatus).toBe("succeeded");
    await ctx.undoVisit();
    expect(ctx.finished).toBe(true);
    expect(ctx.resultsSnapshot).not.toBeNull();
  });
});

describe("followTheLeaderPlay play again", () => {
  function mockCreated(guestFirst: boolean) {
    const player = {
      ref: "p1",
      displayName: "You",
      participantTypeKey: "PLAYER",
    };
    const guest = {
      ref: "p2",
      displayName: "Guest",
      participantTypeKey: "GUEST",
    };
    vi.mocked(createSession).mockResolvedValue({
      sessionId: "s2",
      participants: guestFirst ? [guest, player] : [player, guest],
    } as never);
  }

  type CreateCall = {
    config: { overrides: { lives: number } };
    participants: { participantTypeKey: string }[];
  };

  it("seats the guest first and opens on them when the guest starts", async () => {
    mockCreated(true);
    const ctx = await started();
    ctx.playAgainStarter = 1;
    await ctx.playAgain();
    const call = vi.mocked(createSession).mock
      .calls[0][0] as never as CreateCall;
    expect(call.participants.map((p) => p.participantTypeKey)).toEqual([
      "GUEST",
      "PLAYER",
    ]);
    expect(call.config.overrides.lives).toBe(3);
    expect(ctx.$store.game.seats[0].participantRef).toBe("p2");
    expect(ctx.state()?.activeParticipantRef).toBe("p2");
    expect(ctx.playAgainStarter).toBeNull();
  });

  it("keeps the player first when the player starts", async () => {
    mockCreated(false);
    const ctx = await started();
    ctx.playAgainStarter = 0;
    await ctx.playAgain();
    const call = vi.mocked(createSession).mock
      .calls[0][0] as never as CreateCall;
    expect(call.participants.map((p) => p.participantTypeKey)).toEqual([
      "PLAYER",
      "GUEST",
    ]);
    expect(ctx.state()?.activeParticipantRef).toBe("p1");
  });

  it("clears the Set choice for the new session", async () => {
    mockCreated(false);
    const ctx = await started();
    ctx.setChosen = true;
    await ctx.playAgain();
    expect(ctx.setChosen).toBe(false);
  });
});
