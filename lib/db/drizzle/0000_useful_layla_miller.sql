CREATE TABLE IF NOT EXISTS "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_submission_id" text NOT NULL,
	"meal" text NOT NULL,
	"items" jsonb NOT NULL,
	"rating" integer NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "feedback_client_submission_id_unique" UNIQUE("client_submission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"image_data" text,
	"is_veg" boolean DEFAULT true NOT NULL,
	"meals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"heading_line1" text DEFAULT 'WHAT DID YOU' NOT NULL,
	"heading_line2" text DEFAULT 'ORDER?' NOT NULL,
	"menu_seeded" boolean DEFAULT false NOT NULL
);
