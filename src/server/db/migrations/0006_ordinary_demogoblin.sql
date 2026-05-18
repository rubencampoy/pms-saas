CREATE TABLE "airbnb_hosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"airbnb_token" varchar(128) NOT NULL,
	"airbnb_client_id" varchar(255) NOT NULL,
	"host_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"host_status_code" varchar(10),
	"oauth_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airbnb_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"airbnb_host_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"airbnb_listing_id" varchar(128) NOT NULL,
	"airbnb_room_id" varchar(128),
	"airbnb_rate_id" varchar(128),
	"listing_name" varchar(500),
	"property_type" varchar(100),
	"is_activated" boolean DEFAULT false NOT NULL,
	"is_multi_unit" boolean DEFAULT false NOT NULL,
	"room_type_id" uuid,
	"property_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_plan_mappings" ALTER COLUMN "external_rate_plan_id" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "rate_plan_mappings" ALTER COLUMN "external_room_type_id" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "room_type_mappings" ALTER COLUMN "external_room_type_id" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "airbnb_hosts" ADD CONSTRAINT "airbnb_hosts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airbnb_hosts" ADD CONSTRAINT "airbnb_hosts_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airbnb_listings" ADD CONSTRAINT "airbnb_listings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airbnb_listings" ADD CONSTRAINT "airbnb_listings_airbnb_host_id_airbnb_hosts_id_fk" FOREIGN KEY ("airbnb_host_id") REFERENCES "public"."airbnb_hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airbnb_listings" ADD CONSTRAINT "airbnb_listings_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airbnb_listings" ADD CONSTRAINT "airbnb_listings_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airbnb_listings" ADD CONSTRAINT "airbnb_listings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unq_airbnb_hosts_org_integration" ON "airbnb_hosts" USING btree ("organization_id","integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_airbnb_listings_org_listing" ON "airbnb_listings" USING btree ("organization_id","airbnb_listing_id");