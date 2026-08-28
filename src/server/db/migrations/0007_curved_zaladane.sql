ALTER TABLE "booking_engine_settings" ADD COLUMN "brand_display_name" varchar(120) DEFAULT '';--> statement-breakpoint
ALTER TABLE "booking_engine_settings" ADD COLUMN "brand_primary_color" varchar(7) DEFAULT '#137fec' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_engine_settings" ADD COLUMN "brand_logo_url" varchar(500) DEFAULT '';--> statement-breakpoint
ALTER TABLE "booking_engine_settings" ADD COLUMN "brand_favicon_url" varchar(500) DEFAULT '';--> statement-breakpoint
ALTER TABLE "booking_engine_settings" ADD COLUMN "brand_cover_image_url" varchar(500) DEFAULT '';--> statement-breakpoint
ALTER TABLE "booking_engine_settings" ADD COLUMN "brand_hide_chamelio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_engine_settings" ADD COLUMN "brand_privacy_url" varchar(500) DEFAULT '';--> statement-breakpoint
ALTER TABLE "booking_engine_settings" ADD COLUMN "brand_terms_url" varchar(500) DEFAULT '';--> statement-breakpoint
ALTER TABLE "booking_engine_settings" ADD COLUMN "brand_cookies_url" varchar(500) DEFAULT '';