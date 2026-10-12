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
Las ramas están listas y tienen las migraciones 001 y 002 aplicadas y registradas
en schema_migrations. Las migraciones se aplicaron primero en preview y después
en production, en una transacción por rama. Preview no tiene datos de sesión.

## Proyecto Vercel y Preview

Equipo: Diego Rojas (`diego-rojas1`, `team_YAklYS96FWhCE5qMktOUFgTE`).
Proyecto: `alive` (`prj_fdcsAIGlmf6vRGnRBt66PK1fPSC9`).
El propietario creó el proyecto; la configuración se actualizó mediante el plugin.
La copia local quedó vinculada con esos IDs verificados en .vercel/project.json.

El import inicial intentó construir `main` en `8d8be56`, versión anterior a la
preparación para Vercel. Falló con `Cannot read properties of undefined (reading 'fsPath')`.
Se configuró la raíz del repositorio, Express, Node 24, npm ci, npm run build,
Fluid Compute, región iad1 y duración de función de 120 segundos.

El Preview de `feat/preparar-vercel-postgres` en `78a288b` terminó READY:
https://alive-18smqpami-diego-rojas1.vercel.app

La protección de despliegue sigue activa. El plugin recibió 403 al intentar
acceder al Preview protegido y consultar sus runtime logs. Esto impide verificar
la interfaz, API y llamadas reales de Gemini desde esta conexión; READY confirma
el build y despliegue, no el flujo de chat. El propietario puede abrir el Preview
con su sesión de Vercel. Para automatizar su verificación, la conexión necesita
acceso al equipo/proyecto y al deployment protegido. No se desactivó protección.

`main` sigue siendo la rama de producción prevista. El código integrado continúa
en la PR #1 hacia dev; todavía no se ha publicado mediante un merge a main.
No establecer public como Output Directory: Express necesita también su función
backend; Vercel sirve public/ como archivos estáticos.

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
GEMINI_API_KEY ya estaba configurada por el propietario para Production y Preview.
Se conservó sin leer ni sustituir su valor. No está configurada para Development;
para desarrollo local, proporcionar una clave propia directamente en .env.local.
El proyecto conserva las llamadas directas a Gemini y el modelo gratuito elegido.

`DATABASE_URL_UNPOOLED` solo hace falta para ejecutar migraciones con conexión directa.
No es una variable requerida por el backend desplegado. Las credenciales de Preview
no deben apuntar a la rama production. No se instaló una integración Marketplace:
los recursos existentes de Neon están conectados mediante estas variables, sin duplicarlos.
DATABASE_URL está configurada por separado para Production, Preview y Development;
Development usa preview y tiene además DATABASE_URL_UNPOOLED. GEMINI_MODEL está
configurada en los tres entornos.

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
antes de publicar. No copiar datos de prueba a production. La vinculación y las claves requeridas para Production/Preview se verificaron.
Las migraciones remotas ya se aplicaron usando Neon MCP y sus checksums coinciden
con los archivos versionados. El comando puede comprobar/reutilizar el registro
cuando se configure una clave de desarrollo para su ejecución local.

## Verificación y publicación

1. Comprobar el esquema ya aplicado en preview y las conexiones del backend.
2. Abrir el Preview READY de la rama de trabajo integrada.
3. Probar chat, dolor, recarga, dos navegadores, reinicio y persistencia.
4. Confirmar que el evaluador/actor no avanzan el estado ante fallos y que Gemini
   devuelve mensajes de sobrecarga cuando corresponde.
5. Integrar la PR #1 en dev y abrir una PR dev → main; el esquema production ya está preparado.
6. Publicar la versión aprobada desde main y verificarla con su base production.

Las pruebas locales usan Postgres embebido y Gemini simulado. No sustituyen la
verificación de un deployment conectado a Neon y Gemini reales.
