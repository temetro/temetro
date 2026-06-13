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
EXPOSE 4000
# Apply migrations, then start the API.
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
