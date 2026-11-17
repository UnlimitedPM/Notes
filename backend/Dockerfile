# Serveur Notes — image de production
FROM node:22-bookworm-slim AS build
# better-sqlite3 est un module natif : sans prébuild, node-gyp a besoin de ces outils.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p /data && chown -R node:node /data
USER node
ENV DATA_DIR=/data
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
