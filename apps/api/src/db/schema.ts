import {
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userRole = pgEnum('user_role', ['COACH', 'STUDENT']);
export const tournamentStatus = pgEnum('tournament_status', [
  'DRAFT',
  'OPEN',
  'ONGOING',
  'COMPLETED',
]);
export const matchStatus = pgEnum('match_status', [
  'ACTIVE',
  'COMPLETED',
  'ABORTED',
]);
export const matchResult = pgEnum('match_result', [
  'WHITE_WIN',
  'BLACK_WIN',
  'DRAW',
]);
export const endReason = pgEnum('end_reason', [
  'CHECKMATE',
  'RESIGNATION',
  'TIMEOUT',
  'STALEMATE',
  'DRAW',
  'ABORTED',
]);
export const queueStatus = pgEnum('queue_status', [
  'WAITING',
  'MATCHED',
  'CANCELLED',
]);

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    role: userRole('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export const tournaments = pgTable(
  'tournaments',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    baseTimeSecs: integer('base_time_secs').notNull(),
    incrementSecs: integer('increment_secs').notNull().default(0),
    status: tournamentStatus('status').notNull().default('DRAFT'),
    coachId: text('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('tournaments_status_start_idx').on(table.status, table.startsAt)],
);

export const participants = pgTable(
  'participants',
  {
    id: text('id').primaryKey(),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    points: real('points').notNull().default(0),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('participants_tournament_user_unique').on(
      table.tournamentId,
      table.userId,
    ),
    index('participants_tournament_points_idx').on(
      table.tournamentId,
      table.points,
    ),
  ],
);

export const matches = pgTable(
  'matches',
  {
    id: text('id').primaryKey(),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'restrict' }),
    whitePlayerId: text('white_player_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    blackPlayerId: text('black_player_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: matchStatus('status').notNull().default('ACTIVE'),
    result: matchResult('result'),
    endReason: endReason('end_reason'),
    pgn: text('pgn').notNull().default(''),
    fen: text('fen')
      .notNull()
      .default('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    baseTimeSecs: integer('base_time_secs').notNull(),
    incrementSecs: integer('increment_secs').notNull().default(0),
    whiteTimeMs: integer('white_time_ms').notNull(),
    blackTimeMs: integer('black_time_ms').notNull(),
    activeColor: text('active_color').notNull().default('w'),
    lastMoveAt: timestamp('last_move_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('matches_tournament_status_idx').on(table.tournamentId, table.status),
    index('matches_white_status_idx').on(table.whitePlayerId, table.status),
    index('matches_black_status_idx').on(table.blackPlayerId, table.status),
    uniqueIndex('matches_white_active_unique')
      .on(table.whitePlayerId)
      .where(sql`${table.status} = 'ACTIVE'`),
    uniqueIndex('matches_black_active_unique')
      .on(table.blackPlayerId)
      .where(sql`${table.status} = 'ACTIVE'`),
  ],
);

export const queueEntries = pgTable(
  'queue_entries',
  {
    id: text('id').primaryKey(),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: queueStatus('status').notNull().default('WAITING'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('queue_fifo_idx').on(
      table.tournamentId,
      table.status,
      table.createdAt,
    ),
    uniqueIndex('queue_waiting_user_unique')
      .on(table.tournamentId, table.userId)
      .where(sql`${table.status} = 'WAITING'`),
  ],
);
