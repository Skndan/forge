# Forge Worker Audit
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/worker-audit/package.json packages/worker-audit/tsconfig.json ./packages/worker-audit/
COPY packages/types/package.json packages/types/tsconfig.json ./packages/types/

RUN bun install --frozen-lockfile

COPY packages/types ./packages/types
RUN cd packages/types && bun run build

COPY packages/worker-audit ./packages/worker-audit
RUN cd packages/worker-audit && bun run build

CMD ["bun", "run", "packages/worker-audit/dist/index.js"]
