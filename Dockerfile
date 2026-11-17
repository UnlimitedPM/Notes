# Image unique : PWA compilée + API Fastify dans le même processus.

# 1. Build du frontend
FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. Build du backend
FROM node:22-bookworm-slim AS backend
# better-sqlite3 est un module natif : sans prébuild, node-gyp a besoin de ces outils.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev

# 3. Image finale
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=backend /app/node_modules ./node_modules
COPY --from=backend /app/dist ./dist
COPY --from=backend /app/package.json ./
COPY --from=frontend /app/dist ./public
RUN mkdir -p /data && chown -R node:node /data
USER node
ENV DATA_DIR=/data
ENV STATIC_DIR=/app/public
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
