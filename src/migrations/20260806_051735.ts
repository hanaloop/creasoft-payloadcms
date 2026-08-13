import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_docs_locale" AS ENUM('ko', 'en', 'es');
  CREATE TYPE "public"."enum_docs_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__docs_v_version_locale" AS ENUM('ko', 'en', 'es');
  CREATE TYPE "public"."enum__docs_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "docs_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "docs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"locale" "enum_docs_locale",
  	"title" varchar,
  	"description" varchar,
  	"source_path" varchar,
  	"parent_id" integer,
  	"order" numeric DEFAULT 0,
  	"published_at" timestamp(3) with time zone,
  	"content" jsonb,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_docs_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_docs_v_version_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_docs_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_locale" "enum__docs_v_version_locale",
  	"version_title" varchar,
  	"version_description" varchar,
  	"version_source_path" varchar,
  	"version_parent_id" integer,
  	"version_order" numeric DEFAULT 0,
  	"version_published_at" timestamp(3) with time zone,
  	"version_content" jsonb,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__docs_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "docs_id" integer;
  ALTER TABLE "docs_tags" ADD CONSTRAINT "docs_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "docs" ADD CONSTRAINT "docs_parent_id_docs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v_version_tags" ADD CONSTRAINT "_docs_v_version_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_docs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_parent_id_docs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_docs_v" ADD CONSTRAINT "_docs_v_version_parent_id_docs_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."docs"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "docs_tags_order_idx" ON "docs_tags" USING btree ("_order");
  CREATE INDEX "docs_tags_parent_id_idx" ON "docs_tags" USING btree ("_parent_id");
  CREATE INDEX "docs_locale_idx" ON "docs" USING btree ("locale");
  CREATE UNIQUE INDEX "docs_source_path_idx" ON "docs" USING btree ("source_path");
  CREATE INDEX "docs_parent_idx" ON "docs" USING btree ("parent_id");
  CREATE INDEX "docs_order_idx" ON "docs" USING btree ("order");
  CREATE UNIQUE INDEX "docs_slug_idx" ON "docs" USING btree ("slug");
  CREATE INDEX "docs_updated_at_idx" ON "docs" USING btree ("updated_at");
  CREATE INDEX "docs_created_at_idx" ON "docs" USING btree ("created_at");
  CREATE INDEX "docs__status_idx" ON "docs" USING btree ("_status");
  CREATE INDEX "_docs_v_version_tags_order_idx" ON "_docs_v_version_tags" USING btree ("_order");
  CREATE INDEX "_docs_v_version_tags_parent_id_idx" ON "_docs_v_version_tags" USING btree ("_parent_id");
  CREATE INDEX "_docs_v_parent_idx" ON "_docs_v" USING btree ("parent_id");
  CREATE INDEX "_docs_v_version_version_locale_idx" ON "_docs_v" USING btree ("version_locale");
  CREATE INDEX "_docs_v_version_version_source_path_idx" ON "_docs_v" USING btree ("version_source_path");
  CREATE INDEX "_docs_v_version_version_parent_idx" ON "_docs_v" USING btree ("version_parent_id");
  CREATE INDEX "_docs_v_version_version_order_idx" ON "_docs_v" USING btree ("version_order");
  CREATE INDEX "_docs_v_version_version_slug_idx" ON "_docs_v" USING btree ("version_slug");
  CREATE INDEX "_docs_v_version_version_updated_at_idx" ON "_docs_v" USING btree ("version_updated_at");
  CREATE INDEX "_docs_v_version_version_created_at_idx" ON "_docs_v" USING btree ("version_created_at");
  CREATE INDEX "_docs_v_version_version__status_idx" ON "_docs_v" USING btree ("version__status");
  CREATE INDEX "_docs_v_created_at_idx" ON "_docs_v" USING btree ("created_at");
  CREATE INDEX "_docs_v_updated_at_idx" ON "_docs_v" USING btree ("updated_at");
  CREATE INDEX "_docs_v_latest_idx" ON "_docs_v" USING btree ("latest");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_docs_fk" FOREIGN KEY ("docs_id") REFERENCES "public"."docs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_docs_id_idx" ON "payload_locked_documents_rels" USING btree ("docs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "docs_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "docs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_docs_v_version_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_docs_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "docs_tags" CASCADE;
  DROP TABLE "docs" CASCADE;
  DROP TABLE "_docs_v_version_tags" CASCADE;
  DROP TABLE "_docs_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_docs_fk";
  
  DROP INDEX "payload_locked_documents_rels_docs_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "docs_id";
  DROP TYPE "public"."enum_docs_locale";
  DROP TYPE "public"."enum_docs_status";
  DROP TYPE "public"."enum__docs_v_version_locale";
  DROP TYPE "public"."enum__docs_v_version_status";`)
}
