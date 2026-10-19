"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ApiError, apiRequest, socketOrigin } from "@/lib/api";

type User = {
  id: string;
  email: string;
  name: string;
  role: "COACH" | "STUDENT";
};
type Tournament = {
  id: string;
  name: string;
  startsAt: string;
  baseTimeSecs: number;
  incrementSecs: number;
  status: "DRAFT" | "OPEN" | "ONGOING" | "COMPLETED";
  coachId: string;
  coachName: string;
  participantCount: number;
  joined: boolean;
};
type Match = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  status: "ACTIVE" | "COMPLETED" | "ABORTED";
  result: "WHITE_WIN" | "BLACK_WIN" | "DRAW" | null;
  endReason: string | null;
  pgn: string;
  startedAt: string;
  endedAt: string | null;
  whitePlayerId: string;
  whiteName: string;
  blackPlayerId: string;
  blackName: string;
};
type Leaderboard = {
  tournament: Tournament;
  winner: { name: string; points: number } | null;
  standings: { rank: number; userId: string; name: string; points: number }[];
};
type TournamentForm = {
  name: string;
  startsAt: string;
  baseTimeSecs: number;
  incrementSecs: number;
};

const blankTournament: TournamentForm = {
  name: "",
  startsAt: "",
  baseTimeSecs: 300,
  incrementSecs: 0,
};

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [notice, setNotice] = useState("");
  const [queueingTournament, setQueueingTournament] = useState<string | null>(
    null,
  );
  const [socketStatus, setSocketStatus] = useState<
    "connecting" | "connected" | "offline"
  >("connecting");
  const [selectedTournament, setSelectedTournament] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [form, setForm] = useState<TournamentForm>(blankTournament);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<User>("/auth/me"),
    retry: false,
  });
  const user = me.data;
  const tournaments = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => apiRequest<Tournament[]>("/tournaments"),
    enabled: Boolean(user),
  });
  const matches = useQuery({
    queryKey: ["matches", "mine"],
    queryFn: () => apiRequest<Match[]>("/matches/mine"),
    enabled: Boolean(user),
  });
  const visibleTournamentId =
    selectedTournament || tournaments.data?.[0]?.id || "";
  const leaderboard = useQuery({
    queryKey: ["leaderboard", visibleTournamentId],
    queryFn: () =>
      apiRequest<Leaderboard>(
        `/tournaments/${visibleTournamentId}/leaderboard`,
      ),
    enabled: Boolean(user && visibleTournamentId),
  });

  useEffect(() => {
    if (!user || user.role !== "STUDENT") return;
    const socket = io(socketOrigin(), {
      withCredentials: true,
      transports: ["websocket"],
    });
    socketRef.current = socket;
    socket.on("connect", () => setSocketStatus("connected"));
    socket.on("disconnect", () => setSocketStatus("offline"));
    socket.on("connect_error", () => setSocketStatus("offline"));
    socket.on("queue:waiting", (payload: { tournamentId: string }) => {
      setQueueingTournament(payload.tournamentId);
      setNotice(
        "You’re in the queue. We’ll take you to your game as soon as a player is ready.",
      );
    });
    socket.on("queue:matched", (payload: { matchId: string }) => {
      setQueueingTournament(null);
      router.push(`/matches/${payload.matchId}`);
    });
    socket.on("match:error", (error: { message?: string }) => {
      setQueueingTournament(null);
      setNotice(
        error.message ?? "The live connection could not complete that action.",
      );
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [router, user]);

  const tournamentFormMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
      };
      return editing
        ? apiRequest<Tournament>(`/tournaments/${editing.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : apiRequest<Tournament>("/tournaments", {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: async () => {
      setNotice(
        editing
          ? "Tournament details saved."
          : "Tournament created as a draft.",
      );
      setForm(blankTournament);
      setEditing(null);
      setShowCreateForm(false);
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const joinTournament = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ joined: true }>(`/tournaments/${id}/join`, {
        method: "POST",
      }),
    onSuccess: async () => {
      setNotice(
        "You’ve joined the tournament. Find an opponent when you’re ready.",
      );
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const updateStatus = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: Tournament["status"];
    }) =>
      apiRequest<Tournament>(`/tournaments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: async () => {
      setNotice("Tournament status updated.");
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const deleteTournament = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ deleted: true }>(`/tournaments/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setNotice("Tournament deleted.");
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const logout = useMutation({
    mutationFn: () =>
      apiRequest<{ loggedOut: true }>("/auth/logout", { method: "POST" }),
    onSuccess: async () => {
      await queryClient.clear();
      router.replace("/login");
    },
    onError: (error: Error) => setNotice(error.message),
  });

  const activeMatches = useMemo(
    () => matches.data?.filter((match) => match.status === "ACTIVE") ?? [],
    [matches.data],
  );

  function editTournament(tournament: Tournament) {
    setEditing(tournament);
    setForm({
      name: tournament.name,
      startsAt: toLocalDateTime(tournament.startsAt),
      baseTimeSecs: tournament.baseTimeSecs,
      incrementSecs: tournament.incrementSecs,
    });
    setShowCreateForm(true);
  }

  function submitTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    tournamentFormMutation.mutate();
  }

  function queueForGame(tournamentId: string) {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setNotice("The live connection is not ready yet. Try again in a moment.");
      return;
    }
    setQueueingTournament(tournamentId);
    setNotice("Looking for an opponent…");
    socket.emit(
      "queue:join",
      { tournamentId },
      (response?: { success: boolean; error?: { message?: string } }) => {
        if (response && !response.success) {
          setQueueingTournament(null);
          setNotice(
            response.error?.message ?? "Could not join the matchmaking queue.",
          );
        }
      },
    );
  }

  function cancelQueue() {
    const tournamentId = queueingTournament;
    if (!tournamentId || !socketRef.current?.connected) return;
    socketRef.current.emit("queue:cancel", { tournamentId });
    setQueueingTournament(null);
    setNotice("You left the matchmaking queue.");
  }

  if (!user) {
    if (
      me.isError &&
      !(me.error instanceof ApiError && me.error.status === 401)
    ) {
      return (
        <main className="loading-screen">
          <div className="error-panel">
            <h1>We couldn’t load your account</h1>
            <p>{me.error.message}</p>
            <button
              className="button button-primary"
              onClick={() => void me.refetch()}
            >
              Try again
            </button>
          </div>
        </main>
      );
    }
    if (me.isError && me.error instanceof ApiError && me.error.status === 401) {
      return (
        <main className="loading-screen">
          <div className="error-panel">
            <div className="loading-mark">K</div>
            <h1>Welcome to Kingdom of Chess</h1>
            <p>Sign in to manage tournaments and play matches.</p>
            <Link className="button button-primary" href="/login">
              Sign in
            </Link>
          </div>
        </main>
      );
    }
    return (
      <main className="loading-screen">
        <div className="loading-mark">K</div>
        <p>Loading your chess hall…</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Kingdom of Chess home">
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <span>
            Kingdom <strong>of Chess</strong>
          </span>
        </Link>
        <div className="topbar-account">
          <div className="account-copy">
            <span className="account-name">{user.name}</span>
            <span className="account-role">
              {user.role === "COACH" ? "Coach" : "Student"}
            </span>
          </div>
          <button
            className="button button-quiet button-small"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="workspace">
        <section className="welcome-row">
          <div>
            <p className="eyebrow">
              {user.role === "COACH" ? "Coach workspace" : "Student hall"}
            </p>
            <h1>
              {user.role === "COACH"
                ? "Tournament desk"
                : "Your next game is waiting."}
            </h1>
            <p className="muted">
              {user.role === "COACH"
                ? "Set the field, follow the standings, and let the students play."
                : "Find a tournament, meet your opponent, and play at your own pace."}
            </p>
          </div>
          {user.role === "STUDENT" && (
            <div className={`connection-pill connection-${socketStatus}`}>
              <span className="connection-dot" />
              {socketStatus === "connected"
                ? "Live connection ready"
                : socketStatus === "connecting"
                  ? "Connecting to live games"
                  : "Live connection offline"}
            </div>
          )}
        </section>

        {notice && (
          <div className="notice notice-info" role="status">
            <span>{notice}</span>
            {queueingTournament && (
              <button className="text-button" onClick={cancelQueue}>
                Leave queue
              </button>
            )}
            {!queueingTournament && (
              <button className="notice-dismiss" onClick={() => setNotice("")}>
                Dismiss
              </button>
            )}
          </div>
        )}

        {user.role === "STUDENT" && activeMatches.length > 0 && (
          <section className="resume-match">
            <div>
              <p className="eyebrow">Back to your game</p>
              <h2>You have an active match</h2>
              <p className="muted">{activeMatches[0].tournamentName}</p>
            </div>
            <Link
              className="button button-primary"
              href={`/matches/${activeMatches[0].id}`}
            >
              Resume match
            </Link>
          </section>
        )}

        <section
          className="content-section"
          aria-labelledby="tournament-heading"
        >
          <div className="section-heading">
            <div>
              <h2 id="tournament-heading">
                {user.role === "COACH" ? "Tournaments" : "Find your tournament"}
              </h2>
              <p className="muted">
                {user.role === "COACH"
                  ? "Manage registration, schedule, and tournament progress."
                  : "Join an open tournament to enter its matchmaking queue."}
              </p>
            </div>
            {user.role === "COACH" && (
              <button
                className="button button-primary"
                onClick={() => {
                  setEditing(null);
                  setForm(blankTournament);
                  setShowCreateForm((value) => !value);
                }}
              >
                {showCreateForm && !editing
                  ? "Close form"
                  : "Create tournament"}
              </button>
            )}
          </div>

          {showCreateForm && user.role === "COACH" && (
            <form className="tournament-form" onSubmit={submitTournament}>
              <div className="form-heading">
                <h3>{editing ? "Edit tournament" : "New tournament"}</h3>
                <p className="muted">
                  Time control is shown as base minutes plus seconds added after
                  each move.
                </p>
              </div>
              <label className="field">
                <span>Tournament name</span>
                <input
                  maxLength={80}
                  minLength={3}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  required
                  value={form.name}
                />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Start date and time</span>
                  <input
                    onChange={(event) =>
                      setForm({ ...form, startsAt: event.target.value })
                    }
                    required
                    type="datetime-local"
                    value={form.startsAt}
                  />
                </label>
                <label className="field">
                  <span>Base minutes</span>
                  <input
                    max={120}
                    min={1}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        baseTimeSecs: Number(event.target.value) * 60,
                      })
                    }
                    required
                    type="number"
                    value={form.baseTimeSecs / 60}
                  />
                </label>
                <label className="field">
                  <span>Increment seconds</span>
                  <input
                    max={60}
                    min={0}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        incrementSecs: Number(event.target.value),
                      })
                    }
                    required
                    type="number"
                    value={form.incrementSecs}
                  />
                </label>
              </div>
              {tournamentFormMutation.isError && (
                <p className="notice notice-error" role="alert">
                  {tournamentFormMutation.error.message}
                </p>
              )}
              <div className="form-actions">
                <button
                  className="button button-primary"
                  disabled={tournamentFormMutation.isPending}
                >
                  {tournamentFormMutation.isPending
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : "Create draft"}
                </button>
                {editing && (
                  <button
                    className="button button-quiet"
                    onClick={() => {
                      setEditing(null);
                      setShowCreateForm(false);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          {tournaments.isPending ? (
            <div className="loading-panel">Loading tournaments…</div>
          ) : tournaments.isError ? (
            <div className="error-panel" role="alert">
              <p>{tournaments.error.message}</p>
              <button
                className="button button-secondary"
                onClick={() => void tournaments.refetch()}
              >
                Try again
              </button>
            </div>
          ) : !tournaments.data?.length ? (
            <div className="empty-panel">
              <h3>No tournaments yet</h3>
              <p className="muted">
                {user.role === "COACH"
                  ? "Create a draft tournament to begin."
                  : "Your coach will publish tournaments here when registration opens."}
              </p>
            </div>
          ) : (
            <div className="tournament-list">
              {tournaments.data.map((tournament) => (
                <article className="tournament-row" key={tournament.id}>
                  <div className="tournament-main">
                    <div className="tournament-title-row">
                      <h3>{tournament.name}</h3>
                      <StatusBadge status={tournament.status} />
                    </div>
                    <div className="tournament-meta">
                      <span>{formatDate(tournament.startsAt)}</span>
                      <span>
                        {Math.round(tournament.baseTimeSecs / 60)} min +{" "}
                        {tournament.incrementSecs}s
                      </span>
                      <span>{tournament.participantCount} players</span>
                    </div>
                  </div>
                  <div className="tournament-actions">
                    {user.role === "STUDENT" &&
                      tournament.status === "OPEN" &&
                      !tournament.joined && (
                        <button
                          className="button button-secondary"
                          disabled={joinTournament.isPending}
                          onClick={() => joinTournament.mutate(tournament.id)}
                        >
                          Join tournament
                        </button>
                      )}
                    {user.role === "STUDENT" &&
                      tournament.joined &&
                      ["OPEN", "ONGOING"].includes(tournament.status) && (
                        <button
                          className="button button-primary"
                          disabled={Boolean(queueingTournament)}
                          onClick={() => queueForGame(tournament.id)}
                        >
                          {queueingTournament === tournament.id
                            ? "Finding opponent…"
                            : "Find opponent"}
                        </button>
                      )}
                    {user.role === "STUDENT" &&
                      tournament.joined &&
                      !["OPEN", "ONGOING"].includes(tournament.status) && (
                        <span className="muted small-copy">
                          You’re registered
                        </span>
                      )}
                    {user.role === "COACH" && (
                      <CoachTournamentActions
                        tournament={tournament}
                        busy={
                          updateStatus.isPending || deleteTournament.isPending
                        }
                        onDelete={() => {
                          if (
                            window.confirm(
                              `Delete “${tournament.name}”? This cannot be undone.`,
                            )
                          ) {
                            deleteTournament.mutate(tournament.id);
                          }
                        }}
                        onEdit={() => editTournament(tournament)}
                        onStatus={(status) =>
                          updateStatus.mutate({ id: tournament.id, status })
                        }
                      />
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="lower-grid">
          <section
            className="content-section"
            aria-labelledby="standings-heading"
          >
            <div className="section-heading">
              <div>
                <h2 id="standings-heading">Standings</h2>
                <p className="muted">
                  Points decide rank; tied scores share a rank, then names sort
                  alphabetically.
                </p>
              </div>
              {tournaments.data && tournaments.data.length > 1 && (
                <label className="select-wrap">
                  <span className="sr-only">Choose tournament standings</span>
                  <select
                    onChange={(event) =>
                      setSelectedTournament(event.target.value)
                    }
                    value={visibleTournamentId}
                  >
                    {tournaments.data.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {leaderboard.isPending ? (
              <div className="loading-panel">Loading standings…</div>
            ) : leaderboard.isError ? (
              <div className="error-panel" role="alert">
                <p>{leaderboard.error.message}</p>
                <button
                  className="button button-secondary"
                  onClick={() => void leaderboard.refetch()}
                >
                  Try again
                </button>
              </div>
            ) : !leaderboard.data?.standings.length ? (
              <div className="empty-panel compact-empty">
                Players will appear here after they join.
              </div>
            ) : (
              <>
                {leaderboard.data.winner && (
                  <div className="winner-banner">
                    <span className="winner-seal">WINNER</span>
                    <span>
                      <strong>{leaderboard.data.winner.name}</strong> is the
                      tournament winner
                    </span>
                  </div>
                )}
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Rank</th>
                        <th scope="col">Player</th>
                        <th scope="col">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.data.standings.map((row) => (
                        <tr key={row.userId}>
                          <td className="rank-cell">
                            {row.rank.toString().padStart(2, "0")}
                          </td>
                          <td>
                            {row.name}
                            {row.userId === user.id && (
                              <span className="you-tag">You</span>
                            )}
                          </td>
                          <td className="points-cell">
                            {row.points.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section
            className="content-section"
            aria-labelledby="matches-heading"
          >
            <div className="section-heading">
              <div>
                <h2 id="matches-heading">
                  {user.role === "COACH" ? "Recent matches" : "Your matches"}
                </h2>
                <p className="muted">
                  Games and results from your tournament history.
                </p>
              </div>
            </div>
            {matches.isPending ? (
              <div className="loading-panel">Loading matches…</div>
            ) : matches.isError ? (
              <div className="error-panel" role="alert">
                <p>{matches.error.message}</p>
                <button
                  className="button button-secondary"
                  onClick={() => void matches.refetch()}
                >
                  Try again
                </button>
              </div>
            ) : !matches.data?.length ? (
              <div className="empty-panel compact-empty">
                Completed games will be recorded here.
              </div>
            ) : (
              <div className="match-list">
                {matches.data.slice(0, 8).map((match) => (
                  <MatchHistoryRow
                    interactive={user.role === "STUDENT"}
                    key={match.id}
                    match={match}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
        <footer className="page-footer">
          A good game is built one considered move at a time.
        </footer>
      </div>
    </main>
  );
}

function MatchHistoryRow({
  match,
  interactive,
}: {
  match: Match;
  interactive: boolean;
}) {
  const content = (
    <>
      <div>
        <span className="match-names">
          {match.whiteName} <span>vs</span> {match.blackName}
        </span>
        <span className="match-subtitle">
          {match.tournamentName} · {formatDate(match.startedAt)}
        </span>
      </div>
      <span
        className={`match-result ${match.status === "ACTIVE" ? "result-live" : ""}`}
      >
        {match.status === "ACTIVE"
          ? "Live"
          : match.result === "DRAW"
            ? "Draw"
            : match.result === "WHITE_WIN"
              ? `${match.whiteName} won`
              : `${match.blackName} won`}
      </span>
    </>
  );
  return interactive ? (
    <Link className="match-row" href={`/matches/${match.id}`}>
      {content}
    </Link>
  ) : (
    <div className="match-row">{content}</div>
  );
}

function StatusBadge({ status }: { status: Tournament["status"] }) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {status.toLowerCase()}
    </span>
  );
}

function CoachTournamentActions({
  tournament,
  busy,
  onEdit,
  onStatus,
  onDelete,
}: {
  tournament: Tournament;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: Tournament["status"]) => void;
  onDelete: () => void;
}) {
  const nextStatus: Partial<
    Record<Tournament["status"], Tournament["status"]>
  > = {
    DRAFT: "OPEN",
    OPEN: "ONGOING",
    ONGOING: "COMPLETED",
  };
  const actionText: Partial<Record<Tournament["status"], string>> = {
    DRAFT: "Open registration",
    OPEN: "Start tournament",
    ONGOING: "Complete",
  };
  return (
    <div className="coach-actions">
      {tournament.status !== "COMPLETED" && (
        <button
          className="button button-secondary button-small"
          onClick={onEdit}
        >
          Edit
        </button>
      )}
      {nextStatus[tournament.status] && (
        <button
          className="button button-primary button-small"
          disabled={busy}
          onClick={() => onStatus(nextStatus[tournament.status]!)}
        >
          {actionText[tournament.status]}
        </button>
      )}
      {tournament.status === "DRAFT" && (
        <button
          className="button button-danger button-small"
          disabled={busy}
          onClick={onDelete}
        >
          Delete
        </button>
      )}
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}
