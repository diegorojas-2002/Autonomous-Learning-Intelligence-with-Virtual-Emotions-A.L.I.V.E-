import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { SessionStore } from '../backend/sessionStore.js';

export async function database() {
  const pg = new PGlite();
  for (const file of ['001_sessions_interactions.sql', '002_session_credentials_and_leases.sql']) {
    await pg.exec(await readFile(new URL(`../database/migrations/${file}`, import.meta.url), 'utf8'));
  }
  // Adaptador con exclusión de transacciones para la única conexión de PGlite.
  let tail = Promise.resolve();
  const lock = async () => {
    let release;
    const previous = tail;
    tail = new Promise(resolve => { release = resolve; });
    await previous;
    return release;
  };
  const db = {
    async query(...args) { const release = await lock(); try { return await pg.query(...args); } finally { release(); } },
    async connect() { const release = await lock(); return { query: (...args) => pg.query(...args), release }; }
  };
  return { pg, db, store: new SessionStore(db) };
}
