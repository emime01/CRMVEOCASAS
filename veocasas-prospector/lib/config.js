// Configuración central del agente. Lo editable a mano está marcado con EDITAR.

export const DEPARTAMENTOS = [
  'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores', 'Florida',
  'Lavalleja', 'Maldonado', 'Montevideo', 'Paysandú', 'Río Negro', 'Rivera', 'Rocha',
  'Salto', 'San José', 'Soriano', 'Tacuarembó', 'Treinta y Tres',
];

const env = (k, d) => process.env[k] ?? d;

export const CONFIG = {
  remitente: { nombre: env('SENDER_NAME', 'Equipo Veocasas'), email: env('SENDER_EMAIL', '') },
  adminEmail: env('ADMIN_EMAIL', ''),
  baseUrl: env('BASE_URL', 'http://localhost:3000'),
  agendaUrl: env('AGENDA_URL', ''),

  cupoDiario: Number(env('DAILY_NEW_LIMIT', 25)),  // primeros correos por día hábil (subir de a poco)
  secuenciaDias: [3, 7, 10],                         // seguimientos, en días desde el primer correo
  graciaFinalDias: 3,                                // tras el día 10, espera antes de pasar a "sin respuesta"
  conversacionSinRespuestaDias: 7,                   // tras una respuesta automática del agente
  autoResponderInfo: env('AUTO_REPLY_INFO', 'true') === 'true',

  ejecutivos: (() => { try { return JSON.parse(env('EXECUTIVES_JSON', '[]')); } catch { return []; } })(),
  fuentesActivas: env('FUENTES', 'maps,google').split(',').map(s => s.trim()),

  // EDITAR: lo único que el agente puede afirmar al responder solo. Lo que no esté acá, lo deriva a un ejecutivo.
  conocimiento: `
Veocasas es un portal inmobiliario de Uruguay donde las inmobiliarias publican propiedades en venta y alquiler.
Las inmobiliarias pagan por publicar; los interesados contactan directo a la inmobiliaria desde cada aviso.
Las propiedades en venta muestran un cotizador hipotecario de Itaú para que el comprador simule su préstamo.
Para ver planes, precios y condiciones, se coordina una llamada corta con un ejecutivo comercial.
`.trim(),

  firma: `${env('SENDER_NAME', 'Equipo Veocasas')}\nVeocasas, portal inmobiliario de Uruguay\nveocasas.com.uy`,

  // EDITAR: copy de la secuencia. Variables: {{nombre}} {{zona}} {{agenda}} {{remitente}}
  plantillas: {
    inicial: {
      asunto: '{{nombre}} en Veocasas',
      cuerpo: `Hola, equipo de {{nombre}}:

Soy {{remitente}}, de Veocasas. Estamos sumando inmobiliarias de {{zona}} al portal y quería invitarlos a publicar sus propiedades con nosotros: una vitrina más, con las consultas llegando directo a ustedes.

¿Les sirve una llamada de 15 minutos para contarles cómo funciona? Pueden elegir el horario acá: {{agenda}}

O simplemente respondan este correo y lo coordinamos.`,
    },
    seguimientos: [
      `Hola de nuevo. Les subo este correo por si quedó tapado entre otros.

¿Les interesa que les mande la propuesta por escrito?`,
      `Una consulta rápida: ¿quién es la persona indicada en {{nombre}} para hablar de la publicación de propiedades?

Si no es usted, le agradezco si me pasa su contacto.`,
      `Este es mi último correo para no llenarles la bandeja.

Si en algún momento quieren evaluar Veocasas, respondan este correo y lo retomamos.`,
    ],
    derivacion: `{{saludo}}

Les presento a {{ejecutivo}} ({{ejecutivoEmail}}), que está en copia y se encarga de acompañar a las inmobiliarias que se suman a Veocasas. Les va a escribir a la brevedad para avanzar.`,
    pie: `

--
{{firma}}

Si prefieren no recibir más correos de Veocasas, pueden darse de baja acá: {{bajaUrl}}`,
  },
};

// Fuentes de prospección (sin Apify)
const ZONAS_REDES = ['uruguay', 'montevideo', 'punta del este', 'canelones', 'colonia', 'salto', 'paysandú', 'rocha'];

export const FUENTES = {
  // Google Places API: una búsqueda de hasta 3 páginas (60 lugares) por consulta
  maps: {
    consultas: () => DEPARTAMENTOS.flatMap(d => [`inmobiliaria en ${d}, Uruguay`, `negocios inmobiliarios en ${d}, Uruguay`]),
    paginas: 3,
  },
  // Google vía Serper: portales de la competencia, redes, cámaras y guías
  google: {
    consultas: () => [
      ...DEPARTAMENTOS.map(d => `inmobiliaria ${d} contacto`),
      ...ZONAS_REDES.flatMap(z => [`site:instagram.com inmobiliaria ${z}`, `site:facebook.com inmobiliaria ${z}`, `site:tiktok.com inmobiliaria ${z}`]),
      'site:infocasas.com.uy inmobiliaria', 'site:casasymas.com.uy inmobiliaria', 'site:gallito.com.uy inmobiliaria',
      'site:mercadolibre.com.uy inmobiliaria tienda oficial',
      'cámara inmobiliaria uruguaya socios', 'asociación de inmobiliarias del uruguay socios',
      'guía de inmobiliarias uruguay', 'rematadores y corredores inmobiliarios uruguay',
    ],
    paginas: 3,
  },
};

// Rastreo de portales y cámaras (scripts/crawler.mjs, corre en GitHub Actions)
// EDITAR: verificar y afinar las URLs exactas de directorios de inmobiliarias / listas de socios.
export const DIRECTORIOS = {
  startUrls: [
    'https://www.infocasas.com.uy/inmobiliarias',
    'https://www.casasymas.com.uy',
    'https://www.gallito.com.uy',
    'https://www.ciu.org.uy',
    'https://www.adiu.org.uy',
  ],
  profundidad: 2,
  maxPaginasPorSitio: 120,
  // solo sigue links cuyo texto o URL sugiera un listado de inmobiliarias
  patronLinks: /inmobiliari|socio|agencia|corredor|rematador|directorio|gu[ií]a|empresa/i,
};
