CREATE TABLE "users" (
	"telegram_id" bigint PRIMARY KEY NOT NULL,
	"username" text,
	"first_name" text DEFAULT '',
	"last_name" text DEFAULT '',
	"phone" text,
	"main_wallet" numeric(12, 2) DEFAULT '0' NOT NULL,
	"play_wallet" numeric(12, 2) DEFAULT '0' NOT NULL,
	"referred_by" bigint,
	"referral_count" bigint DEFAULT 0 NOT NULL,
	"referral_earnings" numeric(12, 2) DEFAULT '0' NOT NULL,
	"deposit_count" bigint DEFAULT 0 NOT NULL,
	"total_deposited" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_withdrawn" numeric(12, 2) DEFAULT '0' NOT NULL,
	"games_played" bigint DEFAULT 0 NOT NULL,
	"games_won" bigint DEFAULT 0 NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"bonus_claimed" boolean DEFAULT false NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"last_active" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"screenshot_file_id" text,
	"transaction_ref" text,
	"processed_by" bigint,
	"processed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" varchar(20) NOT NULL,
	"account_number" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"processed_by" bigint,
	"processed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
