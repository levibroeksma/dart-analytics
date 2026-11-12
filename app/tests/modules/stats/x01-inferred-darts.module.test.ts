import { describe, expect, it } from "vitest";
import { inferredSessions } from "@modules/stats/x01-inferred-darts.module";
import { dart, session, visit } from "./support/x01-inferred-fixtures";

describe("inferredSessions", () => {
  it("walks a visit, recomputing remaining and darts left per dart", () => {
    const { sessions } = inferredSessions([
      session([
        visit(40, [dart("OUTER_SINGLE", 20, 20), dart("DOUBLE", 10, 20)]),
      ]),
    ]);
    const [first, second] = sessions[0]!.visits[0]!.darts;
    expect([
      first!.remaining,
      first!.dartNumber,
      first!.aim?.key,
      first!.hit,
    ]).toEqual([40, 1, "DOUBLE:20", false]);
    expect([
      second!.remaining,
      second!.dartNumber,
      second!.aim?.key,
      second!.hit,
    ]).toEqual([20, 2, "DOUBLE:10", true]);
    expect(sessions[0]!.visits[0]).toMatchObject({
      outcome: "FINISHED",
      remainingAfter: 0,
    });
  });

  it("resolves the busting dart and restores the remaining", () => {
    const { sessions } = inferredSessions([
      session([visit(16, [dart("OUTER_SINGLE", 16, 16)])]),
    ]);
    expect(sessions[0]!.visits[0]).toMatchObject({
      outcome: "BUST",
      remainingAfter: 16,
    });
    expect(sessions[0]!.visits[0]!.darts[0]!.aim?.key).toBe("DOUBLE:8");
  });

  it("restarts at the leg's own starting remaining", () => {
    const { sessions } = inferredSessions([
      session([
        visit(40, [dart("DOUBLE", 20, 40)], "leg-1"),
        visit(501, [dart("TREBLE", 20, 60)], "leg-2"),
      ]),
    ]);
    expect(sessions[0]!.visits[1]!.darts[0]!.basis).toBe("LARGE_TARGET");
  });

  it("skips a session holding a dart without coordinates, and only that session", () => {
    const broken = session(
      [visit(501, [{ ...dart("TREBLE", 20, 60), locationX: null }])],
      "s-broken",
    );
    const fine = session([visit(501, [dart("TREBLE", 20, 60)])], "s-fine");
    const result = inferredSessions([broken, fine]);
    expect(result.skippedSessions).toBe(1);
    expect(result.sessions.map((s) => s.sessionId)).toEqual(["s-fine"]);
  });

  it("counts an undecodable session as skipped", () => {
    expect(inferredSessions([{ ...session([]), undecodable: true }])).toEqual({
      sessions: [],
      skippedSessions: 1,
    });
  });

  it("records every candidate key on the dart", () => {
    const { sessions } = inferredSessions([
      session([visit(18, [dart("OUTER_SINGLE", 2, 2)])]),
    ]);
    expect(sessions[0]!.visits[0]!.darts[0]!.candidateKeys).toEqual([
      "DOUBLE:9",
      "SINGLE:2",
    ]);
  });

  it("exposes the finish candidate's key, null when none holds a finish", () => {
    const { sessions } = inferredSessions([
      session([
        visit(18, [dart("OUTER_SINGLE", 2, 2)]),
        visit(501, [dart("TREBLE", 20, 60)]),
      ]),
    ]);
    expect(sessions[0]!.visits[0]!.darts[0]!.finishKey).toBe("DOUBLE:9");
    expect(sessions[0]!.visits[1]!.darts[0]!.finishKey).toBeNull();
  });
});
