import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`
      ALTER TABLE "docs" ADD COLUMN IF NOT EXISTS "source_metadata" jsonb;
      ALTER TABLE "_docs_v" ADD COLUMN IF NOT EXISTS "version_source_metadata" jsonb;
    `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
      ALTER TABLE "_docs_v" DROP COLUMN IF EXISTS "version_source_metadata";
      ALTER TABLE "docs" DROP COLUMN IF EXISTS "source_metadata";
    `)
}
