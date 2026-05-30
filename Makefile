# ─────────────────────────────────────────────────────────────────────────────
# Medianet Incubateur — Makefile
# Usage: make <target>
# ─────────────────────────────────────────────────────────────────────────────

DOCKER_USERNAME ?= yourusername
TAG             ?= latest
COMPOSE         = docker compose
COMPOSE_PROD    = docker compose -f docker-compose.prod.yml

.PHONY: help dev prod build push pull logs down clean \
        build-java build-front test lint \
        deploy rollback seed

# ── Default target ────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Medianet Incubateur — available targets"
	@echo ""
	@echo "  Dev:"
	@echo "    make dev          Start all services locally (hot-reload)"
	@echo "    make down         Stop and remove containers"
	@echo "    make logs         Tail logs of all services"
	@echo "    make logs s=auth  Tail logs of a specific service"
	@echo "    make seed         Insert admin seed data"
	@echo ""
	@echo "  Build:"
	@echo "    make build        Build all Docker images"
	@echo "    make build-java   Build only Java services"
	@echo "    make build-front  Build only Next.js apps"
	@echo "    make test         Run all tests"
	@echo "    make lint         Lint frontends"
	@echo ""
	@echo "  Docker Hub:"
	@echo "    make push         Build & push all images  (DOCKER_USERNAME=xxx)"
	@echo "    make pull         Pull all images from Docker Hub"
	@echo ""
	@echo "  Production:"
	@echo "    make prod         Start production stack (pulled images)"
	@echo "    make deploy       Pull latest & restart production"
	@echo "    make rollback     Roll back to previous tag  (TAG=v1.0.0)"
	@echo ""
	@echo "  Cleanup:"
	@echo "    make clean        Remove stopped containers + dangling images"
	@echo ""

# ── Development ───────────────────────────────────────────────────────────────
dev:
	$(COMPOSE) up -d --build
	@echo ""
	@echo "  Frontoffice : http://localhost:3000"
	@echo "  Backoffice  : http://localhost:3001"
	@echo "  API Gateway : http://localhost:8080"
	@echo "  Eureka      : http://localhost:8761"
	@echo "  RabbitMQ    : http://localhost:15672  (medianet/medianet)"
	@echo ""

down:
	$(COMPOSE) down

logs:
ifdef s
	$(COMPOSE) logs -f $(s)
else
	$(COMPOSE) logs -f
endif

# ── Build ─────────────────────────────────────────────────────────────────────
build: build-java build-front
	@echo "All images built ✅"

build-java:
	@for svc in eureka-server api-gateway auth-service session-service \
	            candidature-service notification-service programme-service \
	            ai-scoring-service ai-matching-service; do \
	  echo "→ Building $$svc..."; \
	  (cd backend/$$svc && mvn -B clean package -DskipTests -q) && \
	  docker build -t $(DOCKER_USERNAME)/medianet-$$svc:$(TAG) backend/$$svc || exit 1; \
	done

build-front:
	docker build \
	  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 \
	  -t $(DOCKER_USERNAME)/medianet-frontoffice:$(TAG) \
	  frontend/nextjs-frontoffice
	docker build \
	  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 \
	  -t $(DOCKER_USERNAME)/medianet-backoffice:$(TAG) \
	  frontend/nextjs-backoffice
	docker build -t $(DOCKER_USERNAME)/medianet-nginx:$(TAG) nginx

# ── Test & Lint ───────────────────────────────────────────────────────────────
test:
	@echo "Running Java tests..."
	@for svc in auth-service session-service candidature-service \
	            notification-service programme-service \
	            ai-scoring-service ai-matching-service; do \
	  echo "→ Testing $$svc..."; \
	  (cd backend/$$svc && mvn -B test -q) || exit 1; \
	done
	@echo "All tests passed ✅"

lint:
	@echo "Linting frontoffice..."
	cd frontend/nextjs-frontoffice && npm run lint
	@echo "Linting backoffice..."
	cd frontend/nextjs-backoffice && npm run lint

# ── Docker Hub ────────────────────────────────────────────────────────────────
push: build
	@echo "Pushing images to Docker Hub as $(DOCKER_USERNAME)..."
	@for img in eureka-server api-gateway auth-service session-service \
	            candidature-service notification-service programme-service \
	            ai-scoring-service ai-matching-service \
	            frontoffice backoffice nginx; do \
	  docker push $(DOCKER_USERNAME)/medianet-$$img:$(TAG); \
	done
	@echo "All images pushed ✅"

pull:
	@for img in eureka-server api-gateway auth-service session-service \
	            candidature-service notification-service programme-service \
	            ai-scoring-service ai-matching-service \
	            frontoffice backoffice nginx; do \
	  docker pull $(DOCKER_USERNAME)/medianet-$$img:$(TAG); \
	done

# ── Production ────────────────────────────────────────────────────────────────
prod:
	DOCKER_USERNAME=$(DOCKER_USERNAME) TAG=$(TAG) $(COMPOSE_PROD) up -d
	@echo "Production stack started ✅"

deploy: pull
	DOCKER_USERNAME=$(DOCKER_USERNAME) TAG=$(TAG) \
	  $(COMPOSE_PROD) up -d --remove-orphans
	docker image prune -f
	@echo "Deployed $(TAG) ✅"

rollback:
	@echo "Rolling back to TAG=$(TAG)..."
	DOCKER_USERNAME=$(DOCKER_USERNAME) TAG=$(TAG) \
	  $(COMPOSE_PROD) up -d --remove-orphans
	@echo "Rolled back to $(TAG) ✅"

# ── Seed data ─────────────────────────────────────────────────────────────────
seed:
	@echo "Seeding admin account..."
	curl -s -X POST http://localhost:8080/api/auth/register \
	  -H 'Content-Type: application/json' \
	  -d '{"firstName":"Admin","lastName":"Medianet","email":"admin@medianet.dz","password":"Admin1234!","role":"ADMIN"}' \
	  | python3 -m json.tool || true
	@echo "Seed done ✅"

# ── Cleanup ───────────────────────────────────────────────────────────────────
clean:
	docker container prune -f
	docker image prune -f
	@echo "Cleaned ✅"
