import { classify } from "@lib/game/board/board-geometry.module";
import type {
  BoardCoordinate,
  BoardInputController,
  BoardInputOptions,
  BoardPointer,
  ScreenToBoard,
  Handedness,
  MagnifierPlacement,
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

export const MAGNIFIER_GAP = 16;

/**
 * Places the magnifier away from the throwing hand and clear of the viewport
 * edges. It sits above the pointer by default, because a fingertip covers what
 * is directly beneath it, and drops below only when there is no room above.
 * Handedness picks the preferred side on the X axis, flipping to the opposite
 * side when that overflows. After the flip, each axis is independently
 * clamped so the magnifier's box stays within the viewport; when the viewport
 * is narrower (X) or shorter (Y) than the magnifier itself, the clamp pins
 * the box to the viewport's near edge (left on X, top on Y) instead of
 * leaving it hanging outside the viewport.
 */
export function magnifierPlacement(
  pointer: BoardPointer,
  viewport: { width: number; height: number },
  handedness: Handedness,
  size: number,
): MagnifierPlacement {
  const reach = size / 2 + MAGNIFIER_GAP;
  const half = size / 2;
  const preferLeft = handedness === "RIGHT";

  let offsetX = preferLeft ? -reach : reach;
  if (pointer.clientX + offsetX - half < 0) {
    offsetX = reach;
  } else if (pointer.clientX + offsetX + half > viewport.width) {
    offsetX = -reach;
  }
  const minOffsetX = half - pointer.clientX;
  const maxOffsetX = viewport.width - pointer.clientX - half;
  offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, offsetX));

  let offsetY = -reach;
  if (pointer.clientY + offsetY - half < 0) {
    offsetY = reach;
  }
  const minOffsetY = half - pointer.clientY;
  const maxOffsetY = viewport.height - pointer.clientY - half;
  offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, offsetY));

  return { offsetX, offsetY };
}

const DEFAULT_MAGNIFIER_SIZE = 120;

/**
 * The press-drag-release cycle over the board.
 *
 * Nothing commits until release, because the treble ring is 10 mm tall and a
 * fingertip covers far more than that: the player needs to see what is under
 * the crosshair, adjust, and only then let go. A press that never moves still
 * commits at its own position, so a confident tap costs one gesture.
 */
export function boardInput(options: BoardInputOptions): BoardInputController {
  const magnifierSize = options.magnifierSize ?? DEFAULT_MAGNIFIER_SIZE;
  const handedness = options.handedness ?? "RIGHT";

  let point: BoardCoordinate | null = null;
  let placement: MagnifierPlacement | null = null;
  let active = false;

  function track(pointer: BoardPointer): void {
    const board = options.toBoard(pointer);
    if (!board) return;

    point = board;
    placement = magnifierPlacement(
      pointer,
      options.viewport ?? { width: 0, height: 0 },
      handedness,
      magnifierSize,
    );
  }

  function reset(): void {
    active = false;
    point = null;
    placement = null;
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

    press(pointer) {
      active = true;
      track(pointer);
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
