import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { PrismaClient } from '@prisma/client';

/** Prisma resolves `file:` paths from the schema directory, not the process cwd. */
function schemaDirectory(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(dir, 'schema.prisma'))) return dir;
    if (existsSync(path.join(dir, 'prisma', 'schema.prisma'))) return path.join(dir, 'prisma');
    dir = path.dirname(dir);
  }
  throw new Error(`schema.prisma não encontrado a partir de ${__dirname}`);
}

function resolveDatabaseUrl(url: string): string {
  if (!url.startsWith('file:')) return url;
  const filePath = url.slice('file:'.length);
  if (path.isAbsolute(filePath)) return url;
  return `file:${path.resolve(schemaDirectory(), filePath)}`;
}

export function libsqlAdapterConfig(): { url: string; authToken?: string } {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  const useTurso = Boolean(tursoUrl?.startsWith('libsql://') && tursoToken);
  const raw = useTurso ? tursoUrl : process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN, ou DATABASE_URL=file:./dev.db');
  }
  return {
    url: resolveDatabaseUrl(raw),
    authToken: useTurso ? tursoToken : undefined,
  };
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaLibSQL(libsqlAdapterConfig()) });
}
