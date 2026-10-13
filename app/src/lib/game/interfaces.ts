import type { Expr } from "./types";

export interface Call {
  (fn: string): string;
  /** True for the solo scoreboard; for an expr with no `xFor` twin. */
  readonly solo: boolean;
}

export interface Tile {
  label: string;
  value: Expr;
  /** Rendered inside `<template x-if>` when set. */
  showWhen?: Expr;
}
