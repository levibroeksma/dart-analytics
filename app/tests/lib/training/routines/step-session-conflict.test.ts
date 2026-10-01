import { describe, it, expect } from "vitest";
import {
  activeRoutineConflict,
  activeSessionConflict,
} from "@lib/training/routines/step-session-conflict";

describe("activeSessionConflict", () => {
  it("reads the blocking session out of an already-active failure's details", () => {
    expect(
      activeSessionConflict(
        Object.assign(new Error("Session already active"), {
          code: "SESSION_ALREADY_ACTIVE",
          details: { sessionId: "sess-9", startedAt: "2026-09-14T19:05:00Z" },
        }),
      ),
    ).toEqual({ sessionId: "sess-9", startedAt: "2026-09-14T19:05:00Z" });
  });

  it("keeps the conflict when the server sent no startedAt", () => {
    expect(
      activeSessionConflict(
        Object.assign(new Error("Session already active"), {
          code: "SESSION_ALREADY_ACTIVE",
          details: { sessionId: "sess-9" },
        }),
      ),
    ).toEqual({ sessionId: "sess-9", startedAt: null });
  });

  it("is null for an already-active failure carrying no sessionId to act on", () => {
    expect(
      activeSessionConflict(
        Object.assign(new Error("Session already active"), {
          code: "SESSION_ALREADY_ACTIVE",
        }),
      ),
    ).toBeNull();
  });

  it("is null for any other failure", () => {
    expect(
      activeSessionConflict(
        Object.assign(new Error("boom"), {
          code: "INTERNAL_ERROR",
          details: { sessionId: "sess-9" },
        }),
      ),
    ).toBeNull();
    expect(activeSessionConflict(new Error("boom"))).toBeNull();
    expect(activeSessionConflict(null)).toBeNull();
  });
});

describe("activeRoutineConflict", () => {
  it("reads the open routine out of an already-active failure's details", () => {
    expect(
      activeRoutineConflict(
        Object.assign(new Error("Session already active"), {
          code: "SESSION_ALREADY_ACTIVE",
          details: {
            activityId: "act-9",
            startedAt: "2026-09-30T10:00:00Z",
            routineName: "Balanced Training",
          },
        }),
      ),
    ).toEqual({
      activityId: "act-9",
      startedAt: "2026-09-30T10:00:00Z",
      routineName: "Balanced Training",
    });
  });

  it("tolerates a missing start time and name", () => {
    expect(
      activeRoutineConflict(
        Object.assign(new Error("Session already active"), {
          code: "SESSION_ALREADY_ACTIVE",
          details: { activityId: "act-9" },
        }),
      ),
    ).toEqual({ activityId: "act-9", startedAt: null, routineName: "" });
  });

  it("is null for a game conflict, which names a sessionId and no activityId", () => {
    expect(
      activeRoutineConflict(
        Object.assign(new Error("Session already active"), {
          code: "SESSION_ALREADY_ACTIVE",
          details: { sessionId: "sess-9" },
        }),
      ),
    ).toBeNull();
  });

  it("is null for any other failure, and for no error at all", () => {
    expect(
      activeRoutineConflict(
        Object.assign(new Error("boom"), {
          code: "INTERNAL_ERROR",
          details: { activityId: "act-9" },
        }),
      ),
    ).toBeNull();
    expect(activeRoutineConflict(undefined)).toBeNull();
  });
});
