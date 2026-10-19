# Kingdom of Chess API

NestJS 11 API workspace using strict TypeScript, PostgreSQL, Drizzle ORM, and Drizzle Kit SQL migrations. REST routes are prefixed with `/api/v1`; Socket.IO is the required transport for real-time gameplay.

## Current foundation

- `src/main.ts` configures the `/api/v1` prefix, credentialed CORS, and a global `class-validator` validation pipe.
- `src/app.controller.ts` exposes `GET /api/v1/health` and checks PostgreSQL connectivity.
- `src/db/schema.ts`, `src/db/database.service.ts`, and `drizzle.config.ts` define the initial Drizzle/PostgreSQL foundation.
- The authentication, tournament, matchmaking, match, and leaderboard modules are not implemented yet.
- Dependency resolution succeeded at the workspace root. API build, tests, health response, and migrations have not been verified.

## Local development

From the repository root, configure `.env` using `.env.example`, ensure Docker Desktop is running, and then run:

```powershell
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run dev:api
```

`db:generate` and `db:migrate` target the API workspace. Review generated SQL migrations before applying them. The database service must be reachable before migration or API startup; these commands have not yet been verified end to end.

The API uses `DATABASE_URL`, `JWT_SECRET`, `API_PORT`, and `FRONTEND_URL`. Configure valid local values in the root `.env`; do not commit `.env` or put secrets in browser-visible variables.

## Useful commands

Run from the repository root:

```powershell
npm run build --workspace @kingdom-chess/api
npm run test --workspace @kingdom-chess/api
npm run test:e2e --workspace @kingdom-chess/api
npm run lint --workspace @kingdom-chess/api
```

These commands are documented entry points, not claims that the checks have passed.
