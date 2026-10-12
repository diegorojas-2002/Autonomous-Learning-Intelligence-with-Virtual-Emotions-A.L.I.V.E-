import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

export async function applyMigrations(db, directory = new URL('../database/migrations/', import.meta.url)) {
  const files = (await readdir(directory)).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
  const client = await db.connect();
  const applied = [];
  try {
    await client.query('BEGIN');
    // Una sola instancia modifica el esquema por vez; no interviene en las sesiones.
    await client.query("SELECT pg_advisory_xact_lock(410827)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY, checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    for (const name of files) {
      const source = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const existing = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name]);
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`La migración aplicada ${name} cambió; crea una nueva migración.`);
        continue;
      }
      // Los archivos también se pueden usar en psql, pero aquí hay una sola transacción.
      const sql = source.replace(/^\s*(BEGIN|COMMIT);\s*$/gm, '');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name,checksum) VALUES ($1,$2)', [name, checksum]);
      applied.push(name);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* conservar error original */ }
    throw error;
  } finally { client.release(); }
}
