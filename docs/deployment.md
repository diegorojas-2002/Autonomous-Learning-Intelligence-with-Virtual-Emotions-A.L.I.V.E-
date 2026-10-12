# Recursos de ALIVE y configuración pendiente

## Recursos creados

- Neon: organización Diego, plan Free.
- Proyecto: ALIVE (`little-poetry-50944788`), región AWS us-east-1, Postgres 17.
- Base: `alive`; propietario: `alive_owner`.
- Rama de producción: `production` (`br-restless-boat-b7aa1o2u`).
- Rama de Preview/Development: `preview` (`br-lucky-band-b7i0r25m`).
- Consola: https://console.neon.tech/app/projects/little-poetry-50944788

El cómputo se configuró con mínimo y máximo 0.25 CU; se mantuvieron los valores de
suspensión permitidos por la cuenta. No se contrató un plan de pago.
Las ramas están listas pero no tienen todavía las tablas de ALIVE ni datos de sesión.

## Bloqueo en Vercel

Equipo previsto: Diego Rojas (`diego-rojas1`, `team_YAklYS96FWhCE5qMktOUFgTE`).
Proyecto previsto: `alive`. La API rechazó su creación con 403 forbidden.
La CLI también rechazó el acceso al mismo equipo. No se creó un proyecto ni un deployment.
Se necesita que el propietario cree el proyecto desde su cuenta o que una conexión
con permisos de creación complete ese paso. No se presupone que reconectar resuelva el 403.

Desde https://vercel.com/new importar el repositorio
`diegorojas-2002/Autonomous-Learning-Intelligence-with-Virtual-Emotions-A.L.I.V.E-`
en el equipo Diego Rojas, con nombre `alive` y raíz `.`.
El código a probar está en `feat/preparar-vercel-postgres`; configurar `main` como
rama de producción y desplegar esa rama de trabajo como Preview, antes del merge.
Si el import intenta desplegar main automáticamente, esa rama todavía no contiene
la nueva versión: no utilizar ese deployment para verificar esta implementación.

Configuración en el código: Express, Node 24, `npm ci`, `npm run build`, Fluid Compute,
región `iad1` y función de 120 segundos. No establecer `public` como Output Directory:
Express necesita también su función backend; Vercel sirve public/ como archivos estáticos.

## Variables por entorno

| Variable | Production | Preview / Development |
|---|---|---|
| `DATABASE_URL` | URL pooled de la rama production | URL pooled de la rama preview |
| `GEMINI_API_KEY` | Clave propia de Gemini | Clave para pruebas de Gemini |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | `gemini-3.5-flash-lite` |

Obtener las URLs desde Connect en la rama correspondiente de Neon, usando la base
alive y el rol alive_owner. Para la aplicación, activar pooling y TLS con verificación
de certificados, por ejemplo `sslmode=verify-full`. Guardar las URLs y claves como
variables secretas del servidor en Vercel; nunca ponerlas en archivos públicos o Git.
No se dispone de GEMINI_API_KEY en este entorno y no se ha creado una clave nueva.
El proyecto conserva las llamadas directas a Gemini y el modelo gratuito elegido.

`DATABASE_URL_UNPOOLED` solo hace falta para ejecutar migraciones con conexión directa.
No es una variable requerida por el backend desplegado. Las credenciales de Preview
no deben apuntar a la rama production. No se instaló una integración Marketplace:
los recursos existentes de Neon se conectarán mediante estas variables, sin duplicarlos.

## Vinculación, variables y migraciones

Después de crear el proyecto Vercel, con una CLI autenticada:

```sh
npx vercel link --yes --scope diego-rojas1 --project alive
npx vercel env pull .env.local --environment=development --yes
```

El backend carga explícitamente .env.local y después .env, sin sobrescribir variables
del proceso. Mantener en .env.local las claves de desarrollo y la URL directa de preview
como DATABASE_URL_UNPOOLED. Verificar que pertenecen a la misma rama y base antes de:

```sh
npm ci
npm run db:migrate
```

El comando requiere la vinculación real en .vercel/project.json y las claves necesarias.
Usa conexión directa, una transacción, un bloqueo de migración y checksums en
schema_migrations. Puede repetirse sin volver a ejecutar SQL aplicado.
No se ejecuta en cada build, inicio ni petición. Si se aplicaron archivos SQL manualmente,
revisar y registrar primero el esquema existente; no repetir las migraciones iniciales.

Aplicar y verificar primero en preview; luego repetir con las credenciales de production
antes de publicar. No copiar datos de prueba a production. Mientras no se complete la
vinculación y verificación de claves de Vercel, no se ejecutarán migraciones remotas.

## Verificación y publicación

1. Aplicar el esquema en preview y probar conexiones.
2. Crear Preview desde la rama de trabajo integrada.
3. Probar chat, dolor, recarga, dos navegadores, reinicio y persistencia.
4. Confirmar que el evaluador/actor no avanzan el estado ante fallos y que Gemini
   devuelve mensajes de sobrecarga cuando corresponde.
5. Integrar la PR #1 en dev, abrir una PR dev → main y preparar el esquema production.
6. Publicar la versión aprobada desde main y verificarla con su base production.

Las pruebas locales usan Postgres embebido y Gemini simulado. No sustituyen la
verificación de un deployment conectado a Neon y Gemini reales.
