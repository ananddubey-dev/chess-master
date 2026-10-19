# Implementation Plan and Submission Gates

**Updated:** 19 October 2026  
**Goal:** Deliver the required-stack tournament journey from coach setup through student matchmaking, live chess, persisted results, and standings.

## Status Legend

- `[ ]` Not implemented or not yet verified.
- `[~]` Implemented in source but not verified at runtime.
- `[x]` Verified by an actual command or end-to-end observation.
- `[!]` Blocked with a documented reason.

Source presence is not evidence that a behavior works. Tests are explicitly deferred until the user authorizes them.

## Initial Scaffold Audit

Before this implementation pass, the repo contained the NestJS/Next.js scaffolds, PostgreSQL/Drizzle schema and provider, health route, and placeholder landing page. Authentication, tournament behavior, matchmaking, gameplay, results, and leaderboard were absent. That baseline was about a starter scaffold, not a functioning MVP.

Current workspace: `C:\Users\ADMIN\Desktop\chess`. A direct check found application dependencies missing from expected `node_modules` locations. Docker health, builds, API health, migrations, tests, and browser flow have not been verified in this pass.

## Phase 0 — Reproducible Foundation

- [~] NestJS 11, strict TypeScript, PostgreSQL/Drizzle provider, Next.js App Router/React 19, Tailwind, and QueryClient foundation are present.
- [~] `.env.example`, Compose PostgreSQL service, API/web scripts, and DB scripts are present.
- [ ] Restore dependencies and create the root npm lockfile.
- [ ] Generate and review the Drizzle SQL migration.
- [ ] Start PostgreSQL, apply migration, and confirm healthy status.
- [ ] Build and lint both apps; confirm strict TypeScript.
- [ ] Verify API health, CORS, environment validation, and frontend API connectivity.
- [~] Initialize shadcn/ui configuration and a reusable accessible button primitive; additional primitives are unnecessary for the current forms and tables.

## Phase 1 — Authentication and Seed

- [~] Validate required environment values at API startup.
- [~] Email/password login with bcrypt, httpOnly JWT cookie, logout, and `/auth/me` plus `/me`.
- [~] Protect API routes and enforce coach/student permissions.
- [~] Authenticate Socket.IO from the session cookie and resolve the account from the database.
- [~] Add repeatable seed for one coach and four students; local credentials are in root `README.md`.
- [ ] Once authorized, test valid/invalid login, unauthenticated requests, and role denials.

## Phase 2 — Tournament Management

- [~] Coach create/list/read/update/delete with status lifecycle rules.
- [~] Student browse and join open tournaments; membership is unique and eligibility is checked transactionally.
- [~] Protect tournament management by coach ownership; only safe draft tournaments can be deleted.
- [~] Return standings, match results, and tournament winner data.
- [ ] Once authorized, test lifecycle, duplicate join, owner permissions, and delete safety.

## Phase 3 — Matchmaking

- [~] Persist tournament FIFO queue entries and support queue cancellation.
- [~] Pair eligible players transactionally with row locks and a global waiting-entry uniqueness constraint.
- [~] Reject users already playing or queued in another tournament.
- [~] Assign colors and initialize persisted match clocks/state.
- [~] Notify both players through authenticated Socket.IO events and route them to the match.
- [~] Document one-process queue limitations.
- [ ] Once authorized, test concurrent queueing and paired student sessions.

## Phase 4 — Live Chess

- [~] Authenticate match sockets and authorize participant-only room joins.
- [~] Validate moves on the server with `chess.js` and enforce participant, color, turn, status, and legal-move rules.
- [~] Persist FEN, PGN, clocks, last move time, and result.
- [~] Broadcast participant-specific authoritative snapshots, including after reconnect.
- [~] Calculate clocks from server timestamps; timeout sweep runs every three seconds.
- [~] Handle checkmate, resignation, timeout, stalemate, and chess.js draw conditions.
- [~] Lock move/finalization transactions and award points idempotently.
- [ ] Once authorized, test legal/illegal/out-of-turn moves, timeout, reconnect, and duplicate finalization.

## Phase 5 — Results and Leaderboard

- [~] Score win = 1, draw = 0.5, loss = 0 in the result transaction.
- [~] Rank by points, share ranks on ties, then sort names consistently.
- [~] Show match history, tournament standings, and a winner only after completion.
- [ ] Once authorized, test scoring, tie ordering, and result idempotency.

## Phase 6 — Web Experience

- [~] Login and role-aware dashboard.
- [~] Coach create/edit/status/delete actions, student browse/join/queue, standings, match history, and visible error/loading/empty states.
- [~] Live board with clocks, turns, PGN, drag and manual move input, resignation, connection status, and result.
- [~] TanStack React Query handles REST server data and cache invalidation; Socket.IO handles live events.
- [~] Responsive styles and keyboard-visible focus states are implemented in source.
- [~] Configure shadcn/ui conventions and use the shared Button primitive on the login flow.
- [ ] Build and inspect the app at desktop/mobile breakpoints.
- [ ] Once authorized, run the two-browser coach/two-student flow.

## Phase 7 — Submission Verification

- [x] Update root and app READMEs with setup, accounts, REST routes, Socket.IO events, a two-browser walkthrough, decisions, and limitations.
- [ ] Restore dependencies and create lockfile.
- [ ] Generate/review/apply migration; run seed.
- [ ] Build and lint API and web (not tests).
- [ ] Start the stack and verify health/login from the browser.
- [ ] Run automated tests only after the user explicitly asks.

## Known MVP Limitations

- Queue and timeout sweep are designed for one API process; no Redis or multi-instance coordination.
- Timeout sweep interval is three seconds.
- Pawn promotion auto-selects queen.
- No draw-offer UI or spectator mode.
- Ties use shared rank and alphabetical display order, not head-to-head tiebreaks.
- Runtime behavior remains unverified until the gates above are completed.

## Next Actions

1. Restore dependencies and generate `package-lock.json`.
2. Generate and review Drizzle migration SQL.
3. Build/lint API and web without running tests.
4. Start PostgreSQL, apply migrations, seed, and verify API/web startup and health.
5. Stop before test execution; wait for the user to authorize tests.
