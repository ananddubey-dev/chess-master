# Product Requirements Document (PRD)
## Kingdom of Chess — Tournament Module

**Status:** Requirements documented; required-stack implementation remains incomplete  
**Deadline:** 18 October 2026  
**Product:** Real-time online chess tournament module for Kingdom of Chess  
**Primary goal:** Deliver a working path from joining a tournament → auto-matching → playing a live match → seeing the result on the leaderboard.

## 0. Required Technology Stack
This stack is the source of truth for implementation:
- Backend: NestJS 11, strict TypeScript, PostgreSQL, Drizzle ORM with SQL migrations, Socket.IO, and `class-validator` DTO validation.
- Frontend: Next.js App Router, React 19, strict TypeScript, Tailwind CSS, shadcn/ui, TanStack React Query, Socket.IO Client, `chess.js`, and a React-19-compatible chessboard UI component.
- Local database: PostgreSQL through Docker Compose.
- Do not use Vite as the frontend framework or Prisma as the ORM unless the assignment requirements are explicitly changed. The current repository audit found neither; if legacy files are encountered later, inspect them but do not build new features on those choices.

## 1. Product Overview
Kingdom of Chess is an online chess academy for kids in India. This assignment builds a self-contained tournament module where coaches manage tournaments and students play live 1-on-1 chess games.

The most important outcome is a reliable real-time experience: both players see the same legal moves and game result, clocks behave consistently, and completed results update tournament standings.

## 2. Users and Roles
### Coach
- Create, read, update, and delete tournaments, subject to safe lifecycle rules.
- Configure tournament name, start date/time, time control, and status.
- View participants, matches, standings, per-match results, and winner after completion.
- Does not manually choose opponents; matchmaking is server-controlled.

### Student
- Sign in and view open or ongoing tournaments.
- Join an open tournament.
- Enter the matchmaking queue using **Find opponent**.
- Play a live match when paired.
- View the board, clocks, PGN/move list, result, match history, schedule, ranking, and leaderboard.
- Re-queue after a completed match when tournament rules permit.

## 3. Required Functional Requirements
### FR-01 Authentication and Authorization
- Email/password login.
- Passwords stored as secure hashes, never plaintext.
- JWT delivered in an `httpOnly` cookie.
- Protected REST routes and a `GET /api/v1/me` endpoint.
- Coach and Student permissions enforced on both frontend and backend.
- Socket.IO connections authenticated.
- Only a logged-in participant of a match may join that match's room.
- Seed one coach and at least four students; document credentials in README for local assessment.

### FR-02 Tournament Management
- Tournament fields: name, time control, start date/time, status.
- Statuses: `DRAFT`, `OPEN`, `ONGOING`, `COMPLETED` (persisted enum naming may use uppercase).
- Coach can manage tournaments and inspect tournament stats.
- Students can join tournaments that are open and eligible.
- Validate lifecycle transitions and prevent unsafe edits/deletes after matches begin.

### FR-03 Matchmaking
- Students request an opponent within a tournament.
- Server pairs two eligible waiting students automatically.
- Pairing is atomic to prevent one student being assigned to multiple active matches.
- Both players are notified through Socket.IO and routed to the match without manual refresh.
- After a game ends, eligible students can queue again.
- Initial policy: FIFO queue; document limitations.

### FR-04 Live Chess
- Two-way move synchronization via Socket.IO.
- `chess.js` is used for legal chess rules and PGN generation; do not hand-roll chess rules.
- Server is authoritative for move validation and accepted game state.
- Both players see a shared turn clock; when a player's time reaches zero, that player loses on time.
- Record move history/PGN and persist it when the game ends.
- Handle checkmate, resignation, timeout, stalemate, and draw.
- Reject illegal moves, out-of-turn moves, and moves from non-participants.
- On disconnect/reconnect, avoid silently corrupting game state; reconnection restoration is a stretch goal unless time permits.

### FR-05 Results and Leaderboard
- Win = 1 point, draw = 0.5 point, loss = 0 points.
- Leaderboard ordered by points descending.
- Tiebreaker: use total points first, then a documented deterministic secondary rule (recommended: head-to-head where feasible, otherwise shared rank and stable name ordering). Do not claim a complex tiebreak is implemented unless it is.
- Match result and participant points must be persisted consistently, preferably in a database transaction.
- Show final winner when the tournament is completed.

### FR-06 API and Validation
- REST routes use `/api/v1`.
- Standard response envelope, for example `{ "success": true, "data": ... }`; errors use a consistent shape.
- DTO validation with `class-validator` for every REST input.
- Correct HTTP status codes and centralized exception handling.
- Paginate list endpoints if time permits; avoid unbounded production-style queries.

### FR-07 Frontend
- Next.js App Router and React 19 UI styled with Tailwind CSS and shadcn/ui.
- Login screen.
- Coach tournament management.
- Student tournament browse/join and schedule.
- Matchmaking waiting state.
- Live board with clocks and PGN/move list.
- Leaderboard, ranking, and match history.
- TanStack React Query for REST data; invalidate relevant cache after mutations.
- Socket.IO client for real-time events.
- Loading, error, success, and empty states; no silent failures.

### FR-08 Testing
Automated tests must cover:
- Result-to-points/leaderboard scoring.
- Tournament join eligibility/rules.
- Chess move legality and turn validation.
- Add tests for matchmaking concurrency and authorization if time permits.

### FR-09 Documentation
README must document:
- Prerequisites, environment variables, database setup, migrations, seed, and startup.
- Seed credentials.
- How to test a match locally with two students in separate browsers/profiles.
- Socket event names, payloads, and directions.
- Design decisions, trade-offs, and known limitations.

## 4. Non-Functional Requirements
- Strict TypeScript and clear module boundaries.
- Secure password hashing, httpOnly cookies, least-privilege authorization, and validated inputs.
- Server-authoritative chess state and clocks.
- Database constraints and transactions for critical state changes.
- Useful logs without passwords, JWTs, or secrets.
- Responsive, accessible UI with clear status feedback.
- Reproducible local setup with Docker Compose and migrations.
- Keep implementation understandable enough to explain in a live walkthrough.

## 5. Out of Scope for the Initial MVP
Unless all required features are working, do not prioritize:
- Redis or multi-server socket scaling.
- Microservices or Kubernetes.
- Spectator mode.
- Advanced draw offers, threefold repetition UI, or 50-move rule UI.
- Standings-based matchmaking.
- Full round-robin completion.
- Move-list position navigation.
- Complex analytics.

## 6. Acceptance Criteria
The MVP is accepted only when:
1. A seeded coach and students can log in.
2. Role-protected routes reject unauthorized roles.
3. A coach can create and open a tournament.
4. Two eligible students can join and be auto-paired.
5. Both players see legal moves from the same server state.
6. Clocks count down for the active player and timeout produces a result.
7. Checkmate, resignation, stalemate/draw outcomes are handled.
8. PGN and match result persist.
9. Leaderboard points reflect completed results.
10. Critical deterministic tests pass.
11. A clean setup is documented and reproducible.

## 7. Product Risks
- One-day timebox may force reduced UI polish or optional features.
- Socket reconnects and clock synchronization are common failure points.
- Matchmaking must be concurrency-safe.
- Result persistence and leaderboard scoring must not double-apply a result.
- Keep known limitations explicit in README and walkthrough.
