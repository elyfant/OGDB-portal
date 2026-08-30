# Local development workflow

The repeatable cycle for making a change to `OGDB-portal`, from edit to
deployed. See `DEPLOYMENT.md` for what happens on the server side.

## Cross-project context: OGDB design notes

`OGDB-portal`'s gateway reads/writes the same production database that
`~/projects/OGDB` (a separate repo, Alembic migrations + backfill scripts)
defines and evolves. Claude Code doesn't share memory or CLAUDE.md context
across separate git repos, so without help a session working here has no
way to know about schema decisions made over there.

Fix: a symlink into `.claude/rules/`, which Claude Code loads automatically
every session. It's gitignored (machine-local, points at an absolute path
that only resolves on this machine) — recreate it after a fresh clone or on
a new machine:

```bash
mkdir -p .claude/rules
ln -s ~/projects/OGDB/alembic/design-notes.md .claude/rules/ogdb-design-notes.md
```

See `docs/design/build-hierarchy.md` for the summary this unlocked.

## Cross-project context: norgliders (facility planning)

Same problem, one level up: `~/projects/norgliders` holds the facility-wide
system map, open cross-repo dependency questions, and architecture
decisions — none of it visible to a session started here without help.

```bash
ln -s ~/projects/norgliders/dependencies.md .claude/rules/norgliders-dependencies.md
ln -s ~/projects/norgliders/decisions .claude/rules/norgliders-decisions
```

## 0. Ground rule: no real data entry locally

`ogdb-test` (local) and production (the VM) are two different databases
now, and they will diverge — that's expected. **Real operational data
(actual mission updates, actual status changes) only ever gets entered
through the production app.** Local `ogdb-test` is a sandbox for testing
features — fine to make a mess of it, nothing there is "real" anymore.

If local data starts feeling too stale/unrealistic to test against
meaningfully, refresh it *from* production (never the other way):
```bash
# on the VM
docker compose exec postgres pg_dump -U ogdb -d ogdb -F c -f /tmp/prod.dump
docker compose cp postgres:/tmp/prod.dump ~/prod.dump

# on your local machine
scp nrec_app:~/prod.dump ~/prod.dump
docker exec -i ogdb-test pg_restore -U postgres -d ogdb --clean --if-exists < ~/prod.dump
rm ~/prod.dump

# back on the VM, same cleanup habit as always
ssh nrec_app "rm ~/prod.dump"
```

## 1. Edit

VS Code (or whatever), in `~/projects/OGDB-portal`, same as always.

## 2. Test locally — dev mode

One-time setup, only needed for the calibration certificate parser
(`gateway/scripts/parse_certificate.py`, invoked by the gateway as a
subprocess — Debian's system Python refuses global `pip install`
per PEP 668, hence the venv):
```bash
cd ~/projects/OGDB-portal/gateway
python3 -m venv .venv-parse
.venv-parse/bin/pip install pdfplumber python-dateutil
```
The gateway finds it automatically at `gateway/.venv-parse/bin/python3`
(no env var needed) as long as it's started via `npm run start:dev`
from the `gateway/` workspace. The Docker image builds its own venv at
a fixed path instead (see `Dockerfile.gateway`).

Two terminals, fast iteration with hot reload:

```bash
cd ~/projects/OGDB-portal/gateway
npm run start:dev
```
```bash
cd ~/projects/OGDB-portal/dashboard
npm run dev
```

Points at local `ogdb-test`. This is where you'll do most of your actual
testing — but it does **not** prove the change will work in production.
Dev mode (`ts-node`/`next dev`) is a different code path than the
compiled production build — three separate bugs this week (entry-point
paths, Next's standalone tracing, the Secure-cookie issue) only ever
showed up in a production build, never in dev mode. Step 3 exists
specifically to catch that class of bug before it reaches the VM.

## 3. Build the production images locally

From the repo root (`~/projects/OGDB-portal`):

```bash
docker compose build gateway dashboard
```

This runs both `Dockerfile.gateway` and `Dockerfile.dashboard` through an
actual production build (`nest build` / `next build`), the same as what
will happen on the VM. If it fails here, it would have failed there too —
much cheaper to find out now.

Optional but worth it before anything non-trivial: actually run the
built images and click through the app, same as dev mode but against the
compiled build. Point them at `ogdb-test` directly rather than spinning
up a separate empty database just for this check:

```bash
docker run -d --name gw-check --network host \
  -e DATABASE_URL="postgresql://postgres:devpassword@localhost:5433/ogdb" \
  -e JWT_SECRET="local-build-check-only" -e PORT=3001 \
  ogdb-portal-gateway

docker run -d --name db-check --network host \
  -e API_URL="http://localhost:3001" -e PORT=3000 \
  ogdb-portal-dashboard
```
Then `http://localhost:3000` as usual.

```bash
docker rm -f gw-check db-check   # when done — this is local
                                  # verification only, don't leave it running
```

## 4. Push

```bash
git add -A
git commit -m "describe what changed"
git push origin main
```

## 5. Deploy (separate, deliberate step — not automatic)

Pushing to GitHub does not update the server. When you're actually ready
for the team to see the change, see `DEPLOYMENT.md`'s "Day-to-day ops"
section:

```bash
ssh nrec_app
cd ~/OGDB-portal
git pull && docker compose up -d --build
```
