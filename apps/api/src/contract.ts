import { Elysia } from "elysia";
import { ClientIntentSchema, ServerEventSchema } from "./types";

// Keep this module free of Bun and DB imports so the web app can import it.
export const wsRoute = "/ws" as const;

export const wsSchemas = {
  body: ClientIntentSchema,
  response: ServerEventSchema,
} as const;

export const contract = new Elysia().ws(wsRoute, {
  ...wsSchemas,
  message() {},
});

export type WsContractRoutes = (typeof contract)["~Routes"];

export type App = typeof contract;
