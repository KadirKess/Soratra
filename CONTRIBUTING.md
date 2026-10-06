# Contributing to Soratra

Soratra is a reading journal for individuals and small circles of friends. Contributions should make keeping a reading journal easier while preserving that focus. There is no advertising, tracking, public follower graph, or recommendation feed.

Maintenance is occasional. Small, focused fixes are easier to review. Open an issue before starting a large feature or changing how reading activity is shared, so we can agree on the behavior first.

## Report a bug

Include the revision you run, your operating system and Docker version, steps to reproduce, and what you expected to happen. Use synthetic accounts and reading notes in examples. Remove credentials, email addresses, account exports, and personal reading data from logs and screenshots.

For a security vulnerability, use GitHub's private vulnerability reporting on this repository's Security tab. Do not publish an exploit or affected readers' data in a public issue.

## Set up a development instance

Use Node.js 24, npm, and Docker with Compose v2. Start from a fresh checkout, create a topic branch, and generate your own local configuration. Never use a hosted instance's environment file or database for development.

```sh
git clone https://github.com/KadirKess/Soratra.git
cd Soratra
git switch -c fix/your-change
node scripts/setup.mjs
docker compose -f compose.dev.yaml up -d --wait
npm ci
npm run db:migrate
npm run dev
```

Open `http://localhost:3000` and register a test account. The development database listens on `127.0.0.1:5432`; that port must be free. The setup script generates a private, ignored `.env` and refuses to overwrite an existing one. Optional `.env.local` values override `.env` for local development.

For public hosting, backups, and upgrades, use the [self-hosting guide](docs/SELF_HOSTING.md). Development servers and Drizzle Studio should stay on your local machine.

## Check a change

Run the checks relevant to your change before opening a pull request. The full quality checks are:

```sh
npm run typecheck
npm test
npm run test:setup
npm run build
npm audit --omit=dev --audit-level=high
```

Vitest covers application logic using mocked external responses. Setup tests exercise configuration generation and the launcher with simulated Docker commands. Neither replaces running the actual containers.

### Test the Docker installation

Use a separate checkout with its own generated `.env` for these tests. Install npm dependencies there and leave `APP_PORT`, `SITE_URL`, and `AUTH_URL` at their generated defaults. Port 3000 must be free; stop any local development server using it first.

The commands below create a dedicated Compose project and database volume. The test overlay enables `E2E=true` and adds a local Open Library fixture. Never use that overlay or enable `E2E` on a shared installation.

```sh
npx playwright install --with-deps chromium
docker compose -p soratra-contributor-tests -f compose.yaml -f docker/compose.test.yaml up -d --build --wait --wait-timeout 180
docker compose -p soratra-contributor-tests -f compose.yaml -f docker/compose.test.yaml run --rm migrate
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

These browser tests exercise the containerized application, its PostgreSQL database, and its book-metadata fixture through real account, shelf, session, export, and friendship workflows. The repeated migration command checks that migrations can run again safely.

Inspect failures and stop the test installation with the same project name and Compose files:

```sh
docker compose -p soratra-contributor-tests -f compose.yaml -f docker/compose.test.yaml logs --tail 200 app migrate scheduler
docker compose -p soratra-contributor-tests -f compose.yaml -f docker/compose.test.yaml down
```

Stopping this way preserves the test database volume. It contains synthetic accounts created by Playwright. The [CI workflow](.github/workflows/ci.yml) runs a fresh installation on GitHub and also checks readiness and the downloadable source archive.

## Make changes that fit the project

- Preserve the reader's local calendar date. Sessions and streaks use IANA time zones and `YYYY-MM-DD` text dates; do not replace them with UTC date slicing.
- Keep email addresses and time zones private. Shared shelves and journal entries require an accepted friendship. Removing that connection must remove access immediately.
- Validate API inputs with Zod and use appropriate `TRPCError` codes. Preserve shared rate limits and optimistic concurrency for session edits.
- Keep reading notes, credentials, reset tokens, and account identifiers out of operational logs.
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
