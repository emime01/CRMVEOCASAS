# Veocasas Prospector

Agente de captación comercial para **Veocasas**, un portal inmobiliario de Uruguay donde las inmobiliarias pagan por publicar sus propiedades.

El agente:
1. encuentra todas las inmobiliarias de Uruguay que pueda,
2. les escribe por correo,
3. hace seguimiento si no responden,
4. lee y clasifica las respuestas con IA,
5. le pasa las interesadas a un ejecutivo de ventas humano, que cierra la venta.

El código vive en `veocasas-prospector/` dentro del repo del CRM y se despliega como un proyecto aparte de Vercel (`veocasas-prospector`, Root Directory = esta carpeta). Este documento explica qué hace y por qué, para seguir construyéndolo.

---

## Stack

- **Next.js 14 (App Router)** desplegado en **Vercel**, con Vercel Cron.
- **Firestore** (`@google-cloud/firestore`, no firebase-admin). Es el mismo proyecto Firebase del CRM de Veocasas (`crmveocasas-4fc8c`), pero en colecciones propias con prefijo `prospeccion_`.
  - **Sin claves:** la organización de Google (movimagen.com.uy) prohíbe crear claves de cuentas de servicio. En Vercel se usa federación de identidades: Google confía en el token OIDC de Vercel (pool y proveedor `vercel`) y lo cambia por la cuenta `firebase-adminsdk-fbsvc@crmveocasas-4fc8c.iam.gserviceaccount.com`. firebase-admin no acepta estas credenciales para Firestore; por eso se usa la librería de Firestore directo (misma API).
- **Gmail API**, con OAuth y refresh token de una casilla dedicada. Se usa para enviar correos, leer hilos y detectar rebotes.
- **Claude API**, modelo `claude-haiku-5-5`, para:
  - extraer inmobiliarias de texto desordenado,
  - clasificar respuestas,
  - redactar respuestas simples.
- **Google Places API (New)**, endpoint Text Search, para la búsqueda en Google Maps.
- **Serper.dev** para resultados orgánicos de Google, incluyendo búsquedas `site:` en redes y portales.
- **Playwright en GitHub Actions** para rastrear directorios de portales y cámaras una vez por mes.
- **Sin Apify.** Se sacó a propósito por costo. El objetivo es menos de US$ 5/mes en búsqueda e IA.

---

## Flujo completo

```
BÚSQUEDA (mensual)
  Places API  → 38 consultas ("inmobiliaria en {departamento}, Uruguay" ×19 deptos ×2 variantes), 3 páginas c/u
  Serper      → ~51 consultas: por departamento + site:instagram/facebook/tiktok por zona
                + site:infocasas / casasymas / gallito / mercadolibre + cámaras y guías
  Crawler     → GitHub Actions + Playwright sobre URLs de directorios (portales, CIU, ADIU)
        ↓ resultados crudos en cola (prospeccion_jobs)
PROCESAMIENTO
  Maps        → filtro por type real_estate_agency o regex
  Google/web  → Claude extrae [{nombre, web, email, telefono, instagram, facebook, departamento}]
  → normalización + deduplicado por claves → prospeccion_leads (estado: nuevo)
ENRIQUECIMIENTO
  email existente → verificar MX
  si no hay → buscarlo en la web (/, /contacto, /contact, /nosotros…)
  si no hay web → buscar la web o un email por Serper
  → listo (tiene email válido) | sin_email (2 intentos fallidos)
SECUENCIA (días hábiles, hora UY)
  día 0  correo inicial   (cupo diario, DAILY_NEW_LIMIT)
  día 3  seguimiento 1    (mismo hilo)
  día 7  seguimiento 2
  día 10 seguimiento 3 ("último correo")
  día 13 → sin_respuesta  (queda en el panel para que un humano decida)
RESPUESTAS (se revisan antes de cada envío)
  Claude clasifica la respuesta → actúa según la etapa (tabla abajo)
DERIVACIÓN
  se responde en el hilo presentando al ejecutivo (en CC) + se le envía un resumen por correo
  → derivado. El agente deja de tocar ese hilo.
```

---

## Estados del lead (`estado`)

| Estado | Significado |
|---|---|
| `nuevo` | Recién encontrado, buscando email |
| `listo` | Tiene email válido; espera su turno en el cupo diario |
| `en_secuencia` | Ya recibió el primer correo; `paso` va de 1 a 4 |
| `conversando` | Hizo una pregunta general y el agente respondió. A los 7 días sin respuesta pasa a `sin_respuesta` |
| `derivado` | Lo tiene un ejecutivo |
| `sin_respuesta` | Terminó la secuencia sin responder. Acciones en el panel: reiniciar, contacto manual o descartar |
| `sin_email` | No se encontró correo. Se puede cargar a mano desde el panel |
| `no_interesado`, `rebotado`, `baja`, `cliente`, `descartado`, `manual` | Estados finales o fuera del flujo |

## Etapas de clasificación (Claude)

| Etapa | Criterio | Acción |
|---|---|---|
| `fuera_oficina` | Respuesta automática | Ignorar; la secuencia sigue |
| `baja` | Pide no recibir más correos | `baja` y se agrega a excluidos para siempre |
| `no_interesado` | Rechazo claro | Se cierra |
| `redirige` | Indica otro correo o persona | Si hay un email válido, se reinicia la secuencia a ese correo; si no, se deriva |
| `info` | Pregunta general que se responde **solo** con `CONFIG.conocimiento` | Responde el agente → `conversando` |
| `caliente` | Interés: acepta llamada, pide propuesta o precios, o pregunta algo que no está en el conocimiento | Se deriva a un ejecutivo |
| `cierre` | Quiere contratar o arrancar, o pregunta cómo pagar | Se deriva con prioridad |

Reglas importantes:
- **Ante la duda, se elige la etapa más caliente.** Es preferible que un humano mire de más.
- **El agente nunca inventa precios ni condiciones.** Si la respuesta necesita algo que no está en `conocimiento`, se deriva.
- **Si la IA falla o devuelve algo inválido, la etapa es `caliente`.** Así la respuesta pasa a una persona.

## Ejecutivos

Se configuran en `EXECUTIVES_JSON`, con este formato:

```json
[{"nombre":"Ana","email":"ana@veocasas.com.uy","etapas":["caliente","cierre"],"departamentos":["Maldonado"]}]
```

- La asignación se reparte por turnos (round-robin), por etapa.
- Si algún ejecutivo tiene `departamentos` y el lead es de uno de esos departamentos, se asigna entre esos ejecutivos.
- Si no hay ejecutivo para la etapa, se avisa a `ADMIN_EMAIL`.

---

## Modelo de datos (Firestore)

**`prospeccion_leads`**

| Grupo | Campos |
|---|---|
| Identificación | `nombre`, `web`, `email`, `telefono`, `instagram`, `facebook`, `departamento` |
| Origen y deduplicado | `fuentes[]`, `keys[]` |
| Estado | `estado`, `paso`, `intentosEnriquecer` |
| Hilo de Gmail | `threadId`, `asunto`, `ultimoMessageId`, `referencias` (para que todo quede en un hilo) |
| Fechas | `primerEnvio`, `ultimoEnvio`, `proximoEnvio`, `ultimoInboundProcesado` |
| Clasificación | `etapa`, `score` (0–100), `resumenIA`, `contacto` |
| Derivación | `ejecutivo`, `derivadoEn` |
| Registro | `historial[]` (log de eventos), `creado`, `actualizado` |

**`keys[]` (deduplicado):** se busca un lead existente con `array-contains-any` sobre estas claves; si hay coincidencia, se fusiona.
- `em:{email}`
- `dom:{dominio}`, solo si no es un dominio genérico tipo gmail, ni una red social o un portal
- `ig:{handle}`
- `tt:{handle}`
- `nm:{nombre normalizado}`, sin la palabra "inmobiliaria", "S.R.L." ni tildes

**Otras colecciones:**
- **`prospeccion_jobs`**: cola de resultados crudos `{fuente, items[], offset, done}`, en lotes de 10 a 20 ítems.
- **`prospeccion_excluidos`**: `{keys[], motivo}`. Guarda clientes actuales y bajas; nunca se les escribe. Los clientes se cargan con `npm run importar-clientes -- clientes.csv`.
- **`prospeccion_meta`**: contadores de round-robin y datos de la última prospección.

Índices compuestos en `firestore.indexes.json`:
- `estado + proximoEnvio`
- `estado + actualizado desc`
- `estado + creado`
- `done + creado`

---

## Estructura del código

```
lib/config.js      configuración central: plantillas, conocimiento, cupos, consultas de búsqueda, URLs de directorios
lib/fuentes.js     clientes de Places API y Serper
lib/extract.js     ítem crudo → candidatos (Claude para texto libre)
lib/normalize.js   emails, dominios, handles, slugs, detección de departamento, listas de bloqueo
lib/leads.js       upsert con deduplicado, exclusiones
lib/enrich.js      verificación MX, búsqueda de email en web, búsqueda de web por nombre
lib/gmail.js       envío MIME (threading, List-Unsubscribe), lectura de hilos, rebotes
lib/claude.js      prompts de extracción y clasificación
lib/pasos.js       prospectar, procesarJobs, enriquecer, enviar, revisarRespuestas, derivar, ciclos
lib/util.js        fechas en hora UY (UTC-3), días hábiles, presupuesto de tiempo, firma HMAC de bajas
app/page.js        panel: flujo de etapas con conteos + tabla por estado + acciones
app/api/cron/*     prospectar (mensual), diario (L–V 10:00 UY), frecuente (diario 18:00 UY)
app/api/admin/run  disparar ciclos desde el panel
app/api/leads/[id] acciones manuales (reactivar, email, manual, descartar, cliente)
app/api/baja       link de baja (GET) y one-click unsubscribe (POST)
middleware.js      Basic Auth del panel (DASHBOARD_PASSWORD)
scripts/           crawler.mjs (Playwright), gmail-token.mjs, importar-clientes.mjs
.github/workflows/directorios.yml   rastreo mensual de portales
```

## Restricciones técnicas a respetar

- **Duración de las funciones:** las funciones de Vercel tienen máximo 300 s. Por eso cada paso recibe una función `vivo()` (presupuesto de tiempo) y deja el trabajo a medias en la cola para la próxima corrida. El orden del ciclo diario es: respuestas → procesar → enriquecer → enviar.
- **Respuestas antes de enviar:** antes de mandar un seguimiento se revisa el hilo. Si hay respuesta nueva, no se envía.
- **Días y horario:** no se envía nada sábados ni domingos (hora UY), y las fechas de seguimiento que caen en fin de semana se corren al lunes.
- **Tope de Places API:** hay que mantenerse dentro de las 1.000 llamadas gratis por mes del SKU Text Search Enterprise. El field mask pide web y teléfono, que son de ese SKU. Google no deja bajar la cuota diaria de Text Search ("Ajustable: No"), así que el tope lo lleva el agente: cada llamada se cuenta en `prospeccion_meta/places_{AAAA-MM}` y al llegar a `PLACES_MONTHLY_LIMIT` (900 por defecto) deja de consultar Places hasta el mes siguiente. Como respaldo, alerta de presupuesto en Google Cloud.
- **Inicialización perezosa:** Firebase, Gmail y Anthropic se inicializan recién cuando se usan, para que `next build` no falle sin variables de entorno.
- **Fuentes y build:** `next/font/google` (Instrument Sans) necesita internet en el build. En Vercel funciona.

## Cumplimiento y entregabilidad

- **Baja:** cada correo lleva un link de baja firmado con HMAC y la cabecera `List-Unsubscribe`. Esto lo exige la Ley 18.331 de Uruguay sobre datos personales.
- **Volumen:** arrancar con unos 20 correos nuevos por día y subir de a poco. La casilla dedicada necesita SPF, DKIM y DMARC configurados.
- **Datos:** solo se juntan datos públicos de empresas. No se hace scraping directo de Instagram ni TikTok porque va contra sus términos; esas cuentas se encuentran vía Google.

## Variables de entorno

| Grupo | Variables |
|---|---|
| General y seguridad | `BASE_URL`, `CRON_SECRET`, `UNSUB_SECRET`, `DASHBOARD_PASSWORD` |
| Firebase | `FIREBASE_PROJECT_ID` + una de: `GCP_WORKLOAD_IDENTITY_PROVIDER` y `GCP_SERVICE_ACCOUNT_EMAIL` (Vercel, sin claves) · `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` (clave) · nada (gcloud local) |
| Gmail y remitente | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `SENDER_EMAIL`, `SENDER_NAME`, `ADMIN_EMAIL` |
| Comportamiento del agente | `EXECUTIVES_JSON`, `DAILY_NEW_LIMIT`, `AUTO_REPLY_INFO`, `AGENDA_URL`, `FUENTES` (`maps,google`), `PLACES_MONTHLY_LIMIT` |
| Pruebas y lanzamiento | `MODO_PRUEBA_EMAIL` (todo correo va a esa casilla), `AGENTE_ACTIVO` (los crons solo corren con `true`) |
| Proveedores | `GOOGLE_PLACES_API_KEY`, `SERPER_API_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |

---

## Pendientes conocidos

1. **Contenido comercial:** completar `CONFIG.conocimiento` (lo que el agente puede afirmar solo) y revisar el copy de las 4 plantillas. Está en español de Uruguay y trata de "ustedes".
2. **URLs de directorios:** verificar las URLs exactas de los listados de inmobiliarias en InfoCasas, Casas y Más y Gallito, y de las listas de socios de las cámaras (CIU, ADIU), en `DIRECTORIOS.startUrls`.
3. **Pruebas:** no hay tests todavía. Conviene cubrir `normalize.js`, el cálculo de fechas de la secuencia y la clasificación con un set de respuestas reales.
4. **Respuestas fuera del hilo:** si una inmobiliaria responde en un hilo nuevo en lugar de contestar el original, hoy no se detecta. Habría que buscar por remitente contra `keys em:`.
5. **Conexión con el CRM:** al marcar un lead como `cliente`, podría crearse automáticamente en el CRM de ventas existente.
6. **Plan de Vercel:** en Hobby los crons corren una vez por día. En Pro, cambiar `/api/cron/frecuente` a cada hora para leer respuestas más rápido.
7. **Crawler sin credenciales:** `.github/workflows/directorios.yml` usa `FIREBASE_PRIVATE_KEY`, que no se puede crear. Hay que pasarlo a federación con GitHub (`google-github-actions/auth`) o hacer que mande las páginas al deploy de Vercel.
