# ========================================
# Base Stage: Alpine Linux with Bun
# ========================================
FROM oven/bun:1.3.13-alpine AS base

RUN apk add --no-cache libc6-compat curl

# ========================================
# Pruner Stage: Emit a minimal monorepo subset that @sim/mothership depends on
# ========================================
FROM base AS pruner
WORKDIR /app

RUN bun add -g turbo

COPY . .

RUN turbo prune @sim/mothership --docker

# ========================================
# Dependencies Stage: Install Dependencies
# ========================================
FROM base AS deps
WORKDIR /app

COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/bun.lock ./bun.lock

RUN --mount=type=cache,id=bun-cache,target=/root/.bun/install/cache \
    bun install --linker=hoisted --omit=dev --ignore-scripts

# ========================================
# Runner Stage: Run the owned Mothership service
# ========================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=6891

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

COPY --from=deps --chown=nextjs:nodejs /app ./
COPY --from=pruner --chown=nextjs:nodejs /app/out/full/ ./

USER nextjs

EXPOSE 6891

CMD ["bun", "apps/mothership/src/index.ts"]
