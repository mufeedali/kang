import { Elysia } from "elysia";

const port = Number(process.env.PORT ?? 3000);

new Elysia().get("/health", () => ({ status: "ok" })).listen(port);

console.log(`Kang API listening on http://localhost:${port}`);
