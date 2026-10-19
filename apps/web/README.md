# Kingdom of Chess Web

Next.js App Router application using React 19, strict TypeScript, Tailwind CSS, shadcn/ui conventions, TanStack React Query, Socket.IO Client, and `react-chessboard`.

## Screens and behavior

- `/login`: email/password sign-in using the API's httpOnly cookie.
- `/`: coach tournament management or student tournament discovery, join, matchmaking, standings, and match history.
- `/matches/[id]`: participant-only live board, player clocks, move list/PGN, connection state, accessible manual move input, resignation, and final result.

REST data is loaded through the shared cookie-enabled API helper and React Query. Match moves, pairing, and results arrive over authenticated Socket.IO; the client renders authoritative API/server snapshots and does not decide legal moves or scores.

## Run locally

Configure the root `.env` from `.env.example`, start the API and database as described in the root [`README.md`](../../README.md), then run from the repository root:

```powershell
npm run dev:web
```

The web server uses `http://localhost:3001`; `NEXT_PUBLIC_API_URL` points to the API prefix (default `http://localhost:3000/api/v1`). Keep secrets out of all `NEXT_PUBLIC_*` variables.

## Validation

```powershell
npm run build --workspace @kingdom-chess/web
npm run lint --workspace @kingdom-chess/web
```

These checks and the two-browser game flow have not yet been verified for the current implementation.
