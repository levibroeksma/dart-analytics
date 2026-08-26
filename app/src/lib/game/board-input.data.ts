import {
  boardInput,
  boardPxPerMm,
  screenToBoard,
} from "@modules/game/board-input.module";
import type {
  BoardInputController,
  DartFact,
  DartObservation,
  Handedness,
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

/** Gap in pixels between the magnifier circle and the read printed above it. */
const MAGNIFIER_LABEL_GAP = 8;

/**
 * The read's position, `gap` pixels above the magnifier circle's own top
 * edge. The circle is centred on the anchor origin (`magnifierAnchorStyle`'s
 * `left`/`top`), so its top edge sits at `-magnifierSize / 2`; this is that,
 * minus the gap. The view pairs this with a `-translate-y-full` class so the
 * computed `top` lands under the label's BOTTOM edge, not its top — needed
 * because the label's own height (font-size-dependent) is never known here.
 */
export function magnifierLabelStyle(view: BoardView): string {
  return `top: -${view.magnifierSize / 2 + MAGNIFIER_LABEL_GAP}px`;
}

/**
 * The magnifier's own position, in viewport pixels, for one pointer position.
 * The anchor is `clientX`/`clientY` and the placement offsets were clamped
 * against the visual viewport, so the element this drives is `fixed`.
 *
 * Returns an object, not a string: this binds to the SAME element as
 * `x-show="board.active"` (BoardMagnifier's outer div). A string return would
 * make Alpine's `:style` replace the whole `style` attribute on every
 * re-evaluation (`setAttribute`), wiping out the `display: none` `x-show` had
 * just set the moment any dependency of this function changes — including
 * `board` changing while `active` stays false, e.g. on `recordUnseen()` (#159).
 * The object form merges individual properties instead (`style.setProperty`),
 * leaving `display` untouched, matching `magnifierBox()`.
 */
export function magnifierAnchorStyle(
  view: BoardView,
  pointerX: number,
  pointerY: number,
): Record<string, string> {
  const offsetX = view.placement ? view.placement.offsetX : 0;
  const offsetY = view.placement ? view.placement.offsetY : 0;
  return {
    left: `${pointerX + offsetX}px`,
    top: `${pointerY + offsetY}px`,
  };
}

/**
 * The transform that slides the board point under the finger beneath the
 * crosshair, at `--mag-zoom` times the board's CURRENT displayed scale. The
 * zoom factor stays a CSS custom property so it never enters Alpine's scope;
 * multiplying it here by the live `pxPerMm` keeps magnification a fixed
 * multiple of the displayed board across every viewport.
 */
export function magnifierBoardStyle(view: BoardView): string {
  const x = view.point ? view.point.x : 0;
  const y = view.point ? view.point.y : 0;
  return `transform: scale(calc(var(--mag-zoom) * ${view.pxPerMm})) translate(${-x}px, ${-y}px)`;
}

/** The resolved read printed under the magnifier, blank before the first press. */
export function magnifierRead(view: BoardView): string {
  if (!view.preview) return "";
  const target = view.preview.targetNumber ?? "";
  return `${view.preview.zoneKey} ${target} · ${view.preview.score}`;
}

type BoardInputDataContext = {
  input: BoardInputController | null;
  board: BoardView;
  pointerX: number;
  pointerY: number;
  $refs: { board: SVGSVGElement };
  $store: {
    game: { turns: TurnFact[] };
    boardInput: { handedness: Handedness };
  };
  syncBoard(this: BoardInputDataContext): void;
  magnifierAnchor(this: BoardInputDataContext): Record<string, string>;
  magnifierBox(this: BoardInputDataContext): Record<string, string>;
  magnifierBoard(this: BoardInputDataContext): string;
  magnifierLabel(this: BoardInputDataContext): string;
  magnifierRead(this: BoardInputDataContext): string;
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
  handedness: Handedness,
): BoardInputController {
  return boardInput({
    toBoard: screenToBoard(board),
    pxPerMm: () => boardPxPerMm(board),
    onCommit,
    handedness,
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

    magnifierAnchor(this: BoardInputDataContext): Record<string, string> {
      return magnifierAnchorStyle(this.board, this.pointerX, this.pointerY);
    },

    magnifierBox(this: BoardInputDataContext): Record<string, string> {
      return {
        width: `${this.board.magnifierSize}px`,
        height: `${this.board.magnifierSize}px`,
      };
    },

    magnifierBoard(this: BoardInputDataContext): string {
      return magnifierBoardStyle(this.board);
    },

    magnifierLabel(this: BoardInputDataContext): string {
      return magnifierLabelStyle(this.board);
    },

    magnifierRead(this: BoardInputDataContext): string {
      return magnifierRead(this.board);
    },

    onPointerDown(this: BoardInputDataContext, event: PointerEvent) {
      event.preventDefault();
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      const controller = freshController(
        this.$refs.board,
        onCommit,
        this.$store.boardInput.handedness,
      );
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
        this.input ??
        freshController(
          this.$refs.board,
          onCommit,
          this.$store.boardInput.handedness,
        );
      this.input = controller;
      controller.commitUnseen();
      this.syncBoard();
    },

    visitMarkers(this: BoardInputDataContext): BoardMarker[] {
      return markersForTurns(this.$store.game.turns);
    },
  };
}
