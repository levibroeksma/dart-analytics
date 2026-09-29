import { describe, expect, it } from "vitest";
import {
  gameScopeKey,
  isRoutineKey,
  parseStepKey,
  routineScopeKey,
  stepScopeKey,
} from "@modules/stats/routine-scope.module";
import type { GameTypeKey } from "@lib/types";

const SNAPSHOT_UUID = "018f2c3a-7b1a-7c3e-89ab-1234567890ab";
const NAME_KEY = "name-0123456789abcdef0123456789abcdef";
const FINGERPRINT = "0123456789abcdef0123456789abcdef";

describe("isRoutineKey", () => {
  it("accepts a snapshot routineTemplateId UUID", () => {
    expect(isRoutineKey(SNAPSHOT_UUID)).toBe(true);
  });

  it("accepts the name-<md5> fallback form", () => {
    expect(isRoutineKey(NAME_KEY)).toBe(true);
  });

  it("rejects an uppercase-hex name- key", () => {
    expect(isRoutineKey("name-0123456789ABCDEF0123456789ABCDEF")).toBe(false);
  });

  it("rejects a short hash", () => {
    expect(isRoutineKey("name-0123456789abcdef")).toBe(false);
  });

  it("rejects name- alone", () => {
    expect(isRoutineKey("name-")).toBe(false);
  });

  it("rejects a plain name", () => {
    expect(isRoutineKey("My Routine")).toBe(false);
  });
});

describe("parseStepKey", () => {
  it("parses a valid step key", () => {
    expect(parseStepKey(`3-${FINGERPRINT}`)).toEqual({
      sequenceNumber: 3,
      fingerprint: FINGERPRINT,
    });
  });

  it("rejects a zero sequence number", () => {
    expect(parseStepKey(`0-${FINGERPRINT}`)).toBeNull();
  });

  it("rejects a negative sequence number", () => {
    expect(parseStepKey(`-1-${FINGERPRINT}`)).toBeNull();
  });

  it("rejects a non-integer sequence number", () => {
    expect(parseStepKey(`1.5-${FINGERPRINT}`)).toBeNull();
  });

  it("rejects a fingerprint one character short", () => {
    expect(parseStepKey(`3-${FINGERPRINT.slice(0, 31)}`)).toBeNull();
  });
});

describe("scope keys", () => {
  it("builds a routine scope key", () => {
    expect(routineScopeKey(SNAPSHOT_UUID)).toBe(`routine:${SNAPSHOT_UUID}`);
  });

  it("builds a step scope key", () => {
    expect(stepScopeKey(SNAPSHOT_UUID, `3-${FINGERPRINT}`)).toBe(
      `routine:${SNAPSHOT_UUID}:step:3-${FINGERPRINT}`,
    );
  });

  it("builds a game scope key", () => {
    expect(gameScopeKey("501" as GameTypeKey)).toBe("game:501");
  });

  it("keeps the three scope key kinds distinct for equal inputs", () => {
    const sameInput = "501";
    const keys = new Set([
      gameScopeKey(sameInput as GameTypeKey),
      routineScopeKey(sameInput),
      stepScopeKey(sameInput, sameInput),
    ]);
    expect(keys.size).toBe(3);
  });
});
