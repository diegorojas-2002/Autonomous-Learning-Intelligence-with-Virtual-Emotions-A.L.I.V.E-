import '../backend/env.js';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { applyMigrations } from './migrations.mjs';

let pool;
try {
  const linked = JSON.parse(await readFile(new URL('../.vercel/project.json', import.meta.url), 'utf8'));
  if (!linked.projectId || !linked.orgId) throw new Error('Proyecto Vercel sin vincular.');
  if (!process.env.GEMINI_API_KEY?.trim() || !process.env.DATABASE_URL?.trim()) throw new Error('Faltan variables requeridas.');
  const raw = process.env.DATABASE_URL_UNPOOLED?.trim();
  if (!raw) throw new Error('Falta DATABASE_URL_UNPOOLED.');
  const url = new URL(raw);
  const runtimeUrl = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname.includes('-pooler')) throw new Error('Se requiere conexión Postgres directa.');
  if (url.hostname !== runtimeUrl.hostname.replace('-pooler', '') || url.pathname !== runtimeUrl.pathname || url.username !== runtimeUrl.username) {
    throw new Error('La conexión directa y la de aplicación deben corresponder a la misma base y rama.');
  }
  pool = new pg.Pool({ connectionString: raw, connectionTimeoutMillis: 10000 });
  const applied = await applyMigrations(pool);
  console.log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'El esquema ya está actualizado.');
} catch {
  // No mostrar errores de conexión que puedan contener una contraseña o URL.
  console.error('No se aplicaron migraciones. Verifica la vinculación Vercel, las claves de .env.local y la conexión directa. Si el esquema se creó manualmente, no repitas las migraciones iniciales: revisa su registro primero.');
  process.exitCode = 1;
} finally { if (pool) await pool.end(); }
