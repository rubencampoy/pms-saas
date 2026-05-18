ALTER TABLE "organizations" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "max_properties" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "max_units" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "max_users" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "suspended_reason" text;