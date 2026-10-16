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
# The runtime image has no dev dependencies, so the two command-line tasks are
# bundled into single files.
RUN node_modules/.bin/esbuild src/server/db/migrate.ts --bundle --platform=node --format=cjs --target=node24 --log-level=warning --outfile=cli/migrate.cjs \
 && node_modules/.bin/esbuild src/scripts/resetLink.ts --bundle --platform=node --format=cjs --target=node24 --log-level=warning --outfile=cli/reset-link.cjs

FROM base AS runtime
ARG SORATRA_VERSION=dev
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 SORATRA_VERSION=$SORATRA_VERSION
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build /app/cli ./cli
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/LICENSE /app/NOTICE /app/TRADEMARKS.md ./
COPY --from=build /app/LICENSES ./LICENSES
COPY --from=build /app/docker/healthcheck.mjs ./docker/healthcheck.mjs
COPY --chmod=755 docker/soratra.sh /usr/local/bin/soratra
# /config holds the generated database password; a named volume mounted there
# inherits this ownership.
RUN mkdir -p .next/cache /config && chown node:node .next/cache /config
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 CMD ["node", "docker/healthcheck.mjs"]
CMD ["soratra", "start"]
