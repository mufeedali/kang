FROM docker.io/oven/bun:1 AS dev
WORKDIR /app
COPY package.json bun.lock* ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN bun install
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["bunx", "vite", "--host"]

FROM docker.io/oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock* ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN bun install

# api/src is needed for TypeScript type resolution — it is not bundled into the output.
COPY apps/api/src ./apps/api/src

COPY apps/web/public ./apps/web/public
COPY apps/web/scripts ./apps/web/scripts
COPY apps/web/src ./apps/web/src
COPY apps/web/index.html ./apps/web/index.html
COPY apps/web/vite.config.ts ./apps/web/vite.config.ts
COPY apps/web/tsconfig.json apps/web/tsconfig.app.json apps/web/tsconfig.node.json ./apps/web/

WORKDIR /app/apps/web

ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN bun run build

FROM docker.io/oven/bun:1 AS production
WORKDIR /app
RUN bun add serve
COPY --from=build /app/apps/web/dist ./dist
COPY --from=build /app/apps/web/scripts/write-runtime-config.ts ./write-runtime-config.ts
EXPOSE 4173
CMD ["sh", "-c", "bun ./write-runtime-config.ts ./dist && bunx serve dist -s -l ${PORT:-4173}"]
