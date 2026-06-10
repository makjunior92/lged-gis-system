# Deployment & CI/CD

Production runs on the Hostinger VPS at `http://168.231.77.12:3000`.

## How it works

| Event | What runs |
| --- | --- |
| Pull request → `main` | **CI** — frontend build/lint, backend Docker smoke tests |
| Merge / push to `main` | **Deploy** — rsync code to VPS, rebuild containers, health check |

Your day-to-day flow:

```bash
git checkout -b feature/my-change
# ... develop, commit, push ...
# Open PR on GitHub → CI must pass
# Merge PR → auto-deploy to VPS (~3–5 min)
```

## One-time setup

### 1. VPS `.env` (already done if you deployed manually)

On the server at `/opt/lged-gis-system/.env`:

```env
POSTGRES_PASSWORD=<strong-random>
JWT_SECRET_KEY=<strong-random>
CORS_ORIGINS=http://168.231.77.12:3000
```

Generate secrets:

```bash
openssl rand -base64 32
```

**Never commit `.env`.** CI/CD excludes it from rsync so server secrets stay put.

### 2. GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
| --- | --- |
| `VPS_HOST` | `168.231.77.12` |
| `VPS_USER` | `root` |
| `VPS_SSH_PRIVATE_KEY` | Full private key (see below) |

#### Recommended: dedicated deploy key

On your Mac:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/lged-deploy -N "" -C "github-actions-lged-deploy"
```

Add the **public** key to the VPS:

```bash
ssh root@168.231.77.12 "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
cat ~/.ssh/lged-deploy.pub | ssh root@168.231.77.12 "cat >> ~/.ssh/authorized_keys"
```

Copy the **private** key into GitHub secret `VPS_SSH_PRIVATE_KEY`:

```bash
cat ~/.ssh/lged-deploy
```

Paste the entire block including `-----BEGIN` / `-----END` lines.

You can reuse your existing `~/.ssh/id_ed25519` instead, but a deploy-only key is safer.

### 3. GitHub environment (optional)

The deploy workflow uses a `production` environment. In **Settings → Environments → production** you can:

- Require manual approval before deploy
- Restrict deploys to the `main` branch

If you skip creating the environment, GitHub creates it automatically on first deploy.

### 4. Branch protection (recommended)

**Settings → Branches → Add rule** for `main`:

- Require a pull request before merging
- Require status checks: `Frontend build & lint`, `Backend smoke tests`

Then merges only deploy code that passed CI.

## Manual deploy (fallback)

If CI/CD is unavailable:

```bash
rsync -avzr --delete \
  --exclude '.git/' --exclude '.env' \
  --exclude 'frontend/node_modules/' --exclude 'db_data/' \
  ./ root@168.231.77.12:/opt/lged-gis-system/

ssh root@168.231.77.12 \
  'cd /opt/lged-gis-system && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build'
```

## Production vs dev

Use both compose files on the VPS:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml` closes backend/db ports, disables hot reload, and reads `CORS_ORIGINS` from `.env`.

Local development stays:

```bash
docker compose up -d --build
```

## Troubleshooting

**Deploy fails at rsync** — check `VPS_SSH_PRIVATE_KEY`, `VPS_HOST`, and that the public key is in VPS `authorized_keys`.

**Deploy succeeds but site broken** — SSH in and run:

```bash
cd /opt/lged-gis-system
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100
```

**Login fails after deploy** — confirm `CORS_ORIGINS` in server `.env` matches the URL in the browser exactly (including `http://` and port).

**Database wiped accidentally** — never run `docker compose down -v` in production; `-v` deletes the `db_data` volume.
