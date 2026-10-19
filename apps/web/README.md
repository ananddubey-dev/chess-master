# Kingdom of Chess Web

Next.js App Router application using React 19 and strict TypeScript. The required UI stack is Tailwind CSS, shadcn/ui, TanStack React Query, Socket.IO Client, `chess.js`, and `react-chessboard`.

## Current foundation

- The App Router scaffold and landing page are present under `src/app/`.
- `src/app/providers.tsx` installs a TanStack React Query provider.
- The required client-side chess and real-time dependencies are declared in this workspace.
- The landing page is a scaffold; login, tournament flows, matchmaking, live gameplay, and leaderboard screens are not implemented.
- Workspace dependency resolution succeeded, but the web build and browser flow have not been verified.

## Local development

From the repository root, install dependencies if needed, configure the root `.env` from `.env.example`, then start the app:

```powershell
npm run dev:web
```

The web app is configured for `http://localhost:3001`. Its browser-facing API base URL is configured with `NEXT_PUBLIC_API_URL`; do not put secrets in `NEXT_PUBLIC_*` variables. Start the API separately with `npm run dev:api`.

## Validation

From the repository root:

```powershell
npm run build --workspace @kingdom-chess/web
npm run lint --workspace @kingdom-chess/web
```

These are available checks and have not yet been run successfully as part of the current audit.
