# Project Rules
## Engineering, Security, and AI-Assisted Development

These rules are the source of truth for implementation decisions in this repository.

## 1. Required Stack — Non-negotiable
- Frontend: Next.js App Router, React 19, and strict TypeScript.
- Styling/components: Tailwind CSS and shadcn/ui.
- REST server state: TanStack React Query.
- Backend: NestJS 11 and strict TypeScript.
- Database: PostgreSQL accessed through Drizzle ORM; use Drizzle Kit for SQL migrations.
- Real-time transport: Socket.IO server and client.
- Chess rules and PGN: `chess.js` and a compatible maintained chessboard UI component.
- DTO validation: `class-validator` and `class-transformer`.
- Local database: Docker Compose with a loopback-bound port and persistent volume.
- Do not use Vite or Prisma unless the assignment requirements are explicitly changed. The current audit found no Vite/Prisma scaffold; if an artifact is discovered later, treat it as legacy input rather than approval to continue with that stack.

## 2. Code Quality and Stack Migration
- Inspect current files and dependencies before editing, replacing, or deleting them.
- Prefer small, focused changes and existing project conventions.
- Keep controllers and socket gateways thin; place business rules in services.
- Use DTOs at every REST boundary and validate socket payloads.
- Use explicit return types for important service methods.
- Use strict TypeScript; avoid `any` unless a concrete integration constraint requires it and is documented.
- Keep package versions aligned with the package manager and committed lockfile; do not switch tooling or install another framework blindly.
- The current repository audit found the required Next.js/Drizzle foundation and no Vite/Prisma files. If a legacy Vite/Prisma file is encountered later, inspect and preserve it until any needed migration is reviewed and replacement behavior is verified; never leave instructions that direct new work to the legacy stack.
- Never claim a command, migration, test, build, or feature passed unless it actually ran and its result was inspected.
- Do not claim features work until exercised end to end where appropriate.

## 3. API Conventions
- All REST routes use `/api/v1`.
- Success shape: `{ "success": true, "data": ... }`.
- Error shape: `{ "success": false, "error": { "code": "...", "message": "...", "details": [] } }`.
- Use suitable HTTP codes: `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, and `422` as appropriate; `500` is for unexpected errors.
- Use `class-validator` DTOs for every REST body, query, and path input where validation applies.
- Do not expose password hashes, JWTs, internal stack traces, or secrets.
- Do not return success before the database operation has succeeded.

## 4. Authentication and Authorization
- Store password hashes only; use a suitable password-hashing algorithm.
- JWT must be set in an `httpOnly` cookie.
- Configure cookie `secure` and `sameSite` deliberately for local versus production.
- Configure CORS to an explicit allowed origin when cookies are used; never use `*` with credentials.
- Protect every private REST endpoint on the backend.
- Enforce Coach/Student permissions in backend guards/services, not only in React.
- Do not trust role, user ID, color, or participant identity sent by a client.
- Authenticate Socket.IO handshakes and authorize every private match-room join.
- Consider CSRF protection appropriate to cookie-based authentication.
- Never log passwords, cookies, JWTs, or secrets.

## 5. Chess and Match Integrity
- Use `chess.js`; do not implement chess legality manually.
- Server state is authoritative.
- Validate participant, assigned color, active turn, match status, move freshness, and legality.
- Reject duplicate, stale, illegal, and out-of-turn moves.
- Calculate clocks using server timestamps; never trust client-reported remaining time.
- Serialize or guard concurrent move/timeout/result transitions.
- Finalize a match once only; duplicate events must not award points again.
- Persist final PGN, result, end reason, timestamps, and enough state for restoration.
- Reconcile clients with authoritative snapshots, not local assumptions.

## 6. Database and Migration Rules
- Use Drizzle ORM schema definitions and Drizzle Kit-generated SQL migrations as the single active persistence implementation.
- Every schema change requires a generated, reviewed, committed migration.
- Keep the active schema/migrations in the documented API Drizzle location; do not create duplicate schemas.
- Use PostgreSQL unique constraints for uniqueness, including email and tournament participation.
- Use transactions for match completion and participant score updates.
- Prevent duplicate active matches and queue claims in service logic and database constraints where feasible.
- Avoid destructive schema changes without a reviewed migration and backup strategy.
- Do not use Prisma commands for the target implementation. If a Prisma artifact is discovered later, preserve it until Drizzle is operational and any required data migration has been verified.
- Seed scripts must be deterministic and safe to rerun where practical.
- Do not commit real user data or production secrets.

## 7. Real-Time Events
- Document each event's name, direction, payload, authorization, and expected response.
- Validate every event payload.
- Use acknowledgements or structured error events so failures are not silent.
- Do not trust client-supplied user IDs.
- Only authorized match participants can enter private rooms.
- Emit events after state changes are accepted/persisted, not before.
- Ensure duplicate delivery cannot duplicate side effects.

## 8. Frontend Rules
- Use Next.js App Router and React 19; do not add frontend routes using Vite.
- Use strict TypeScript, Tailwind CSS, and shadcn/ui consistent with `design.md`.
- Use TanStack React Query for REST server data and invalidate relevant query keys after mutations.
- Use Socket.IO Client only for live events and reconcile against authoritative snapshots.
- Use a shared API client with cookie credentials enabled.
- Use `chess.js` for client-side chess utilities; server authorization and legality remain authoritative.
- Route guards improve UX only; backend authorization is the security boundary.
- Every data screen needs loading, error, and empty states.
- Prevent duplicate submissions while mutations are pending.
- Do not show fake live data, placeholder success, or nonfunctional controls.
- Keep the board responsive and readable; provide accessible inputs and controls.

## 9. Testing Rules
- Test scoring, leaderboard ranking, tournament join eligibility, legal moves, and turn validation.
- Test role authorization and unauthorized socket joins where feasible.
- Test match completion idempotency and duplicate event handling.
- Prefer deterministic unit tests for domain logic.
- Do not mark tests as passing without running them.
- Fix root causes rather than weakening assertions.

## 10. Git and Environment
- Make small, meaningful commits; inspect status before staging.
- Keep `.env`, tokens, passwords, and local database secrets out of Git.
- Maintain `.env.example` with placeholders only.
- Never place secrets in `NEXT_PUBLIC_*` browser-visible variables.
- Do not change dependency versions casually during the deadline.
- Run relevant formatting, type checks, tests, and builds before final submission.
- Document known limitations honestly in README.

## 11. AI Pair-Programming Rules
Before applying generated code:
1. Identify exact file paths.
2. Check imports, package versions, and existing code.
3. Implement one coherent unit at a time.
4. Run the relevant command/test.
5. Read the actual error before changing more files.
6. Update `memory.md` when architecture, progress, or next steps change.
7. Never claim completion based only on code generation.
