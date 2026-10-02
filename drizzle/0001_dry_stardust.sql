ALTER TABLE "documents" ADD COLUMN "content_id" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_owner_content_unique" ON "documents" USING btree ("owner_id","content_id");