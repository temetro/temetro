# --- build stage: compile TypeScript -> dist ------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
# --ignore-scripts skips native postinstall builds (e.g. better-sqlite3, a
# dev-only dependency of @better-auth/cli that needs Python/node-gyp). The build
# step is just `tsc`, which needs no compiled binaries, and better-sqlite3 is
# never used at runtime (the prod stage omits dev deps).
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# --- runtime stage: prod deps only -----------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 4000
# The entrypoint auto-generates any missing secrets, then we apply migrations
# and start the API.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
