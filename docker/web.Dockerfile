# ---- Build stage ----
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app
ARG API_URL=http://localhost:4100
ARG NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1
ENV API_URL=${API_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @nexus/web build

# ---- Runtime stage ----
FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web ./apps/web

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
