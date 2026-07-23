# ─────────────────────────────────────────────────────────────────────────────
# Multi-arch build definition for `docker buildx bake`.
#
# Builds every Medianet image for one or more platforms and pushes multi-arch
# manifests to Docker Hub. Multi-platform images cannot be loaded into the local
# Docker store, so bake builds and pushes in a single step (--push).
#
# Always pass -f docker-bake.hcl so bake does NOT also auto-load docker-compose.yml:
#   DOCKER_USERNAME=yassinecherni9 docker buildx bake -f docker-bake.hcl --push
#   PLATFORMS=linux/arm64          docker buildx bake -f docker-bake.hcl --push   # arm64 only
#
# See deploy.sh (which wires up the builder + login) and DEPLOY.md.
# ─────────────────────────────────────────────────────────────────────────────

variable "DOCKER_USERNAME"     { default = "yassinecherni9" }
variable "TAG"                 { default = "latest" }
# Comma-separated target platforms. Default = both (runs on amd64 + arm64).
variable "PLATFORMS"           { default = "linux/amd64,linux/arm64" }
# Baked into the Next.js bundles at build time (cannot change at runtime).
# BOTH frontends call the backend domain — nginx routes its /api/ to the
# gateway over HTTPS (no mixed content; CORS is open on the services).
variable "FRONTOFFICE_API_URL" { default = "https://medianetincubatorbackend.duckdns.org" }
variable "BACKOFFICE_API_URL"  { default = "https://medianetincubatorbackend.duckdns.org" }

function "img" {
  params = [name]
  result = "${DOCKER_USERNAME}/medianet-${name}:${TAG}"
}

# Shared by every target: the platform list.
target "_common" {
  platforms = split(",", PLATFORMS)
}

group "default" {
  targets = [
    "eureka-server", "auth-service", "candidature-service", "notification-service",
    "programme-service", "ai-scoring-service", "ai-matching-service",
    "admin-ai-service", "pitch-media-service", "api-gateway", "nginx",
    "frontoffice", "backoffice",
  ]
}

# ── Spring Boot / gateway / discovery (context = ./backend/<name>) ────────────
target "eureka-server" {
  inherits = ["_common"]
  context  = "./backend/eureka-server"
  tags     = [img("eureka-server")]
}
target "auth-service" {
  inherits = ["_common"]
  context  = "./backend/auth-service"
  tags     = [img("auth-service")]
}
target "candidature-service" {
  inherits = ["_common"]
  context  = "./backend/candidature-service"
  tags     = [img("candidature-service")]
}
target "notification-service" {
  inherits = ["_common"]
  context  = "./backend/notification-service"
  tags     = [img("notification-service")]
}
target "programme-service" {
  inherits = ["_common"]
  context  = "./backend/programme-service"
  tags     = [img("programme-service")]
}
target "ai-scoring-service" {
  inherits = ["_common"]
  context  = "./backend/ai-scoring-service"
  tags     = [img("ai-scoring-service")]
}
target "ai-matching-service" {
  inherits = ["_common"]
  context  = "./backend/ai-matching-service"
  tags     = [img("ai-matching-service")]
}
target "admin-ai-service" {
  inherits = ["_common"]
  context  = "./backend/admin-ai-service"
  tags     = [img("admin-ai-service")]
}
target "api-gateway" {
  inherits = ["_common"]
  context  = "./backend/api-gateway"
  tags     = [img("api-gateway")]
}

# ── Pitch media (Python / ffmpeg / whisper) ──────────────────────────────────
target "pitch-media-service" {
  inherits = ["_common"]
  context  = "./backend/pitch-media-service"
  tags     = [img("pitch-media-service")]
}

# ── Reverse proxy ─────────────────────────────────────────────────────────────
target "nginx" {
  inherits = ["_common"]
  context  = "./nginx"
  tags     = [img("nginx")]
}

# ── Frontends — each baked with its own public API URL ───────────────────────
target "frontoffice" {
  inherits = ["_common"]
  context  = "./frontend/nextjs-frontoffice"
  args     = { NEXT_PUBLIC_API_URL = FRONTOFFICE_API_URL }
  tags     = [img("frontoffice")]
}
target "backoffice" {
  inherits = ["_common"]
  context  = "./frontend/nextjs-backoffice"
  args     = { NEXT_PUBLIC_API_URL = BACKOFFICE_API_URL }
  tags     = [img("backoffice")]
}
