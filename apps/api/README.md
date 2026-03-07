# api

Backend for Kang.

SQLite is the default database.

Database access uses Bun.SQL.

Starting the API bootstraps the database if the `tasks` table does not exist yet.

If `DATABASE_URL` is not set, the API uses `file:./kang.sqlite`.

If `DATABASE_URL` points to Postgres, the API uses Postgres automatically.

You can still force a dialect explicitly:

```bash
DATABASE_DIALECT=sqlite bun run start
DATABASE_DIALECT=postgres bun run start
```

Examples:

```bash
bun run start
DATABASE_URL=postgres://postgres:postgres@localhost:5432/kang bun run start
```
