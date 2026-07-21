# Deploying Medianet to Docker Hub → your server

All images are published under **`yassinecherni9/medianet-<service>`**. The dev
`docker-compose.yml` (build) and `docker-compose.prod.yml` (pull) use the **same
image names**, so what you build locally is exactly what the server runs.

You can change the account without editing files: set `DOCKER_USERNAME` (default
`yassinecherni9`) and `TAG` (default `latest`).

---

## 1 — Build & push multi-arch images (run locally)

Images build for **`linux/amd64` + `linux/arm64`** by default, so the same tags
run on your dev machine and on an **arm64 server**. Cross-building uses
`docker buildx`; multi-arch images can't be loaded into the local Docker store,
so they're **built and pushed together** (one step). All build config lives in
[`docker-bake.hcl`](docker-bake.hcl).

### Option A — the script (Git Bash / WSL / Linux / macOS)
```bash
DOCKER_USERNAME=yassinecherni9 ./deploy.sh                          # amd64 + arm64
PLATFORMS=linux/arm64 DOCKER_USERNAME=yassinecherni9 ./deploy.sh    # arm64 only
```

### Option B — manual (PowerShell on Windows / Docker Desktop)
```powershell
$env:DOCKER_USERNAME = "yassinecherni9"
docker login -u yassinecherni9

# one-time: a builder that can target multiple platforms
docker buildx create --name medianet-builder --driver docker-container --bootstrap

# build EVERY image for amd64 + arm64 and push (tags/args come from docker-bake.hcl)
docker buildx bake -f docker-bake.hcl --builder medianet-builder --push

# arm64 only:
$env:PLATFORMS = "linux/arm64"
docker buildx bake -f docker-bake.hcl --builder medianet-builder --push
```

The server's `docker compose pull` then automatically fetches the arm64 variant
from the multi-arch manifest — no server-side change needed.

> ⚠️ **Frontends:** `NEXT_PUBLIC_API_URL` is compiled into the Next.js bundle, so
> it must be correct **at build time**. The bake file bakes the front office with
> `FRONTOFFICE_API_URL` and the back office with `BACKOFFICE_API_URL` — override
> either as an env var before building.

> **QEMU:** cross-building arm64 on an amd64 host needs binfmt/QEMU emulation.
> Docker Desktop ships it; on a bare Linux host run once:
> `docker run --privileged --rm tonistiigi/binfmt --install all`. Emulated
> Java/Node builds are noticeably slower than native ones.

> The dev `docker-compose.yml build` still works for a quick **single-arch** local
> build; use the bake file above for multi-arch release images.

---

## 2 — Run on the server (only Docker + these two files needed, no source)

Copy to the server: **`docker-compose.prod.yml`** and a filled-in **`.env`**
(from `.env.prod.example`). Then:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps          # check health
docker compose -f docker-compose.prod.yml logs -f api-gateway
```

Redeploy after pushing new images:
```bash
docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d
```

### Before the first `up`
- Fill **`.env`** — at minimum `JWT_SECRET`, DB/RabbitMQ/MinIO passwords, and the
  SMTP (`MAIL_*`) credentials.
- **TLS:** nginx mounts certs from the host at the paths in `TLS_FULLCHAIN` /
  `TLS_PRIVKEY` (Let's Encrypt by default). Point them at your real certs, or
  drop the `nginx` service and terminate TLS elsewhere.
- **GPU:** `ollama` requests an NVIDIA GPU. On a **CPU-only** server, remove the
  `deploy:` block under `ollama` in `docker-compose.prod.yml`.
- **Schema:** services use Hibernate `ddl-auto: update`, so new columns/tables
  (tasks deliverable fields, etc.) are created automatically on first boot.

---

## Image list (all `:${TAG}`)
```
yassinecherni9/medianet-eureka-server         yassinecherni9/medianet-ai-scoring-service
yassinecherni9/medianet-auth-service          yassinecherni9/medianet-ai-matching-service
yassinecherni9/medianet-candidature-service   yassinecherni9/medianet-admin-ai-service
yassinecherni9/medianet-notification-service  yassinecherni9/medianet-pitch-media-service
yassinecherni9/medianet-programme-service     yassinecherni9/medianet-api-gateway
yassinecherni9/medianet-frontoffice           yassinecherni9/medianet-backoffice
yassinecherni9/medianet-nginx
```
Third-party images (postgres, minio, ollama, rabbitmq) are pulled from their own
registries — not rebuilt or pushed.
