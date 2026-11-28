# ---- Build stage ----
FROM node:20-alpine AS builder
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /app

# Copy workspace manifests for cached installs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @nexus/database generate
RUN pnpm --filter @nexus/database build
RUN pnpm --filter @nexus/api build

# ---- Runtime stage ----
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
