# Forge Realtime — WebSocket Service
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/realtime/package.json packages/realtime/tsconfig.json ./packages/realtime/
COPY packages/types/package.json packages/types/tsconfig.json ./packages/types/

RUN bun install --frozen-lockfile

COPY packages/types ./packages/types
RUN cd packages/types && bun run build

COPY packages/realtime ./packages/realtime
RUN cd packages/realtime && bun run build

EXPOSE 3001

CMD ["bun", "run", "packages/realtime/dist/index.js"]
