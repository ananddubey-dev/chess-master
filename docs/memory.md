# Project Memory
## Kingdom of Chess — Verified Working Context

**Purpose:** Evidence-based handoff of requirements, repository state, completed checks, and next work. A present source file or package declaration is not proof that its behavior works.

## 1. Assignment and Required Stack

- Company: Kingdom of Chess; full-stack take-home assignment for a real-time chess tournament module.
- Deadline: before 18 October 2026.
- Core journey: student joins tournament → server auto-matches students → live chess → persisted result → leaderboard.
- Backend: NestJS 11, strict TypeScript, PostgreSQL, Drizzle ORM/Drizzle Kit SQL migrations, Socket.IO, and `class-validator` DTO validation.
- Frontend: Next.js App Router, React 19, strict TypeScript, Tailwind CSS, shadcn/ui, TanStack React Query, Socket.IO Client, `chess.js`, and `react-chessboard`.
- Local database: PostgreSQL through Docker Compose.
- **Stack correction:** Next.js App Router + React 19 is required, not Vite. Drizzle ORM is required, not Prisma.

## 2. Environment and Repository

- OS: Windows; editor: VS Code.
- Workspace: `C:\Users\ADMIN\Desktop\multiplayer-chess`.
- Documentation directory: `docs/` (not `doc/`).
- Git repository: branch `master`, no commits; latest status showed project files untracked.
- Node.js `v24.19.0`; npm `11.17.0`.
- Root `package-lock.json` is absent. Workspace `node_modules` exists, and the npm dependency tree resolves.
- Docker Engine was not reachable during this audit; database container health is unknown.
- No assignment PDF was found in the repository.
- Never record actual `.env` values or credentials in this file.

## 3. Actual Repository Audit

Found in the current workspace:
- `apps/api/` has NestJS 11 package declarations, strict TypeScript config, a `/api/v1/health` controller that checks PostgreSQL, Drizzle ORM schema/configuration, and a PostgreSQL pool/provider.
- `apps/web/` has Next.js App Router and React 19 package declarations, strict TypeScript config, Tailwind, a landing page, and a TanStack React Query provider.
- Workspace manifests declare Socket.IO support, `class-validator`, `chess.js`, and `react-chessboard`.
- Root scripts cover API/web development, builds/tests/lint, Docker database startup, and Drizzle generation/migration.
- No Vite config, Prisma schema/directory, generated Drizzle SQL migration directory, seed implementation, or root lockfile was found.
- Authentication, roles/authorization, tournaments, matchmaking, live match logic, and leaderboard behavior are not implemented.
- Presence of a health controller, schema, and scripts does not prove runtime functionality.

## 4. Commands Run and Results (2026-10-17)

- `node --version` → `v24.19.0`.
- `npm --version` → `11.17.0`.
- `npm ls --depth=0 --workspaces` → exit code 0; declared workspace dependencies resolve.
- `docker compose config --quiet` → exit code 0; Compose configuration parses.
- `docker compose ps` → could not connect to the Docker Desktop Linux engine pipe; container status/health not verified.
- `git --no-pager status --short --branch` → `master` has no commits; project files are untracked.
- No app build, unit/e2e test, migration generation/application, API health request, or browser flow was run.

## 5. Current Progress and Remaining Work

Completed/verified:
- Required-stack package manifests and starter files are present.
- API/web TypeScript configs are strict.
- Drizzle schema, config, database provider, and health route exist.
- Workspace dependency resolution and Docker Compose syntax checks pass.
- Documentation was reconciled with actual current scaffold and stack state.

Next actions:
1. Start Docker Desktop; confirm PostgreSQL is healthy with `docker compose up -d db` and `docker compose ps`.
2. Run `npm install` from the root to create a reproducible npm lockfile.
3. Review Drizzle schema, generate SQL migration with `npm run db:generate`, and apply it with `npm run db:migrate`.
4. Build and start API/web; verify `GET /api/v1/health` against the running database.
5. Initialize shadcn/ui; add deterministic seed/auth, tournament flows, matchmaking, authoritative gameplay, results, and leaderboard.
6. Add and run critical domain/authorization tests, then verify two-player browser flow.

## 6. Data Model Direction

The existing Drizzle schema contains `users`, `tournaments`, `participants`, `matches`, and `queue_entries` tables with role/status enums, relational constraints, and indexes. This is schema source code only; SQL migrations have not been generated or applied.

## 7. Important Decisions

- Next.js App Router/React 19 and Drizzle/PostgreSQL are the required choices.
- No Vite configuration or Prisma schema was found; do not migrate or restore those stacks.
- Preserve user files and inspect before destructive changes.
- Keep the API authoritative for authorization, matchmaking, legal chess state, clocks, and scoring.
- Prefer transactional/idempotent result finalization and concurrency-safe matchmaking.
- Avoid Redis, Kubernetes, microservices, and unrelated infrastructure for the MVP.
- Keep known limitations explicit; do not claim unverified features or commands passed.
