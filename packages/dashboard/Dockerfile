# ── Dashboard Dockerfile (Next.js standalone) ──
# Multi-stage: deps → build → production

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/dashboard/package.json packages/dashboard/tsconfig.json ./packages/dashboard/
COPY packages/types/package.json packages/types/tsconfig.json ./packages/types/

RUN npm install --frozen-lockfile

# Stage 2: Build application
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build shared types
RUN cd packages/types && npm run build

# Build dashboard
RUN cd packages/dashboard && npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/packages/dashboard/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/packages/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/dashboard/.next/static ./.next/static

USER nextjs

EXPOSE 3003

ENV PORT=3003

CMD ["node", "packages/dashboard/server.js"]
