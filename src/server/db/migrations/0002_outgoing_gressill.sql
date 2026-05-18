ALTER TABLE "properties" ADD COLUMN "plan" varchar(20) DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "max_units" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
-- Backfill: lift plan from organization down to each of its properties
UPDATE "properties" p
SET "plan" = o."plan"
FROM "organizations" o
WHERE p."organization_id" = o."id";--> statement-breakpoint
-- Backfill: max_units = max(50, current_unit_count + 10) so existing properties don't appear over-limit
UPDATE "properties" p
SET "max_units" = GREATEST(50, COALESCE((
  SELECT COUNT(*)::int + 10 FROM "units" u WHERE u."property_id" = p."id"
), 10));--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "plan";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "max_units";
