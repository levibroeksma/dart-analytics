import type {
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
