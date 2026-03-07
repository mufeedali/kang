import { Elysia } from "elysia";
import { ClientIntentSchema, ServerEventSchema } from "./types";

// ws() schemas — shared with index.ts so there is only one definition.
// MUST stay in this file (not index.ts) because the web app imports App from
// here.  This file MUST NOT import anything from bun, the database, or the
// ws handler, otherwise those bun-specific types leak into the frontend build.
export const wsSchemas = {
  body: ClientIntentSchema,
  response: ServerEventSchema,
} as const;

export const contract = new Elysia().ws("/ws", { ...wsSchemas, message() {} });

export type App = typeof contract;
