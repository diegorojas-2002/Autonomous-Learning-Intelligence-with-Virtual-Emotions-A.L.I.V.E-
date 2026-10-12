import pg from 'pg';
import { SessionStore } from './sessionStore.js';

export function createSessionStore() {
  if (!process.env.DATABASE_URL?.trim()) throw new Error('Falta DATABASE_URL. Configura Postgres y aplica las migraciones.');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
  // No imprimir errores de conexión que puedan incluir credenciales.
  pool.on('error', () => console.error('Conexión inactiva de Postgres interrumpida.'));
  return new SessionStore(pool);
}
