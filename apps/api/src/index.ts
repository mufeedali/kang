import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { migrate } from "./db/schema";
import { handleClose, handleMessage, handleOpen } from "./ws/handler";

const port = process.env.PORT ?? 3001;

await migrate();

const app = new Elysia()
  .use(cors())
  .get("/health", () => ({ status: "ok" }))
  .ws("/ws", {
    open(ws) {
      handleOpen(ws as never);
    },
    message(ws, message) {
      handleMessage(ws as never, message as string);
    },
    close(ws) {
      handleClose(ws as never);
    },
  })
  .listen(port);

console.log(`Kang API running at http://localhost:${port}`);
console.log(`WebSocket at ws://localhost:${port}/ws`);

export type App = typeof app;
