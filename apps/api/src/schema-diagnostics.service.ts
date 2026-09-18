import { ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from './prisma.service';

const normalize = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

@Injectable()
export class SchemaDiagnosticsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertStaging() {
    const deploymentEnv = process.env.DEPLOY_ENV || process.env.APP_ENV || process.env.ENVIRONMENT;
    if (deploymentEnv !== 'staging') {
      throw new ForbiddenException('Schema diagnostics are available only in staging');
    }
  }

  async getDiagnostics() {
    this.assertStaging();
    const rows = (sql: string) => this.prisma.$queryRawUnsafe<any[]>(sql);
    const [database, migrations, extensions, tables, columns, enums, constraints, indexes, functions, triggers] = await Promise.all([
      rows('SELECT current_database() AS "databaseId"'),
      rows('SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'),
      rows(`SELECT extname AS name FROM pg_extension WHERE extname='vector' ORDER BY extname`),
      rows(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name`),
      rows(`SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,is_identity,identity_generation FROM information_schema.columns WHERE table_schema='public' AND table_name <> '_prisma_migrations' ORDER BY table_name,ordinal_position`),
      rows(`SELECT t.typname AS type_name,e.enumlabel AS enum_label,e.enumsortorder::text AS sort_order FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`),
      rows(`SELECT c.conname AS name,c.contype AS type,pg_get_constraintdef(c.oid,true) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace LEFT JOIN pg_class r ON r.oid=c.conrelid WHERE n.nspname='public' AND COALESCE(r.relname,'') <> '_prisma_migrations' ORDER BY c.conname`),
      rows(`SELECT i.relname AS name,pg_get_indexdef(i.oid,0,true) AS definition FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace WHERE n.nspname='public' AND i.relkind='i' AND i.relname NOT LIKE '_prisma_migrations%' ORDER BY i.relname`),
      rows(`SELECT p.proname AS name,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e') ORDER BY p.proname,p.oid`),
      rows(`SELECT t.tgname AS name,pg_get_triggerdef(t.oid,true) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY t.tgname`),
    ]);
    const inventory = {
      extensions: extensions.map((r) => r.name),
      tables: tables.map((r) => r.name),
      columns: columns.map((r) => ({ ...r, column_default: normalize(r.column_default) })),
      enums,
      constraints: constraints.map((r) => ({ ...r, definition: normalize(r.definition) })),
      indexes: indexes.map((r) => ({ ...r, definition: normalize(r.definition) })),
      functions: functions.map((r) => ({ ...r, definition: normalize(r.definition) })),
      triggers: triggers.map((r) => ({ ...r, definition: normalize(r.definition) })),
    };
    return {
      environment: 'staging',
      databaseId: database[0]?.databaseId,
      schemaFingerprint: createHash('sha256').update(JSON.stringify(inventory)).digest('hex'),
      migrationCount: Number(migrations[0]?.count ?? 0),
      buildCommit: process.env.COMMIT_SHA || 'unknown',
    };
  }
}
