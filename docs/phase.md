# Implementation Phases
## Required-Stack Plan and Verification Checklist

**Deadline:** Before 18 October 2026  
**Strategy:** The required-stack scaffold is already present. Verify and finish its foundation, then deliver the smallest complete end-to-end tournament flow. Do not spend time on optional polish before core acceptance criteria work.

## Status Legend
- `[ ]` Not started / not verified
- `[~]` Partially present or in progress; not yet verified as working
- `[x]` Verified by inspecting the repository or running the stated check
- `[!]` Blocked; reason must be stated

Only mark implementation/runtime tasks complete after actual repository evidence and the corresponding command/test prove them.

## Repository Baseline — 17 October 2026
Verified by file inspection and commands:
- [x] Inspected root/app manifests, Docker Compose, environment sample, and project Markdown files.
- [x] Git repository is on `master` with no commits; `git status --short --branch` shows project files as untracked.
- [x] Next.js App Router + React 19 scaffold is present in `apps/web/`; no Vite config was found.
- [x] NestJS 11 scaffold, strict TypeScript config, Drizzle schema/configuration, and PostgreSQL provider are present in `apps/api/`; no Prisma files were found.
- [x] `npm ls --depth=0 --workspaces` completed with exit code 0; workspace dependencies resolve.
- [x] `docker compose config --quiet` completed with exit code 0.
- [ ] No root `package-lock.json` exists yet.
- [ ] Docker Engine was unreachable during `docker compose ps`; database container health is not verified.
- [ ] Drizzle SQL migrations have not been generated or applied.
- [ ] App builds, API health request, and feature tests have not been run/verified.
- [ ] shadcn/ui configuration/components have not been initialized.
- [x] No assignment PDF was found in the repository.

## Phase 0 — Required-Stack Foundation and Verification
**Priority:** P0

### 0A. Required-stack scaffolds
- [x] Inspect the existing app contents, manifests, and scripts before planning further setup.
- [x] `apps/web` has a Next.js App Router + React 19 scaffold, strict TypeScript configuration, and Tailwind CSS.
- [x] `apps/api` has a NestJS 11 scaffold and strict TypeScript configuration.
- [ ] Initialize shadcn/ui and verify its component configuration.
- [x] Declare TanStack React Query, Socket.IO Client, `chess.js`, and `react-chessboard`; the web app has a QueryClient provider.
- [x] Add Drizzle ORM schema, Drizzle Kit configuration, and PostgreSQL pool/database service; verify SQL generation and migration below.
- [x] Set TypeScript strict mode for both apps.
- [x] Align workspace scripts and sample environment names with Next.js (`NEXT_PUBLIC_API_URL`) and Drizzle.
- [x] No Vite configuration or Prisma schema/directory was found; a legacy-stack migration is not currently needed.

### 0B. Verify foundation
- [x] Docker Compose configuration parses.
- [x] `npm ls --depth=0 --workspaces` resolves declared dependencies (exit 0).
- [ ] Create and commit the root npm lockfile with the selected workspace dependencies.
- [ ] Docker Engine starts PostgreSQL and `docker compose ps` confirms it is healthy.
- [ ] Drizzle schema/migrations generate and apply successfully to PostgreSQL.
- [ ] NestJS starts; `GET /api/v1/health` returns a successful database check.
- [ ] Next.js starts and builds; verify the frontend can call the API from the configured origin.
- [ ] Verify credentialed CORS, DTO validation, and required environment validation at runtime.
- [ ] Confirm `.env` is ignored and no secrets are tracked.

**Acceptance criteria:** Next.js and NestJS start from documented commands; PostgreSQL accepts a reviewed Drizzle migration; the API health route and browser frontend respond; strict TypeScript builds pass.

## Phase 1 — Authentication and Seed
**Priority:** P0
- [ ] Validate required environment variables on startup.
- [ ] Implement password hashing, email/password login, JWT `httpOnly` cookie, logout, and `GET /api/v1/me`.
- [ ] Add authentication guard and Coach/Student role guard/decorator.
- [ ] Enforce roles on backend REST actions and authenticate Socket.IO handshakes.
- [ ] Add deterministic Drizzle seed: one coach and at least four students; document local-only credentials.
- [ ] Test valid/invalid login, missing authentication, and forbidden roles.

**Acceptance criteria:** Seeded accounts authenticate; password hashes and JWTs are not returned in normal response bodies; protected REST/socket access rejects unauthenticated or wrong-role users.

## Phase 2 — Tournament Management
**Priority:** P0
- [ ] Add validated tournament create/list/retrieve/update/delete DTOs and endpoints.
- [ ] Enforce coach management permissions and safe lifecycle transitions.
- [ ] Allow students to browse eligible tournaments and join open tournaments.
- [ ] Prevent duplicate membership and joins to ineligible tournaments through service rules and database constraints.
- [ ] Return participants, matches, results, and standings as required.
- [ ] Test join eligibility, duplicate joins, lifecycle rules, and authorization.

**Acceptance criteria:** A coach can create/open a tournament; an eligible student joins exactly once; invalid roles/statuses are rejected by the API.

## Phase 3 — Automatic Matchmaking
**Priority:** P0
- [ ] Implement tournament-specific queue entry and cancellation if supported.
- [ ] Atomically pair two distinct eligible waiting students; prevent duplicate active matches.
- [ ] Create assigned colors and authoritative initial clock/game state.
- [ ] Notify both players through authenticated Socket.IO events without requiring refresh.
- [ ] Document queue durability/scaling limitations.
- [ ] Test concurrent queue requests and two independent student sessions.

**Acceptance criteria:** Two eligible queued students receive one persisted match, no student is paired twice concurrently, and both clients receive the same match assignment.

## Phase 4 — Server-Authoritative Live Chess
**Priority:** P0
- [ ] Authorize participants before joining private match rooms.
- [ ] Use `chess.js` on the server to validate match status, identity/color, turn, freshness, and legal moves.
- [ ] Persist enough state to restore the board, move history/PGN, and clocks.
- [ ] Broadcast accepted moves and authoritative snapshots to both participants.
- [ ] Calculate shared clocks from server timestamps and persisted remaining time.
- [ ] Handle checkmate, resignation, timeout, stalemate, and draw.
- [ ] Serialize move/timeout/result races; finalize exactly once with a database transaction.
- [ ] Test legal/illegal moves, turn validation, color authorization, timeout, and duplicate finalization.

**Acceptance criteria:** Two clients observe the same legal server state; invalid/out-of-turn moves are rejected; termination and score updates are persisted once.

## Phase 5 — Results and Leaderboard
**Priority:** P0
- [ ] Implement win = 1, draw = 0.5, loss = 0.
- [ ] Update player points only once per completed match.
- [ ] Rank by points, then a documented deterministic secondary tiebreak/stable shared rank.
- [ ] Show match history, results, standings, and a winner only for a completed tournament.
- [ ] Test result scoring, ranking, tie behavior, and duplicate result prevention.

**Acceptance criteria:** Persisted standings equal scores from completed matches and are deterministically ordered.

## Phase 6 — Next.js User Experience
**Priority:** P0
- [ ] Build Login and role-aware application shell with Next.js App Router, React 19, Tailwind CSS, and shadcn/ui.
- [ ] Implement coach tournament dashboard and create/edit/details/results screens.
- [ ] Implement student tournament browse/join, schedule/history, matchmaking wait, and leaderboard screens.
- [ ] Implement live board, player clocks, turn indicator, connection status, move list/PGN, and resignation/result views.
- [ ] Use TanStack React Query for REST data and invalidate affected queries after mutations.
- [ ] Use Socket.IO Client for queue/match events; reconcile with authoritative API/socket snapshots.
- [ ] Include accessible forms plus loading, error, empty, pending, and success states.
- [ ] Verify responsive layout and a two-student browser flow.

**Acceptance criteria:** The documented student/coach journey works in the browser without direct database manipulation or fake live data.

## Phase 7 — Tests, README, Submission
**Priority:** P0
- [ ] Test scoring, leaderboard ranking, join rules, chess legality, turn validation, authorization, and idempotent finalization.
- [ ] Run backend tests/build and frontend build/type checks.
- [ ] Verify Drizzle migrations and seed from a clean local database.
- [ ] Document Windows prerequisites, Docker, environment variables, migrations, seed credentials, and app startup.
- [ ] Document REST conventions, socket event names/directions/payloads, design choices, and honest limitations.
- [ ] Confirm `.env.example` contains placeholders and no secrets are tracked.
- [ ] Manually play a match using two separate browser profiles.

**Acceptance criteria:** Critical automated checks pass and a clean local setup can be followed from the README; report any unverified criterion honestly.

## Stretch Goals — Only After P0
- [ ] Reconnect and restore authoritative board and clock.
- [ ] Coach spectator mode.
- [ ] Draw offers, threefold repetition, 50-move rule UI, or increment-clock refinements.
- [ ] Advanced matchmaking, full round-robin completion, or analytics.

## Final Submission Gate
Do not spend remaining time on polish while any of these are broken:
1. Authentication and backend role checks.
2. Tournament join eligibility.
3. Automatic pairing.
4. Legal synchronized chess moves.
5. Shared clock and game termination.
6. Persisted result and leaderboard scoring.
7. Verified tests and reproducible setup documentation.
