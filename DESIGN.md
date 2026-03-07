# Kang

A multi-user kanban board.

# Principles

- Cutting edge but not too cutting edge.
- Simple wherever possible. Avoid unnecessary complexity.
- Avoid boilerplate as much as possible. UNLESS the benefits far outweigh the cons. (vite, for example)
- One WebSocket connection for basically everything.
- CRDT implementation:
    - Every operation has to be atomic.
    - Non-conflicting actions should not result in a conflict.
- UI should look decent.
- Does NOT need to be "production-ready" in the truest sense. But I should be able to explain *how* I could potentially scale it.
- Dev env must be deployable through Docker/Podman with Compose.

# Stack

- Backend:
    - Bun with ElysiaJS and Eden for type-safety.
    - PostgreSQL and SQLite support.
- Frontend:
    - React 19 + Vite 8 + TypeScript
    - shadcn/ui + Lucide for UI components
    - Zustand for state management
    - dnd-kit for drag and drop
- fractional-indexing for task ordering
    - Why? Collision handling has too many edge cases.
- Biome for linting and formatting.

# Client-Server Architecture


```
┌──────────────┐         WebSocket          ┌──────────────────────┐
│   Client A   │<──────────────────────────>│                      │
│  (React +    │                            │     Elysia / Bun     │
│   Zustand)   │                            │                      │
└──────────────┘                            │  ┌────────────────┐  │
                                            │  │  WS Handler    │  │
┌──────────────┐         WebSocket          │  │  (thin layer)  │  │
│   Client B   │<──────────────────────────>│  └───────┬────────┘  │
└──────────────┘                            │          │           │
                                            │  ┌───────▼────────┐  │
                                            │  │  task-service  │  │
                                            │  │   (business    │  │
                                            │  │  logic / LWW)  │  │
                                            │  └───────┬────────┘  │
                                            │          │           │
                                            │  ┌───────▼────────┐  │
                                            │  │    Bun SQL     │  │
                                            └──┴───────┬────────┴──┘
                                                       │
                                                ┌──────▼───────┐
                                                │  PostgreSQL  │
                                                └──────────────┘
```

# Data Handling

- Within PostgreSQL, only a tasks table, nothing else.
- "Users" will be in server memory and user's localStorage.
    - Anyone who connects to the WebSocket is a user.
    - We create a UUID, a display name and a user color.
    - We use localStorage, so the identity is re-usable throughout that server session and browser's existence.
