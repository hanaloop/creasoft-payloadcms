import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_doc_categories_locale" AS ENUM('ko', 'en', 'es');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  CREATE TABLE IF NOT EXISTS "doc_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"locale" "enum_doc_categories_locale" NOT NULL,
  	"parent_id" integer,
  	"slug" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  -- Docs that were previously used as a parent become document categories.
  -- Keeping their IDs preserves every existing docs.parent relationship.
  INSERT INTO "doc_categories" ("id", "title", "locale", "parent_id", "slug", "updated_at", "created_at")
  SELECT "id", "title", "locale"::text::"enum_doc_categories_locale", "parent_id", "slug", "updated_at", "created_at"
  FROM "docs"
  WHERE "id" IN (
    SELECT DISTINCT "parent_id" FROM "docs" WHERE "parent_id" IS NOT NULL
    UNION
    SELECT DISTINCT "version_parent_id" FROM "_docs_v" WHERE "version_parent_id" IS NOT NULL
  );
  SELECT setval(
    pg_get_serial_sequence('doc_categories', 'id'),
    COALESCE((SELECT MAX("id") FROM "doc_categories"), 1),
    (SELECT COUNT(*) > 0 FROM "doc_categories")
  );
  
  ALTER TABLE "docs" DROP CONSTRAINT IF EXISTS "docs_parent_id_docs_id_fk";
  
  ALTER TABLE "_docs_v" DROP CONSTRAINT IF EXISTS "_docs_v_version_parent_id_docs_id_fk";
  
  DROP INDEX IF EXISTS "locale_slug_idx";
  DROP INDEX IF EXISTS "locale_slug_1_idx";
  DROP INDEX IF EXISTS "locale_slug_2_idx";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "doc_categories_id" integer;
  DO $$ BEGIN
    ALTER TABLE "doc_categories" ADD CONSTRAINT "doc_categories_parent_id_doc_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."doc_categories"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  CREATE INDEX IF NOT EXISTS "doc_categories_locale_idx" ON "doc_categories" USING btree ("locale");
  CREATE INDEX IF NOT EXISTS "doc_categories_parent_idx" ON "doc_categories" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "doc_categories_slug_idx" ON "doc_categories" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "doc_categories_updated_at_idx" ON "doc_categories" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "doc_categories_created_at_idx" ON "doc_categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "locale_slug_idx" ON "doc_categories" USING btree ("locale","slug");
  DO $$ BEGIN
    ALTER TABLE "docs" ADD CONSTRAINT "docs_parent_id_doc_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."doc_categories"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_version_parent_id_doc_categories_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."doc_categories"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_doc_categories_fk" FOREIGN KEY ("doc_categories_id") REFERENCES "public"."doc_categories"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  CREATE UNIQUE INDEX "locale_slug_1_idx" ON "docs" USING btree ("locale","slug");
  CREATE UNIQUE INDEX "locale_slug_2_idx" ON "blog_posts" USING btree ("locale","slug");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_doc_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("doc_categories_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   -- Categories created after this migration have no equivalent Docs record.
  -- Clear only those references before restoring the previous foreign keys.
  UPDATE "docs" SET "parent_id" = NULL
  WHERE "parent_id" IS NOT NULL
    AND "parent_id" NOT IN (SELECT "id" FROM "docs");
  UPDATE "_docs_v" SET "version_parent_id" = NULL
  WHERE "version_parent_id" IS NOT NULL
    AND "version_parent_id" NOT IN (SELECT "id" FROM "docs");
  ALTER TABLE "docs" DROP CONSTRAINT "docs_parent_id_doc_categories_id_fk";
  ALTER TABLE "_docs_v" DROP CONSTRAINT "_docs_v_version_parent_id_doc_categories_id_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_doc_categories_fk";
  DROP INDEX "payload_locked_documents_rels_doc_categories_id_idx";
   ALTER TABLE "doc_categories" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "doc_categories" CASCADE;
  DROP INDEX "locale_slug_1_idx";
  DROP INDEX "locale_slug_2_idx";
  ALTER TABLE "docs" ADD CONSTRAINT "docs_parent_id_docs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_version_parent_id_docs_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "locale_slug_idx" ON "docs" USING btree ("locale","slug");
  CREATE UNIQUE INDEX "locale_slug_1_idx" ON "blog_posts" USING btree ("locale","slug");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "doc_categories_id";
  DROP TYPE "public"."enum_doc_categories_locale";`)
}
