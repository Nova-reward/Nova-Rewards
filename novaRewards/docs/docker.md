# Docker — Build & Run Guide

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2+

---

## 1. Environment setup

Copy the example env file and fill in your values. Secrets are never baked into
the image — they are mounted at runtime via `env_file`.

```bash
cp .env.example .env
# edit .env with your Stellar keys, DATABASE_URL, etc.
```

The `DATABASE_URL` in `.env` is overridden by Compose to point at the internal
`postgres` service, so you only need to set it for local non-Docker use.

---

## 2. Build the image

```bash
# from Nova-Rewards/novaRewards/
docker build -t nova-rewards-api ./backend
```

The Dockerfile uses a two-stage build:

| Stage | Base | Purpose |
|-------|------|---------|
| builder | node:20-alpine | Installs all deps, copies source |
| runner | node:20-alpine | Production deps only + app source |

---

## 3. Run with Docker Compose

```bash
# from Nova-Rewards/novaRewards/
docker compose up --build
```

Services started:

| Service | Port(s) | Description |
|---------|---------|-------------|
| api | 3001 | Nova Rewards backend |
| postgres | 5432 | PostgreSQL 16 |
| redis | 6379 | Redis 7 |
| mailhog | 1025 / 8025 | SMTP trap + web UI |

The PostgreSQL service is configured with WAL archiving enabled, and the backend
now writes encrypted base backups to `./backups/base` while PostgreSQL archives
encrypted WAL segments to `./backups/wal`.

Stop everything:

```bash
docker compose down
```

Stop and remove volumes (wipes the database):

```bash
docker compose down -v
```

---

## 4. Run database migrations

Migrations live in `database/` and are run with `migrate.js`.

### Inside a running Compose stack

```bash
docker compose exec api node /app/../database/migrate.js
```

Or run a one-off container that shares the same network:

```bash
docker compose run --rm \
  -v "$(pwd)/database:/database" \
  api node /database/migrate.js
```

### Standalone (no Compose)

```bash
DATABASE_URL=postgresql://nova:nova@localhost:5432/nova_rewards \
  node database/migrate.js
```

---

## 5. Useful commands

```bash
# Tail API logs
docker compose logs -f api

# Open a psql shell
docker compose exec postgres psql -U nova -d nova_rewards

# MailHog web UI
open http://localhost:8025
```
