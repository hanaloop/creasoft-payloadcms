import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_blog_posts_locale" AS ENUM('ko', 'en', 'es');
  CREATE TYPE "public"."enum_blog_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__blog_posts_v_version_locale" AS ENUM('ko', 'en', 'es');
  CREATE TYPE "public"."enum__blog_posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "blog_posts_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "blog_posts_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "blog_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"content" jsonb,
  	"locale" "enum_blog_posts_locale",
  	"published_at" timestamp(3) with time zone,
  	"slug" varchar,
  	"subtitle" varchar,
  	"summary" varchar,
  	"source_metadata" jsonb,
  	"source_path" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_blog_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_blog_posts_v_version_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_blog_posts_v_version_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_blog_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_description" varchar,
  	"version_content" jsonb,
  	"version_locale" "enum__blog_posts_v_version_locale",
  	"version_published_at" timestamp(3) with time zone,
  	"version_slug" varchar,
  	"version_subtitle" varchar,
  	"version_summary" varchar,
  	"version_source_metadata" jsonb,
  	"version_source_path" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__blog_posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  DROP INDEX "docs_slug_idx";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "blog_posts_id" integer;
  ALTER TABLE "blog_posts_authors" ADD CONSTRAINT "blog_posts_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "blog_posts_tags" ADD CONSTRAINT "blog_posts_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_blog_posts_v_version_authors" ADD CONSTRAINT "_blog_posts_v_version_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_blog_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_blog_posts_v_version_tags" ADD CONSTRAINT "_blog_posts_v_version_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_blog_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_blog_posts_v" ADD CONSTRAINT "_blog_posts_v_parent_id_blog_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "blog_posts_authors_order_idx" ON "blog_posts_authors" USING btree ("_order");
  CREATE INDEX "blog_posts_authors_parent_id_idx" ON "blog_posts_authors" USING btree ("_parent_id");
  CREATE INDEX "blog_posts_tags_order_idx" ON "blog_posts_tags" USING btree ("_order");
  CREATE INDEX "blog_posts_tags_parent_id_idx" ON "blog_posts_tags" USING btree ("_parent_id");
  CREATE INDEX "blog_posts_locale_idx" ON "blog_posts" USING btree ("locale");
  CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts" USING btree ("published_at");
  CREATE INDEX "blog_posts_slug_idx" ON "blog_posts" USING btree ("slug");
  CREATE UNIQUE INDEX "blog_posts_source_path_idx" ON "blog_posts" USING btree ("source_path");
  CREATE INDEX "blog_posts_updated_at_idx" ON "blog_posts" USING btree ("updated_at");
  CREATE INDEX "blog_posts_created_at_idx" ON "blog_posts" USING btree ("created_at");
  CREATE INDEX "blog_posts__status_idx" ON "blog_posts" USING btree ("_status");
  CREATE UNIQUE INDEX "locale_slug_1_idx" ON "blog_posts" USING btree ("locale","slug");
  CREATE INDEX "_blog_posts_v_version_authors_order_idx" ON "_blog_posts_v_version_authors" USING btree ("_order");
  CREATE INDEX "_blog_posts_v_version_authors_parent_id_idx" ON "_blog_posts_v_version_authors" USING btree ("_parent_id");
  CREATE INDEX "_blog_posts_v_version_tags_order_idx" ON "_blog_posts_v_version_tags" USING btree ("_order");
  CREATE INDEX "_blog_posts_v_version_tags_parent_id_idx" ON "_blog_posts_v_version_tags" USING btree ("_parent_id");
  CREATE INDEX "_blog_posts_v_parent_idx" ON "_blog_posts_v" USING btree ("parent_id");
  CREATE INDEX "_blog_posts_v_version_version_locale_idx" ON "_blog_posts_v" USING btree ("version_locale");
  CREATE INDEX "_blog_posts_v_version_version_published_at_idx" ON "_blog_posts_v" USING btree ("version_published_at");
  CREATE INDEX "_blog_posts_v_version_version_slug_idx" ON "_blog_posts_v" USING btree ("version_slug");
  CREATE INDEX "_blog_posts_v_version_version_source_path_idx" ON "_blog_posts_v" USING btree ("version_source_path");
  CREATE INDEX "_blog_posts_v_version_version_updated_at_idx" ON "_blog_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_blog_posts_v_version_version_created_at_idx" ON "_blog_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_blog_posts_v_version_version__status_idx" ON "_blog_posts_v" USING btree ("version__status");
  CREATE INDEX "_blog_posts_v_created_at_idx" ON "_blog_posts_v" USING btree ("created_at");
  CREATE INDEX "_blog_posts_v_updated_at_idx" ON "_blog_posts_v" USING btree ("updated_at");
  CREATE INDEX "_blog_posts_v_latest_idx" ON "_blog_posts_v" USING btree ("latest");
  CREATE INDEX "version_locale_version_slug_1_idx" ON "_blog_posts_v" USING btree ("version_locale","version_slug");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blog_posts_fk" FOREIGN KEY ("blog_posts_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "locale_slug_idx" ON "docs" USING btree ("locale","slug");
  CREATE INDEX "version_locale_version_slug_idx" ON "_docs_v" USING btree ("version_locale","version_slug");
  CREATE INDEX "payload_locked_documents_rels_blog_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("blog_posts_id");
  CREATE INDEX "docs_slug_idx" ON "docs" USING btree ("slug");
  ALTER TABLE "docs" DROP COLUMN "generate_slug";
  ALTER TABLE "_docs_v" DROP COLUMN "version_generate_slug";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "blog_posts_authors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "blog_posts_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "blog_posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_blog_posts_v_version_authors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_blog_posts_v_version_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_blog_posts_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "blog_posts_authors" CASCADE;
  DROP TABLE "blog_posts_tags" CASCADE;
  DROP TABLE "blog_posts" CASCADE;
  DROP TABLE "_blog_posts_v_version_authors" CASCADE;
  DROP TABLE "_blog_posts_v_version_tags" CASCADE;
  DROP TABLE "_blog_posts_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_blog_posts_fk";
  
  DROP INDEX "locale_slug_idx";
  DROP INDEX "version_locale_version_slug_idx";
  DROP INDEX "payload_locked_documents_rels_blog_posts_id_idx";
  DROP INDEX "docs_slug_idx";
  ALTER TABLE "docs" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "_docs_v" ADD COLUMN "version_generate_slug" boolean DEFAULT true;
  CREATE UNIQUE INDEX "docs_slug_idx" ON "docs" USING btree ("slug");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "blog_posts_id";
  DROP TYPE "public"."enum_blog_posts_locale";
  DROP TYPE "public"."enum_blog_posts_status";
  DROP TYPE "public"."enum__blog_posts_v_version_locale";
  DROP TYPE "public"."enum__blog_posts_v_version_status";`)
}
