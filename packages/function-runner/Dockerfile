# Forge Function Runner — Multi-stage Docker-in-Docker Build
# ============================================================
#
# Stage 1: Build shared types
FROM oven/bun:1 AS types-builder
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/types/package.json packages/types/tsconfig.json ./packages/types/
RUN bun install --frozen-lockfile

COPY packages/types ./packages/types
RUN cd packages/types && bun run build

# Stage 2: Build function-runner
FROM oven/bun:1 AS runner-builder
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/function-runner/package.json packages/function-runner/tsconfig.json ./packages/function-runner/
COPY packages/types/package.json packages/types/tsconfig.json ./packages/types/

RUN bun install --frozen-lockfile

# Copy pre-built types from Stage 1
COPY --from=types-builder /app/packages/types/dist ./packages/types/dist
COPY --from=types-builder /app/packages/types/package.json ./packages/types/package.json

COPY packages/function-runner ./packages/function-runner
RUN cd packages/function-runner && bun run build

# Stage 3: Runtime with Docker-in-Docker
FROM docker:24.0-dind AS runtime

LABEL org.opencontainers.image.title="Forge Function Runner"
LABEL org.opencontainers.image.description="Serverless function runner with Docker-in-Docker isolation"
LABEL org.opencontainers.image.version="0.4.0"

# Install Bun
RUN apk add --no-cache curl unzip ca-certificates \
  && curl -fsSL https://bun.sh/install | bash \
  && ln -s /root/.bun/bin/bun /usr/local/bin/bun

WORKDIR /app

# Copy built artifacts from Stage 2
COPY --from=runner-builder /app/packages/function-runner/dist ./packages/function-runner/dist
COPY --from=runner-builder /app/packages/function-runner/package.json ./packages/function-runner/
COPY --from=runner-builder /app/node_modules ./node_modules

# Copy types
COPY --from=types-builder /app/packages/types/dist ./packages/types/dist
COPY --from=types-builder /app/packages/types/package.json ./packages/types/

# Create function working directory
RUN mkdir -p /tmp/forge-fn /var/log/forge

EXPOSE 3002

# Docker-in-Docker entrypoint
# The DOCKER_HOST env var is set automatically by docker:24.0-dind
# DinD startup requires privileged mode or the docker socket binding
CMD ["bun", "run", "packages/function-runner/dist/index.js"]
