# Self-hosting Soratra

Soratra runs as a web server backed by PostgreSQL. Docker packages both, but the computer or server hosting them must stay running for readers to access the app.

Use a current Docker Engine or Docker Desktop with Compose v2. Installations build the application from this repository; there is no published container image required by this guide.

## Local installation

Run the launcher from the repository root. It checks Docker, asks only for a port, and saves ignored configuration with unique database, authentication, and cleanup secrets. Keep `.env` private and retain a protected copy with your backups.

```sh
./soratra.sh
```

Open the address printed by the launcher and create an account. The default port is 3000; if it is occupied, first launch checks the next ports. An explicitly requested `--port` must be available. Inspect startup and cleanup with `docker compose logs app migrate scheduler`. The helper uses Docker's Node.js image; host Node.js is optional. With Node.js 24 installed, `node scripts/setup.mjs` performs the same setup.

Local mode accepts matching loopback `SITE_URL` and `AUTH_URL` origins. Email can be disabled for a personal installation. Registration and journaling work without delivery; password recovery cannot send email. Password reset links are not printed to logs.

The app port binds to localhost. PostgreSQL stays on the internal Compose network and stores its data in a named volume. Stopping containers preserves this volume.

```sh
./soratra.sh stop
./soratra.sh
```

Use `./soratra.sh configure` to edit saved settings, or pass `--port 3030`, `--name 'Your name'`, and `--support-email reader@example.org` when launching. Pass `--support-email ''` to clear the optional address. Existing credentials are preserved. `--yes --no-open` accepts defaults without prompts and leaves the browser closed. `--no-color` or `NO_COLOR=1` disables terminal colors. Build and startup output is reduced to progress steps; `--verbose` shows Docker output, and failures always show the relevant command output. `advanced` offers optional hosting details: your name or organisation and a contact email appear on the legal and support pages. Personal installations can keep the defaults. Open Library book search needs no API key.

Use `./soratra.sh advanced` for a separate settings menu:

- **Personal details:** the name and contact displayed on legal and support pages.
- **Local port:** a free port for access on this computer.
- **Email recovery:** keep it disabled, or configure a verified Resend sender and enter the API key without echoing it.
- **Public hosting:** switch between localhost and a public domain. Public hosting requires real contact details, verified email delivery, DNS pointing to the host, and free ports 80 and 443 for the HTTPS proxy.
- **Security and source:** set a reporting contact, future expiry, and optional HTTPS source link. Leave the source link blank to use the bundled archive.
- **Runtime:** choose a database connection limit between 1 and 20 and whether search engines may index the public pages. Authenticated pages remain private.

The menu stages changes until you review them and explicitly save. Invalid or incomplete public configurations leave `.env` unchanged. Saving does not launch or restart containers; run `./soratra.sh` afterward to apply the settings. Switching back to local hosting removes the public proxy from this Compose project. Database, authentication, and cleanup credentials are preserved. Rotate those credentials separately with a backup and planned restart; the menu deliberately does not offer rotation.

`./soratra.sh status` shows containers, `logs` follows app and scheduler output, and `update` builds and migrates before restarting. Back up first; updates prompt for confirmation, or accept `update --yes` for unattended use. The launcher never deletes database volumes. It does not install Docker, configure public DNS, or create email credentials. Continue below for public hosting.

The lower-level `./scripts/setup.sh` and Compose commands remain available for operators who prefer them.

Keep the same Compose project name when restarting. Do not add `--volumes` to the stop command, which would remove stored data. For local installations, the launcher keeps the two origin settings in sync when changing the port. Public HTTPS origins remain unchanged. Public instances saved with `DEPLOYMENT_MODE=public` automatically use the public Compose overlay; configure domain and email settings manually as described below.

## Shared internet-facing installation

Use a domain you control and an HTTPS reverse proxy. Configure `DEPLOYMENT_MODE=public`, matching HTTPS `SITE_URL` and `AUTH_URL`, and `EMAIL_MODE=resend`. Set `RESEND_API_KEY` and `EMAIL_FROM` to your own verified Resend sender. Other email providers and general SMTP are not supported.

The supplied Caddy configuration needs DNS pointing at this server and inbound ports 80 and 443. In `.env`, set `PUBLIC_HOST` to the hostname without `https://` and set both origins to `https://` followed by that hostname. Set `PUBLIC_DEPLOYMENT=production`. Then start the public stack:

```sh
docker compose -f compose.yaml -f compose.public.yaml up -d --build --wait
```

The public overlay selects public deployment mode, Resend delivery, and trusted `x-real-ip` forwarding. Add the same two `-f` arguments to subsequent Compose commands for this installation. Caddy's certificate state has its own persistent volumes.

Set `LEGAL_NAME` and `SUPPORT_EMAIL` to your operator details. Review the application's legal and privacy pages against your hosting region, access policy, backup retention, and email provider before inviting readers. Default copy cannot establish your compliance.

The application ignores forwarding headers unless `TRUSTED_PROXY_IP_HEADER` is configured. The supplied proxy uses `x-real-ip`, overwrites the incoming value, and forwards the client address. Keep direct access to the app restricted so visitors cannot bypass that proxy and supply a trusted header themselves.

An optional reporting channel uses `SECURITY_CONTACT`, which defaults to the support mail address, and a future ISO date in `SECURITY_EXPIRES`. The `/.well-known/security.txt` route is unavailable without a valid future expiry. Renew it before it expires.

The About page offers a source archive built from this application's source files. If you set `SOURCE_CODE_URL` instead, ensure it provides the corresponding source for the version you actually run, including your changes. An upstream repository link alone does not satisfy AGPL obligations for a modified installation.

## Data and maintenance

Account deletion removes reading data, friendship records, and reset tokens immediately. A pseudonymized account tombstone remains for 30 days. The scheduler cleans expired tombstones and rate-limit buckets on startup and once a day after success, retrying failed requests after five minutes. Check scheduler logs after installation and upgrades.

Reading data may also remain in backups until your retention period ends. Tell your readers what that period is. Database dumps and exported journals contain personal data; store them outside the repository and limit access.

The account export is JSON format version `1.7`, including shelf entries and finish dates, sessions, freezes, and non-deleted friendships. It is an archive for the reader. There is currently no UI for importing it into another instance.

Use the application's health endpoint at `/api/health` to check readiness. A failed database connection or invalid deployment configuration makes the instance unhealthy; inspect app logs rather than bypassing the check.

### Backups and restore

Back up the PostgreSQL database before every upgrade. Keep a copy of the instance configuration too; a database dump does not contain the application's authentication and email configuration.

For the local stack, create a private destination outside the checkout and take a custom-format dump:

```sh
mkdir -p ../soratra-backups
chmod 700 ../soratra-backups
umask 077
docker compose exec -T db pg_dump -U soratra -d soratra -Fc > ../soratra-backups/soratra.dump
```

Use a new filename for each backup you want to retain. A failed dump can leave a partial file; check the command's exit status before relying on it.

Test restoration into a separate empty database, then compare accounts, journal entries, and an export with the original. Do not use a production database for this test. Backup success alone does not prove restoration works.

From a separate checkout with a newly generated `.env`, use a distinct project name:

```sh
docker compose -p soratra-restore up -d --wait db
docker compose -p soratra-restore exec -T db pg_restore -U soratra -d soratra --no-owner --no-acl --exit-on-error < ../soratra-backups/soratra.dump
```

Before starting that restored app, choose a different `APP_PORT` and matching loopback origins so it does not conflict with the original. Start it with the same `-p soratra-restore` argument. Do not initialize the restored database with migrations before `pg_restore`; the dump contains its schema and migration history.

Changing a database password in the environment file does not rotate the password in an existing PostgreSQL volume. Initialization variables only initialize an empty volume. Rotate credentials deliberately in PostgreSQL and then update the app configuration.

### Upgrades

Use a release tag or reviewed revision and keep your current version recorded. Back up first, stop the application while applying migrations, explicitly run the migration job for the new version, and then start the application. A previous successful migration container does not prove that the new version's migrations ran.

After checking out the new version, run the helper. It builds the new images, stops the app and scheduler, runs migrations against the healthy database, and restarts services only if migration succeeds:

```sh
./scripts/upgrade.sh
```

For the public stack use `./scripts/upgrade.sh -f compose.yaml -f compose.public.yaml`. If migration fails, inspect the output and keep the app stopped until the problem is resolved.

Keep every checked-in migration and its Drizzle metadata. The single initial Git commit does not replace the database migration sequence. Recovery after a schema change needs a reviewed forward fix or restoration plan; blindly starting older application code can fail against a newer schema.

## Contributor setup

Use Node.js 24 LTS and npm. Generate configuration in a fresh checkout with `node scripts/setup.mjs`, then copy `.env` to `.env.local` if you want separate local Next.js overrides. Never copy a hosted instance's environment file into a test installation.

Start the database-only Compose stack, install dependencies, and migrate before starting Next.js. This stack exposes PostgreSQL on `127.0.0.1:5432`. Do not run it alongside another database already using that port. Next.js and database npm scripts load `.env` and optional `.env.local` overrides.

```sh
node scripts/setup.mjs
docker compose -f compose.dev.yaml up -d --wait
npm ci
npm run db:migrate
npm run dev
```

For a schema change, edit `src/server/db/schema.ts`, run `npm run db:generate` with your local environment, inspect the generated migration, and run `npm run db:migrate` on a safe database. Do not hand-edit generated migrations.

### Verification

```sh
npx tsc --noEmit
npm test
npm run test:setup
npm run build
npm audit --omit=dev --audit-level=high
```

The Open Library unit tests use mocked responses. Playwright uses a local Open Library fixture server and generates test accounts. Configure a separate disposable PostgreSQL database, apply migrations to it, and install Chromium with `npx playwright install chromium` before `npm run test:e2e`. Never point Playwright at a production database. `E2E=true` bypasses application rate limits and must not be enabled on a shared instance.

## Network dependencies and limitations

Book search and metadata use Open Library; cover images come from its cover service through Next.js image optimization. The server-side metadata client does not forward readers' IP addresses. Your saved shelves and journal do not require fresh metadata lookups on each visit.

Resend handles password-reset delivery when enabled. Configure operational logs and backups privately; the app's logs deliberately avoid reading notes and account identifiers. There is no analytics or advertising integration.

This distribution is a self-hosted web app. It does not include federation between instances, journal import, an offline catalog, a native app, billing, or automatic device synchronization between separate installations.
