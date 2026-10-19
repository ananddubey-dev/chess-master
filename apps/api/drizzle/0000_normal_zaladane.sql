CREATE TYPE "public"."end_reason" AS ENUM('CHECKMATE', 'RESIGNATION', 'TIMEOUT', 'STALEMATE', 'DRAW', 'ABORTED');--> statement-breakpoint
CREATE TYPE "public"."match_result" AS ENUM('WHITE_WIN', 'BLACK_WIN', 'DRAW');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('ACTIVE', 'COMPLETED', 'ABORTED');--> statement-breakpoint
CREATE TYPE "public"."queue_status" AS ENUM('WAITING', 'MATCHED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('DRAFT', 'OPEN', 'ONGOING', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('COACH', 'STUDENT');--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"white_player_id" text NOT NULL,
	"black_player_id" text NOT NULL,
	"status" "match_status" DEFAULT 'ACTIVE' NOT NULL,
	"result" "match_result",
	"end_reason" "end_reason",
	"pgn" text DEFAULT '' NOT NULL,
	"fen" text DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' NOT NULL,
	"base_time_secs" integer NOT NULL,
	"increment_secs" integer DEFAULT 0 NOT NULL,
	"white_time_ms" integer NOT NULL,
	"black_time_ms" integer NOT NULL,
	"active_color" text DEFAULT 'w' NOT NULL,
	"last_move_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"user_id" text NOT NULL,
	"points" real DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "queue_status" DEFAULT 'WAITING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"base_time_secs" integer NOT NULL,
	"increment_secs" integer DEFAULT 0 NOT NULL,
	"status" "tournament_status" DEFAULT 'DRAFT' NOT NULL,
	"coach_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_white_player_id_users_id_fk" FOREIGN KEY ("white_player_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_black_player_id_users_id_fk" FOREIGN KEY ("black_player_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_tournament_status_idx" ON "matches" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE INDEX "matches_white_status_idx" ON "matches" USING btree ("white_player_id","status");--> statement-breakpoint
CREATE INDEX "matches_black_status_idx" ON "matches" USING btree ("black_player_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_white_active_unique" ON "matches" USING btree ("white_player_id") WHERE "matches"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "matches_black_active_unique" ON "matches" USING btree ("black_player_id") WHERE "matches"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "participants_tournament_user_unique" ON "participants" USING btree ("tournament_id","user_id");--> statement-breakpoint
CREATE INDEX "participants_tournament_points_idx" ON "participants" USING btree ("tournament_id","points");--> statement-breakpoint
CREATE INDEX "queue_fifo_idx" ON "queue_entries" USING btree ("tournament_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_waiting_user_unique" ON "queue_entries" USING btree ("tournament_id","user_id") WHERE "queue_entries"."status" = 'WAITING';--> statement-breakpoint
CREATE UNIQUE INDEX "queue_waiting_user_global_unique" ON "queue_entries" USING btree ("user_id") WHERE "queue_entries"."status" = 'WAITING';--> statement-breakpoint
CREATE INDEX "tournaments_status_start_idx" ON "tournaments" USING btree ("status","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");