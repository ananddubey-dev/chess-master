import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Chess, type Color } from 'chess.js';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../db/database.service';
import {
  matches,
  participants,
  queueEntries,
  tournaments,
  users,
  type endReason,
  type matchResult,
  type tournamentStatus,
} from '../db/schema';
import type { AuthenticatedUser } from './guards';
import type { CreateTournamentDto, MoveDto, UpdateTournamentDto } from './dto';

type TournamentState = (typeof tournamentStatus.enumValues)[number];
type MatchResult = (typeof matchResult.enumValues)[number];
type EndReason = (typeof endReason.enumValues)[number];
type MoveOutcome =
  | { kind: 'timeout'; id: string; result: MatchResult; reason: EndReason }
  | { kind: 'finish'; id: string; result: MatchResult; reason: EndReason }
  | { kind: 'continue'; matchId: string };

@Injectable()
export class TournamentService {
  constructor(private readonly database: DatabaseService) {}

  async createTournament(
    coach: AuthenticatedUser,
    input: CreateTournamentDto,
  ): Promise<Record<string, unknown>> {
    const now = new Date();
    const [created] = await this.database.db
      .insert(tournaments)
      .values({
        id: randomUUID(),
        name: input.name.trim(),
        startsAt: new Date(input.startsAt),
        baseTimeSecs: input.baseTimeSecs,
        incrementSecs: input.incrementSecs ?? 0,
        coachId: coach.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created;
  }

  async listTournaments(userId: string): Promise<Record<string, unknown>[]> {
    const records = await this.database.db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        startsAt: tournaments.startsAt,
        baseTimeSecs: tournaments.baseTimeSecs,
        incrementSecs: tournaments.incrementSecs,
        status: tournaments.status,
        coachId: tournaments.coachId,
        coachName: users.name,
      })
      .from(tournaments)
      .innerJoin(users, eq(users.id, tournaments.coachId))
      .orderBy(desc(tournaments.startsAt));
    return Promise.all(
      records.map(async (record) => ({
        ...record,
        participantCount: await this.database.db
          .select({ count: sql<number>`count(*)::int` })
          .from(participants)
          .where(eq(participants.tournamentId, record.id))
          .then(([row]) => row?.count ?? 0),
        joined:
          (
            await this.database.db
              .select({ id: participants.id })
              .from(participants)
              .where(
                and(
                  eq(participants.tournamentId, record.id),
                  eq(participants.userId, userId),
                ),
              )
              .limit(1)
          ).length > 0,
      })),
    );
  }

  async getTournament(id: string): Promise<Record<string, unknown>> {
    const [record] = await this.database.db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        startsAt: tournaments.startsAt,
        baseTimeSecs: tournaments.baseTimeSecs,
        incrementSecs: tournaments.incrementSecs,
        status: tournaments.status,
        coachId: tournaments.coachId,
        coachName: users.name,
      })
      .from(tournaments)
      .innerJoin(users, eq(users.id, tournaments.coachId))
      .where(eq(tournaments.id, id))
      .limit(1);
    if (!record) throw new NotFoundException('Tournament not found');
    const [participantCount] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(participants)
      .where(eq(participants.tournamentId, id));
    return { ...record, participantCount: participantCount?.count ?? 0 };
  }

  async updateTournament(
    coach: AuthenticatedUser,
    id: string,
    input: UpdateTournamentDto,
  ): Promise<Record<string, unknown>> {
    return this.database.db.transaction(async (tx) => {
      const [record] = await tx
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, id))
        .limit(1)
        .for('update');
      if (!record) throw new NotFoundException('Tournament not found');
      if (record.coachId !== coach.id) throw new ForbiddenException();

      const hasMatches = await tx
        .select({ id: matches.id })
        .from(matches)
        .where(eq(matches.tournamentId, id))
        .limit(1);
      const hasConfigurationChange =
        input.name !== undefined ||
        input.startsAt !== undefined ||
        input.baseTimeSecs !== undefined ||
        input.incrementSecs !== undefined;
      if (hasMatches.length && hasConfigurationChange) {
        throw new ConflictException(
          'Tournament settings cannot change after matches begin',
        );
      }

      const nextStatus = input.status ?? record.status;
      const allowedTransitions: Record<TournamentState, TournamentState[]> = {
        DRAFT: ['DRAFT', 'OPEN'],
        OPEN: ['OPEN', 'ONGOING'],
        ONGOING: ['ONGOING', 'COMPLETED'],
        COMPLETED: ['COMPLETED'],
      };
      if (!allowedTransitions[record.status].includes(nextStatus)) {
        throw new ConflictException(
          `Tournament status cannot change from ${record.status} to ${nextStatus}`,
        );
      }
      if (nextStatus === 'COMPLETED') {
        const activeMatches = await tx
          .select({ id: matches.id })
          .from(matches)
          .where(
            and(eq(matches.tournamentId, id), eq(matches.status, 'ACTIVE')),
          )
          .limit(1);
        if (activeMatches.length) {
          throw new ConflictException(
            'Complete all active matches before completing the tournament',
          );
        }
        const waitingPlayers = await tx
          .select({ id: queueEntries.id })
          .from(queueEntries)
          .where(
            and(
              eq(queueEntries.tournamentId, id),
              eq(queueEntries.status, 'WAITING'),
            ),
          )
          .limit(1);
        if (waitingPlayers.length) {
          throw new ConflictException(
            'Wait for students to leave matchmaking before completing the tournament',
          );
        }
      }
      const [updated] = await tx
        .update(tournaments)
        .set({
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.startsAt === undefined
            ? {}
            : { startsAt: new Date(input.startsAt) }),
          ...(input.baseTimeSecs === undefined
            ? {}
            : { baseTimeSecs: input.baseTimeSecs }),
          ...(input.incrementSecs === undefined
            ? {}
            : { incrementSecs: input.incrementSecs }),
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(tournaments.id, id))
        .returning();
      return updated;
    });
  }

  async deleteTournament(coach: AuthenticatedUser, id: string): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const [record] = await tx
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, id))
        .limit(1)
        .for('update');
      if (!record) throw new NotFoundException('Tournament not found');
      if (record.coachId !== coach.id) throw new ForbiddenException();
      if (record.status !== 'DRAFT') {
        throw new ConflictException('Only draft tournaments can be deleted');
      }
      const existingMatches = await tx
        .select({ id: matches.id })
        .from(matches)
        .where(eq(matches.tournamentId, id))
        .limit(1);
      if (existingMatches.length) {
        throw new ConflictException(
          'A tournament with matches cannot be deleted',
        );
      }
      await tx.delete(tournaments).where(eq(tournaments.id, id));
    });
  }

  async joinTournament(
    student: AuthenticatedUser,
    tournamentId: string,
  ): Promise<{ joined: true; tournamentId: string }> {
    await this.database.db.transaction(async (tx) => {
      const [tournament] = await tx
        .select({ status: tournaments.status })
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
        .limit(1)
        .for('update');
      if (!tournament) throw new NotFoundException('Tournament not found');
      if (tournament.status !== 'OPEN') {
        throw new ConflictException('Only open tournaments can be joined');
      }
      const [inserted] = await tx
        .insert(participants)
        .values({
          id: randomUUID(),
          tournamentId,
          userId: student.id,
        })
        .onConflictDoNothing()
        .returning({ id: participants.id });
      if (!inserted) {
        throw new ConflictException('You already joined this tournament');
      }
    });
    return { joined: true, tournamentId };
  }

  async getLeaderboard(tournamentId: string): Promise<Record<string, unknown>> {
    const tournament = await this.getTournament(tournamentId);
    const rows = await this.database.db
      .select({
        userId: users.id,
        name: users.name,
        points: participants.points,
        joinedAt: participants.joinedAt,
      })
      .from(participants)
      .innerJoin(users, eq(users.id, participants.userId))
      .where(eq(participants.tournamentId, tournamentId))
      .orderBy(desc(participants.points), asc(users.name), asc(users.id));
    const standings = rows.map((row, index) => ({
      ...row,
      rank: standingsRank(rows, index),
    }));
    return {
      tournament,
      winner:
        tournament.status === 'COMPLETED' && standings.length
          ? standings[0]
          : null,
      standings,
    };
  }

  async getTournamentMatches(
    user: AuthenticatedUser,
    tournamentId: string,
  ): Promise<Record<string, unknown>[]> {
    const tournament = await this.getTournament(tournamentId);
    if (user.role === 'COACH' && tournament.coachId !== user.id) {
      throw new ForbiddenException();
    }
    const whiteUser = alias(users, 'white_user');
    const blackUser = alias(users, 'black_user');
    const matchFilter =
      user.role === 'COACH'
        ? eq(matches.tournamentId, tournamentId)
        : and(
            eq(matches.tournamentId, tournamentId),
            or(
              eq(matches.whitePlayerId, user.id),
              eq(matches.blackPlayerId, user.id),
            ),
          );
    return this.database.db
      .select({
        id: matches.id,
        status: matches.status,
        result: matches.result,
        endReason: matches.endReason,
        pgn: matches.pgn,
        startedAt: matches.startedAt,
        endedAt: matches.endedAt,
        whitePlayerId: matches.whitePlayerId,
        whiteName: whiteUser.name,
        blackPlayerId: matches.blackPlayerId,
        blackName: blackUser.name,
      })
      .from(matches)
      .innerJoin(whiteUser, eq(whiteUser.id, matches.whitePlayerId))
      .innerJoin(blackUser, eq(blackUser.id, matches.blackPlayerId))
      .where(matchFilter)
      .orderBy(desc(matches.startedAt))
      .then((rows) => rows.map((row) => ({ ...row, tournament })));
  }

  async getMyMatches(userId: string): Promise<Record<string, unknown>[]> {
    const whiteUser = alias(users, 'white_user');
    const blackUser = alias(users, 'black_user');
    const playerRows = await this.database.db
      .select({
        id: matches.id,
        tournamentId: matches.tournamentId,
        tournamentName: tournaments.name,
        status: matches.status,
        result: matches.result,
        endReason: matches.endReason,
        pgn: matches.pgn,
        startedAt: matches.startedAt,
        endedAt: matches.endedAt,
        whitePlayerId: matches.whitePlayerId,
        whiteName: whiteUser.name,
        blackPlayerId: matches.blackPlayerId,
        blackName: blackUser.name,
      })
      .from(matches)
      .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
      .innerJoin(whiteUser, eq(whiteUser.id, matches.whitePlayerId))
      .innerJoin(blackUser, eq(blackUser.id, matches.blackPlayerId))
      .where(
        or(
          eq(matches.whitePlayerId, userId),
          eq(matches.blackPlayerId, userId),
        ),
      )
      .orderBy(desc(matches.startedAt));
    return playerRows;
  }

  async getCoachMatches(coachId: string): Promise<Record<string, unknown>[]> {
    const whiteUser = alias(users, 'white_user');
    const blackUser = alias(users, 'black_user');
    return this.database.db
      .select({
        id: matches.id,
        tournamentId: matches.tournamentId,
        tournamentName: tournaments.name,
        status: matches.status,
        result: matches.result,
        endReason: matches.endReason,
        pgn: matches.pgn,
        startedAt: matches.startedAt,
        endedAt: matches.endedAt,
        whitePlayerId: matches.whitePlayerId,
        whiteName: whiteUser.name,
        blackPlayerId: matches.blackPlayerId,
        blackName: blackUser.name,
      })
      .from(matches)
      .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
      .innerJoin(whiteUser, eq(whiteUser.id, matches.whitePlayerId))
      .innerJoin(blackUser, eq(blackUser.id, matches.blackPlayerId))
      .where(eq(tournaments.coachId, coachId))
      .orderBy(desc(matches.startedAt))
      .limit(50);
  }

  async queueStudent(
    student: AuthenticatedUser,
    tournamentId: string,
  ): Promise<{ status: 'WAITING' | 'MATCHED'; matchId?: string }> {
    const pairing = await this.database.db.transaction(async (tx) => {
      const [tournament] = await tx
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
        .limit(1)
        .for('update');
      if (!tournament) throw new NotFoundException('Tournament not found');
      if (!['OPEN', 'ONGOING'].includes(tournament.status)) {
        throw new ConflictException(
          'This tournament is not accepting matchmaking',
        );
      }
      const [membership] = await tx
        .select({ id: participants.id })
        .from(participants)
        .where(
          and(
            eq(participants.tournamentId, tournamentId),
            eq(participants.userId, student.id),
          ),
        )
        .limit(1);
      if (!membership) {
        throw new ForbiddenException('Join the tournament before queueing');
      }
      const studentActive = await tx
        .select({ id: matches.id })
        .from(matches)
        .where(
          and(
            eq(matches.status, 'ACTIVE'),
            or(
              eq(matches.whitePlayerId, student.id),
              eq(matches.blackPlayerId, student.id),
            ),
          ),
        )
        .limit(1);
      if (studentActive.length) {
        throw new ConflictException('You already have an active match');
      }
      const [otherQueue] = await tx
        .select({ tournamentId: queueEntries.tournamentId })
        .from(queueEntries)
        .where(
          and(
            eq(queueEntries.userId, student.id),
            eq(queueEntries.status, 'WAITING'),
          ),
        )
        .limit(1);
      if (otherQueue && otherQueue.tournamentId !== tournamentId) {
        throw new ConflictException(
          'You are already waiting in another tournament',
        );
      }
      await tx
        .insert(queueEntries)
        .values({ id: randomUUID(), tournamentId, userId: student.id })
        .onConflictDoNothing();
      const [currentQueue] = await tx
        .select({ tournamentId: queueEntries.tournamentId })
        .from(queueEntries)
        .where(
          and(
            eq(queueEntries.userId, student.id),
            eq(queueEntries.status, 'WAITING'),
          ),
        )
        .limit(1);
      if (!currentQueue || currentQueue.tournamentId !== tournamentId) {
        throw new ConflictException(
          'You are already waiting in another tournament',
        );
      }
      const waiting = await tx
        .select()
        .from(queueEntries)
        .where(
          and(
            eq(queueEntries.tournamentId, tournamentId),
            eq(queueEntries.status, 'WAITING'),
          ),
        )
        .orderBy(asc(queueEntries.createdAt))
        .limit(2)
        .for('update', { skipLocked: true });

      if (waiting.length < 2) return { status: 'WAITING' as const };
      if (waiting[0].userId === waiting[1].userId) {
        throw new ConflictException(
          'Queue cannot match a player with themselves',
        );
      }
      const active = await tx
        .select({
          whitePlayerId: matches.whitePlayerId,
          blackPlayerId: matches.blackPlayerId,
        })
        .from(matches)
        .where(
          and(
            eq(matches.status, 'ACTIVE'),
            or(
              inArray(
                matches.whitePlayerId,
                waiting.map((entry) => entry.userId),
              ),
              inArray(
                matches.blackPlayerId,
                waiting.map((entry) => entry.userId),
              ),
            ),
          ),
        )
        .limit(1);
      if (active.length) {
        const activePlayerIds = new Set(
          active.flatMap((match) => [match.whitePlayerId, match.blackPlayerId]),
        );
        await tx
          .update(queueEntries)
          .set({ status: 'CANCELLED', updatedAt: new Date() })
          .where(
            inArray(
              queueEntries.id,
              waiting
                .filter((entry) => activePlayerIds.has(entry.userId))
                .map((entry) => entry.id),
            ),
          );
        return { status: 'WAITING' as const };
      }

      const id = randomUUID();
      const now = new Date();
      await tx.insert(matches).values({
        id,
        tournamentId,
        whitePlayerId: waiting[0].userId,
        blackPlayerId: waiting[1].userId,
        baseTimeSecs: tournament.baseTimeSecs,
        incrementSecs: tournament.incrementSecs,
        whiteTimeMs: tournament.baseTimeSecs * 1000,
        blackTimeMs: tournament.baseTimeSecs * 1000,
        activeColor: 'w',
        lastMoveAt: now,
        startedAt: now,
      });
      await tx
        .update(queueEntries)
        .set({ status: 'MATCHED', updatedAt: now })
        .where(
          inArray(
            queueEntries.id,
            waiting.map((entry) => entry.id),
          ),
        );
      return { status: 'MATCHED' as const, matchId: id };
    });
    return pairing;
  }

  async cancelQueue(
    userId: string,
    tournamentId: string,
  ): Promise<{ cancelled: true }> {
    await this.database.db
      .update(queueEntries)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(
        and(
          eq(queueEntries.userId, userId),
          eq(queueEntries.tournamentId, tournamentId),
          eq(queueEntries.status, 'WAITING'),
        ),
      );
    return { cancelled: true };
  }

  async getMatchSnapshot(
    matchId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const [match] = await this.database.db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!match) throw new NotFoundException('Match not found');
    this.assertParticipant(match, userId);
    if (match.status === 'ACTIVE' && this.remaining(match, new Date()) <= 0) {
      await this.finishMatch(
        match.id,
        match.activeColor === 'w' ? 'BLACK_WIN' : 'WHITE_WIN',
        'TIMEOUT',
      );
      return this.getMatchSnapshot(matchId, userId);
    }
    const [white] = await this.database.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, match.whitePlayerId))
      .limit(1);
    const [black] = await this.database.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, match.blackPlayerId))
      .limit(1);
    const activeRemaining =
      match.status === 'ACTIVE' ? this.remaining(match, new Date()) : null;
    return {
      id: match.id,
      tournamentId: match.tournamentId,
      status: match.status,
      result: match.result,
      endReason: match.endReason,
      fen: match.fen,
      pgn: match.pgn,
      activeColor: match.activeColor,
      whiteTimeMs:
        match.activeColor === 'w' && activeRemaining !== null
          ? activeRemaining
          : match.whiteTimeMs,
      blackTimeMs:
        match.activeColor === 'b' && activeRemaining !== null
          ? activeRemaining
          : match.blackTimeMs,
      lastMoveAt: match.lastMoveAt,
      startedAt: match.startedAt,
      endedAt: match.endedAt,
      viewerColor: userId === match.whitePlayerId ? 'w' : 'b',
      white,
      black,
    };
  }

  async submitMove(
    userId: string,
    input: MoveDto,
  ): Promise<Record<string, unknown>> {
    const outcome = await this.database.db.transaction(
      async (tx): Promise<MoveOutcome> => {
        const [match] = await tx
          .select()
          .from(matches)
          .where(eq(matches.id, input.matchId))
          .limit(1)
          .for('update');
        if (!match) throw new NotFoundException('Match not found');
        this.assertParticipant(match, userId);
        if (match.status !== 'ACTIVE')
          throw new ConflictException('Match is finished');
        if (input.expectedFen !== match.fen) {
          throw new ConflictException(
            'The board changed; refresh before moving',
          );
        }
        const color: Color = userId === match.whitePlayerId ? 'w' : 'b';
        if (color !== match.activeColor) {
          throw new ConflictException('It is not your turn');
        }
        const now = new Date();
        const clockAfter = this.remaining(match, now);
        if (clockAfter <= 0) {
          return {
            kind: 'timeout',
            id: match.id,
            result: color === 'w' ? 'BLACK_WIN' : 'WHITE_WIN',
            reason: 'TIMEOUT',
          };
        }
        const chess = this.chessFromMatch(match.fen, match.pgn);
        const possible = chess
          .moves({ square: input.from, verbose: true })
          .some(
            (move) =>
              move.to === input.to &&
              (move.promotion ?? undefined) === input.promotion,
          );
        if (!possible) throw new BadRequestException('Illegal chess move');
        chess.move({
          from: input.from,
          to: input.to,
          ...(input.promotion ? { promotion: input.promotion } : {}),
        });
        const whiteTimeMs =
          color === 'w'
            ? clockAfter + match.incrementSecs * 1000
            : match.whiteTimeMs;
        const blackTimeMs =
          color === 'b'
            ? clockAfter + match.incrementSecs * 1000
            : match.blackTimeMs;
        await tx
          .update(matches)
          .set({
            fen: chess.fen(),
            pgn: chess.pgn(),
            whiteTimeMs,
            blackTimeMs,
            activeColor: chess.turn(),
            lastMoveAt: now,
            updatedAt: now,
          })
          .where(eq(matches.id, match.id));
        const terminal = chess.isCheckmate() || chess.isDraw();
        if (!terminal) return { kind: 'continue', matchId: match.id };
        let result: MatchResult;
        let reason: EndReason;
        if (chess.isCheckmate()) {
          result = chess.turn() === 'w' ? 'BLACK_WIN' : 'WHITE_WIN';
          reason = 'CHECKMATE';
        } else if (chess.isStalemate()) {
          result = 'DRAW';
          reason = 'STALEMATE';
        } else {
          result = 'DRAW';
          reason = 'DRAW';
        }
        return { kind: 'finish', id: match.id, result, reason };
      },
    );

    if (outcome.kind === 'timeout') {
      await this.finishMatch(outcome.id, outcome.result, outcome.reason);
    } else if (outcome.kind === 'finish') {
      await this.finishMatch(outcome.id, outcome.result, outcome.reason);
    }
    return this.getMatchSnapshot(input.matchId, userId);
  }

  async resign(
    userId: string,
    matchId: string,
  ): Promise<Record<string, unknown>> {
    const [match] = await this.database.db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!match) throw new NotFoundException('Match not found');
    this.assertParticipant(match, userId);
    if (match.status !== 'ACTIVE')
      throw new ConflictException('Match is finished');
    const timedOut = this.remaining(match, new Date()) <= 0;
    const result =
      timedOut || userId === match.whitePlayerId ? 'BLACK_WIN' : 'WHITE_WIN';
    await this.finishMatch(
      matchId,
      result,
      timedOut ? 'TIMEOUT' : 'RESIGNATION',
    );
    return this.getMatchSnapshot(matchId, userId);
  }

  async expireActiveMatches(): Promise<
    { id: string; whitePlayerId: string; blackPlayerId: string }[]
  > {
    const active = await this.database.db
      .select({
        id: matches.id,
        whitePlayerId: matches.whitePlayerId,
        blackPlayerId: matches.blackPlayerId,
        activeColor: matches.activeColor,
        lastMoveAt: matches.lastMoveAt,
        whiteTimeMs: matches.whiteTimeMs,
        blackTimeMs: matches.blackTimeMs,
      })
      .from(matches)
      .where(eq(matches.status, 'ACTIVE'));
    const now = new Date();
    const expired: {
      id: string;
      whitePlayerId: string;
      blackPlayerId: string;
    }[] = [];
    for (const match of active) {
      const elapsed = match.lastMoveAt
        ? now.getTime() - match.lastMoveAt.getTime()
        : 0;
      const time =
        (match.activeColor === 'w' ? match.whiteTimeMs : match.blackTimeMs) -
        elapsed;
      if (time <= 0) {
        await this.finishMatch(
          match.id,
          match.activeColor === 'w' ? 'BLACK_WIN' : 'WHITE_WIN',
          'TIMEOUT',
        );
        const [completed] = await this.database.db
          .select({ status: matches.status, endReason: matches.endReason })
          .from(matches)
          .where(eq(matches.id, match.id))
          .limit(1);
        if (
          completed?.status === 'COMPLETED' &&
          completed.endReason === 'TIMEOUT'
        ) {
          expired.push({
            id: match.id,
            whitePlayerId: match.whitePlayerId,
            blackPlayerId: match.blackPlayerId,
          });
        }
      }
    }
    return expired;
  }

  async cancelOrFinishMatch(
    matchId: string,
    result: MatchResult,
    reason: EndReason,
  ): Promise<void> {
    await this.finishMatch(matchId, result, reason);
  }

  private async finishMatch(
    matchId: string,
    result: MatchResult,
    reason: EndReason,
  ): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1)
        .for('update');
      if (!match || match.status !== 'ACTIVE') return;
      const now = new Date();
      let finalResult = result;
      let finalReason = reason;
      const timeLeft = this.remaining(match, now);
      if (reason === 'TIMEOUT' && timeLeft > 0) return;
      if (reason === 'RESIGNATION' && timeLeft <= 0) {
        finalReason = 'TIMEOUT';
      }
      if (finalReason === 'TIMEOUT') {
        finalResult = match.activeColor === 'w' ? 'BLACK_WIN' : 'WHITE_WIN';
      }
      await tx
        .update(matches)
        .set({
          status: 'COMPLETED',
          result: finalResult,
          endReason: finalReason,
          ...(finalReason === 'TIMEOUT'
            ? match.activeColor === 'w'
              ? { whiteTimeMs: 0 }
              : { blackTimeMs: 0 }
            : {}),
          endedAt: now,
          updatedAt: now,
        })
        .where(and(eq(matches.id, matchId), eq(matches.status, 'ACTIVE')));
      const scores =
        finalResult === 'DRAW'
          ? [
              { playerId: match.whitePlayerId, points: 0.5 },
              { playerId: match.blackPlayerId, points: 0.5 },
            ]
          : [
              {
                playerId:
                  finalResult === 'WHITE_WIN'
                    ? match.whitePlayerId
                    : match.blackPlayerId,
                points: 1,
              },
            ];
      for (const score of scores) {
        await tx
          .update(participants)
          .set({ points: sql`${participants.points} + ${score.points}` })
          .where(
            and(
              eq(participants.tournamentId, match.tournamentId),
              eq(participants.userId, score.playerId),
            ),
          );
      }
    });
  }

  private remaining(
    match: {
      activeColor: string;
      whiteTimeMs: number;
      blackTimeMs: number;
      lastMoveAt: Date | null;
    },
    now: Date,
  ): number {
    const stored =
      match.activeColor === 'w' ? match.whiteTimeMs : match.blackTimeMs;
    return Math.max(
      0,
      stored -
        (match.lastMoveAt ? now.getTime() - match.lastMoveAt.getTime() : 0),
    );
  }

  private chessFromMatch(fen: string, pgn: string): Chess {
    const chess = new Chess();
    if (pgn) chess.loadPgn(pgn);
    else chess.load(fen);
    return chess;
  }

  private assertParticipant(
    match: { whitePlayerId: string; blackPlayerId: string },
    userId: string,
  ): void {
    if (match.whitePlayerId !== userId && match.blackPlayerId !== userId) {
      throw new ForbiddenException(
        'Only match participants may view or update this match',
      );
    }
  }
}

function standingsRank(rows: { points: number }[], index: number): number {
  let firstIndex = index;
  while (firstIndex > 0 && rows[firstIndex - 1].points === rows[index].points) {
    firstIndex -= 1;
  }
  return firstIndex + 1;
}
