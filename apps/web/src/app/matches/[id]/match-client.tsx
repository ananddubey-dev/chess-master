"use client";

import { useQuery } from "@tanstack/react-query";
import { Chess, type Square } from "chess.js";
import { Chessboard, type ChessboardOptions } from "react-chessboard";
import { io, type Socket } from "socket.io-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ApiError, apiRequest, socketOrigin } from "@/lib/api";

type User = { id: string; name: string; role: "COACH" | "STUDENT" };
type MatchState = {
  id: string;
  tournamentId: string;
  status: "ACTIVE" | "COMPLETED" | "ABORTED";
  result: "WHITE_WIN" | "BLACK_WIN" | "DRAW" | null;
  endReason:
    | "CHECKMATE"
    | "RESIGNATION"
    | "TIMEOUT"
    | "STALEMATE"
    | "DRAW"
    | "ABORTED"
    | null;
  fen: string;
  pgn: string;
  activeColor: "w" | "b";
  whiteTimeMs: number;
  blackTimeMs: number;
  lastMoveAt: string | null;
  startedAt: string;
  viewerColor: "w" | "b";
  white: { id: string; name: string };
  black: { id: string; name: string };
};

export default function MatchClient({ matchId }: { matchId: string }) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [connection, setConnection] = useState<
    "connecting" | "connected" | "offline"
  >("connecting");
  const [message, setMessage] = useState("");
  const [clockNow, setClockNow] = useState(Date.now());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [resigning, setResigning] = useState(false);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<User>("/auth/me"),
    retry: false,
  });
  const initialMatch = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => apiRequest<MatchState>(`/matches/${matchId}`),
    retry: false,
  });

  useEffect(() => {
    if (initialMatch.data) setMatch(initialMatch.data);
  }, [initialMatch.data]);

  useEffect(() => {
    if (me.isError && me.error instanceof ApiError && me.error.status === 401) {
      router.replace("/login");
    }
    if (
      initialMatch.isError &&
      initialMatch.error instanceof ApiError &&
      initialMatch.error.status === 403
    ) {
      setMessage("This game is private to its two players.");
    }
  }, [initialMatch.error, initialMatch.isError, me.error, me.isError, router]);

  useEffect(() => {
    if (!me.data) return;
    const socket = io(socketOrigin(), {
      withCredentials: true,
      transports: ["websocket"],
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnection("connected");
      socket.emit("match:join", { matchId });
    });
    socket.on("disconnect", () => setConnection("offline"));
    socket.on("connect_error", () => setConnection("offline"));
    socket.on("match:state", (state: MatchState) => setMatch(state));
    socket.on("match:move:accepted", (state: MatchState) => setMatch(state));
    socket.on("match:finished", (state: MatchState) => {
      setMatch(state);
      setResigning(false);
    });
    socket.on("match:error", (error: { message?: string }) => {
      setResigning(false);
      setMessage(error.message ?? "That action could not be completed.");
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [matchId, me.data]);

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const sendMove = useCallback(
    (sourceSquare: string, targetSquare: string, piece?: string) => {
      if (
        !match ||
        match.status !== "ACTIVE" ||
        !socketRef.current?.connected
      ) {
        setMessage("The game is not ready to accept a move.");
        return false;
      }
      if (
        !/^[a-h][1-8]$/.test(sourceSquare) ||
        !/^[a-h][1-8]$/.test(targetSquare)
      ) {
        setMessage("Enter valid board squares, such as e2 and e4.");
        return false;
      }
      const movingPiece = piece?.endsWith("P")
        ? "p"
        : new Chess(match.fen).get(sourceSquare as Square)?.type;
      const isPromotion =
        movingPiece === "p" && ["1", "8"].includes(targetSquare[1]);
      socketRef.current.emit("match:move", {
        matchId,
        expectedFen: match.fen,
        from: sourceSquare,
        to: targetSquare,
        ...(isPromotion ? { promotion: "q" } : {}),
      });
      setMessage("");
      return true;
    },
    [match, matchId],
  );

  function dropPiece(
    args: Parameters<NonNullable<ChessboardOptions["onPieceDrop"]>>[0],
  ): boolean {
    if (!args.targetSquare) return false;
    return sendMove(args.sourceSquare, args.targetSquare, args.piece.pieceType);
  }

  function submitMoveForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (from.length !== 2 || to.length !== 2) {
      setMessage("Enter a source and destination square, such as e2 and e4.");
      return;
    }
    sendMove(from.toLowerCase(), to.toLowerCase());
    setFrom("");
    setTo("");
  }

  function resign() {
    if (
      !socketRef.current?.connected ||
      !window.confirm(
        "Resign this match? The result will be recorded immediately.",
      )
    )
      return;
    setResigning(true);
    socketRef.current.emit("match:resign", { matchId });
  }

  const whiteClock = clockValue(match, "w", clockNow);
  const blackClock = clockValue(match, "b", clockNow);
  const ownIsWhite = match?.viewerColor === "w";
  const isMyTurn = match?.activeColor === match?.viewerColor;

  if (initialMatch.isPending && !match) {
    return (
      <main className="loading-screen">
        <div className="loading-mark">K</div>
        <p>Rejoining your game…</p>
      </main>
    );
  }
  if (!match) {
    return (
      <main className="match-error-page">
        <div className="empty-panel">
          <h1>Game unavailable</h1>
          <p className="muted">
            {message ||
              initialMatch.error?.message ||
              "This game could not be loaded."}
          </p>
          <button
            className="button button-primary"
            onClick={() => router.push("/")}
          >
            Back to tournaments
          </button>
        </div>
      </main>
    );
  }

  const currentPlayer =
    match.activeColor === "w" ? match.white.name : match.black.name;
  const resultText =
    match.result === "DRAW"
      ? "The game is a draw"
      : match.result === "WHITE_WIN"
        ? `${match.white.name} wins`
        : match.result === "BLACK_WIN"
          ? `${match.black.name} wins`
          : "Game in progress";
  const reasonText: Record<NonNullable<MatchState["endReason"]>, string> = {
    CHECKMATE: "by checkmate",
    RESIGNATION: "by resignation",
    TIMEOUT: "on time",
    STALEMATE: "by stalemate",
    DRAW: "by draw",
    ABORTED: "match aborted",
  };

  return (
    <main className="match-page">
      <header className="topbar match-topbar">
        <Link className="brand" href="/" aria-label="Kingdom of Chess home">
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <span>
            Kingdom <strong>of Chess</strong>
          </span>
        </Link>
        <div className="match-topbar-right">
          <span className={`connection-pill connection-${connection}`}>
            <span className="connection-dot" />
            {connection === "connected"
              ? "Connected"
              : connection === "connecting"
                ? "Reconnecting"
                : "Offline"}
          </span>
          <Link className="button button-quiet button-small" href="/">
            Exit game
          </Link>
        </div>
      </header>

      <div className="match-layout">
        <section className="board-column" aria-label="Chess match">
          <div className="match-heading">
            <div>
              <p className="eyebrow">Live tournament match</p>
              <h1>
                {match.status === "ACTIVE" ? "Your game" : "Game complete"}
              </h1>
            </div>
            <span className="color-label">
              Playing {ownIsWhite ? "white" : "black"}
            </span>
          </div>

          <PlayerStrip
            active={match.status === "ACTIVE" && match.activeColor !== "w"}
            color="black"
            name={match.black.name}
            time={blackClock}
          />
          <div className="board-frame">
            <Chessboard
              options={{
                position: match.fen,
                boardOrientation: match.viewerColor === "b" ? "black" : "white",
                allowDragging:
                  match.status === "ACTIVE" &&
                  isMyTurn &&
                  connection === "connected",
                showNotation: true,
                onPieceDrop: dropPiece,
                animationDurationInMs: 160,
                darkSquareStyle: { backgroundColor: "#78917f" },
                lightSquareStyle: { backgroundColor: "#f0eadb" },
              }}
            />
          </div>
          <PlayerStrip
            active={match.status === "ACTIVE" && match.activeColor !== "b"}
            color="white"
            name={match.white.name}
            time={whiteClock}
          />

          <div className="turn-line" aria-live="polite">
            {match.status === "ACTIVE" ? (
              <>
                <span
                  className={`turn-indicator ${isMyTurn ? "turn-own" : ""}`}
                />
                {isMyTurn ? "Your turn" : `${currentPlayer} to move`}
              </>
            ) : (
              <span>
                {resultText}{" "}
                {match.endReason ? reasonText[match.endReason] : ""}
              </span>
            )}
          </div>
        </section>

        <aside className="game-sidebar">
          <section className="game-panel">
            <h2>Game details</h2>
            <dl className="game-facts">
              <div>
                <dt>White</dt>
                <dd>{match.white.name}</dd>
              </div>
              <div>
                <dt>Black</dt>
                <dd>{match.black.name}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>
                  {new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(match.startedAt))}
                </dd>
              </div>
              <div>
                <dt>Connection</dt>
                <dd>
                  {connection === "connected"
                    ? "Live"
                    : connection === "connecting"
                      ? "Reconnecting"
                      : "Offline"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="game-panel move-panel">
            <div className="panel-heading">
              <div>
                <h2>Moves</h2>
                <span className="muted small-copy">PGN notation</span>
              </div>
              {match.pgn && (
                <span className="move-count">
                  {match.pgn.trim().split(/\s+/).length} tokens
                </span>
              )}
            </div>
            {match.pgn ? (
              <pre className="pgn-text">{match.pgn}</pre>
            ) : (
              <p className="empty-moves">The first move is yours to make.</p>
            )}
          </section>

          {match.status === "ACTIVE" && (
            <>
              <form className="manual-move" onSubmit={submitMoveForm}>
                <p className="small-copy">Prefer typing a move?</p>
                <div className="manual-move-fields">
                  <label className="field">
                    <span>From</span>
                    <input
                      maxLength={2}
                      onChange={(event) => setFrom(event.target.value)}
                      placeholder="e2"
                      value={from}
                    />
                  </label>
                  <label className="field">
                    <span>To</span>
                    <input
                      maxLength={2}
                      onChange={(event) => setTo(event.target.value)}
                      placeholder="e4"
                      value={to}
                    />
                  </label>
                  <button
                    className="button button-secondary button-small"
                    disabled={!isMyTurn || connection !== "connected"}
                  >
                    Play move
                  </button>
                </div>
              </form>
              <button
                className="button button-danger button-wide"
                disabled={resigning || connection !== "connected"}
                onClick={resign}
              >
                {resigning ? "Resigning…" : "Resign game"}
              </button>
            </>
          )}

          {match.status !== "ACTIVE" && (
            <div className="result-panel">
              <span className="result-label">Final result</span>
              <strong>{resultText}</strong>
              <span>{match.endReason ? reasonText[match.endReason] : ""}</span>
              <Link className="button button-primary button-wide" href="/">
                Return to tournaments
              </Link>
            </div>
          )}
          {message && (
            <p className="notice notice-error" role="alert">
              {message}
            </p>
          )}
          <p className="game-footnote">
            The server validates each move and keeps the official clock.
          </p>
        </aside>
      </div>
    </main>
  );
}

function PlayerStrip({
  active,
  color,
  name,
  time,
}: {
  active: boolean;
  color: "white" | "black";
  name: string;
  time: string;
}) {
  return (
    <div className={`player-strip ${active ? "player-active" : ""}`}>
      <div
        className={`player-piece player-piece-${color}`}
        aria-hidden="true"
      />
      <div className="player-details">
        <span className="player-name">{name}</span>
        <span className="player-color">
          {color} side{active ? " · to move" : ""}
        </span>
      </div>
      <time
        className={`clock ${active ? "clock-active" : ""}`}
        aria-label={`${name} remaining time`}
      >
        {time}
      </time>
    </div>
  );
}

function clockValue(
  match: MatchState | null,
  color: "w" | "b",
  now: number,
): string {
  if (!match) return "—:—";
  let milliseconds = color === "w" ? match.whiteTimeMs : match.blackTimeMs;
  if (
    match.status === "ACTIVE" &&
    match.activeColor === color &&
    match.lastMoveAt
  ) {
    milliseconds -= now - new Date(match.lastMoveAt).getTime();
  }
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;
  return `${minutesPart}:${secondsPart.toString().padStart(2, "0")}`;
}
