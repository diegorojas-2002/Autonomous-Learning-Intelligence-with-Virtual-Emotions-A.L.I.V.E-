import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/migrations.mjs';

test('migraciones: esquema completo, repetición segura y checksum inmutable', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const adapter = { connect: async () => ({ query: (...args) => db.query(...args), release() {} }) };
  // node-postgres acepta scripts SQL; PGlite usa exec para múltiples sentencias.
  adapter.connect = async () => ({
    query: (sql, params) => params ? db.query(sql, params) : db.exec(sql).then(rows => rows.at(-1)), release() {}
  });
  assert.deepEqual(await applyMigrations(adapter), ['001_sessions_interactions.sql', '002_session_credentials_and_leases.sql']);
  assert.deepEqual(await applyMigrations(adapter), []);
  const columns = (await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='sessions'")).rows.map(x => x.column_name);
  for (const column of ['state','token_hash','operation_expires_at','retired']) assert.ok(columns.includes(column));
  await db.query("UPDATE schema_migrations SET checksum='modificado' WHERE name=$1", ['001_sessions_interactions.sql']);
  await assert.rejects(applyMigrations(adapter), /cambió/);
  assert.equal((await db.query('SELECT * FROM schema_migrations')).rows.length, 2);
});
