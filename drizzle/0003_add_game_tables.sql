-- Add game-related tables for bingo gameplay

-- Games table (individual game sessions)
CREATE TABLE IF NOT EXISTS "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"win_pattern" varchar(20) DEFAULT 'any' NOT NULL,
	"winner_id" bigint,
	"winner_board_number" integer,
	"prize_pool" numeric(12, 2) DEFAULT '0' NOT NULL,
	"commission" numeric(12, 2) DEFAULT '0' NOT NULL,
	"player_count" integer DEFAULT 0 NOT NULL,
	"total_calls" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Boards table (pre-generated 5x5 bingo boards per game)
CREATE TABLE IF NOT EXISTS "boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"board_number" integer NOT NULL,
	"content" text NOT NULL,
	"board_hash" text NOT NULL,
	"assigned_to" bigint,
	"assigned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Game players table
CREATE TABLE IF NOT EXISTS "game_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"telegram_id" bigint NOT NULL,
	"board_number" integer NOT NULL,
	"bet_amount" numeric(12, 2) NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);

-- Called numbers table
CREATE TABLE IF NOT EXISTS "called_numbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"number" integer NOT NULL,
	"call_order" integer NOT NULL,
	"called_at" timestamp DEFAULT now() NOT NULL
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "games_room_id_idx" ON "games" ("room_id");
CREATE INDEX IF NOT EXISTS "games_status_idx" ON "games" ("status");
CREATE INDEX IF NOT EXISTS "boards_game_id_idx" ON "boards" ("game_id");
CREATE INDEX IF NOT EXISTS "boards_assigned_to_idx" ON "boards" ("assigned_to");
CREATE INDEX IF NOT EXISTS "game_players_game_id_idx" ON "game_players" ("game_id");
CREATE INDEX IF NOT EXISTS "game_players_telegram_id_idx" ON "game_players" ("telegram_id");
CREATE INDEX IF NOT EXISTS "called_numbers_game_id_idx" ON "called_numbers" ("game_id");

-- Add comments
COMMENT ON TABLE "games" IS 'Individual bingo game sessions';
COMMENT ON TABLE "boards" IS 'Pre-generated 5x5 bingo boards for each game';
COMMENT ON TABLE "game_players" IS 'Players participating in each game';
COMMENT ON TABLE "called_numbers" IS 'Numbers called during each game';
