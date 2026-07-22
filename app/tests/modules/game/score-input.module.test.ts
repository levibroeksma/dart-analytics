import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ScoreInputBuffer,
  SCORE_INPUT_GHOST_MS,
} from "@modules/game/score-input.module";

/** Press a digit and advance past the ghost window so the next press is eligible. */
function press(buf: ScoreInputBuffer, digit: number, detail = 1): void {
  buf.appendDigit(digit, { detail });
  vi.advanceTimersByTime(SCORE_INPUT_GHOST_MS + 1);
}

describe("ScoreInputBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("digit buffer", () => {
    it("appends digits and rejects length > maxLength (default 3)", () => {
      const buf = new ScoreInputBuffer();
      press(buf, 1);
      press(buf, 8);
      press(buf, 0);
      expect(buf.value).toBe("180");
      press(buf, 0);
      expect(buf.value).toBe("180");
    });

    it('replaces a lone "0" instead of prefixing', () => {
      const buf = new ScoreInputBuffer();
      press(buf, 0);
      expect(buf.value).toBe("0");
      press(buf, 5);
      expect(buf.value).toBe("5");
    });

    it("deleteLast removes the last character", () => {
      const buf = new ScoreInputBuffer();
      press(buf, 4);
      press(buf, 5);
      buf.deleteLast({ detail: 1 });
      expect(buf.value).toBe("4");
    });

    it("clear empties without requiring an event", () => {
      const buf = new ScoreInputBuffer();
      press(buf, 1);
      press(buf, 2);
      buf.clear();
      expect(buf.value).toBe("");
    });

    it("setValue replaces the buffer and asNumber maps empty to null", () => {
      const buf = new ScoreInputBuffer();
      expect(buf.asNumber()).toBeNull();
      buf.setValue("55");
      expect(buf.value).toBe("55");
      expect(buf.asNumber()).toBe(55);
      buf.clear();
      expect(buf.asNumber()).toBeNull();
    });

    it("respects custom maxLength", () => {
      const buf = new ScoreInputBuffer({ maxLength: 2 });
      press(buf, 9);
      press(buf, 9);
      press(buf, 9);
      expect(buf.value).toBe("99");
    });
  });

  describe("activation guard", () => {
    it("accepts intentional same-digit double when spaced beyond GHOST_MS (detail 1 then 2)", () => {
      const buf = new ScoreInputBuffer();
      buf.appendDigit(2, { detail: 1 });
      vi.advanceTimersByTime(SCORE_INPUT_GHOST_MS + 1);
      buf.appendDigit(2, { detail: 2 });
      expect(buf.value).toBe("22");
    });

    it("rejects a second activation inside the ghost window", () => {
      const buf = new ScoreInputBuffer();
      buf.appendDigit(5, { detail: 1 });
      buf.appendDigit(5, { detail: 1 });
      expect(buf.value).toBe("5");
    });

    it("rejects event.detail > 2 even after the ghost window", () => {
      const buf = new ScoreInputBuffer();
      buf.appendDigit(3, { detail: 1 });
      vi.advanceTimersByTime(SCORE_INPUT_GHOST_MS + 1);
      buf.appendDigit(3, { detail: 3 });
      expect(buf.value).toBe("3");
    });

    it("does not treat detail === 2 as a reject", () => {
      const buf = new ScoreInputBuffer();
      buf.appendDigit(1, { detail: 1 });
      vi.advanceTimersByTime(SCORE_INPUT_GHOST_MS + 1);
      buf.appendDigit(8, { detail: 2 });
      expect(buf.value).toBe("18");
    });

    it("clear/setValue reset the ghost clock so the next press is accepted immediately", () => {
      const buf = new ScoreInputBuffer();
      buf.appendDigit(9, { detail: 1 });
      buf.clear();
      buf.appendDigit(1, { detail: 1 });
      expect(buf.value).toBe("1");
    });
  });
});
