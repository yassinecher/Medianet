# Medianet Incubateur — Système d'Incubation

Architecture microservices complète : 4 Spring Boot services + 2 Angular apps + infrastructure Docker.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  FRONTOFFICE (Angular)         BACKOFFICE (Angular)      │
│  localhost:4200                localhost:4300             │
│  Porteurs de projet            Administrateurs           │
└────────────────┬───────────────────────┬────────────────┘
                 │                       │
                 ▼                       ▼
         ┌───────────────────────────────────┐
         │     API GATEWAY (Spring Cloud)    │
         │          localhost:8080           │
         └────┬──────────────┬──────────┬───┘
              │              │          │
              ▼              ▼          ▼
         ┌────────┐   ┌──────────┐  ┌──────────────┐
         │  AUTH  │   │ SESSION  │  │  CANDIDATURE │
         │  :8081 │   │  :8082   │  │     :8083    │
         └───┬────┘   └────┬─────┘  └──────┬───────┘
             │             │               │
         ┌───┴────┐   ┌────┴────┐   ┌─────┴────┐
         │PG:5432 │   │PG:5433  │   │ PG:5434  │
         └────────┘   └─────────┘   └──────────┘
                 Redis:6379  RabbitMQ:5672
```

---

## Démarrage rapide

### Prérequis
- Docker Desktop installé et démarré
- Git (optionnel)

### Lancer toute la stack

```bash
cd "C:\Users\EL PANDAs\Documents\Medianet"
docker compose up --build
```

> Premier build : ~5-10 minutes (téléchargement des images + compilation Maven)
> Relances suivantes : ~2 minutes

### URLs d'accès

| Service | URL | Description |
|---------|-----|-------------|
| Frontoffice | http://localhost:4200 | Portail public (porteurs) |
| Backoffice | http://localhost:4300 | Dashboard admin |
| API Gateway | http://localhost:8080 | Point d'entrée API unique |
| RabbitMQ UI | http://localhost:15672 | medianet / medianet2024 |

---

## Comptes par défaut

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@medianet.tn | Admin1234! |

> Pour créer des porteurs et jurés : utilisez le formulaire d'inscription du frontoffice (rôle PORTEUR) ou le panneau utilisateurs dans le backoffice.

---

## Flux complet (selon le cahier des charges)

### Étape 1 — Dépôt des dossiers

```
Admin (backoffice) → Crée une session d'incubation [status: OPEN]
Porteur (frontoffice) → Voit la session sur la page d'accueil
Porteur → S'inscrit et soumet son dossier (formulaire 4 étapes)
Admin → Reçoit la candidature [status: PENDING]
```

### Étape 2 — Évaluation

```
Admin → Assigne 1+ jurés à la candidature [status: UNDER_EVALUATION]
Jury → Se connecte et évalue avec 4 critères pondérés :
       Innovation (30%) + Faisabilité (25%) + Impact marché (25%) + Équipe (20%)
Admin → Consulte le score agrégé moyen
```

### Étape 3 — Décision finale

```
Admin → Accepte : email envoyé avec identifiants d'accès [status: ACCEPTED]
Admin → Rejette : porteur reçoit motifs de rejet   [status: REJECTED]
```

---

## API Reference

### Auth (`/api/auth`)
```
POST /api/auth/login           → {token, userId, email, firstName, lastName, role}
POST /api/auth/register        → {token, ...}
GET  /api/auth/me              → UserDto (Bearer required)
GET  /api/auth/validate        → UserDto (Bearer required)
GET  /api/auth/users           → UserDto[] (ADMIN only)
GET  /api/auth/users/role/JURY → UserDto[] (ADMIN only)
PATCH /api/auth/users/{id}/toggle-active (ADMIN)
```

### Sessions (`/api/sessions`)
```
GET   /api/sessions            → SessionDto[] (public)
GET   /api/sessions?status=OPEN
GET   /api/sessions/{id}       → SessionDto (public)
POST  /api/sessions            → (ADMIN) create
PUT   /api/sessions/{id}       → (ADMIN) update
PATCH /api/sessions/{id}/status → {status: OPEN|EVALUATION|CLOSED|CANCELLED}
GET   /api/sessions/stats      → (ADMIN) {total,open,evaluation,closed,cancelled}
```

### Candidatures (`/api/candidatures`)
```
POST  /api/candidatures                → (PORTEUR) submit
GET   /api/candidatures                → (ADMIN/JURY) all, ?status=&sessionId=
GET   /api/candidatures/my             → (PORTEUR) own candidature(s)
GET   /api/candidatures/{id}           → full detail
GET   /api/candidatures/session/{id}   → (ADMIN/JURY) by session
POST  /api/candidatures/{id}/assign-jury   → (ADMIN) {juryAssignments:[{juryId,juryEmail,juryName}]}
POST  /api/candidatures/{id}/evaluate      → (JURY) {innovationScore,feasibilityScore,marketImpactScore,teamQualityScore,comment}
PATCH /api/candidatures/{id}/accept        → (ADMIN)
PATCH /api/candidatures/{id}/reject        → (ADMIN) {reason}
GET   /api/candidatures/stats              → (ADMIN)
```

---

## Structure du projet

```
Medianet/
├── docker-compose.yml
├── backend/
│   ├── api-gateway/           Spring Cloud Gateway (port 8080)
│   ├── auth-service/          JWT auth + user management (port 8081)
│   ├── session-service/       Session lifecycle (port 8082)
│   └── candidature-service/   Application workflow (port 8083)
└── frontend/
    ├── frontoffice/           Angular 17 — porteurs (port 4200)
    └── backoffice/            Angular 17 — admins (port 4300)
```

---

## Développement local (sans Docker)

### Backend : lancer un service individuel

```bash
cd backend/auth-service
./mvnw spring-boot:run
```

> Assurez-vous d'avoir PostgreSQL sur le port correspondant et définissez les variables d'environnement.

### Frontend : lancer en dev

```bash
cd frontend/frontoffice
npm install
npm start       # http://localhost:4200

cd frontend/backoffice
npm install
npm start       # http://localhost:4300
```

---

## JWT

- Secret partagé entre tous les services : `medianet-super-secret-jwt-key-2024-medianet-incubation`
- Expiration : 24h
- Claims : `sub` (email), `userId`, `role`, `firstName`, `lastName`
- Header : `Authorization: Bearer <token>`

---

## Base de données

Chaque service a sa propre base PostgreSQL (pattern microservice) :
- `auth_db` → users, roles
- `session_db` → sessions d'incubation
- `candidature_db` → candidatures, évaluations, jury assignments

Schema auto-créé par Hibernate (`ddl-auto: update`).
