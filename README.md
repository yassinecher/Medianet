# Medianet Incubateur

A multi-programme **startup incubation platform**: candidature intake and AI-assisted
scoring, jury evaluation, a programme-centric mentor/coaching workspace, task and
workshop management, an AI pitch-video coach, and a CMS-editable public site — built
as **8 Spring Boot / Python microservices behind an API gateway**, with two
**Next.js 14** applications (a public/porteur front office and an admin back office),
all orchestrated with Docker Compose.

Built as a PFE (end-of-studies project) at ESPRIT for Medianet Incubateur.

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Security](#security)
- [Data model](#data-model)
- [CI/CD](#cicd)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project history](#project-history)

---

## What it does

The platform serves four roles, each with a purpose-built workspace rather than one
generic screen:

**Admin (back office)** — creates and publishes programmes (form template, evaluation
criteria, timeline/sessions, partners), assigns jury and mentors, reviews candidatures
alongside the AI's score, manages roles and per-user permissions, edits the public
landing page live, sends templated invitations/mailings, and gets a dashboard
surfacing what needs attention (e.g. a startup with no mentor assigned — flagged as
critical).

**Porteur (project lead, front office)** — applies to open programmes through a
form whose sections adapt to the template the admin chose, tracks the candidature's
status, submits a pitch video and gets an AI-generated score + coaching advice,
works assigned tasks (checklist, document uploads, submit-for-review), and follows
their programme's timeline, coaching plan, and rendez-vous with their mentor.

**Mentor** — sees the startups they accompany across every programme, opens a
per-startup coaching workspace (plan, session notes, meeting requests, availability
slots the porteur can book), reviews the mentee's pitch submissions, and joins
workshops the admin scheduled for that startup.

**Jury** — evaluates assigned candidatures against the programme's weighted criteria
and sees their own submitted scores.

Cutting across all of them: a shared calendar (sessions, tasks, meetings, workshops
in one agenda), a live-updating notification feed, and dynamic RBAC — an admin can
create new roles and grant/revoke individual permissions at runtime, and a
logged-in user's UI updates immediately (via Server-Sent Events) when their access
changes.

### Feature map

| Domain | What's implemented |
|---|---|
| **Programmes** | Lifecycle (draft → open → in-progress → evaluation → closed), configurable form templates, weighted evaluation criteria, sessions/phases with a visual timeline builder ("Parcours") |
| **Candidatures** | Multi-step application form, jury assignment, per-criterion scoring, hybrid rule-based + LLM AI scoring, accept/reject |
| **Programme roster** | An organisation's participation in *one* programme is its own entity — carries that programme's mentor, so one startup can have a different mentor per programme |
| **Coaching** | Plan (milestones + notes), session journal, meeting requests, mentor-published availability slots the porteur books directly |
| **Tasks** | Checklist steps, document uploads (not just links), an append-only activity log, extra collaborators beyond the primary assignee, admin review (approve / request changes) |
| **Workshops** | Sessions targeted at specific startups within a programme — the assigned mentor is pulled in automatically |
| **Pitch AI coach** | Video upload → self-hosted transcription (faster-whisper) + optional vision analysis (Ollama) → LLM scoring against the pitch rubric with actionable advice |
| **RBAC** | Admin-defined roles, per-user permission grants/revokes, live permission refresh over SSE, permission-aware navigation and API guards |
| **Admin AI assistant** | Tool-calling chat agent that can look up and act on programme/candidature/user data on the admin's behalf |
| **Landing page CMS** | Every section of the public homepage (hero, stats, features, process, testimonials, FAQ, theme colors) is admin-editable with a live preview |
| **Notifications** | Role invitations with RSVP tracking, templated bulk mailing to a programme's roster, an in-app feed that highlights critical/unread items |
| **File storage** | MinIO (S3-compatible) for logos, galleries, and pitch videos, served through the gateway on one public domain |

---

## Architecture

```
                    ┌─────────────────────┐   ┌─────────────────────┐
                    │  Front office (3000) │   │  Back office (3001) │
                    │  Next.js 14 — porteur │   │  Next.js 14 — admin  │
                    │  / mentor / jury      │   │                       │
                    └───────────┬───────────┘   └───────────┬───────────┘
                                │                             │
                                └──────────────┬──────────────┘
                                               ▼
                               ┌───────────────────────────┐
                               │   API Gateway (8080)       │
                               │   Spring Cloud Gateway     │
                               │   single entry point,      │
                               │   routes /api/** by name   │
                               └─────────────┬───────────────┘
                                              │  resolved via
                                              ▼
                               ┌───────────────────────────┐
                               │  Eureka (8761) — registry  │
                               └─────────────┬───────────────┘
        ┌──────────┬──────────┬──────────┬──┴───────┬──────────┐
        ▼          ▼          ▼          ▼          ▼          ▼
     auth      candidature programme  notification admin-ai  pitch-media
     :8081       :8083       :8086      :8087       :8088      (Python)
    (JWT,      (applications, (programmes,  (invitations, (LLM scoring,   (Whisper +
   roles,      scoring,      tasks,       templated     chat agent,     vision, called
   RBAC)       jury)         coaching,    email)        landing-page    by admin-ai)
                              workshops,                 generation)
                              MinIO files)
        │          │              │            │             │
        ▼          ▼              ▼            ▼             ▼
   auth_db   candidature_db  programme_db  notification_db  admin_ai_db
                       (PostgreSQL 15 — one database per service)

   + MinIO (object storage) · RabbitMQ (provisioned, not yet wired to a
     producer/consumer) · Ollama (optional local LLM, off by default)
```

Every service registers with Eureka on boot; the gateway is the **only** service the
front ends ever call, and it forwards each `/api/**` path to the right service by
logical name. Internally, services that need data they don't own call each other
over plain REST (e.g. candidature-service asks auth-service for a user's name) —
there is no cross-service SQL join.

### Backend services

| Service | Port | Role |
|---|---|---|
| **eureka-server** | 8761 | Service discovery |
| **api-gateway** | 8080 | Single public entry point, request routing |
| **auth-service** | 8081 | Users, JWT, dynamic roles/permissions, organisations |
| **candidature-service** | 8083 | Candidature submission, jury assignment, scoring |
| **programme-service** | 8086 | Programmes, sessions, roster, coaching, tasks, workshops, files, landing-page |
| **notification-service** | 8087 | Invitations, RSVP, templated/bulk email |
| **admin-ai-service** | 8088 | AI scoring, admin chat assistant, content generation |
| **pitch-media-service** | — (internal) | Python/FastAPI — pitch video transcription + visual analysis |

> Two earlier standalone AI services (`ai-scoring-service`, `ai-matching-service`)
> were superseded by `admin-ai-service` and retired — see [Project history](#project-history).

### Frontend apps

| App | Port | Audience |
|---|---|---|
| **nextjs-frontoffice** | 3000 | Porteurs, mentors, jury |
| **nextjs-backoffice** | 3001 | Administrators |

Both are Next.js 14 (App Router) with Tailwind CSS, Zustand for client state, and
Framer Motion for motion. `NEXT_PUBLIC_API_URL` is compiled into the bundle at
**build time** (see `docker-bake.hcl`), not read at runtime.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 3.2, Spring Cloud Gateway, Spring Cloud Netflix Eureka, Spring Security + JWT, Spring Data JPA |
| AI/ML | Ollama (local LLM) or HuggingFace Inference Providers (hosted), faster-whisper (speech-to-text), scikit-learn-era matching logic folded into admin-ai-service |
| Async service | Python 3.11, FastAPI, ffmpeg |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand, Framer Motion |
| Data | PostgreSQL 15 (one database per service), MinIO (S3-compatible object storage) |
| Infra | Docker Compose, Nginx (reverse proxy + TLS in production), GitHub Actions (CI, multi-arch build & deploy, TLS renewal) |

---

## Getting started

### Prerequisites
- Docker Desktop (or Docker Engine + Compose v2)
- ~4 GB RAM free for the base stack (more if you enable the optional local-LLM profile)

### 1 — Configure

```bash
cp .env.example .env
```

Fill in `.env` — at minimum `JWT_SECRET` (generate one: `openssl rand -base64 48`)
and the SMTP credentials (`MAIL_*`) if you want invitation emails to actually send.
Everything else has a working local default. **Never commit a filled-in `.env`.**

### 2 — Run

```bash
docker compose up -d --build
```

First build compiles every Java service and installs both frontends' dependencies —
allow 10–15 minutes. Subsequent starts are seconds unless the code changed.

> `docker compose restart <service>` reruns the **existing image** — after a code
> change use `docker compose up -d --build <service>` instead.

### 3 — Open it

| | URL |
|---|---|
| Front office | http://localhost:3000 |
| Back office | http://localhost:3001 |
| API gateway | http://localhost:8080 |
| Eureka dashboard | http://localhost:8761 |

A default admin account is seeded on first boot from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
in `.env` (`admin@medianet.dz` / see your `.env` if you kept the example values —
**change both before any real deployment**). Everyone else registers through
`/register` (front office, auto-assigned the PORTEUR role) or is created with a
chosen role from the back office's `/users` page.

### Running a single service outside Docker

```bash
cd backend/auth-service && ./mvnw spring-boot:run     # needs a local Postgres + env vars, see docker-compose.yml
cd backend/pitch-media-service && pip install -r requirements.txt && uvicorn app:app --reload --port 8087
cd frontend/nextjs-frontoffice && npm install && npm run dev   # :3000
cd frontend/nextjs-backoffice && npm install && npm run dev    # :3001
```

---

## Project structure

```
Medianet/
├── docker-compose.yml          # dev — builds every image locally
├── docker-compose.prod.yml     # prod — pulls pre-built images (see DEPLOY.md)
├── docker-bake.hcl             # multi-arch (amd64+arm64) build definition
├── nginx/                      # reverse proxy + TLS config (prod only)
├── .env.example                # environment variable template — copy to .env
├── backend/
│   ├── eureka-server/          # service discovery
│   ├── api-gateway/            # routing, the only public backend port
│   ├── auth-service/           # users, JWT, RBAC, organisations
│   ├── candidature-service/    # applications, jury, scoring
│   ├── programme-service/      # programmes, roster, coaching, tasks, workshops, files
│   ├── notification-service/   # invitations, email
│   ├── admin-ai-service/       # AI scoring, chat assistant, content generation
│   └── pitch-media-service/    # Python — video transcription + analysis
└── frontend/
    ├── nextjs-frontoffice/     # porteur / mentor / jury portal
    └── nextjs-backoffice/      # admin console
```

Each Spring Boot service follows the same internal layout:
`controller/` (REST endpoints + `@PreAuthorize` guards) → `service/` (business logic) →
`repository/` (Spring Data JPA) → `entity/` / `dto/`.

---

## Security

- **JWT** issued by auth-service, validated by every service's own
  `JwtAuthenticationFilter`; claims carry the user id, roles, and effective
  permissions so downstream services don't need a round trip to check access.
- **Two layers of authorization**: URL-level (`SecurityConfig`, e.g. programme `GET`
  is public, everything else requires auth) and method-level
  (`@PreAuthorize("hasRole('ADMIN')")` / a named permission) on sensitive endpoints.
- **Dynamic RBAC**: roles and permissions are database rows an admin can edit at
  runtime, not compile-time constants — see `ModuleCatalog` in auth-service.
- **Secrets** live only in a git-ignored `.env` (`.env.example` is the tracked
  template); the compose files reference `${VAR}` and refuse to start without the
  required ones (`JWT_SECRET:?...`).
- **Minimal attack surface**: only the API gateway, the two front ends, and MinIO
  (which serves public file URLs directly) publish a host port; every database and
  every other internal service is reached solely over the private Docker network.
- **Readiness gating**: every Spring service exposes `/actuator/health`; dependent
  containers wait on `condition: service_healthy`, not just "process started."

---

## Data model

Each service owns one PostgreSQL database — no service reads another's tables
directly (**database-per-service**, a deliberate microservice boundary, not an
oversight). Schema is managed by Hibernate (`ddl-auto: update`); for a stricter
production rollout this is a natural place to introduce Flyway/Liquibase migrations.

| Database | Service |
|---|---|
| `auth_db` | auth-service |
| `candidature_db` | candidature-service |
| `programme_db` | programme-service |
| `notification_db` | notification-service |
| `admin_ai_db` | admin-ai-service |

The central domain object is `ProgrammeParticipant` (programme-service): an
organisation's participation in **one** programme. It — not the organisation — carries
that programme's assigned mentor, so a startup active in two programmes can have two
different mentors. Coaching plans, meetings, availability bookings, and reviews all
key off this participation, not the organisation directly.

---

## CI/CD

Three GitHub Actions workflows:

- **`ci.yml`** — on every push/PR: compiles each Java service and type-checks +
  builds both Next.js apps. Infra-free, runs on stock `ubuntu-latest`.
- **`deploy.yml`** — builds every image (native amd64), pushes to Docker Hub, then
  pulls and restarts the stack on the target server over SSH. All credentials come
  from GitHub Actions Secrets — nothing is hardcoded in the workflow.
- **`ssl-renew.yml`** — periodic Let's Encrypt certificate renewal for the production
  reverse proxy.

For a multi-arch (amd64 + arm64) local build, see [`DEPLOY.md`](DEPLOY.md).

---

## Testing

Backend: JUnit unit and integration tests on the highest-risk services (JWT issuance/
validation, auth business logic, candidature scoring, programme and notification
services) — see `src/test/java` in each service. Frontend correctness currently
relies on TypeScript's strict mode and the CI build/type-check gate rather than a
dedicated test suite; expanding component/e2e coverage is a natural next step.

---

## Deployment

Full instructions — building multi-arch images, the server-side `.env`, TLS,
GPU-vs-CPU Ollama — are in [`DEPLOY.md`](DEPLOY.md). Short version:

```bash
# once, locally: build & push every image
DOCKER_USERNAME=yourdockerhubuser ./deploy.sh

# on the server: only docker-compose.prod.yml + a filled .env are needed
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## Project history

A short record of the architecture decisions that shaped the current system:

- **`session-service` → `programme-service`**: sessions were folded into the
  programme domain; the old `session_id` column is kept nullable on `candidatures`
  for historical rows, new ones use `programme_id`.
- **Frontends: Angular → Next.js 14**: the original Angular apps (`:4200`/`:4300`)
  were rebuilt as the current Next.js apps (`:3000`/`:3001`) for App Router +
  server components and a faster iteration loop.
- **`ai-scoring-service` + `ai-matching-service` → `admin-ai-service`**: two
  narrowly-scoped AI microservices (Java+Ollama scoring, Python+scikit-learn KNN
  matching) were consolidated into one AI service with a swappable LLM backend and
  a tool-calling admin assistant, removing a service-to-service coupling that
  had become more overhead than it was worth.
- **Organisation-global mentor → per-programme mentor**: the mentor assignment
  moved from the `Organization` entity to `ProgrammeParticipant`, so a startup's
  mentor is scoped to the programme it's being accompanied in, not global to the
  organisation.
