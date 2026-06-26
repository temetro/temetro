# --- deps ------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Retry on transient registry drops (ECONNRESET / "network aborted") and allow a
# long timeout — the dependency set is large, so a slow connection can stall.
RUN npm ci --no-audit --no-fund \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=180000 \
    --fetch-timeout=900000

# --- build (Next.js standalone output) -------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
# NEXT_PUBLIC_* values are inlined at build time. We deliberately leave the API
# URL EMPTY by default: the app derives the backend URL from the browser host at
# runtime (see lib/backend-url.ts), so one prebuilt image works on localhost and
# any clinic LAN IP. Set NEXT_PUBLIC_API_URL only to pin a fixed/proxied URL.
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runtime ---------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
