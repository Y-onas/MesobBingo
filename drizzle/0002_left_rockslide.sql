CREATE TABLE "games" (
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
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"board_number" integer NOT NULL,
	"content" text NOT NULL,
	"board_hash" text NOT NULL,
	"assigned_to" bigint,
	"assigned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"telegram_id" bigint NOT NULL,
	"board_number" integer NOT NULL,
	"bet_amount" numeric(12, 2) NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "called_numbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"number" integer NOT NULL,
	"call_order" integer NOT NULL,
	"called_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "sms_text" text;