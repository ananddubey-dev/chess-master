# Kingdom of Chess

Kingdom of Chess is a real-time tournament app for academy coaches and students. The API owns authentication, tournament rules, FIFO matchmaking, legal chess state, clocks, results, and points; the web app renders the resulting state.

## Stack

- **API:** NestJS 11, strict TypeScript, REST under `/api/v1`, Socket.IO, `class-validator`.
- **Database:** PostgreSQL 16, Drizzle ORM, Drizzle Kit SQL migrations.
- **Web:** Next.js App Router, React 19, Tailwind CSS, TanStack React Query, Socket.IO Client, `react-chessboard`.
- **Chess:** `chess.js` on the server for move validation and PGN, plus the React board for interaction.

Vite and Prisma are not used.

## Implemented scope

- Email/password sign-in with bcrypt hashes and an `httpOnly` JWT cookie; logout and `/auth/me`.
- Coach-owned tournament CRUD with lifecycle validation; student registration and duplicate-join protection.
- Persisted FIFO queue, transactional pair creation, player colors, time controls, and queue cancellation.
- Authenticated Socket.IO rooms and participant-only match snapshots.
- Server-validated chess moves, persisted FEN/PGN, increment clocks, timeout/checkmate/stalemate/draw/resignation results, and transactional point updates.
- Standings with points ordering, shared rank for ties, stable alphabetical ordering, and a winner only for completed tournaments.
- Responsive coach/student workspace, login, tournament controls, standings, match history, and live board.

Source is implemented but has **not yet been build- or runtime-verified** in this workspace. No test suite has been run. Do not treat this list as evidence that the end-to-end flow has passed.

## Local setup (Windows PowerShell)

Prerequisites: Node.js/npm and Docker Desktop with the Linux engine running.

1. Copy `.env.example` to `.env`. Use a local-only database password and a random `JWT_SECRET` with at least 32 characters. Never commit `.env`.
2. Install workspace dependencies from the repository root:

   ```powershell
   npm install
   ```

3. Start PostgreSQL and confirm it is healthy:

   ```powershell
   docker compose up -d db
   docker compose ps
   ```

4. Generate and apply the Drizzle migration, then create local assessment accounts:

   ```powershell
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

   Review generated SQL in `apps/api/drizzle/` before applying it. The migration and seed commands have not yet been run in this workspace.

5. Start the API and web app in separate terminals:

   ```powershell
   npm run dev:api
   npm run dev:web
   ```

   Open `http://localhost:3001`; the API uses `http://localhost:3000`.

### Seed accounts (local development only)

| Role | Email | Password |
| --- | --- | --- |
| Coach | `coach@kingdomchess.local` | `Coach123!` |
| Student | `aarav@kingdomchess.local` | `Student123!` |
| Student | `anaya@kingdomchess.local` | `Student123!` |
| Student | `kabir@kingdomchess.local` | `Student123!` |
| Student | `isha@kingdomchess.local` | `Student123!` |

These credentials are for a local disposable database only. Change/remove seed accounts before using any shared or deployed environment.

## Play a local game

1. Sign in as the coach, create a tournament, then choose **Open registration**.
2. Open two separate browser profiles (or one normal and one private window).
3. Sign in with two different student accounts, join the open tournament, and choose **Find opponent**.
4. Both students should be routed to the same match. Make moves by dragging pieces or entering source/destination squares; either player can resign.
5. Sign back in as the coach to inspect standings and match results.

## REST API

- `GET /api/v1/health`
- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `GET /api/v1/me`
- `GET /api/v1/tournaments`, `GET /api/v1/tournaments/:id`
- Coach-only: `POST /api/v1/tournaments`, `PATCH /api/v1/tournaments/:id`, `DELETE /api/v1/tournaments/:id`
- Student-only: `POST /api/v1/tournaments/:id/join`
- `GET /api/v1/tournaments/:id/leaderboard`, `GET /api/v1/tournaments/:id/matches`
- `GET /api/v1/matches/mine`, participant-only `GET /api/v1/matches/:id`
- Participant-only REST fallbacks: `POST /api/v1/matches/:id/move`, `POST /api/v1/matches/:id/resign`

Success bodies use `{ "success": true, "data": ... }`; REST errors use a consistent error envelope. The session cookie is `httpOnly`, `SameSite=Lax`, and `Secure` in production.

## Socket.IO events

All socket connections authenticate with the `kc_session` cookie. The API does not accept client-provided user IDs or roles.

| Event | Direction | Payload / result |
| --- | --- | --- |
| `queue:join` | client → server | `{ tournamentId }`; server sends `queue:waiting` or `queue:matched`. |
| `queue:cancel` | client → server | `{ tournamentId }`; marks the caller's waiting entry cancelled. |
| `queue:waiting` | server → client | `{ tournamentId }` after a persisted queue entry is accepted. |
| `queue:matched` | server → paired students | `{ tournamentId, matchId }` after one match is persisted. |
| `match:join` | client → server | `{ matchId }`; only participants may join, then receive `match:state`. |
| `match:state` | server → joining participant | Authoritative FEN, PGN, player/color, status, and clock snapshot. |
| `match:move` | client → server | `{ matchId, from, to, promotion? }`; server validates turn, participant, and legality. |
| `match:move:accepted` | server → both participants | New participant-specific authoritative snapshot. |
| `match:resign` | client → server | `{ matchId }`; final result is persisted once. |
| `match:finished` | server → both participants | Final authoritative snapshot and persisted result. |
| `match:error` | server → requester | `{ code, message }` for rejected socket actions. |

Socket event acknowledgements also return `{ success, data }` or `{ success: false, error }`.

## Decisions and known limitations

- Matchmaking is FIFO and PostgreSQL-backed; this single-process MVP does not use Redis or coordinate horizontally scaled API instances.
- The timeout worker runs in the API process and checks active games every three seconds. Run a single API instance for the MVP.
- Pawn promotion currently auto-promotes to a queen; there is no draw-offer UI or spectator mode.
- Ranking uses points, shared rank for equal points, then stable alphabetical ordering; it does not implement head-to-head tiebreaks.
- Socket reconnect rejoins the match and reloads the persisted board/clock snapshot.
- Automated tests, compilation, migration application, Docker health, API health, and the two-browser flow remain to be verified.

## Documentation

- [`docs/prd.md`](./docs/prd.md): requirements and acceptance criteria.
- [`docs/design.md`](./docs/design.md): screens, interactions, and accessibility.
- [`docs/architecture.md`](./docs/architecture.md): technical architecture and implementation details.
- [`docs/phase.md`](./docs/phase.md): current implementation plan and verification gates.
- [`docs/rules.md`](./docs/rules.md): engineering and security rules.
- [`docs/memory.md`](./docs/memory.md): latest evidence-based handoff.
