CREATE TABLE IF NOT EXISTS "meal_feedback" (
	"submission_id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"meal" text NOT NULL,
	"meal_date" date NOT NULL,
	"rating" integer NOT NULL,
	"tags" text[] NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "device_id" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "meal_date" date;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meal_feedback_device_meal_day_unique" ON "meal_feedback" USING btree ("device_id","meal","meal_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "feedback_device_meal_day_unique" ON "feedback" USING btree ("device_id","meal","meal_date");