# Forge Gateway — Bun + Fastify
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json turbo.json ./
COPY packages/gateway/package.json packages/gateway/tsconfig.json ./packages/gateway/
COPY packages/types/package.json packages/types/tsconfig.json ./packages/types/

RUN bun install --frozen-lockfile

# Build shared types
COPY packages/types ./packages/types
RUN cd packages/types && bun run build

# Build gateway
COPY packages/gateway ./packages/gateway
RUN cd packages/gateway && bun run build

EXPOSE 3000

CMD ["bun", "run", "packages/gateway/dist/index.js"]
