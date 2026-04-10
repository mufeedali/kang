import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { wsRoute, wsSchemas } from "./contract";
import { migrate } from "./db/schema";
import { handleClose, handleMessage, handleOpen } from "./ws/handler";

const port = process.env.PORT ?? 3001;

await migrate();

new Elysia()
  .use(cors())
  .get("/health", () => ({ status: "ok" }))
  .ws(wsRoute, {
    ...wsSchemas,
    open(ws) {
      handleOpen(ws as never);
    },
    message(ws, message) {
      // With body schema defined, Elysia validates incoming messages before
      // this callback fires.  Invalid payloads are dropped automatically.
      handleMessage(ws as never, message);
    },
    close(ws) {
      handleClose(ws as never);
    },
  })
  .listen({ port, hostname: "0.0.0.0" });

console.log(`Kang API running at http://0.0.0.0:${port}`);
console.log(`WebSocket at ws://localhost:${port}/ws`);
