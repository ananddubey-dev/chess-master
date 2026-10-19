# Project Memory

## Kingdom of Chess — Evidence-Based Handoff

**Last updated:** 19 October 2026  
**Purpose:** Record the product requirements, current source state, and remaining verification work without presenting unverified code as proven behavior.

## 1. Assignment and Required Stack

- Product: Kingdom of Chess real-time chess tournament module.
- Core journey: student joins tournament → server auto-matches students → live chess → persisted result → leaderboard.
- Backend: NestJS 11, strict TypeScript, PostgreSQL, Drizzle ORM/Drizzle Kit SQL migrations, Socket.IO, and `class-validator`.
- Frontend: Next.js App Router, React 19, strict TypeScript, Tailwind CSS, TanStack React Query, Socket.IO Client, `chess.js`, and `react-chessboard`.
- Local database: PostgreSQL through Docker Compose.
- Vite and Prisma are not part of the selected stack.

## 2. Workspace and Environment

- Workspace: `C:\Users\ADMIN\Desktop\chess`.
- Documentation is in `docs/`.
- `.env.example` is present; never record its values or other secrets here.
- Package manifests declare all application dependencies. A direct filesystem check found the Nest, Drizzle, Next, and chessboard packages absent from the expected `node_modules` locations, so install/restore dependencies before building.
- No root lockfile or generated Drizzle migration was present at the initial audit. Recheck after dependency installation and migration generation.
- Docker Engine and PostgreSQL health have not been checked in this implementation pass.
- No assignment PDF was found in the workspace snapshot.

## 3. Initial Baseline

The prior memory entry documented a scaffold-only state: health endpoint, DB schema/provider, Next.js landing page, and query provider. Authentication, tournament behavior, matchmaking, live game logic, results, and leaderboard were missing. That assessment described the pre-implementation state and is no longer current.

## 4. Implementation Added in This Pass

### API source

- Email/password login, bcrypt verification, JWT httpOnly cookie, logout, `/auth/me`, `/me`, authenticated user lookup, and coach/student authorization guards.
- Tournament list/detail/create/update/delete, lifecycle checks, student join eligibility, participant counts, tournament matches, leaderboard, and coach/student match history.
- Safe draft-only tournament deletion and configuration locking once matches exist.
- Persisted FIFO queue and transaction-locked pairing; only registered students can queue, active players are rejected, and queue cancellation is supported.
- Authenticated Socket.IO handshake and payload validation; participant-authorized match joins; participant-specific state broadcasts.
- Server-authoritative `chess.js` move validation, PGN/FEN persistence, server-timestamp clocks, increment, timeout sweep, resignation, checkmate/stalemate/draw, and idempotent transactional score finalization.
- A repeatable local seed script creates one coach and four students; local credentials are documented in root `README.md`, not in this memory file.
- Global REST validation and standardized API exception responses.

### Web source

- Login screen, role-aware dashboard, tournament create/edit/status/delete controls for coaches, browse/join/matchmaking for students, standings, history, queue state, and responsive layouts.
- Live-match screen with board, player clocks, turn status, PGN, manual-square alternative to dragging, connection indicator, resignation, results, and Socket.IO reconnect state recovery.
- Shared cookie-enabled API client and TanStack React Query usage.

### Documentation

- Root and app READMEs now include local setup, seed accounts, core REST routes, socket event directions/payloads, two-browser walkthrough, decisions, and limitations.
- `docs/architecture.md`, `docs/phase.md`, and this file are being kept aligned with source and verification status.

## 5. Current Verification Status

**Not run in this pass (per the user's instruction to defer tests):**

- Unit tests, e2e tests, and browser tests.

**Still unverified:**

- Dependency installation/lockfile creation.
- API and web TypeScript builds/lint.
- Drizzle migration generation/application.
- Docker/PostgreSQL health, seed execution, API health request, and browser/two-student match.
- Runtime behavior and strict type correctness of the new code.

Source presence is not proof of operation. Do not describe the end-to-end flow as passed until these gates are completed.

## 6. Decisions and Known Limitations

- API is authoritative for identity, permissions, matchmaking, legal chess state, clocks, results, and scoring.
- Queue pairing and result scoring are PostgreSQL-backed; the target is one API process, not horizontally scaled instances.
- Timeout sweeps run every three seconds in the API process.
- Promotion auto-selects queen; no draw-offer UI or spectator mode.
- Equal point totals share rank, with names used for stable ordering; no head-to-head tiebreak.
- No Redis, microservices, or Kubernetes are required for the MVP.
- Avoid changing or deleting user files outside task scope.

## 7. Submission Next Steps

1. Restore dependencies from the root manifest and create the npm lockfile.
2. Generate/review the Drizzle SQL migration.
3. Build and lint API and web without running tests.
4. Start PostgreSQL, apply migrations, run the local seed, and verify health plus login.
5. Once the user authorizes testing, run the critical domain tests and exercise a two-student browser match.
6. Update this handoff with actual command outcomes; keep every incomplete runtime acceptance item explicit.
