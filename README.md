# Kingdom of Chess

A real-time chess tournament application for coaches and students. The product requirements, design, architecture, implementation phases, and engineering rules are documented in [`docs/`](./docs/).

## Required stack

- **API:** NestJS 11, strict TypeScript, REST under `/api/v1`, Socket.IO, and `class-validator`.
- **Database:** PostgreSQL with Drizzle ORM and Drizzle Kit SQL migrations, using Docker Compose locally.
- **Web:** Next.js App Router, React 19, strict TypeScript, Tailwind CSS, and shadcn/ui.
- **Client data and chess UI:** TanStack React Query, Socket.IO Client, `chess.js`, and `react-chessboard`.

Vite and Prisma are not part of the required stack. The current manifests and source use Next.js and Drizzle; no Vite configuration or Prisma schema was found in the repository during the latest audit.

## Current status (17 October 2026)

- The Next.js and NestJS workspace manifests, app scaffolds, strict TypeScript configurations, Drizzle schema/configuration, and PostgreSQL provider are present.
- Workspace dependencies resolve with `npm ls --depth=0 --workspaces` (exit 0). There is no root `package-lock.json`.
- `docker compose config --quiet` succeeds. Docker Engine was not reachable when checking container status, so PostgreSQL health is currently unverified.
- Drizzle SQL migrations have not been generated or applied. App builds, tests, and an end-to-end tournament flow have not been verified.
- The API currently has a database-backed health route; authentication, tournament management, matchmaking, live-game behavior, and leaderboard features remain to be implemented.

See [`docs/phase.md`](./docs/phase.md) for the evidence-based checklist and [`docs/memory.md`](./docs/memory.md) for the latest audit details.

## Local setup

Prerequisites: Node.js/npm and Docker Desktop with its Linux engine running.

1. Copy `.env.example` to `.env`, then replace local placeholder secrets and verify the connection settings.
2. Install workspace dependencies and generate a lockfile:

   ```powershell
   npm install
   ```

3. Start PostgreSQL and confirm it is healthy:

   ```powershell
   docker compose up -d db
   docker compose ps
   ```

4. Generate and apply the Drizzle migration:

   ```powershell
   npm run db:generate
   npm run db:migrate
   ```

   Review the generated SQL before applying it. The migration flow has not yet been run in this workspace.

5. Start the API and web app in separate terminals:

   ```powershell
   npm run dev:api
   npm run dev:web
   ```

The configured web port is `3001`; the API listens on `3000`. The application builds and runtime health check are not yet verified. No seed command/account credentials exist yet, so authentication and the tournament flow cannot currently be assessed.

## Product and UX

The core journey is: coach opens a tournament → students join → the server pairs students → players complete a live game → persisted results update the leaderboard. The server must remain authoritative for authorization, legal moves, clocks, match completion, and scoring.

## Documentation

- [`docs/prd.md`](./docs/prd.md): functional requirements and acceptance criteria.
- [`docs/design.md`](./docs/design.md): screens, interaction, and accessibility.
- [`docs/architecture.md`](./docs/architecture.md): target architecture and current repository audit.
- [`docs/phase.md`](./docs/phase.md): implementation checklist and verification gates.
- [`docs/rules.md`](./docs/rules.md): engineering and security constraints.
- [`docs/memory.md`](./docs/memory.md): verified handoff notes.
