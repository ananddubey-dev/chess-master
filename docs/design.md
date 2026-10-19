# Design Specification
## Kingdom of Chess — UI/UX

**Design objective:** A clean, focused chess experience that feels trustworthy and usable for students and coaches. Prioritize readability and game clarity over decorative effects.

## 0. Frontend Implementation Stack
- Use Next.js App Router and React 19 with strict TypeScript.
- Style with Tailwind CSS and accessible shadcn/ui primitives; keep the visual direction and required screens below.
- Use TanStack React Query for REST server data and Socket.IO Client for live match events.
- Use `chess.js` for client-side chess utilities and a maintained chessboard component compatible with React 19. The server remains authoritative.

## 1. Design Principles
- Chessboard and current game state are the visual focus during play.
- Use a consistent spacing, typography, color, and component system.
- Keep primary actions obvious; destructive actions require confirmation.
- Always communicate loading, empty, success, and error states.
- Support desktop first for the live two-player board, while remaining responsive on smaller screens.
- Avoid excessive gradients, glass effects, or animation that competes with the board.

## 2. Visual Direction
- **Style:** Modern, calm, academy-friendly, professional.
- **Surfaces:** Neutral light background, white cards, subtle borders and shadows.
- **Primary accent:** Deep blue for primary actions and navigation.
- **Semantic colors:** Green for success, amber for waiting/warning, red for errors/destructive actions.
- **Typography:** System UI or a readable sans-serif; clear hierarchy and comfortable line height.
- **Chessboard:** Use a maintained board component; ensure pieces and square contrast are clear.
- Do not encode status by color alone; pair color with text or icon.

## 3. Layout
### App Shell
- Top bar: product name, current user, role label, profile/logout.
- Navigation differs by role.
- Main content uses a centered responsive container and consistent page spacing.
- Display actionable page title and concise supporting text.

### Student Navigation
- Tournaments
- My Schedule / Matches
- Leaderboard
- Profile (optional if time permits)

### Coach Navigation
- Overview
- Tournaments
- Tournament Details / Standings
- Match Results

## 4. Required Screens
### 4.1 Login
- Email and password fields.
- Submit button with pending state.
- Inline validation and generic authentication error.
- No password or token shown in UI/logs.
- Successful login redirects according to role.

### 4.2 Student Tournament Browse
- Cards or table showing tournament name, start date/time, time control, status, and join state.
- Join button only when eligible and open.
- Empty state when no tournaments are available.
- Error state with retry action.

### 4.3 Student Matchmaking
- Clear waiting indicator and tournament name.
- Cancel queue action if cancellation is supported.
- Explain that pairing is automatic.
- When paired, navigate to the match via a server event.
- Handle socket disconnect and matchmaking errors visibly.

### 4.4 Live Match
Desktop layout:
- Main area: chessboard and player information.
- Opponent and own clocks shown clearly near the board.
- Side panel: move list/PGN, current turn, connection status, resign action.
- Show check/checkmate/draw/result feedback.
- Disable invalid interactions while waiting for server acknowledgement.
- On finish, show result and links to leaderboard / queue again.

Small screens:
- Board remains within viewport width.
- Move list can move below board.
- Controls remain reachable and do not overlap board or clocks.

### 4.5 Leaderboard
- Tournament title and status.
- Rank, player, points, and optional played/win/draw/loss columns.
- Stable ordering and visible tie behavior.
- Loading skeleton, empty state, and error/retry state.
- Winner banner only when tournament completion is real and persisted.

### 4.6 Coach Tournament Management
- Tournament list with status and start time.
- Create/edit form for name, start date/time, base minutes, increment seconds, and status where transitions permit.
- Delete confirmation; prevent unsafe deletion after matches exist.
- Detail view with participants, match results, standings, and winner.
- Validation errors displayed next to fields.

## 5. Reusable UI Components
- `AppShell`, `RoleNavigation`, `PageHeader`
- `Button`, `Input`, `Select`, `Dialog`, `Badge`
- `LoadingState`, `ErrorState`, `EmptyState`
- `TournamentCard`, `TournamentForm`, `StatusBadge`
- `LeaderboardTable`
- `ChessGameBoard`, `PlayerClock`, `MoveList`, `MatchResultPanel`
- `ConnectionStatus`, `ConfirmDialog`

Avoid building a component library beyond the needs of this assignment.

## 6. Interaction and State Rules
- TanStack React Query owns REST server data and cache invalidation.
- Socket state owns transient live match events; reconcile snapshots with server state.
- Never treat a client-side move or client clock as authoritative.
- Disable controls during pending operations where duplicate actions could cause inconsistent state.
- Show errors in context and provide retry where safe.
- Mutations invalidate tournament, match, and leaderboard queries as appropriate.

## 7. Accessibility
- Inputs have visible labels and accessible error text.
- Buttons have descriptive names and keyboard focus styles.
- Status is communicated with text, not color alone.
- Maintain adequate contrast.
- Avoid relying solely on drag-and-drop for chess moves if the board library supports click/tap alternatives.

## 8. Definition of Done for a Screen
- Responsive at common desktop and mobile widths.
- Loading, error, and empty states exist where relevant.
- Forms validate and show server errors.
- Role-inappropriate actions are hidden in UI and still blocked by backend.
- No placeholder action is presented as working functionality.
