/// <reference path="../.astro/types.d.ts" />

interface AppLocalsAuth {
  authUserId: string;
  playerId?: string;
  /** JWT name claim — present only on the provision route (D76). */
  name?: string;
}

declare namespace App {
  interface Locals {
    requestId: string;
    auth?: AppLocalsAuth;
  }
}
