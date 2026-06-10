# Deployment & CI/CD

Production URL: **https://quantumflux.cloud/lged/** (after DNS + TLS).  
Direct VPS (legacy): `http://168.231.77.12:3000/lged/` (localhost-bound in prod compose).

## Domain setup (`quantumflux.cloud/lged`)

### You must do (Hostinger DNS)

Point the domain to your VPS IP:

| Type | Name | Value |
| --- | --- | --- |
| **A** | `@` | `168.231.77.12` |
| **A** | `www` | `168.231.77.12` |

Wait until `dig quantumflux.cloud +short` shows `168.231.77.12` (not another IP).

### Server `.env` (CORS)

On the VPS at `/opt/lged-gis-system/.env`:

```env
CORS_ORIGINS=https://quantumflux.cloud,http://quantumflux.cloud
```

Restart backend after editing: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend`

### What deploy does automatically

1. Builds frontend with base path `/lged/`
2. Binds Docker frontend to `127.0.0.1:3000` (not public)
3. Runs `deploy/scripts/setup-host-nginx.sh` — host nginx proxies `/lged/` → Docker
4. Certbot requests HTTPS when DNS is correct

Manual nginx setup: `bash /opt/lged-gis-system/deploy/scripts/setup-host-nginx.sh`

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

The deploy workflow no longer uses a `production` environment gate, so deploys run automatically after merge without a separate approval step.

If you add a `production` environment later (**Settings → Environments**), leave **Required reviewers** empty for solo development — otherwise deploy jobs will wait for manual approval in Actions.

### 4. Branch rules (configured for solo dev)

The repo is **public** and uses ruleset **`main-solo-dev`** on `main`:

| Rule | Setting |
| --- | --- |
| Restrict deletions | On |
| Block force pushes | On |
| Require a pull request before merging | On |
| Required approving reviews | **0** (no reviewer needed) |
| Required status checks | `Frontend build & lint`, `Backend smoke tests` |
| Bypass list | **makjunior92** + **Repository admin** (always) |

**Important:** GitHub does **not** let you **Approve** your own pull request — the Approve button stays gray for the PR author. That is platform-wide.

As owner you can still **merge your own PR** because required reviews are **0** and you are on the bypass list. Use **Merge pull request** — you do not need Approve.

**Day-to-day flow:** feature branch → PR → CI green → **Merge** → auto-deploy.

**Bypass:** as repo admin you can also push directly to `main` or merge even if a check is misconfigured.

**Manual workflow run:** **Actions → CI** or **Deploy to VPS → Run workflow**.

Repository settings: `delete_branch_on_merge`, `allow_update_branch`.

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
