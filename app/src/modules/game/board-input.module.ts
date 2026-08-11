import { classify } from "@lib/game/board/board-geometry.module";
import type {
  BoardCoordinate,
  BoardInputController,
  BoardInputOptions,
  BoardPointer,
  ScreenToBoard,
  Handedness,
  MagnifierPlacement,
  MagnifierSide,
} from "./types";

/**
 * Builds a converter from viewport pixels to board millimetres for one SVG
 * element. The SVG's viewBox is authored in millimetres, so its inverse screen
 * CTM is the whole transform — no scale factor is tracked by hand, and the
 * conversion stays correct when the board is resized, scrolled or zoomed.
 *
 * Returns null for a pointer when the element is detached and has no screen
 * CTM, which happens if a page teardown races a pointer event.
 */
export function screenToBoard(svg: SVGSVGElement): ScreenToBoard {
  return (pointer) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;

    const point = svg.createSVGPoint();
    point.x = pointer.clientX;
    point.y = pointer.clientY;

    const board = point.matrixTransform(matrix.inverse());
    return { x: board.x, y: board.y };
  };
}

const DEFAULT_PX_PER_MM = 1;

/**
 * Pixels per board millimetre at the SVG's current displayed size, read from
 * its screen CTM's horizontal scale factor. The board's viewBox is authored
 * in millimetres, so this factor is exactly how many screen pixels one board
 * millimetre currently occupies — the board is `w-full`, so it changes with
 * viewport width and must be re-read rather than assumed constant.
 *
 * Falls back to 1 (no scaling) when the element has no screen CTM, which
 * happens if a page teardown races the read.
 */
export function boardPxPerMm(svg: SVGSVGElement): number {
  const matrix = svg.getScreenCTM();
  return matrix ? matrix.a : DEFAULT_PX_PER_MM;
}

export const MAGNIFIER_GAP = 16;

/**
 * Picks which side of the pointer the magnifier sits on, for the pointer
 * position a gesture STARTS at. Handedness picks the preferred side on the X
 * axis; it flips to the opposite side only if the preferred side would
 * overflow the viewport at this starting position. The Y axis prefers above
 * the pointer, dropping below only when there is no room above. This is a
 * one-shot decision — see `boardInput`'s `track`, which calls it once per
 * gesture (on press) and reuses the result for every following `move`, so
 * the magnifier never swaps sides mid-drag.
 */
function resolveMagnifierSide(
  pointer: BoardPointer,
  viewport: { width: number; height: number },
  handedness: Handedness,
  size: number,
): MagnifierSide {
  const reach = size / 2 + MAGNIFIER_GAP;
  const half = size / 2;

  let x: "left" | "right" = handedness === "RIGHT" ? "left" : "right";
  const offsetXFor = (side: "left" | "right") =>
    side === "left" ? -reach : reach;
  if (pointer.clientX + offsetXFor(x) - half < 0) {
    x = "right";
  } else if (pointer.clientX + offsetXFor(x) + half > viewport.width) {
    x = "left";
  }

  let y: "above" | "below" = "above";
  if (pointer.clientY - reach - half < 0) {
    y = "below";
  }

  return { x, y };
}

/**
 * Positions the magnifier `size` MAGNIFIER_GAP-clear of the pointer on the
 * given, already-decided `side`, then clamps each axis independently so the
 * magnifier's box stays within the viewport for the CURRENT pointer
 * position. When the viewport is narrower (X) or shorter (Y) than the
 * magnifier itself, the clamp pins the box to the viewport's near edge (left
 * on X, top on Y) instead of leaving it hanging outside the viewport.
 *
 * Unlike `resolveMagnifierSide`, this never changes which side the magnifier
 * is on — it only slides the box along with the pointer — so it is safe to
 * call on every `move` of a gesture without the magnifier jumping sides.
 */
function clampMagnifierPlacement(
  pointer: BoardPointer,
  viewport: { width: number; height: number },
  side: MagnifierSide,
  size: number,
): MagnifierPlacement {
  const reach = size / 2 + MAGNIFIER_GAP;
  const half = size / 2;

  let offsetX = side.x === "left" ? -reach : reach;
  const minOffsetX = half - pointer.clientX;
  const maxOffsetX = viewport.width - pointer.clientX - half;
  offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, offsetX));

  let offsetY = side.y === "above" ? -reach : reach;
  const minOffsetY = half - pointer.clientY;
  const maxOffsetY = viewport.height - pointer.clientY - half;
  offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, offsetY));

  return { offsetX, offsetY };
}

/**
 * Places the magnifier away from the throwing hand and clear of the viewport
 * edges, for a single pointer position. A thin wrapper over
 * `resolveMagnifierSide` + `clampMagnifierPlacement`, kept for callers that
 * only ever place the magnifier once (e.g. tests) — a live gesture must call
 * the two steps separately so the side is resolved once and clamped on every
 * move, rather than re-resolved every move (see `boardInput`).
 */
export function magnifierPlacement(
  pointer: BoardPointer,
  viewport: { width: number; height: number },
  handedness: Handedness,
  size: number,
): MagnifierPlacement {
  const side = resolveMagnifierSide(pointer, viewport, handedness, size);
  return clampMagnifierPlacement(pointer, viewport, side, size);
}

const DEFAULT_MAGNIFIER_SIZE = 120;

/**
 * The press-drag-release cycle over the board.
 *
 * Nothing commits until release, because the treble ring is 10 mm tall and a
 * fingertip covers far more than that: the player needs to see what is under
 * the crosshair, adjust, and only then let go. A press that never moves still
 * commits at its own position, so a confident tap costs one gesture.
 *
 * A press only becomes active once `options.toBoard` yields a point. If the
 * SVG is detached (a page teardown racing the pointer event), the transform
 * returns null and the controller stays inert — `active` false, nothing to
 * preview, nothing for a following `release()` to commit. It must never
 * report a live press it cannot honour.
 */
export function boardInput(options: BoardInputOptions): BoardInputController {
  const magnifierSize = options.magnifierSize ?? DEFAULT_MAGNIFIER_SIZE;
  const handedness = options.handedness ?? "RIGHT";

  let point: BoardCoordinate | null = null;
  let placement: MagnifierPlacement | null = null;
  let side: MagnifierSide | null = null;
  let active = false;

  function track(pointer: BoardPointer): boolean {
    const board = options.toBoard(pointer);
    if (!board) return false;

    point = board;
    const viewport = options.viewport ?? { width: 0, height: 0 };
    if (!side) {
      side = resolveMagnifierSide(pointer, viewport, handedness, magnifierSize);
    }
    placement = clampMagnifierPlacement(pointer, viewport, side, magnifierSize);
    return true;
  }

  function reset(): void {
    active = false;
    point = null;
    placement = null;
    side = null;
  }

  return {
    get active() {
      return active;
    },
    get preview() {
      return point ? classify(point.x, point.y) : null;
    },
    get point() {
      return point;
    },
    get placement() {
      return placement;
    },
    get magnifierSize() {
      return magnifierSize;
    },
    get pxPerMm() {
      return options.pxPerMm ? options.pxPerMm() : DEFAULT_PX_PER_MM;
    },

    press(pointer) {
      active = track(pointer);
    },

    move(pointer) {
      if (!active) return;
      track(pointer);
    },

    release() {
      if (!active || !point) {
        reset();
        return;
      }

      const hit = classify(point.x, point.y);
      const committed = point;
      reset();

      options.onCommit({
        hitTargetNumber: hit.targetNumber,
        hitZoneKey: hit.zoneKey,
        locationX: committed.x,
        locationY: committed.y,
      });
    },

    cancel() {
      reset();
    },

    commitUnseen() {
      reset();
      options.onCommit({
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });
    },
  };
}
