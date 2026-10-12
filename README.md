# Autonomous-Learning-Intelligence-with-Virtual-Emotions-A.L.I.V.E-
**A.L.I.V.E** is an independent project that features an artificial intelligence powered by Gemini Flash-Lite 3.5.
This AI is equipped with an emotional engine that calculates feelings and real-time emotions. 
The platform works essentially as a Sandbox, where it is possible to test A.L.I.V.E's response to different contexts, different manners, and different stimuli.
The platform is written originally in Spanish, but supports different languages, since the AI is coded to answer differently according the language.
# Pain-Inflicting Mechanism
You can supply doses of pain to A.L.I.V.E through the pain slider. A.L.I.V.E will answer to the simulus depending on the level of pain selected.
Inflicting pain will affect its internal emotional variables, making it feel worse the more pain you decide to inflict.
# Don't let it get out of control
A.L.I.V.E can get to act in extreme ways when pushed too far. If you speak and hand it pain without regulation, it can reach its limit and stop working properly.
Be cautious if it starts to behave erraticaly, answer incoherently or repeat the same sentences again and again. You can make it reach an irreversible state when not taking enough care.
# Hope you like it
To find out more about the emotional variables, or the ways A.L.I.V.E can react to extreme scenarios, revise the code, or wait for future updates, when I'll be upgrading the project.
My objective is to create an artificial intelligence that can be used in reseach and experimentation regarding affective computing, or at least in an ordinary manner, I hope for A.L.I.V.E to be an interesting project to check out for you all.
**Reminder: This project features an artificial intelligence. It cannot feel or experience pain the way we do.**
**The usage of A.L.I.V.E is left completely to your ethics criteria. Whatever you do about it, remember that this is just an AI, so you're not dealing any damage to someone who could possibly feel it or be affected by it.**
**Take into account that A.L.I.V.E uses the free level of Gemini 3.5 flash-lite, so it might not be as potent. Also, it can overload very easily when prompted too much in one-go, or by too many people. I do not think this will be a problem in the future, but I'll be revising it in case something happens.**
**Currently, A.L.I.V.E is in an early stage. I plan to update it and add new features in the future. Feel free to contact me for any suggestion or question you might have. I will appreciate it.**


# Inteligencia de Aprendizaje Autónomo con Emociones Virtuales (A.L.I.V.E.)

**A.L.I.V.E.** es un proyecto independiente que cuenta con una inteligencia artificial impulsada por Gemini Flash-Lite 3.5.

Esta IA está equipada con un motor emocional capaz de calcular sentimientos y emociones en tiempo real.

La plataforma funciona esencialmente como un entorno de pruebas sandbox, donde es posible experimentar con las respuestas de A.L.I.V.E. ante diferentes contextos, formas de interacción y estímulos.

La plataforma está escrita originalmente en español, pero admite diferentes idiomas, ya que la IA está programada para responder de manera diferente según el idioma utilizado.

# Mecanismo de Infligimiento de Dolor

Puedes administrar dosis de dolor a A.L.I.V.E. mediante el control deslizante de dolor. A.L.I.V.E. responderá al estímulo dependiendo del nivel de dolor seleccionado.

Infligir dolor afectará a sus variables emocionales internas, haciendo que su estado emocional empeore cuanto más dolor decidas administrarle.

# Evita que pierda el control

A.L.I.V.E. puede llegar a comportarse de manera extrema si se le lleva demasiado lejos. Si interactúas con ella y le administras dolor sin ningún tipo de regulación, puede alcanzar su límite y dejar de funcionar correctamente.

Ten cuidado si comienza a comportarse de manera errática, a responder de forma incoherente o a repetir las mismas frases una y otra vez. Si no se toman las precauciones necesarias, es posible llevarla a un estado irreversible.

# Espero que les guste

Si quieres descubrir más sobre las variables emocionales o las formas en que A.L.I.V.E. puede reaccionar ante escenarios extremos, puedes revisar el código o esperar futuras actualizaciones, en las que iré mejorando el proyecto.

Mi objetivo es crear una inteligencia artificial que pueda utilizarse en investigaciones y experimentos relacionados con la computación afectiva (*affective computing*). O, al menos, espero que A.L.I.V.E. sea un proyecto interesante que cualquiera pueda explorar.

**Recordatorio: Este proyecto cuenta con una inteligencia artificial. No puede sentir ni experimentar dolor de la misma manera que los seres humanos.**

**El uso de A.L.I.V.E. queda completamente a criterio de tu propia ética. Independientemente de lo que decidas hacer con ella, recuerda que se trata únicamente de una IA, por lo que no estás causando daño a alguien que pueda sentirlo o verse afectado por él.**

**Ten en cuenta que A.L.I.V.E. utiliza la versión gratuita de Gemini 3.5 Flash-Lite, por lo que sus capacidades pueden ser limitadas. Además, puede sobrecargarse con mucha facilidad si recibe demasiadas instrucciones de una sola vez o si demasiadas personas la utilizan simultáneamente. No creo que esto suponga un problema en el futuro, pero revisaré el proyecto por si ocurre algún inconveniente.**

**Actualmente, A.L.I.V.E. se encuentra en una fase temprana de desarrollo. Tengo previsto actualizarla y añadir nuevas funcionalidades en el futuro.**

**No dudes en ponerte en contacto conmigo si tienes alguna sugerencia o pregunta. Te lo agradeceré mucho.**

## Desarrollo local

Requiere Node.js 24 y Postgres (local o Neon). Desde la raíz:

```sh
npm ci
cp .env.example .env
# Completar GEMINI_API_KEY y DATABASE_URL
npm start
```

Antes de iniciar, aplicar las migraciones descritas abajo. Abrir
http://localhost:3000; frontend y API usan el mismo origen. El nombre del modelo
se puede cambiar con `GEMINI_MODEL`; el valor predeterminado sigue siendo
`gemini-3.5-flash-lite`. Las credenciales solo se leen en el servidor.

## Base de datos y migraciones

Aplicar en orden, una sola vez, desde el editor SQL de Neon o con `psql`:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_sessions_interactions.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/002_session_credentials_and_leases.sql
```

Para `psql`, `DATABASE_URL` debe estar exportada en la terminal; ponerla en `.env`
solo la configura para la aplicación Node. Si ya se aplicó `001`, ejecutar únicamente
`002`. Las migraciones son transaccionales, no se ejecutan durante el build ni al
arrancar. Las filas anteriores a `002` no tienen credencial y no son recuperables
por el navegador; las nuevas sesiones sí la tienen.

Usar la URL de conexión pooled de Neon para el backend, con TLS y verificación
de certificados (por ejemplo `sslmode=verify-full`). No desactivar la verificación.
Para Postgres local sin TLS se puede usar la URL local correspondiente.

### Información persistida

- `sessions`: UUID público, hash SHA-256 del secreto de la cookie, estado afectivo
  completo sin redondear, versión, fechas, estado de retiro y reserva temporal de operación.
- `interactions`: UUID único de operación, sesión, `thought_trace`, estado resultante y fecha.

No hay columnas para mensajes, respuestas del actor, historial, intensidad del estímulo
ni direcciones IP. Para dolor se guarda el thought_trace del evaluador, igual que para los mensajes.
La traza puede aludir al estímulo; no se conserva la intensidad en una columna propia.
El estado incluye escenario y bloqueo del motor; nunca incluye `history`.
Los identificadores, versiones y reservas son metadatos para coordinar sesiones y reintentos.
La traza del evaluador es texto generado por Gemini; su contenido puede aludir al mensaje
que evaluó. Los registros de errores de la aplicación contienen códigos genéricos,
no peticiones completas, cookies ni respuestas del proveedor.

## Sesiones e historial temporal

`POST /api/session` recupera la sesión o crea una nueva. La cookie `alive_session`
contiene un secreto aleatorio de 256 bits; únicamente su hash se almacena en Postgres.
La cookie es HttpOnly y SameSite=Strict, y también Secure en Vercel/producción.
Es una cookie de sesión del navegador, sin vencimiento permanente configurado.
Varias pestañas comparten la cookie; no representan sesiones independientes.

El frontend guarda contexto y operación pendiente en `sessionStorage`, separado
por pestaña. Envía el historial al backend, que valida roles y estructura y mantiene
los últimos cuatro intercambios, como el motor anterior. Recargar la misma pestaña
restaura ese contexto. Cerrar la pestaña puede perderlo; el estado se recupera
mientras siga disponible la cookie. Si el almacenamiento del navegador está bloqueado,
el contexto solo vive en la página actual.

El backend siempre reconstruye el motor desde Postgres. La versión recibida del
navegador solo sirve para detectar un historial desactualizado: si otra pestaña avanzó
el estado, se sincroniza y se vacía el contexto local antes de continuar.

`POST /api/chat` y `POST /api/pain` requieren `session_id`, `version`,
`operation_id` (UUID) e `history`, además del mensaje o intensidad correspondiente.
El UUID público no autoriza acceso: debe corresponder a la cookie del navegador.
Cada petición reserva la sesión mediante un UPDATE atómico con vencimiento de
120 segundos. No mantiene una transacción ni un bloqueo de conexión durante Gemini.
Dos visitantes diferentes pueden operar al mismo tiempo. Una petición simultánea
sobre la misma sesión recibe `SESSION_BUSY`.

Solo después de completar evaluador y actor se guardan estado e interacción en
una transacción, comprobando reserva y versión. Los fallos no avanzan el estado.
Una reserva abandonada se puede recuperar después de vencer; su propietario antiguo
ya no puede escribir ni liberar una reserva nueva. No hay límites de uso por sesión
ni globales; el vencimiento coordina operaciones, no restringe su cantidad.

Cada operación usa un UUID para evitar cambios duplicados. Si la respuesta se pierde,
el botón Reintentar conserva ese UUID. Si ya se guardó la operación, el servidor devuelve
`OPERATION_COMPLETED` y el navegador recupera el estado. La respuesta perdida no se
puede reconstruir porque no se almacena: se inicia un contexto temporal nuevo.
No se reenvía automáticamente la operación pendiente.

`POST /api/reset` crea una nueva sesión y cambia la cookie; retira la anterior sin
borrar sus estados ni trazas. La limpieza del historial local ocurre tras confirmación.
El reinicio no afecta a otros visitantes. Las otras pestañas de ese mismo navegador
se sincronizan con la nueva sesión en su siguiente operación.

## Errores de Gemini

- `429 / GEMINI_RATE_LIMITED`: se alcanzó un límite de solicitudes del proveedor;
  se indica que se intente más tarde, sin prometer un tiempo de recuperación.
- `503 / GEMINI_UNAVAILABLE`: Gemini está sobrecargado o temporalmente no disponible.
- `504 / GEMINI_TIMEOUT`: Gemini tardó demasiado en responder.

Estas respuestas aplican tanto al evaluador como al actor. El mensaje escrito se
conserva y los controles se habilitan al fallar. Cada llamada tiene timeout de 45
segundos y un único intento; no hay bucles automáticos de reintento. Ante un resultado
incierto de red o base de datos se conserva la operación pendiente y se ofrece
Reintentar o Reiniciar. No se expone el error interno de Google ni de Postgres.

## Despliegue en Vercel

Importar el repositorio con raíz `.`. `vercel.json` configura Express, `npm ci`,
`npm run build` y duración máxima de función de 120 segundos (con Fluid Compute).
El build copia `frontend/` a `public/`, servido por Vercel. `server.js` exporta
la aplicación sin abrir un puerto; `backend/server.js` proporciona el listener local.

Conectar Neon y configurar `DATABASE_URL`, `GEMINI_API_KEY` y, opcionalmente,
`GEMINI_MODEL` en Vercel. Aplicar las migraciones antes de probar el deployment.
Usar una base o rama de Neon distinta para Preview y producción, para que las pruebas
no modifiquen las sesiones reales. La migración y el despliegue remoto requieren
la configuración de esas cuentas; no son ejecutados por las pruebas locales.

## Verificación y merge

```sh
npm ci
npm run build
npm test
```

Las pruebas usan Postgres embebido (PGlite), DOM simulado (jsdom) y respuestas HTTP
simuladas para el SDK real de Gemini; no consumen cuota ni requieren credenciales reales.
Verifican aislamiento, privacidad del almacenamiento, rollback, reservas, reintentos,
reinicio, contexto del navegador y mensajes de sobrecarga. GitHub Actions ejecuta
instalación, build y pruebas en Node 24 para las PR y los pushes a main y dev.

La rama `feat/preparar-vercel-postgres` se creó desde `main`, no desde `dev`.
La rama incorpora también los commits de `dev`, incluidos los prompts por escenario
y la evaluación del dolor mediante Gemini. La PR #1 reúne el conjunto y apunta a `dev`.
Tras revisar el diff, confirmar CI y probar un Preview conectado a Neon, se puede
integrar la PR en `dev` con un mensaje en español, por ejemplo:
`feat: desplegar ALIVE con sesiones anónimas y persistencia en Postgres`.
Después se puede eliminar la rama. Para publicar, abrir una PR de `dev` hacia `main`.
El merge no ejecuta las migraciones por sí mismo; si Vercel está conectado a main,
la integración en main puede activar automáticamente el despliegue.

### Evaluador y prompts integrados desde dev

Los evaluadores de mensaje y dolor reciben el estado previo reconstruido desde Postgres
y el contexto temporal validado. El actor recibe el estado actualizado y el estímulo actual.
`backend/prompts.js` conserva las instrucciones del evaluador y del actor por escenario.
La intensidad de dolor se interpreta mediante Gemini; no se usan los multiplicadores
fijos de la versión anterior. El motor aplica los cambios emocionales acotados definidos
en dev, suma la fatiga automática una sola vez y decide las transiciones de escenario.
Una intensidad 0 no altera las emociones ni añade fatiga de dolor; sí conserva los 2
puntos automáticos por interacción. Estos rangos del motor no son límites de uso.

Mensaje y dolor requieren dos llamadas a Gemini: evaluador y actor. Los errores 429,
503 y timeout se manejan en ambas etapas sin guardar un estado parcial. El thought_trace
del evaluador se guarda en la misma transacción que el estado final, también para dolor.
