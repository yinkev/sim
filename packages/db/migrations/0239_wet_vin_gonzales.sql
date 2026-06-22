CREATE TABLE "copilot_run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"stream_id" text NOT NULL,
	"seq" integer NOT NULL,
	"cursor" text NOT NULL,
	"event_type" text NOT NULL,
	"request_id" text,
	"envelope" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "copilot_run_events" ADD CONSTRAINT "copilot_run_events_run_id_copilot_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."copilot_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copilot_run_events_run_id_idx" ON "copilot_run_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "copilot_run_events_stream_seq_idx" ON "copilot_run_events" USING btree ("stream_id","seq");--> statement-breakpoint
CREATE INDEX "copilot_run_events_event_type_idx" ON "copilot_run_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "copilot_run_events_stream_seq_unique" ON "copilot_run_events" USING btree ("stream_id","seq");