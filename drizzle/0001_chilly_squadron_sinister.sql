CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint,
	"name" text NOT NULL,
	"email" text,
	"role" varchar(20) DEFAULT 'support_admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admins_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"admin_name" text NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"target_user" text,
	"amount" numeric(12, 2),
	"details" text,
	"ip_address" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fraud_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_type" varchar(50) NOT NULL,
	"telegram_id" bigint NOT NULL,
	"username" text,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"description" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"entry_fee" numeric(12, 2) NOT NULL,
	"min_players" integer DEFAULT 5 NOT NULL,
	"max_players" integer DEFAULT 20 NOT NULL,
	"current_players" integer DEFAULT 0 NOT NULL,
	"countdown_time" integer DEFAULT 120 NOT NULL,
	"winning_percentage" integer DEFAULT 75 NOT NULL,
	"total_pot" numeric(12, 2) DEFAULT '0' NOT NULL,
	"expected_payout" numeric(12, 2) DEFAULT '0' NOT NULL,
	"commission" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "assigned_admin" text;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "assigned_admin" text;