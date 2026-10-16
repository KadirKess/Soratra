# Self-hosting Soratra

Soratra is a web app and a PostgreSQL database, packaged as one Docker Compose file. It runs on anything with Docker: a laptop, a home server, a Raspberry Pi running a 64-bit system, or a small VPS. The machine has to stay on for people to use it.

The [README](../README.md#run-it) has the short version. This guide covers the rest.

## Install

In an empty folder:

```sh
curl -fsSLO https://github.com/KadirKess/Soratra/releases/latest/download/compose.yaml
docker compose up -d
```

Open <http://localhost:3000>. The first visit shows a setup screen where you create your account and choose who can join. That first account runs the instance.

Finish setup before you make Soratra reachable from other machines: until then, whoever opens the page first would become the person running it.

### What's running

| Service | What it does |
| --- | --- |
| `app` | Soratra itself. Applies database updates when it starts, then serves the app on port 3000. |
| `db` | PostgreSQL 16. Reachable only by the other services, never from outside. |
| `init` | Runs once on the first start to generate the database password, then exits. |
| `backup` | Writes a database backup to `./backups` once a day. |

Your data lives in two Docker volumes, `soratra_postgres_data` (the database) and `soratra_config` (the generated database password), plus the `./backups` folder. Stopping or restarting keeps all of them. Only `docker compose down --volumes` deletes the volumes, so don't add `--volumes` unless you mean it.

## Settings

Soratra needs none. To change a default, create `.env` next to `compose.yaml` and run `docker compose up -d` afterwards. Every setting is listed in [`.env.example`](../.env.example).

| Setting | Default | What it does |
| --- | --- | --- |
| `SORATRA_BIND` | `127.0.0.1` | The network address to listen on. `0.0.0.0` makes Soratra reachable from other devices. |
| `SORATRA_PORT` | `3000` | The port on this machine. |
| `SORATRA_VERSION` | `1` | Which release to run: `1` follows 1.x, `1.2` stays on 1.2.x, `1.2.0` pins one release. |
| `DOMAIN` | | Your domain, used by `compose.caddy.yaml`. |
| `KEEP_BACKUPS` | `7` | How many daily backups to keep. |
| `SITE_URL` | | Your public address, such as `https://books.example.org`. Only used for link previews and the sitemap. Soratra otherwise answers on whatever address it is reached at. |
| `SEARCH_INDEXING` | `false` | `true` lets search engines index the landing and legal pages. Signed-in pages are never indexed. |
| `TRUSTED_PROXY_IP_HEADER` | | Behind your own reverse proxy, a header it overwrites with the visitor's address, such as `x-real-ip`. Never `x-forwarded-for`. |
| `SECURITY_CONTACT`, `SECURITY_EXPIRES` | | A `mailto:` or `https://` contact and a future date such as `2027-12-31T00:00:00Z`. Together they publish `/.well-known/security.txt`. |
| `SOURCE_CODE_URL` | | Only if you modified Soratra and host the source elsewhere. See [License](#license-and-modified-versions). |

Your name, how readers can reach you, and who can join are not in `.env`. They live in the database and are changed on the admin page.

## Reaching it from other devices

Set `SORATRA_BIND=0.0.0.0` in `.env` and run `docker compose up -d`. Soratra is then at `http://<this machine's address>:<port>` on your network. Phones and laptops on the same Wi-Fi can use it right away.

[Tailscale](https://tailscale.com) is a good way to reach it from anywhere: install it on the server and your devices, and use the server's Tailscale name. Nothing is exposed to the public internet.

Over plain HTTP on a home network, Soratra cannot tell visitors apart for rate limiting, so everyone shares one budget of sign-in attempts. That is fine for a household. A public instance should sit behind HTTPS, as described next.

## HTTPS on your own domain

The Caddy overlay gives you HTTPS with automatic certificates. You need:

- a domain or subdomain whose DNS points at this server,
- ports 80 and 443 free and open to the internet.

Then:

```sh
curl -fsSLO https://github.com/KadirKess/Soratra/releases/latest/download/compose.caddy.yaml
echo "DOMAIN=books.example.org" >> .env
docker compose -f compose.yaml -f compose.caddy.yaml up -d
```

Use the same two `-f` arguments for every later command on this install, or set `COMPOSE_FILE=compose.yaml:compose.caddy.yaml` in `.env` so plain `docker compose` picks up both.

The overlay sets `SITE_URL` and the trusted proxy header for you. Keep `SORATRA_BIND` at its default, so the app is only reachable through Caddy.

### Using your own reverse proxy

If you already run Traefik, nginx, Nginx Proxy Manager, or Cloudflare Tunnel, point it at Soratra's port instead of using the overlay:

- If the proxy runs on the same machine, keep `SORATRA_BIND=127.0.0.1`. Otherwise bind to an address only the proxy can reach.
- Have the proxy overwrite a header such as `X-Real-IP` with the visitor's address, and set `TRUSTED_PROXY_IP_HEADER=x-real-ip`. Don't trust a header the proxy merely appends to.
- Set `SITE_URL` to your public address.
- Pass the `Host` and `X-Forwarded-Proto` headers through. Sign-in uses them to build its own links.

## Readers and accounts

Soratra doesn't send email. The person who runs the instance looks after joining and forgotten passwords from **Profile → Manage members**:

- **Who can join.** *Only people I invite* (the default) or *Anyone who can open this page*. Open sign-up is fine on a private network; on a public domain, invite-only keeps strangers out.
- **Invite links.** Each one works once and expires after seven days. Send it any way you like.
- **Password reset links.** For a reader who forgot their password. The link works once, for 24 hours. Their old password stops working when they choose a new one, and they are signed out everywhere.
- **Your name and contact.** Shown on the support, privacy, and forgot-password pages so readers know who to ask.

The admin page shows usernames and join dates only. It never shows anyone's shelves, journal, or password.

The account that runs the instance can't be deleted from the app, so the instance is never left without someone to run it. If you lose its password, the rescue command prints a reset link from the server:

```sh
docker compose exec app soratra reset-link <your-username>
```

Accounts sign in with a username and password. Usernames aren't case-sensitive. Each instance is separate: accounts and friendships don't carry over between instances.

## Backups and restore

The `backup` service takes a backup when it starts if there isn't one from the last 23 hours, then checks every hour. Files are named `soratra-YYYY-MM-DD-HHMM.dump` and are only readable by their owner. On Linux they belong to root, so use `sudo` to copy them.

A backup on the same disk doesn't survive that disk. Copy `./backups` to another machine or cloud storage now and then.

To take an extra backup right now, for example before an update:

```sh
docker compose exec backup pg_dump --format=custom --file=/backups/before-update.dump
```

To restore one, stop the app, restore into the database, and start the app again:

```sh
docker compose stop app
docker compose exec backup pg_restore --clean --if-exists --no-owner --dbname=soratra /backups/soratra-2026-10-16-0300.dump
docker compose start app
```

This replaces everything in the database with the backup's contents, including accounts and settings. The backup contains everything Soratra needs, the sign-in secret included, so it restores onto a fresh install too.

To move to another machine: install there, stop its app, copy a backup into its `./backups` folder, and restore as above.

## Updates

```sh
docker compose pull
docker compose up -d
```

The app applies any database changes when it starts. The daily backup covers you, but a fresh one before a big update doesn't hurt (see above). Going back to an older release after its database has been updated isn't supported; restore a backup taken before the update instead.

`SORATRA_VERSION` decides how far updates go. The default `1` follows every 1.x release; a new major version is never pulled in automatically. Release notes are on the [releases page](https://github.com/KadirKess/Soratra/releases). Download the new `compose.yaml` from there too when the notes say it changed.

## Building from source

To run your own changes, clone the repository and build the image locally:

```sh
docker compose -f compose.yaml -f compose.build.yaml up -d --build
```

## Using an existing PostgreSQL

Set `POSTGRES_URL` in the app's environment to use your own database server instead of the bundled one, for example `postgres://soratra:password@db.internal:5432/soratra`. PostgreSQL 16 or newer works. Then remove the `db`, `init`, and `backup` services and the app's `depends_on` from your copy of `compose.yaml`. Backups become yours to arrange.

## Data and privacy

Account deletion removes reading data, friendships, and reset links immediately. A pseudonymized account record remains for 30 days, then the app purges it in its daily cleanup. Backups can still hold earlier data until they rotate out. Tell your readers how long you keep backups.

Backups and account exports contain personal data. Keep them private.

The account export is JSON format version `1.7`, with shelf entries and finish dates, sessions, freezes, and current friendships. It's an archive for the reader; there is no import yet.

Book search and metadata come from Open Library. Requests are made by the server and don't include readers' IP addresses. Covers load through the app's image proxy. Saved shelves and journals don't depend on Open Library being up.

Soratra keeps short operational logs (`docker compose logs app`) without reading notes or account identifiers, and collects first-party page-speed figures with no account or persistent identifier. There are no ads or third-party analytics.

`/api/health` reports whether the app and its database are ready; Docker uses it to mark the app healthy.

## License and modified versions

Soratra is licensed under the [GNU AGPLv3](../LICENSE). Every instance offers its exact source as a download on its About page. If you modify Soratra and let other people use it, that archive keeps you covered as long as you build from your modified source. If you host the source elsewhere instead, set `SOURCE_CODE_URL` to it; a link to the upstream repository alone isn't enough for a modified version.

## What Soratra doesn't do

Instances don't connect to each other. There is no journal import, offline book catalog, native app, or email of any kind.

## Contributor setup

Working on Soratra itself? See [CONTRIBUTING.md](../CONTRIBUTING.md).
