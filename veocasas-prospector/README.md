# Agente de prospección de inmobiliarias (Veocasas)

Encuentra inmobiliarias de Uruguay, les escribe desde Gmail, hace seguimiento a los 3, 7 y 10 días, lee las respuestas con Claude y deriva a un ejecutivo según la etapa.

## Flujo

```
Google Places API (Maps) + Google vía Serper (portales, Instagram, Facebook, TikTok, cámaras, guías)
+ crawler propio con Playwright en GitHub Actions (directorios de portales y cámaras)
  → cola en Firestore → normalización y deduplicado (email, dominio, @instagram, nombre)
  → enriquecer: email desde la web o Google + verificación MX       [nuevo → listo | sin_email]
  → enviar: primer correo dentro del cupo diario, solo días hábiles  [en_secuencia]
  → seguimientos en el mismo hilo: día 3, 7 y 10
  → sin respuesta 3 días después del último                         [sin_respuesta → lo evaluás en el panel]
  → si responde, Claude clasifica:
       fuera_oficina  → sigue la secuencia
       no_interesado  → se cierra
       baja           → se cierra y queda excluida para siempre
       redirige       → reinicia la secuencia al nuevo correo
       info           → el agente responde solo con lo que está en CONFIG.conocimiento   [conversando]
       caliente/cierre→ presenta al ejecutivo en el hilo (en copia) + le manda un resumen    [derivado]
```

## Puesta en marcha

1. **Firebase**: usá el proyecto del CRM (`crmveocasas-4fc8c`). La organización no deja crear claves de cuentas de servicio, así que en Vercel se autentica sin claves con federación de identidades:
   - En Google Cloud habilitá *IAM API*, *Security Token Service API* e *IAM Service Account Credentials API*.
   - IAM → Federación de identidades para cargas de trabajo → crear grupo `vercel` con un proveedor OIDC `vercel`: emisor `https://oidc.vercel.com/emime01s-projects`, público permitido `https://vercel.com/emime01s-projects`, asignación `google.subject = assertion.sub` y `attribute.project = assertion.project`, condición `assertion.project == 'veocasas-prospector'`.
   - En el grupo, *Otorgar acceso* con suplantación de la cuenta `firebase-adminsdk-fbsvc@crmveocasas-4fc8c.iam.gserviceaccount.com`, para el atributo `project` = `veocasas-prospector`.
   - Variables: `FIREBASE_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL` (ver `.env.example`).
   Desplegá los índices: `firebase deploy --only firestore:indexes` (archivo `firestore.indexes.json`). Colecciones nuevas: `prospeccion_leads`, `prospeccion_jobs`, `prospeccion_excluidos`, `prospeccion_meta`.
2. **Gmail**: en Google Cloud, habilitá Gmail API y creá un cliente OAuth "Web" con redirect `http://localhost:3333`. Completá `GMAIL_CLIENT_ID/SECRET` en `.env.local` y corré `npm run gmail-token` logueado con la casilla que envía. Si es Google Workspace interno, marcá la app como "Interna" para que el token no venza.
3. **Búsqueda**:
   - En Google Cloud habilitá **Places API (New)**, creá una API key restringida a esa API y cargala en `GOOGLE_PLACES_API_KEY`. Poné un tope de cuota diario para que nunca salga del tramo gratuito.
   - Creá una cuenta en serper.dev y cargá `SERPER_API_KEY`.
   - Cargá `ANTHROPIC_API_KEY`.
   - En el repo de GitHub, agregá los secrets `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` para el rastreo mensual de portales (también se puede lanzar a mano desde la pestaña Actions).
4. **Clientes actuales**: exportá los clientes del CRM a CSV (`nombre,email,web`) y corré `npm run importar-clientes -- clientes.csv`.
5. **Copy y conocimiento**: editá `lib/config.js` (plantillas, `conocimiento`, URLs de directorios marcadas con EDITAR).
6. **Deploy en Vercel**: subí el repo, cargá todas las variables de `.env.example` y desplegá. Los crons de `vercel.json` se activan solos.
7. Abrí el panel (te pide la clave `DASHBOARD_PASSWORD`) y tocá **Buscar inmobiliarias**.

## Crons

| Ruta | Cuándo | Qué hace |
|---|---|---|
| `/api/cron/prospectar` | día 1 de cada mes | busca en Places y Google |
| GitHub Actions `directorios.yml` | día 1 de cada mes | rastrea portales y cámaras |
| `/api/cron/diario` | lunes a viernes 10:00 UY | respuestas → procesar → enriquecer → enviar |
| `/api/cron/frecuente` | todos los días 18:00 UY | respuestas → procesar → enriquecer |

En plan Pro de Vercel cambiá `frecuente` a `0 * * * *` para leer respuestas cada hora. Las funciones usan hasta 300 s (requiere Fluid Compute, activo por defecto en proyectos nuevos).

## Probar antes de lanzar

- `AGENTE_ACTIVO=false` (por defecto): los crons no hacen nada. Todo se dispara a mano con los botones del panel.
- `MODO_PRUEBA_EMAIL=tu@casilla.com`: cada correo (a inmobiliarias y a ejecutivos) va a esa casilla, con una línea arriba que dice a quién iba. Respondé desde esa casilla para probar la clasificación: el agente lo toma como si respondiera la inmobiliaria. Tiene que ser distinta de `SENDER_EMAIL`.
- Para lanzar: vaciá `MODO_PRUEBA_EMAIL`, poné `AGENTE_ACTIVO=true` y volvé a desplegar.

## Entregabilidad

- Empezá con `DAILY_NEW_LIMIT=20` y subí de a 10 por semana hasta ~60.
- Configurá SPF, DKIM y DMARC en el dominio que envía.
- Cada correo lleva link de baja y cabecera `List-Unsubscribe`; las bajas quedan excluidas para siempre.
