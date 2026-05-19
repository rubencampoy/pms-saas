CREATE TABLE "organization_billing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_name" varchar(255),
	"tax_id" varchar(40),
	"address_line1" varchar(255),
	"address_line2" varchar(255),
	"postal_code" varchar(20),
	"city" varchar(120),
	"state" varchar(120),
	"country" varchar(2) DEFAULT 'ES' NOT NULL,
	"billing_email" varchar(255),
	"stripe_customer_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_billing" ADD CONSTRAINT "organization_billing_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unq_organization_billing_org" ON "organization_billing" USING btree ("organization_id");