import { createClient } from '@libsql/client';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ensureRootEnv } from '../src/prisma/create-client';

async function main() {
  ensureRootEnv();
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url?.startsWith('libsql://') || !authToken) {
    console.log('Turso não configurado. A migration ficou apenas no SQLite local (DATABASE_URL).');
    return;
  }

  const client = createClient({ url, authToken });
  await client.execute(
    'CREATE TABLE IF NOT EXISTS _turso_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  );

  const migrationsDir = path.join(__dirname, 'migrations');
  const folders = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name !== 'migration_lock.toml')
    .map((entry) => entry.name)
    .sort();

  for (const folder of folders) {
    const existing = await client.execute({
      sql: 'SELECT id FROM _turso_migrations WHERE id = ?',
      args: [folder],
    });
    if (existing.rows.length > 0) {
      continue;
    }
    const sql = await readFile(path.join(migrationsDir, folder, 'migration.sql'), 'utf8');
    await client.executeMultiple(sql);
    await client.execute({
      sql: 'INSERT INTO _turso_migrations (id, applied_at) VALUES (?, ?)',
      args: [folder, new Date().toISOString()],
    });
    console.log(`Migration aplicada no Turso: ${folder}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
