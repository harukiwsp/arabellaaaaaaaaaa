CREATE TABLE "memories" (
	"slot" integer PRIMARY KEY,
	"photo_key" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"date" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY,
	"name" text DEFAULT 'My Love, Arabella.' NOT NULL,
	"message" text DEFAULT 'Happy birthday, my love. I planted this valley for you — every lily holds a moment of us. Wander slowly, look up at the aurora, and know that each star out here is a wish I made for you.' NOT NULL,
	"owner_key_hash" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" serial PRIMARY KEY,
	"upload_id" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"type" text DEFAULT 'audio/mpeg' NOT NULL,
	"parts" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
