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
- Biome for linting and formatting.

## Why

### Bun

- I chose to use Bun instead of Node because it helps me think less.
- Personally, I like efforts like `uv` and `bun` that try to copy the `cargo` model.
- Bun also comes with a lot of useful batteries included, like Bun.SQL for example.
- Similar reasoning for Biome.

### fractional-indexing

Index collision handling has too many edge cases and I would like to ensure stability.

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
┌───────────────────────┐     WebSocket     ┌──────────────────────┐
│       Client A        │◄─────────────────►│                      │
│  ┌─────────────────┐  │                   │     Elysia / Bun     │
│  │   React UI      │  │                   │                      │
│  └────────┬────────┘  │                   │  ┌────────────────┐  │
│  ┌────────▼────────┐  │                   │  │  WS Handler    │  │
│  │   kang-store    │  │                   │  │  (thin layer)  │  │
│  │   (Zustand)     │  │                   │  └───────┬────────┘  │
│  └────────┬────────┘  │                   │          │           │
│  ┌────────▼────────┐  │     WebSocket     │  ┌───────▼────────┐  │
│  │   sync-engine   │  │◄─────────────────►│  │  task-service  │  │
│  │  (queue/toasts) │  │                   │  │   (business    │  │
│  └────────┬────────┘  │                   │  │  logic / LWW)  │  │
│  ┌────────▼────────┐  │                   │  └───────┬────────┘  │
│  │   ws-client     │  │                   │          │           │
│  │  (transport)    │  │                   │  ┌───────▼────────┐  │
│  └─────────────────┘  │                   │  │    Bun SQL     │  │
└───────────────────────┘                   └──┴───────┬────────┴──┘
                                                       │
                                                ┌──────▼───────┐
                                                │  PostgreSQL  │
                                                └──────────────┘
```

# Data Handling

- Within DB, only a tasks table, nothing else.
- "Users" will be in server memory and user's localStorage.
    - Anyone who connects to the WebSocket is a user.
    - We create a UUID, a display name and a user color.
    - We use localStorage, so the identity is re-usable throughout that server session and browser's existence.

# UI/UX

I'm not great with UI/UX. So my focus is on keeping things looking okayish while making sure that most typical interactions are straightforward.

# Conflict Resolution

The server is the source of truth. Each task has separate version counters for `title`, `description`, and `position` (`status` + `rank`). A change only succeeds if the version the client last saw still matches the version in the database.

This means unrelated changes can both succeed, while true conflicts on the same field are rejected instead of being silently overwritten. Deleted tasks use a simple tombstone (`deleted_at`), and server time is used for `updated_at`.

| Scenario | Outcome |
|---|---|
| Concurrent move + edit | Both succeed — move checks `position_version`; content edits check their own version counters. |
| Concurrent move + move | Only one move can update `position_version`. The other client gets `ACTION_REJECTED` with the latest server state and rolls back its optimistic update. |
| Concurrent reorder / add | Both succeed — independent fractional-index keys are generated with no overlap, so there is no conflict to resolve. |

# Task Ordering

Tasks are ordered by a fractional-index string `rank`. Inserts and moves generate a new key between neighbours in O(1) with no rewrites to other rows, which also eliminates ordering conflicts between concurrent inserts.

# Offline Support

Intents that cannot be sent (WebSocket closed) are queued in memory and persisted to `localStorage` under `kang-offline-queue`. On reconnect the queue is replayed in order; each intent goes through the same LWW path and can be rejected normally.
