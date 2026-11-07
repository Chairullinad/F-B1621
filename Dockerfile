# ============================================================================
# Dockerfile — POS 1621 F&B Web (Next.js Standalone untuk VPS Coolify)
# Sesuai PRD Bagian 10 & 11: Deploy di VPS Hostinger KVM 2 dengan Coolify
# ============================================================================

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

# 1. Instal dependensi
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build aplikasi Next.js (output: standalone)
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# 3. Image produksi ringan dengan non-root user
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Jakarta
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]

