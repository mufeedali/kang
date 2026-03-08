# Kang

Small multiplayer kanban board.

## Workspace

- `apps/api` contains the Bun and Elysia backend.
- `apps/web` contains the React and Vite frontend.

## Commands

```bash
bun run dev:api
bun run dev:web
```

Other useful commands:

```bash
bun run build:web
bun run lint
```

## Deployment

Demo instance is present at: https://kang.up.railway.app/

The compose files are only tested with podman as of now.

Prod:

```bash
podman-compose up -d --build
```

Dev:

```bash
podman-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```
