# Kingdom of Chess API

NestJS 11 API using strict TypeScript, PostgreSQL, Drizzle ORM, and Socket.IO. REST responses use the `{ success, data }` envelope under `/api/v1`; authentication is stored in the `kc_session` httpOnly cookie.

## Features

- Bcrypt password verification, JWT cookie login/logout, `/auth/me` and `/me`.
- Coach-owned tournament lifecycle and student browse/join endpoints.
- Transactional PostgreSQL queue pairing and idempotent result/score finalization.
- Participant-authorized Socket.IO matchmaking and live chess, validated with `chess.js`.
- PostgreSQL-backed clocks, FEN, PGN, match results, and standings.

## Run locally

From the repository root, copy `.env.example` to `.env`, start PostgreSQL, and then run:

```powershell
npm install
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
```

Review generated migration SQL in `apps/api/drizzle/` before applying it. `DATABASE_URL`, `JWT_SECRET`, `API_PORT`, and `FRONTEND_URL` are validated at startup. Keep `.env` local and use a random JWT secret in any shared environment.

Local assessment accounts:

- Coach: `coach@kingdomchess.local` / `Coach123!`
- Students: `aarav@kingdomchess.local`, `anaya@kingdomchess.local`, `kabir@kingdomchess.local`, `isha@kingdomchess.local` / `Student123!`

Seed credentials are only for a disposable local database.

## Socket events

| Event | Direction | Payload |
| --- | --- | --- |
| `queue:join` / `queue:cancel` | client → server | `{ tournamentId }` |
| `queue:waiting` | server → client | `{ tournamentId }` |
| `queue:matched` | server → paired players | `{ tournamentId, matchId }` |
| `match:join` | client → server | `{ matchId }` |
| `match:state` | server → authorized participant | Authoritative FEN, PGN, clocks, and player colors. |
| `match:move` | client → server | `{ matchId, from, to, promotion? }` |
| `match:move:accepted` | server → both players | Accepted authoritative state. |
| `match:resign` | client → server | `{ matchId }` |
| `match:finished` | server → both players | Final result and state. |
| `match:error` | server → requester | `{ code, message }` |

Every connection is authenticated from the session cookie. Room membership and game actions are checked against the authenticated player; client identity, role, and clock values are never trusted.

## Validation

```powershell
npm run build --workspace @kingdom-chess/api
npm run test --workspace @kingdom-chess/api
npm run test:e2e --workspace @kingdom-chess/api
npm run lint --workspace @kingdom-chess/api
```

These commands have not been run for the current implementation. Matchmaking uses a database-backed FIFO queue and is intended for a single API process; multi-instance coordination, Redis, draw offers, and spectator access are out of scope.
