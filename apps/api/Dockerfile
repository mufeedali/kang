FROM docker.io/oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock* ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN bun install --production

COPY apps/api/src ./apps/api/src

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
