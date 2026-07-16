CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_chat_id_copilot_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."copilot_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_chat_id_unique" ON "task" USING btree ("chat_id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."create_task_for_mothership_chat"()
RETURNS TRIGGER AS $task_trigger$
BEGIN
	INSERT INTO "public"."task" ("chat_id")
	VALUES (NEW."id")
	ON CONFLICT ("chat_id") DO NOTHING;
	RETURN NEW;
END;
$task_trigger$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "copilot_chats_create_task_after_insert"
	AFTER INSERT ON "public"."copilot_chats"
	FOR EACH ROW
	WHEN (NEW."type" = 'mothership' AND NEW."workspace_id" IS NOT NULL)
	EXECUTE FUNCTION "public"."create_task_for_mothership_chat"();--> statement-breakpoint
DO $task_backfill$
DECLARE
	last_chat_id uuid;
	batch_last_chat_id uuid;
	batch_count integer;
	inserted_count integer;
BEGIN
	LOOP
		WITH batch AS MATERIALIZED (
			SELECT "id", "type", "workspace_id"
			FROM "public"."copilot_chats"
			WHERE last_chat_id IS NULL OR "id" > last_chat_id
			ORDER BY "id"
			LIMIT 1000
		),
		inserted AS (
			INSERT INTO "public"."task" ("chat_id")
			SELECT "id"
			FROM batch
			WHERE "type" = 'mothership' AND "workspace_id" IS NOT NULL
			ON CONFLICT ("chat_id") DO NOTHING
			RETURNING "chat_id"
		)
		SELECT
			(SELECT "id" FROM batch ORDER BY "id" DESC LIMIT 1),
			(SELECT count(*)::integer FROM batch),
			(SELECT count(*)::integer FROM inserted)
		INTO batch_last_chat_id, batch_count, inserted_count;

		EXIT WHEN batch_count = 0;
		last_chat_id := batch_last_chat_id;
	END LOOP;
END;
$task_backfill$;
