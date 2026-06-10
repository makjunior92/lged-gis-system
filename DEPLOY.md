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

The deploy workflow no longer uses a `production` environment gate, so deploys run automatically after merge without a separate approval step.

If you add a `production` environment later (**Settings → Environments**), leave **Required reviewers** empty for solo development — otherwise deploy jobs will wait for manual approval in Actions.

### 4. Branch rules for solo developers

**Important:** GitHub does **not** let you approve your own pull request — the **Approve** button is always disabled for the PR author. That is platform-wide, not a setting you can change.

As repo owner you can still **merge your own PR** without anyone else's approval. You do not need to click Approve.

Your private repo is on the **free GitHub plan**. Advanced branch rulesets (require PR + required reviews + bypass lists via API) need **GitHub Pro** or a **public** repository. Attempting to configure them returns:

`Upgrade to GitHub Pro or make this repository public to enable this feature.`

**Recommended setup on free private (matches your screenshot):**

| Rule | Setting |
| --- | --- |
| Restrict deletions | On |
| Block force pushes | On |
| Require a pull request before merging | Off *(simplest)* or On **without** "Require approvals" |
| Require status checks to pass | Optional — turn on after CI has run once |

**If "Require a pull request" is on:** expand it and ensure **Require approvals** is **off**. Then open PR → wait for green CI → click **Merge pull request** (ignore the gray Approve button).

**To test CI/CD without a PR:** push directly to `main`, or use **Actions → CI / Deploy to VPS → Run workflow**.

Repository settings already enabled via CLI: `delete_branch_on_merge`, `allow_update_branch`.

### 5. Branch protection (GitHub Pro or public repo only)

**Settings → Branches → Add rule** for `main`:

- Require a pull request before merging
- Require status checks: `Frontend build & lint`, `Backend smoke tests`
- Add yourself (or Repository admin role) to the **Bypass list** with mode **Always**

Then merges only deploy code that passed CI, and you can bypass review rules as admin.

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
