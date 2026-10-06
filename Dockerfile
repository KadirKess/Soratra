# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

FROM dependencies AS tools
COPY src ./src
COPY drizzle ./drizzle
COPY tsconfig.json drizzle.config.ts ./
COPY docker/purge-loop.mjs ./docker/purge-loop.mjs
COPY LICENSE ./LICENSE
COPY NOTICE TRADEMARKS.md ./
COPY LICENSES ./LICENSES
USER node
CMD ["node_modules/.bin/tsx", "src/server/db/migrate.ts"]

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build /app/LICENSE ./LICENSE
COPY --from=build /app/NOTICE /app/TRADEMARKS.md ./
COPY --from=build /app/LICENSES ./LICENSES
COPY --from=build /app/docker/healthcheck.mjs ./docker/healthcheck.mjs
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 CMD ["node", "docker/healthcheck.mjs"]
CMD ["node", "server.js"]
