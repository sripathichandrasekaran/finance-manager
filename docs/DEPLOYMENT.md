# FinanceManager — Deployment

FinanceManager is deployed to the **same VPS that hosts Pilot Messenger
(ReplyPilot)** at `187.127.219.52`, served as the subdomain
**`finance.pilotmessenger.com`**. The two apps share the host's nginx edge
(TLS), but are otherwise isolated: FinanceManager runs in its own Docker
Compose stack (`finance_*` containers on their own network + volume), owns its
own loopback ports, and never touches the `pilot_*` services.

## Topology

```
Internet
   │  https://finance.pilotmessenger.com
   ▼
Host nginx (TLS edge, Certbot)          ← serves BOTH pilotmessenger.com and finance.pilotmessenger.com
   │  /api → http://127.0.0.1:8001
   ▼  other  → http://127.0.0.1:4001
finance_backend (uvicorn :8001)   ← FastAPI, SQLite on volume finance_db
finance_frontend (nginx :4001)    ← built SPA (Vite dist)
```

- Containers bind to **127.0.0.1** only — never reachable from the internet
  except through nginx. Same posture as ReplyPilot.
- Port **8001** is used for the backend and **4001** for the frontend so the
  two stacks never collide (ReplyPilot owns 8000 / 4000).
- Data lives in the `finance_db` Docker volume at `/app/data/finance.db`
  (SQLite). Everything else is disposable and rebuilt on every deploy.

## 1. Prerequisites on the VPS

Everything below is already installed because Pilot Messenger lives there, but
listed for completeness:

- Docker + Docker Compose v2.24+
- nginx (host-level, owns 80/443 — Certbot-driven TLS)
- Certbot with the nginx plugin
- Git

## 2. One-time server setup

### 2.1 Clone the repo

```bash
cd ~
git clone git@github.com:<org>/finance-manager.git
cd finance-manager
```

Use **SSH** for the remote — `deploy.sh` does a `git pull origin main`. GitHub
**deploy keys are per-repo**, so the key ReplyPilot uses cannot be reused here
(GitHub rejects it with "key is already in use"). Generate a separate
read-only deploy key for this repo:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/finance_deploy_key -N '' -C 'finance-manager-deploy'
cat ~/.ssh/finance_deploy_key.pub   # paste into GitHub → repo → Settings → Deploy keys (Allow write access: NO)
```

Then clone and pin the repo to that key, so it never collides with ReplyPilot's
key in `~/.ssh/config`:

```bash
git clone git@github.com:<org>/finance-manager.git
cd finance-manager
git config core.sshCommand "ssh -i /root/.ssh/finance_deploy_key -o IdentitiesOnly=yes"
ssh -T git@github.com   # greet check
```

### 2.2 `.env`

Copy `.env.example` → `.env` and set production values:

```bash
cp .env.example .env
```

Minimum production values (see `.env.example` for the full list):

| Variable | What to set |
|---|---|
| `ENVIRONMENT` | `production` |
| `APP_PASSWORD` | The single-user login password (long, random). If empty, **auth is bypassed** — never ship it empty. |
| `SESSION_SECRET` | Long random string (`python3 -c "import secrets; print(secrets.token_urlsafe(32))"`). Rotating it logs everyone out. |
| `CORS_ORIGINS` | `https://finance.pilotmessenger.com` |
| `ANTHROPIC_API_KEY` | Claude key if you want the AI parsing/insights feature. Without it, AI degrades gracefully. |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | (Optional) for emailing invoices/notifications. |

`DATABASE_URL` is set by `docker-compose.yml` directly
(`sqlite:///./data/finance.db`) and does not need to be in `.env`.

### 2.3 nginx site config

Since this is a subdomain on a shared nginx, add a **new** server block (don't
touch the pilotmessenger.com one). Name it
`/etc/nginx/sites-available/finance.pilotmessenger.com`, symlink into
`sites-enabled/`:

```nginx
server {
    server_name finance.pilotmessenger.com;

    # Security headers (same values as the ReplyPilot site)
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Compression — required at the host layer because the host proxies the
    # frontend container and would otherwise ship the ~1.2MB JS bundle raw.
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/javascript application/xml application/xml+rss image/svg+xml font/woff2;

    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:4001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 80;
}
```

Then reload and issue a cert:

```bash
sudo ln -s /etc/nginx/sites-available/finance.pilotmessenger.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d finance.pilotmessenger.com
```

Certbot rewrites the config to add the 443 block + redirect automatically.

### 2.4 First deploy

```bash
cd ~/finance-manager
docker compose up -d --build
docker ps                                    # finance_backend + finance_frontend "Up"/"healthy"
curl -s https://finance.pilotmessenger.com/health   # {"status":"ok"}
```

## 3. Routine deploys

```bash
cd ~/finance-manager
./deploy.sh
```

`deploy.sh`:
1. Refuses to run if the server working tree has uncommitted changes.
2. `git pull origin main`.
3. `docker compose up -d --build backend frontend` (the DB volume is untouched).
4. Polls `http://localhost:8001/health` inside the container until healthy
   (public endpoint, no auth).
5. Prints the SQLite table list (schema sanity check) and the last 30 backend
   log lines.

## 4. CI / CD

The repo ships `.github/workflows/deploy.yml`. On every push to `main` (and via
manual "Run workflow" in the Actions tab) it:

1. Verifies both Docker images still build.
2. Writes `DEPLOY_KEY` to `~/.ssh/deploy_key` and, via the OpenSSH client
   (with `nick-fields/retry`, 4 attempts), runs `bash deploy.sh` on the VPS.

Repository secrets required (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | `187.127.219.52` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_PORT` | `22` |
| `DEPLOY_KEY` | Private key GitHub uses to log into the VPS |

Create the CI key on the server once:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/ci_deploy_key -N '' -C 'github-actions-finance'
cat ~/.ssh/ci_deploy_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/ci_deploy_key   # paste into DEPLOY_KEY
```

## 5. Rollback

```bash
cd ~/finance-manager
git log --oneline -10
git checkout <sha> -- .
docker compose up -d --build backend frontend
```

FinanceManager uses SQLite with auto-create + schema repairs on startup, so
code rollback is generally safe (the DB volume just may be a schema ahead —
older code ignores unknown columns).

## 6. Backup

The only persistent state is the SQLite DB on the `finance_db` volume.
Back it up with:

```bash
docker run --rm -v financemanager_finance_db:/data -v /root/backups:/backup alpine \
  cp /data/finance.db /backup/finance-$(date +%F).db
```

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `deploy.sh` exits "uncommitted local changes" | Someone edited files on the server | `git status --short`, reconcile, then re-run |
| `finance_backend` crash-loops | `APP_PASSWORD` empty (auth open) or invalid import | `docker logs finance_backend`; check `.env` |
| Subdomain returns 502 | nginx can't reach `127.0.0.1:8001/4001` | Containers not running — `docker compose up -d`, check `docker ps` |
| Auth "open" (no login screen) | `APP_PASSWORD` empty in `.env` | Set it, redeploy |
| AI page shows setup notice | `ANTHROPIC_API_KEY` missing | Add to `.env`, redeploy |