# Forge Function Runner
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/function-runner/package.json packages/function-runner/tsconfig.json ./packages/function-runner/
COPY packages/types/package.json packages/types/tsconfig.json ./packages/types/

RUN bun install --frozen-lockfile

COPY packages/types ./packages/types
RUN cd packages/types && bun run build

COPY packages/function-runner ./packages/function-runner
RUN cd packages/function-runner && bun run build

EXPOSE 3002

CMD ["bun", "run", "packages/function-runner/dist/index.js"]
