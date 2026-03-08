# Kang

A multi-user kanban board.

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

# Personal Principles

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
- This is only an opportunity to learn about things. Nothing else.

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

# Conflict Resolution

Every mutating intent carries a client `timestamp` (ms since epoch). The server rejects it if the timestamp predates the task's `updated_at`, responding with `ACTION_REJECTED` + current server state for client reconciliation.

`updated_at` is per-task, not per-field. Two intents targeting different fields (e.g. a move and a title edit) can both succeed; two intents targeting the same field go through LWW and the loser gets an `ACTION_REJECTED` toast. The client clock is trusted — clock skew can cause unfair LWW outcomes, which is acceptable at this scale.

| Scenario | Outcome |
|---|---|
| Concurrent move + edit | Both succeed — they touch different fields, so neither timestamp conflicts with the other. |
| Concurrent move + move | LWW — the later timestamp wins; the losing client receives `ACTION_REJECTED` with the current task state and rolls back its optimistic update. |
| Concurrent reorder / add | Both succeed — independent fractional-index keys are generated with no overlap, so there is no conflict to resolve. |

# Task Ordering

Tasks are ordered by a fractional-index string `rank`. Inserts and moves generate a new key between neighbours in O(1) with no rewrites to other rows, which also eliminates ordering conflicts between concurrent inserts.

# Offline Support

Intents that cannot be sent (WebSocket closed) are queued in memory and persisted to `localStorage` under `kang-offline-queue`. On reconnect the queue is replayed in order; each intent goes through the same LWW path and can be rejected normally.
