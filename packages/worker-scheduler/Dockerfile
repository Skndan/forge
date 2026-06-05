# Forge Worker Scheduler
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/worker-scheduler/package.json packages/worker-scheduler/tsconfig.json ./packages/worker-scheduler/
COPY packages/types/package.json packages/types/tsconfig.json ./packages/types/

RUN bun install --frozen-lockfile

COPY packages/types ./packages/types
RUN cd packages/types && bun run build

COPY packages/worker-scheduler ./packages/worker-scheduler
RUN cd packages/worker-scheduler && bun run build

CMD ["bun", "run", "packages/worker-scheduler/dist/index.js"]
