# Forge Webhook Worker
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/worker-webhook/package.json packages/worker-webhook/tsconfig.json ./packages/worker-webhook/
COPY packages/types/package.json packages/types/tsconfig.json ./packages/types/

RUN bun install --frozen-lockfile

COPY packages/types ./packages/types
RUN cd packages/types && bun run build

COPY packages/worker-webhook ./packages/worker-webhook
RUN cd packages/worker-webhook && bun run build

CMD ["bun", "run", "packages/worker-webhook/dist/index.js"]
