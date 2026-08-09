import {
  boardInput,
  boardPxPerMm,
  screenToBoard,
} from "@modules/game/board-input.module";
import type {
  BoardInputController,
  DartFact,
  DartObservation,
  TurnFact,
} from "@modules/types";
import type { BoardMarker, BoardView } from "./types";

/**
 * The half-width of the board's own viewBox in millimetres (`-220 -220 440
 * 440`). Marker positions are expressed as a percentage of the board's box so
 * they scale with it, and that conversion needs the same extent the SVG is
 * authored in.
 */
const BOARD_HALF_EXTENT_MM = 220;

function idleView(): BoardView {
  return {
    active: false,
    point: null,
    preview: null,
    placement: null,
    magnifierSize: 0,
    pxPerMm: 1,
  };
}

type BoardInputDataContext = {
  input: BoardInputController | null;
  board: BoardView;
  pointerX: number;
  pointerY: number;
  $refs: { board: SVGSVGElement };
  $store: { game: { turns: TurnFact[] } };
  syncBoard(this: BoardInputDataContext): void;
  onPointerDown(this: BoardInputDataContext, event: PointerEvent): void;
  onPointerMove(this: BoardInputDataContext, event: PointerEvent): void;
  onPointerUp(this: BoardInputDataContext): void;
  onPointerCancel(this: BoardInputDataContext): void;
  recordUnseen(this: BoardInputDataContext): void;
  visitMarkers(this: BoardInputDataContext): BoardMarker[];
};

/**
 * Builds a fresh controller bound to the board SVG, reading the viewport at
 * the moment it is called rather than once for the page's whole lifetime —
 * the board is `w-full`, so both its displayed scale (`pxPerMm`) and the
 * magnifier's clamp bounds depend on the current viewport, and only a value
 * read now can reflect a resize or rotation since the last gesture.
 */
function freshController(
  board: SVGSVGElement,
  onCommit: (observation: DartObservation) => void,
): BoardInputController {
  return boardInput({
    toBoard: screenToBoard(board),
    pxPerMm: () => boardPxPerMm(board),
    onCommit,
    viewport: {
      width: globalThis.innerWidth ?? 0,
      height: globalThis.innerHeight ?? 0,
    },
  });
}

/**
 * The darts a player should currently see stuck in the board: those of the
 * most recent turn, whether it is still open or was just closed by its third
 * dart. Reading the last turn rather than only an OPEN one is what keeps a
 * finished visit's three markers on the board until the next visit's first
 * dart replaces them — a visit closes the moment its last dart lands, so
 * gating on `completedAt === null` would clear the grouping at the exact
 * moment the player wants to look at it.
 *
 * Unseen darts carry no coordinate and are skipped: there is no position to
 * draw them at.
 */
export function markersForTurns(turns: TurnFact[]): BoardMarker[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn) return [];

  return lastTurn.darts
    .filter(
      (dart): dart is DartFact & { locationX: number; locationY: number } =>
        dart.locationX !== null && dart.locationY !== null,
    )
    .map((dart) => ({
      sequence: dart.sequence,
      leftPercent:
        ((dart.locationX + BOARD_HALF_EXTENT_MM) / (BOARD_HALF_EXTENT_MM * 2)) *
        100,
      topPercent:
        ((dart.locationY + BOARD_HALF_EXTENT_MM) / (BOARD_HALF_EXTENT_MM * 2)) *
        100,
    }));
}

/**
 * Bridges pointer events on the board SVG to the pure input controller.
 * A new controller is built on every press (see `freshController`), so a
 * viewport resize or rotation between gestures is picked up on the next
 * one; the controller then persists for the rest of that single gesture, so
 * move/release/cancel keep acting on the same instance press started.
 *
 * Every call into the controller is followed by `syncBoard()`, which copies
 * its readings onto the reactive `board` field the view binds to — see
 * `BoardView` for why the view must never bind at the controller directly.
 */
export function boardInputData(
  onCommit: (observation: DartObservation) => void,
) {
  return {
    input: null as BoardInputController | null,
    board: idleView(),
    pointerX: 0,
    pointerY: 0,

    syncBoard(this: BoardInputDataContext) {
      const controller = this.input;
      if (!controller) {
        this.board = idleView();
        return;
      }
      this.board = {
        active: controller.active,
        point: controller.point,
        preview: controller.preview,
        placement: controller.placement,
        magnifierSize: controller.magnifierSize,
        pxPerMm: controller.pxPerMm,
      };
    },

    onPointerDown(this: BoardInputDataContext, event: PointerEvent) {
      event.preventDefault();
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      const controller = freshController(this.$refs.board, onCommit);
      this.input = controller;
      controller.press(event);
      this.syncBoard();
    },

    onPointerMove(this: BoardInputDataContext, event: PointerEvent) {
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      this.input?.move(event);
      this.syncBoard();
    },

    onPointerUp(this: BoardInputDataContext) {
      this.input?.release();
      this.syncBoard();
    },

    onPointerCancel(this: BoardInputDataContext) {
      this.input?.cancel();
      this.syncBoard();
    },

    recordUnseen(this: BoardInputDataContext) {
      const controller =
        this.input ?? freshController(this.$refs.board, onCommit);
      this.input = controller;
      controller.commitUnseen();
      this.syncBoard();
    },

    visitMarkers(this: BoardInputDataContext): BoardMarker[] {
      return markersForTurns(this.$store.game.turns);
    },
  };
}
