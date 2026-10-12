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

Requiere Node.js 24. Desde la raíz del repositorio:

```sh
npm ci
cp .env.example .env
# Completar GEMINI_API_KEY en .env
npm start
```

Abrir http://localhost:3000 para usar frontend y API desde el mismo origen.
También se puede iniciar con `npm start` desde `backend` después de instalar
las dependencias en la raíz. Ejecutar `npm test` para las pruebas con Gemini simulado.

## Preparación para Vercel y Neon

Importar el repositorio con la raíz del proyecto en `.` y el framework Express.
Configurar el comando de instalación `npm ci` y el comando de build `npm run build`.
El build copia `frontend/` a `public/`, donde Vercel sirve los archivos estáticos.
`server.js` exporta Express sin abrir un puerto; `backend/server.js` inicia el servidor local.

Configurar `GEMINI_API_KEY` y, opcionalmente, `GEMINI_MODEL` en las variables
privadas del proyecto. El modelo predeterminado sigue siendo `gemini-3.5-flash-lite`.
Conectar Neon desde el Marketplace y reservar `DATABASE_URL` para la siguiente etapa.
No incluir credenciales en Git ni en archivos del frontend.

La migración inicial se aplica una sola vez a una base nueva mediante el editor SQL
de Neon, pegando `database/migrations/001_sessions_interactions.sql`, o mediante:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_sessions_interactions.sql
```

`DATABASE_URL` debe estar exportada en la terminal para este comando; copiarla a
`.env` no la exporta automáticamente. La migración es transaccional y no se ejecuta
al arrancar la aplicación ni en cada build. No repetirla sobre tablas existentes.
El campo `state` contendrá el estado completo del motor, incluido escenario y bloqueo,
pero nunca `history`. Las actualizaciones deberán incrementar `version` y actualizar
`updated_at` dentro de la misma transacción que inserta la interacción.

**Estado de esta etapa:** el despliegue y el esquema SQL están preparados, pero
la aplicación todavía usa un agente y un historial compartidos en memoria. No hay
persistencia activa, aislamiento de sesiones ni manejo específico de sobrecarga de Gemini.
Antes de habilitarla para varios visitantes, sigue implementar sesiones anónimas,
persistencia transaccional, historial temporal del navegador y errores del proveedor.
No se han añadido límites por sesión ni globales.
