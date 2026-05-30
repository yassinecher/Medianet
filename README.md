# Medianet Incubateur — Système d'Incubation

Plateforme d'incubation multi-programmes : **7 microservices Spring Boot + 1 service Python (IA matching) + 2 apps Next.js**, orchestrés en Docker Compose.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  FRONTOFFICE (Next.js 14)         BACKOFFICE (Next.js 14)        │
│  localhost:3000                   localhost:3001                 │
│  Porteurs de projet               Administrateurs                │
└──────────────────────┬──────────────────────┬───────────────────┘
                       ▼                      ▼
                ┌────────────────────────────────────┐
                │   API GATEWAY  (Spring Cloud)      │
                │            :8080                   │
                └─────┬─────┬─────┬─────┬─────┬─────┘
                      ▼     ▼     ▼     ▼     ▼
                   auth│  cand │ prog │noti │ ai-*
                   8081│  8083 │ 8086 │8087 │8084-8085
                      │       │      │     │
                      ▼       ▼      ▼     ▼
                   postgres × 4 (one DB per service)

                   + Eureka (8761) — service discovery
                   + RabbitMQ (5672 / 15672) — async messaging
                   + Ollama (11434, llama3.2) — AI commentary
```

### Backend services

| Service | Port | Stack | Purpose |
|---|---|---|---|
| **eureka-server** | 8761 | Spring Cloud Netflix | Service discovery / load balancer registry |
| **api-gateway** | 8080 | Spring Cloud Gateway | Single entry point — routes `/api/**` via `lb://` |
| **auth-service** | 8081 | Spring Boot + JWT | Users, roles, permissions, companies, role-specific profiles |
| **candidature-service** | 8083 | Spring Boot | Candidatures (DOCX form), evaluations, jury assignments |
| **ai-scoring-service** | 8084 | Spring Boot + Ollama | Hybrid rule-based + LLM candidature scoring |
| **ai-matching-service** | 8085 | **Python FastAPI** + scikit-learn KNN + Ollama | Mentor ↔ Porteur matching |
| **programme-service** | 8086 | Spring Boot | Programmes, criteria, phases, partners, tasks |
| **notification-service** | 8087 | Spring Boot + Brevo SMTP | Invitations, RSVP, generic email |

### Frontend apps

| App | Port | Audience | Stack |
|---|---|---|---|
| **nextjs-frontoffice** | 3000 | Porteurs de projets | Next.js 14 (App Router), Tailwind, MagicUI, Framer Motion, Zustand |
| **nextjs-backoffice** | 3001 | Administrateurs | Next.js 14, Recharts, same UI stack |

### Infrastructure

- 4 × PostgreSQL 15 (one DB per service: auth, candidature, notification, programme)
- RabbitMQ 3 (management UI: `:15672`, user `medianet` / pass `medianet2024`)
- Ollama (`llama3.2` model auto-pulled on first start)

---

## Démarrage rapide

### Prérequis
- Docker Desktop installé et démarré
- 8 GB RAM libre minimum (Ollama est gourmand)

### Lancer toute la stack

```bash
cd "C:\Users\EL PANDAs\Documents\Medianet"
docker compose up -d --build
```

> Premier build : ~10-15 minutes (compilation Maven multi-module + npm install + pull Ollama).
> Relances suivantes : ~30 secondes si rien n'a changé.

### URLs d'accès

| Service | URL | Description |
|---|---|---|
| **Frontoffice** | http://localhost:3000 | Portail public — porteurs |
| **Backoffice** | http://localhost:3001 | Console admin |
| API Gateway | http://localhost:8080 | Point d'entrée API unique |
| Eureka | http://localhost:8761 | Dashboard service discovery |
| RabbitMQ | http://localhost:15672 | `medianet` / `medianet2024` |

### Rebuild après changement de code

Important : `docker compose restart <service>` **ne suffit pas** — il relance l'ancienne image.

```bash
docker compose up -d --build <service-name>   # rebuild + redeploy
```

---

## Comptes par défaut

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | `admin@medianet.tn` | `Admin1234!` |

Les porteurs / jury se créent via :
- Frontoffice : `/register` (auto-rôle PORTEUR)
- Backoffice : `/users` (création complète avec rôle au choix)

---

## Flux complet

### Étape 1 — Configuration du programme (admin)

```
Admin (backoffice) → /programmes/new
   ↓ Crée un programme [DRAFT]
   ↓ Choisit un squelette de formulaire (STANDARD, MINIMAL, FOODSTART, TECH, AGRITECH)
   ↓ Ajoute critères + phases + partenaires
   ↓ Bouton "Publier" → status devient OPEN
```

### Étape 2 — Candidature (porteur)

```
Porteur (frontoffice) → /programmes → page de détail
   ↓ Bouton "Rejoindre le programme"
   ↓ Formulaire multi-étapes (sections selon le template choisi par l'admin)
   ↓ Soumission → candidature [PENDING]
```

### Étape 3 — Évaluation

```
Admin → Assigne 1+ jurés à la candidature → [UNDER_EVALUATION]
Jury → /candidatures, évalue selon les critères du programme
       (mode DYNAMIC = critères du programme, ou LEGACY = 4 critères fixes)
Admin → Consulte le score IA + scores juré
Admin → Bouton "Accepter" ou "Rejeter" → [ACCEPTED | REJECTED]
```

---

## Form templates (squelette du formulaire de candidature)

L'admin choisit, à la création/édition du programme, quel **squelette** les porteurs verront sur `/programmes/{id}/candidater` :

| Template | Sections | Cas d'usage |
|---|---|---|
| `STANDARD` | équipe + projet + marché + motivation | Formulaire officiel Medianet (par défaut) |
| `MINIMAL` | projet + motivation | Hackathons, contests |
| `FOODSTART` | équipe + projet + marché + motivation | FoodTech (accent distribution) |
| `TECH` | équipe + projet + motivation | SaaS / IA (pas de questions distribution physique) |
| `AGRITECH` | équipe + projet + marché + motivation | Agriculture (partenariats agricoles, impact) |

La configuration se trouve dans `frontend/nextjs-frontoffice/src/app/programmes/[id]/candidater/page.tsx` → constante `TEMPLATE_CONFIG`.

---

## API Reference

### Auth (`/api/auth`)
```
POST   /api/auth/login            → {token, user}
POST   /api/auth/register         → {token, user}
GET    /api/auth/me               → UserDto                    (Bearer)
GET    /api/auth/validate         → UserDto                    (Bearer)
PUT    /api/auth/profile          → UserDto                    (Bearer)
GET    /api/auth/users            → UserDto[]                  (ADMIN)
PATCH  /api/auth/users/{id}/toggle-active                     (ADMIN)
PATCH  /api/auth/users/{id}/role                              (ADMIN)
PUT    /api/auth/users/{id}/roles                             (ADMIN) sync roles
POST   /api/auth/users/{id}/roles/{assign|remove}             (ADMIN)
GET    /api/auth/permissions      → permission catalog        (ADMIN)
GET    /api/auth/roles            → role catalog              (ADMIN)
POST   /api/auth/users/{id}/permissions/{grant|revoke}        (ADMIN)
PUT    /api/auth/users/{id}/profile/{admin|mentor|porteur|jury} (ADMIN or self)

# Companies
POST   /api/auth/companies        → CompanyDto                 (auth)
GET    /api/auth/companies/mine   → CompanyDto[]              (auth)
GET    /api/auth/companies/{id}                                (auth)
PUT    /api/auth/companies/{id}                                (owner or ADMIN)
DELETE /api/auth/companies/{id}                                (owner or ADMIN)
GET    /api/auth/admin/companies                               (ADMIN)
```

### Programmes (`/api/programmes`)
```
GET    /api/programmes            → ProgrammeDto[]            (public)
GET    /api/programmes/{id}                                    (public)
GET    /api/programmes/{id}/phases                             (public)
GET    /api/programmes/{id}/criteria                           (public)
POST   /api/programmes            → create                    (ADMIN)
PUT    /api/programmes/{id}       → full update               (ADMIN)
PATCH  /api/programmes/{id}/status                            (ADMIN)
GET    /api/programmes/stats                                  (ADMIN)
POST   /api/programmes/{id}/phases                            (ADMIN)
PUT    /api/programmes/{id}/phases/{phaseId}                  (ADMIN)
DELETE /api/programmes/{id}/phases/{phaseId}                  (ADMIN)
POST   /api/programmes/{id}/criteria                          (ADMIN)
PUT    /api/programmes/{id}/criteria/{criterionId}            (ADMIN)
DELETE /api/programmes/{id}/criteria/{criterionId}            (ADMIN)
```

### Partners (`/api/partners`)
```
GET    /api/partners                                          (auth)
POST   /api/partners                                          (ADMIN)
DELETE /api/partners/{id}                                     (ADMIN)
POST   /api/programmes/{pid}/partners/{partnerId}             (ADMIN) attach
DELETE /api/programmes/{pid}/partners/{partnerId}             (ADMIN) detach
```

### Candidatures (`/api/candidatures`)
```
POST   /api/candidatures          → submit                    (PORTEUR)
GET    /api/candidatures          → all, optional ?status=    (ADMIN | JURY)
GET    /api/candidatures/my       → own candidatures         (PORTEUR)
GET    /api/candidatures/{id}                                  (auth)
GET    /api/candidatures/programme/{programmeId}              (ADMIN | JURY)
GET    /api/candidatures/programme/{programmeId}/stats        (ADMIN)
GET    /api/candidatures/my-jury-assignments                  (JURY)
POST   /api/candidatures/{id}/assign-jury                     (ADMIN)
POST   /api/candidatures/{id}/evaluate                        (JURY)
PATCH  /api/candidatures/{id}/accept                          (ADMIN)
PATCH  /api/candidatures/{id}/reject  {reason}                (ADMIN)
GET    /api/candidatures/stats                                (ADMIN)
```

### AI services
```
POST   /api/ai/score/{candidatureId}    → hybrid AI scoring   (ADMIN | JURY)
GET    /api/ai/score/info               → service health      (auth)
POST   /api/ai/match/{candidatureId}    → KNN mentor matching (auth)
GET    /api/ai/match/model/info                                (auth)
POST   /api/ai/match/model/update       → persist KNN model   (ADMIN)
```

### Notifications (`/api/notifications`)
```
POST   /api/notifications/invitations             → single invite (ADMIN)
POST   /api/notifications/invitations/bulk        → bulk invite   (ADMIN)
GET    /api/notifications/invitations             → list          (ADMIN)
DELETE /api/notifications/invitations/{id}        → cancel        (ADMIN)
POST   /api/notifications/email/send              → freeform mail (ADMIN)
POST   /api/notifications/invitations/rsvp/{token}/accept   (public)
POST   /api/notifications/invitations/rsvp/{token}/decline  (public)
```

### Tasks (`/api/tasks`)
```
GET    /api/tasks                  → all              (auth, filtered by role)
GET    /api/tasks/my               → mine             (auth)
GET    /api/tasks/programme/{id}                       (auth)
POST   /api/tasks                                      (ADMIN)
PUT    /api/tasks/{id}                                 (ADMIN | assignee)
PATCH  /api/tasks/{id}/status                          (assignee)
DELETE /api/tasks/{id}                                 (ADMIN)
```

---

## Statuts (énumérations canoniques)

### `CandidatureStatus`
- `PENDING` — soumise, en attente
- `UNDER_EVALUATION` — jury en cours d'évaluation
- `ACCEPTED` — acceptée par l'admin
- `REJECTED` — refusée

### `ProgrammeStatus`
- `DRAFT` — brouillon (non visible aux porteurs)
- `OPEN` — ouvert aux candidatures
- `IN_PROGRESS` — programme en cours d'exécution
- `EVALUATION` — phase d'évaluation des candidats
- `CLOSED` — clôturé
- `CANCELLED` — annulé

### Workflow boutons (backoffice)
```
DRAFT      → "Publier"             → OPEN
OPEN       → "Suspendre"           → DRAFT
           → "Clôturer"            → CLOSED
           → "Lancer l'évaluation" → EVALUATION
EVALUATION → "Rouvrir"             → OPEN
           → "Clôturer"            → CLOSED
CLOSED / CANCELLED                 → (état terminal)
```

---

## Structure du projet

```
Medianet/
├── docker-compose.yml          # dev — port 3000/3001/8080
├── docker-compose.prod.yml     # prod avec Nginx + SSL Let's Encrypt
├── nginx/                      # config Nginx (prod uniquement)
├── backend/
│   ├── eureka-server/          # service discovery
│   ├── api-gateway/            # gateway + routes
│   ├── auth-service/           # users + JWT + companies
│   ├── candidature-service/    # candidatures + évaluations
│   ├── programme-service/      # programmes + criteria + phases + partners + tasks
│   ├── notification-service/   # invitations + email
│   ├── ai-scoring-service/     # Java + Ollama (heuristics + LLM commentary)
│   └── ai-matching-service/    # Python FastAPI + scikit-learn KNN
└── frontend/
    ├── nextjs-frontoffice/     # porteurs (:3000)
    └── nextjs-backoffice/      # admins (:3001)
```

---

## Développement local (sans Docker)

### Lancer un service Spring Boot individuel

```bash
cd backend/auth-service
./mvnw spring-boot:run
```

> Pré-requis : un PostgreSQL local sur le port adapté + variables d'environnement (cf. `docker-compose.yml` pour la liste).

### Lancer ai-matching-service (Python)

```bash
cd backend/ai-matching-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8085
```

### Lancer les fronts en dev

```bash
cd frontend/nextjs-frontoffice
npm install && npm run dev          # http://localhost:3000

cd frontend/nextjs-backoffice
npm install && npm run dev          # http://localhost:3001
```

Variables : `NEXT_PUBLIC_API_URL=http://localhost:8080` (cf. `.env.local`).

---

## JWT

- **Secret partagé** entre tous les services : `medianet-super-secret-jwt-key-2024-medianet-incubation`
- Expiration : 24h
- Claims : `sub` (email), `userId`, `firstName`, `lastName`, `roles` (Set<String>), `permissions` (Set<String>)
- Header attendu : `Authorization: Bearer <token>`

Sécurité :
- Filtres `JwtAuthenticationFilter` dupliqués dans chaque service (ils écrivent `userId`, `userEmail`, `userRoles` dans la request)
- Niveau URL : `SecurityConfig` (programme `GET` public, le reste authentifié)
- Niveau méthode : `@PreAuthorize("hasRole('ADMIN')")` partout où c'est sensible

---

## Base de données

Chaque service possède sa **propre base PostgreSQL** (pattern microservice strict — pas de jointure inter-service en SQL) :

| DB | Port | Service |
|---|---|---|
| `auth_db` | 5432 | auth-service |
| `candidature_db` | 5434 | candidature-service |
| `notification_db` | 5435 | notification-service |
| `programme_db` | 5436 | programme-service |

Schémas auto-créés par Hibernate (`spring.jpa.hibernate.ddl-auto=update`). Pour la prod, basculer sur Flyway ou Liquibase.

---

## Notes de migration

- **session-service supprimé** (mai 2026) — remplacé par programme-service. La colonne `session_id` reste sur la table `candidatures` pour les anciennes lignes (nullable). Les nouvelles candidatures sont rattachées à `programme_id`.
- **Frontends migrés d'Angular → Next.js 14** (App Router) — anciennes URLs `:4200/:4300` remplacées par `:3000/:3001`.
- **`/candidatures/new` retiré** — toutes les candidatures passent maintenant par `/programmes/{id}/candidater` qui rend le formulaire selon le `formTemplate` du programme.
