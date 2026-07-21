#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Build every Medianet image (multi-arch) and push to Docker Hub under
# $DOCKER_USERNAME. Run this LOCALLY (where the source + Docker live). Then
# deploy on the server with docker-compose.prod.yml (see DEPLOY.md).
#
#   DOCKER_USERNAME=yassinecherni9 ./deploy.sh                    # amd64 + arm64
#   PLATFORMS=linux/arm64  DOCKER_USERNAME=yassinecherni9 ./deploy.sh   # arm64 only
#
# Multi-platform images can't be loaded into the local Docker store, so bake
# builds and pushes in ONE step (--push).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

export DOCKER_USERNAME="${DOCKER_USERNAME:-yassinecherni9}"
export TAG="${TAG:-latest}"
export PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
export FRONTOFFICE_API_URL="${FRONTOFFICE_API_URL:-https://app.medianet.dz}"
export BACKOFFICE_API_URL="${BACKOFFICE_API_URL:-https://admin.medianet.dz}"

echo "==> Docker Hub login (${DOCKER_USERNAME})"
docker login -u "${DOCKER_USERNAME}"

# Cross-building for arm64 on an amd64 host needs QEMU/binfmt. Docker Desktop
# ships it; on a bare Linux host, uncomment the next line once:
# docker run --privileged --rm tonistiigi/binfmt --install all

# A docker-container builder is required for multi-platform output.
if ! docker buildx inspect medianet-builder >/dev/null 2>&1; then
  echo "==> Creating multi-platform builder 'medianet-builder'"
  docker buildx create --name medianet-builder --driver docker-container --bootstrap
fi

echo "==> Building + pushing all images for: ${PLATFORMS}"
# -f docker-bake.hcl keeps bake from also auto-loading docker-compose.yml.
docker buildx bake -f docker-bake.hcl --builder medianet-builder --push

echo "✓ Pushed ${DOCKER_USERNAME}/medianet-*:${TAG} for ${PLATFORMS}"
echo "  On the server: docker compose -f docker-compose.prod.yml pull && up -d"
