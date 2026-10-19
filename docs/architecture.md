# Architecture
## Kingdom of Chess — Technical Design

## 1. System Overview
A TypeScript monorepo with a Next.js App Router web client, a NestJS 11 REST and Socket.IO API, and PostgreSQL accessed through Drizzle ORM.

```text
Browser (Next.js App Router, React 19)
  ├── REST /api/v1 ──────────────────────┐
  └── authenticated Socket.IO client ────┤
                                          ▼
                                NestJS 11 Application
                                ├── Auth / Users
                                ├── Tournaments
                                ├── Matchmaking
                                ├── Matches / Game Engine
                                ├── Leaderboard
                                └── Socket.IO Gateway
                                          │
                                          ▼
                          PostgreSQL ← Drizzle ORM + SQL migrations
```

The API owns authentication, permissions, tournament rules, pairing, legal moves, clocks, and final results. The browser renders UI and sends user intent; it never decides authoritative game state or scores.

## 2. Required Stack
### Backend
- NestJS 11 and strict TypeScript.
- REST API versioned under `/api/v1`.
- PostgreSQL, Drizzle ORM, and Drizzle Kit-generated SQL migrations.
- Socket.IO gateway for authenticated matchmaking and live match events.
- `class-validator` / `class-transformer` DTO validation at REST boundaries.

### Frontend
- Next.js App Router, React 19, and strict TypeScript.
- Tailwind CSS and shadcn/ui for styling and accessible UI primitives.
- TanStack React Query for REST server state and cache invalidation.
- Socket.IO Client for matchmaking and live game events.
- `chess.js` for client-side chess utilities and a React-19-compatible chessboard component for board rendering.

Vite and Prisma are not part of the required architecture. The current workspace manifests use Next.js and Drizzle; the latest repository inspection found no Vite configuration or Prisma schema. Do not introduce either stack unless the assignment requirements change.

## 3. Repository Layout
```text
kingdom-chess/
├── apps/
│   ├── api/                         # NestJS 11 REST + Socket.IO
│   │   └── src/
│   │       ├── features/            # Auth, tournament, match services/controllers, gateway
│   │       └── db/                  # Drizzle schema and database provider
│   └── web/                         # Next.js App Router + React 19
│       └── src/
│           ├── app/                 # Login, workspace, and live-match routes
│           └── lib/                 # Cookie-enabled REST client
├── apps/api/drizzle/                # Generated SQL migrations and metadata
├── docs/
│   ├── prd.md
│   ├── design.md
│   ├── architecture.md
│   ├── phase.md
│   ├── rules.md
│   └── memory.md
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

Keep one Drizzle schema/migration location under `apps/api`; do not create duplicate schemas. The repository currently stores its documentation in `docs/`, which is preserved.

## 4. Backend Modules
- **Authentication:** `AuthService`, controllers, and guards provide email/password login, bcrypt hashing, JWT `httpOnly` cookie, logout, `/auth/me` and `/me`, plus role-based access.
- **Tournament and results:** `TournamentService` provides coach CRUD/lifecycle rules, student browse/join, membership, match history, standings, and winner selection.
- **Matchmaking and games:** PostgreSQL queue transactions pair FIFO entries; the Socket.IO gateway authenticates cookie sessions, validates events, authorizes rooms, broadcasts participant-specific snapshots, and runs the timeout sweep.
- **Chess and scoring:** `chess.js` validates server-side moves and PGN; match state is persisted, and result/points updates are transactional and idempotent.
- **DatabaseModule:** PostgreSQL connection and Drizzle schema/query provider.

These responsibilities currently live in `apps/api/src/features/`; the names above describe boundaries rather than separate Nest modules.

Keep controllers and gateways thin. Place business rules in services. Use DTOs for REST and validate socket payloads at the event boundary. Use database transactions for state changes spanning matches and participant scores.

## 5. Database Model and Migrations
The initial relational model should cover:
- `User`: unique email, password hash, display name, and coach/student role.
- `Tournament`: name, start time, time control, lifecycle status, and coach.
- `Participant`: tournament membership, score, and join time; unique `(tournamentId, userId)`.
- `Match`: tournament, assigned white/black players, status/result/end reason, PGN, FEN or replayable moves, clock state, and timestamps.
- `QueueEntry` (if persisted): tournament/user, waiting state, enqueue time, and safe claim/cancellation state.

Use Drizzle schema definitions and Drizzle Kit to generate versioned SQL migrations. Commit migration SQL and metadata. Apply migrations using the project's documented Drizzle Kit command only after the schema and environment are configured. Do not use Prisma schema/client/migration files or commands for the required implementation. If a legacy Prisma artifact is discovered later, inspect it and preserve it until any required data migration and replacement have been reviewed and verified.

Use PostgreSQL constraints for uniqueness and foreign keys. Represent time and score consistently. A fresh local seed should be deterministic and safe to rerun, with one coach and at least four students.

The seed upserts one local coach and four students by email. Pairing and result finalization use PostgreSQL transactions/row locks; migrations still need to be generated and applied in the target environment.

## 6. Chess State and Clock
- The API uses `chess.js`; do not hand-roll chess rules.
- Server state is authoritative. The client submits proposed moves; the server checks match status, participant identity, assigned color, active turn, move freshness, and legality.
- Persist sufficient state to restore the game (FEN plus move history/PGN and clock state, or a complete replayable move history).
- Calculate clocks from persisted remaining time and server timestamps, never from browser-reported values.
- Serialize or guard concurrent move, timeout, resignation, and result transitions.
- Finalize results through one idempotent transactional path that updates tournament points exactly once.
- After accepted moves, on match entry, and on reconnect, send an authoritative snapshot to both authorized participants.

## 7. Socket.IO Conventions
Authenticate the Socket.IO handshake using the same JWT/session policy as REST. Never trust a client-supplied user ID or role.

Suggested events (final payloads must match the implementation and README):
- `queue:join` — client → server; request matchmaking for an eligible tournament.
- `queue:waiting` — server → client; queue confirmation.
- `queue:matched` — server → the paired players; assigned match.
- `match:join` — client → server; request to join a match room.
- `match:state` — server → authorized participants; authoritative snapshot.
- `match:move` — client → server; proposed move.
- `match:move:accepted` — server → participants; accepted move and updated state.
- `match:resign` — client → server; resignation request.
- `match:finished` — server → participants; persisted final result.
- `match:error` — server → requester; structured rejection.

Validate event payloads and authorize room membership against the authenticated participant. Use acknowledgements or structured errors for rejected events. Emit state changes only after acceptance/persistence; duplicate delivery must not duplicate side effects.

## 8. REST Conventions
- Prefix all REST routes with `/api/v1`.
- Success shape: `{ "success": true, "data": ... }`.
- Error shape: `{ "success": false, "error": { "code": "...", "message": "...", "details": [] } }`.
- Validate every applicable body, query, and path DTO with `class-validator`.
- Use appropriate HTTP statuses: `400` invalid input, `401` unauthenticated, `403` forbidden, `404` missing, `409` state conflict, and `500` only for unexpected errors.
- Do not return password hashes, JWTs, secrets, or internal stack traces.

## 9. Authentication and Security
- Hash passwords with a suitable password-hashing algorithm.
- Deliver JWTs in `httpOnly` cookies; set `secure` and `sameSite` deliberately for local and production environments.
- Configure credentialed CORS for an explicit allowed web origin, never wildcard origin.
- Protect private routes and enforce Coach/Student permissions on the server.
- Consider CSRF protection appropriate to cookie authentication.
- Validate all DTOs and socket payloads; never log passwords, cookies, JWTs, or secrets.
- Keep real environment files out of Git; `.env.example` contains placeholders only.

## 10. Concurrency and Consistency
- Pairing must atomically claim two eligible waiting users; prevent self-pairing and multiple simultaneous active matches per student.
- Use appropriate constraints/transactions and row-level locking or equivalent PostgreSQL-safe claim logic for queue pairing.
- A match finalization and score update must be transactional and idempotent.
- Guard concurrent move/timeout transitions with serialization or a state/version check.
- An in-memory queue is acceptable only as an explicitly documented single-process, non-durable limitation; prefer persisted queue entries for this assignment.

## 11. Frontend Data Flow
- Use Next.js App Router layouts and routes; keep client components limited to interactive UI.
- Use React 19, strict TypeScript, Tailwind CSS, and shadcn/ui components in line with `design.md`.
- Use TanStack React Query for REST requests, caching, loading/error state, and mutation invalidation.
- Use Socket.IO Client for transient live events. Reconcile events and reconnects against API snapshots.
- Use a shared REST client with cookie credentials enabled.
- Use `chess.js` only for client-side utilities/interaction; the server remains authoritative.
- Render the board using a maintained, React-19-compatible component; keep clocks, turn, connection status, moves, and results visible and accessible.
- Frontend role checks improve UX but are not a security boundary.

## 12. Environment and Local Infrastructure
Docker Compose runs PostgreSQL for local development. Bind its published port to loopback and use a named volume for persistence. It must not publish the database to external interfaces by default.

Keep secrets only in an ignored local `.env`; provide placeholders in `.env.example`. Expected settings include:
- `DATABASE_URL`: PostgreSQL connection string consumed by Drizzle.
- `JWT_SECRET`: sufficiently long random signing secret.
- `API_PORT`: NestJS listen port.
- `FRONTEND_URL`: exact allowed web origin for credentialed CORS.
- `NEXT_PUBLIC_API_URL`: browser-facing REST base URL; do not place secrets in `NEXT_PUBLIC_*` variables.
- PostgreSQL database/user/password/port settings used by Compose.

Validate required backend environment settings at startup and fail clearly when absent. Document commands only after the package scripts and required-stack setup have been verified.

## 13. Current Repository Audit
Repository and command checks performed on 2026-10-17:
- Git repository is on `master` with no commits; the project files are currently untracked.
- `apps/api` contains a NestJS 11 scaffold, strict TypeScript configuration, Drizzle Kit configuration, a Drizzle schema, PostgreSQL database provider, global DTO validation, and a database-backed health controller.
- `apps/web` contains a Next.js App Router/React 19 scaffold, strict TypeScript configuration, a TanStack React Query provider, and a placeholder landing page.
- Workspace manifests declare the required client dependencies, including Socket.IO Client, `chess.js`, and `react-chessboard`; API packages include Nest Socket.IO support and `class-validator`.
- No Vite configuration, Prisma schema/directory, generated Drizzle migration directory, or root `package-lock.json` was found.
- `npm ls --depth=0 --workspaces` completed with exit code 0. This verifies workspace dependency resolution, not app compilation or runtime behavior.
- `docker compose config --quiet` completed with exit code 0. Docker status could not be checked because the Docker Desktop Linux engine pipe was unavailable; PostgreSQL health is therefore unverified in this audit.
- No Drizzle migration has been generated or applied, and no app build, test suite, API health request, or end-to-end feature flow has been verified.
- No assignment PDF was found in the workspace.

Treat this inventory as the current baseline. The architecture above describes the intended system; it does not imply that the missing business modules, migrations, or user journeys are implemented.

## 14. Deployment and Operations
Production would require TLS, durable secrets management, database backups, monitoring, rate limits, and shared Socket.IO infrastructure/state for horizontal scaling. Durable queue and multi-instance coordination must be designed before scaling beyond one API process. These are outside the first MVP unless the core acceptance criteria are already met.
