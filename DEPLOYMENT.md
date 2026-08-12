# Deploying to norgliders-app (NREC)

Target: `norgliders-app` on NREC, Ubuntu 24.04, `<VM_IP>`. Two phases:
**Phase 1** gets the app running today, reachable from the UiB network over
plain HTTP on port 3000 — no domain needed yet. **Phase 2** adds Caddy +
real HTTPS once a UiB subdomain exists and points at this IP.

Everything below assumes you're running commands as yourself, SSH'd into
the VM (`ssh ubuntu@<VM_IP>`, or whatever user NREC gave you).

## 0. Before you start: NREC security group changes

Via the NREC dashboard (Project → Compute → Instances → norgliders-app →
Security Groups), on top of what's already there:

- Add: `ALLOW IPv4 3000/tcp from 129.177.0.0/16` (Phase 1 — temporary)
- Once Phase 2 is live: add `ALLOW IPv4 443/tcp from 129.177.0.0/16`,
  remove the `3000/tcp` and `4000/tcp` single-IP rules (leftover from
  earlier ad-hoc testing) and the `3000/tcp` rule above.
- Leave the existing `22/tcp from 129.177.0.0/16` rule as-is for SSH.
- Postgres never gets a rule at all — it's never reachable outside the
  VM's internal Docker network, on either phase.

## 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```
Log out and back in (or `newgrp docker`) so your session picks up the
group change. Verify: `docker compose version`.

## 2. Clone the repo

```bash
git clone https://github.com/elyfant/OGDB-portal.git
cd OGDB-portal
```

## 3. Bring the real data over

`ogdb-test`'s data *is* the production dataset — this is a data carry-over,
not a fresh empty schema. From your **local machine** (where `ogdb-test` is
running):

Keep the dump outside the repo directory on both ends — it's the actual
database contents, and a git repo is the wrong place for it even briefly:

```bash
docker exec ogdb-test pg_dump -U postgres -d ogdb -F c -f /tmp/ogdb.dump
docker cp ogdb-test:/tmp/ogdb.dump ~/ogdb.dump
scp ~/ogdb.dump ubuntu@<VM_IP>:~/ogdb.dump
```

## 4. Set up production secrets

```bash
cp .env.production.example .env
```

Edit `.env` and fill in real values — **do not reuse the dev password or
JWT secret**:

```bash
# Generate a DB password and a JWT secret:
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Leave `DOMAIN` as a placeholder for now — it's only read by Caddy, which
isn't running yet in Phase 1.

Also uncomment `COOKIE_SECURE=false` in `.env`. This is Phase-1-only:
the login session cookie defaults to `Secure`, which browsers silently
refuse to store over plain HTTP — without this, login will appear to do
nothing (no error, just bounces back to the login page). Remove this
line again in Phase 2, once Caddy is serving real HTTPS.

## 5. Phase 1: start everything except Caddy

```bash
docker compose up -d --build postgres gateway dashboard
```

Then restore the data into the fresh container:

```bash
docker compose exec -T postgres pg_restore -U ogdb -d ogdb --no-owner --role=ogdb < ~/ogdb.dump
```

(`--no-owner`/`--role` because the dump's original role is `postgres`, not
the new `ogdb` production user — this remaps ownership on restore.)

Once you've confirmed the restore worked (query a table, check row counts),
delete the dump on both ends — no reason for a plaintext copy of the whole
database to sit around on disk:

```bash
rm ~/ogdb.dump           # on the VM
rm ~/ogdb.dump           # and back on your local machine
```

Temporarily expose the dashboard so it's reachable — open `docker-compose.yml`
and add a `ports` line under the `dashboard` service:
```yaml
  dashboard:
    ...
    ports:
      - "3000:3000"
```
Then `docker compose up -d dashboard`. The app is now live at
`http://<VM_IP>:3000` — reachable only from `129.177.0.0/16` per the
security group rule from step 0.

## 6. Set real passwords for the team

Check first — if you already ran `set-user-password` against `ogdb-test`
locally, those password hashes came over with the data dump and this step
is already done for you, Ailin, and Ilker:

```bash
docker compose exec -T postgres psql -U ogdb -d ogdb -c \
  "SELECT email, password_hash IS NOT NULL AS has_password FROM users;"
```

For anyone still showing `f`, or for new teammates added later, the
bootstrap script only exists as compiled JS at runtime (no `ts-node` in
the production image), but it works the same way:

```bash
docker compose exec gateway node dist/scripts/set-user-password.js \
  --email=someone@uib.no --password=your-choice
```
Same rule as before — nobody but the account owner should choose their own
password.

At this point: log in at `http://<VM_IP>:3000/login` and confirm it
all works — Fleet, Missions, status edits, the lot.

## 7. Phase 2: once the UiB subdomain exists

1. Confirm the DNS A record resolves: `dig +short ogdb.uib.no` should
   return `<VM_IP>`.
2. Set `DOMAIN=ogdb.uib.no` (or whatever you got) in `.env`.
3. Remove (or comment out) `COOKIE_SECURE=false` in `.env` — you're on
   real HTTPS now, the cookie should go back to `Secure`.
4. Remove the temporary `ports:` line from the `dashboard` service in
   `docker-compose.yml` — it goes back to internal-only.
5. `docker compose up -d` (starts Caddy too now).
6. Update the security group: add `443/tcp from 129.177.0.0/16`, remove
   the `3000/tcp` rule from step 0.

Caddy issues a Let's Encrypt cert automatically on first request to the
domain. If UiB's DNS host supports DNS-01 challenges via API, that's worth
switching to later — avoids ever needing port 80 open to the whole
internet just for certificate renewal (HTTP-01, Caddy's default, does need
that). Flag this back to me once the domain exists and I'll wire it up.

## Day-to-day ops

```bash
docker compose logs -f gateway      # tail logs for one service
docker compose ps                   # what's running
docker compose down                 # stop everything (data survives — it's in a volume)
git pull && docker compose up -d --build   # deploy a new version
```

Containers restart automatically on VM reboot (`restart: unless-stopped`),
as long as Docker itself starts on boot, which it does by default after
the install in step 1.
