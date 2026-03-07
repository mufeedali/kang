import { Elysia } from "elysia";
import { migrate } from "./db/schema";

const port = Number(process.env.PORT ?? 3000);

await migrate();

new Elysia().get("/health", () => ({ status: "ok" })).listen(port);

console.log(`Kang API listening on http://localhost:${port}`);
