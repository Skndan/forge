# Forge Dashboard — Next.js
FROM node:20-alpine AS base
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/dashboard/package.json packages/dashboard/tsconfig.json ./packages/dashboard/
COPY packages/types/package.json packages/types/tsconfig.json ./packages/types/

RUN npm install --frozen-lockfile

COPY packages/types ./packages/types
RUN cd packages/types && npm run build

COPY packages/dashboard ./packages/dashboard
RUN cd packages/dashboard && npm run build

EXPOSE 3003

CMD ["node", "packages/dashboard/.next/standalone/server.js"]
