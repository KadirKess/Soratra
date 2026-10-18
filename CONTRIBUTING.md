# Contributing to Soratra

Soratra is a reading journal for individuals and small circles of friends. Contributions should make keeping a reading journal easier while preserving that focus. There is no advertising, tracking, public follower graph, or recommendation feed.

Maintenance is occasional. Small, focused fixes are easier to review. Open an issue before starting a large feature or changing how reading activity is shared, so we can agree on the behavior first.

## Report a bug

Include the version you run (`docker compose exec app printenv SORATRA_VERSION`), your operating system and Docker version, steps to reproduce, and what you expected to happen. Use synthetic accounts and reading notes in examples. Remove credentials, reset and invite links, account exports, and personal reading data from logs and screenshots.

For a security vulnerability, use GitHub's private vulnerability reporting on this repository's Security tab. Do not publish an exploit or affected readers' data in a public issue.

## Set up a development instance

Use Node.js 24, npm, and Docker with Compose v2. Start from a fresh checkout and create a topic branch. Never point development at a real instance's database.

```sh
git clone https://github.com/KadirKess/Soratra.git
cd Soratra
git switch -c fix/your-change
echo 'POSTGRES_URL=postgres://soratra:soratra@localhost:5432/soratra' > .env
docker compose -f compose.dev.yaml up -d --wait
npm ci
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. The first visit shows the setup screen; the account you create there is the instance's admin. The development database uses a fixed password, listens only on `127.0.0.1:5432`, and that port must be free. Optional `.env.local` values override `.env`. [`.env.example`](.env.example) lists the other settings.

For public hosting, backups, and upgrades, use the [self-hosting guide](docs/SELF_HOSTING.md). Development servers and Drizzle Studio should stay on your local machine.

## Check a change

Run the checks relevant to your change before opening a pull request. The full quality checks are:

```sh
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

Vitest covers application logic using mocked external responses. It doesn't replace running the actual containers.

### Test the Docker installation

This builds the image from your checkout and runs the browser tests against the full stack, the way CI does. Port 3000 must be free; stop any development server first. Move a personal `.env` aside while you do this, because Compose reads it.

The test overlay sets `E2E=true`, which turns off rate limits, and swaps Open Library for a local fixture. Never use it on a real installation. The first browser test completes setup with open registration and a test admin, so always start from fresh volumes.

```sh
npx playwright install --with-deps chromium
export COMPOSE_PROJECT_NAME=soratra-contributor-tests
export COMPOSE_FILE=compose.yaml:compose.build.yaml:docker/compose.test.yaml
docker compose up -d --build --wait --wait-timeout 300
docker compose exec -T app soratra migrate
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

These tests drive real account, setup, invite, password reset, shelf, session, export, and friendship flows. The extra `soratra migrate` checks that migrations can safely run twice.

Inspect failures, then remove the test installation and its synthetic data:

```sh
docker compose logs --tail 200 init db app backup
docker compose down --volumes
```

The [CI workflow](.github/workflows/ci.yml) does the same on GitHub and also checks the rescue command, the first backup, readiness, and the downloadable source archive.

### Install scenarios

CI also runs whole installations in other shapes, each from its own throwaway folder and Compose project, with the scripts in `docker/ci/`:

- `lifecycle.sh` seeds the previous release, updates it to your image on the same volumes, restarts it, then moves it to a fresh install with a backup. Readers must stay signed in with their data intact throughout. It needs the release tags (`git fetch --tags`) and the published previous image.
- `fresh-install.sh` drives first-run setup in the browser, invite-only joining, and the admin settings.
- `caddy.sh` runs the HTTPS overlay in production mode with `DOMAIN=localhost`, and checks the optional settings and that rate limits use the address Caddy saw. It needs ports 80 and 443.
- `compose-config.sh` checks that every documented combination of compose files parses.

Build the image under the tag the scripts expect, then run any of them:

```sh
docker build -t ghcr.io/kadirkess/soratra:ci --build-arg SORATRA_VERSION=ci .
docker/ci/fresh-install.sh
```

## Make changes that fit the project

- Preserve the reader's local calendar date. Sessions and streaks use IANA time zones and `YYYY-MM-DD` text dates; do not replace them with UTC date slicing.
- Soratra stores no email addresses. Keep time zones private. Shared shelves and journal entries require an accepted friendship. Removing that connection must remove access immediately.
- Validate API inputs with Zod and use appropriate `TRPCError` codes. Preserve shared rate limits and optimistic concurrency for session edits.
- Keep reading notes, credentials, reset and invite tokens, and account identifiers out of operational logs.
- Use transactions for operations with multiple writes. Updates to users, library entries, and friendships must explicitly set `updatedAt`.
- Use the CSS variables in `src/app/globals.css`, the bundled Cormorant Garamond and DM Sans fonts, and existing reduced-motion behavior. Keep the paper-and-ink palette; do not add a dark mode.
- Keep comments short and explain non-obvious reasons. Avoid decorative separators, emojis, and generated-looking section headers.

### Database changes

Edit `src/server/db/schema.ts`, then generate and inspect the migration:

```sh
npm run db:generate
npm run db:migrate
```

Run migrations only against a safe development database. Commit the generated SQL and Drizzle metadata together. Do not hand-edit generated migrations or remove old migrations. Explain how existing data is preserved, and include a backup or recovery plan when a change could affect stored data.

## Open a pull request

Explain the problem, the resulting behavior, and how you checked it. Include screenshots for visible interface changes and call out configuration or migration changes. Keep unrelated edits in separate pull requests. Use conventional commit messages such as `fix: preserve a session note when editing`.

Add focused coverage when a change affects access control, dates, stored data, or another behavior likely to regress. Update the README or self-hosting guide when installation or operator settings change. Do not commit `.env`, database dumps, account exports, generated source archives, or browser output.

Contributions are provided under the project's [AGPLv3 license](LICENSE). Keep the attribution in [NOTICE](NOTICE), respect the [branding policy](TRADEMARKS.md), and retain third-party license notices.
