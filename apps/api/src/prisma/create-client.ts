import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { PrismaClient } from '@prisma/client';

function parseEnvFile(filePath: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function findRepoRoot(start: string): string | undefined {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}

/** Fill missing variables from the repository root `.env`. */
export function ensureRootEnv(): void {
  const repoRoot = findRepoRoot(process.cwd()) ?? findRepoRoot(__dirname);
  if (!repoRoot) return;
  const file = path.join(repoRoot, '.env');
  if (!existsSync(file)) return;
  for (const [key, value] of parseEnvFile(file)) {
    const trimmed = value.trim();
    if (!trimmed || process.env[key]?.trim()) continue;
    process.env[key] = trimmed;
  }
}

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
  ensureRootEnv();
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
