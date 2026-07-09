/// <reference path="../.astro/types.d.ts" />

interface AppLocalsAuth {
  authUserId: string;
  playerId?: string;
}

declare namespace App {
  interface Locals {
    requestId: string;
    auth?: AppLocalsAuth;
  }
}
