// Configuración central del agente. Lo editable a mano está marcado con EDITAR.

export const DEPARTAMENTOS = [
  'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores', 'Florida',
  'Lavalleja', 'Maldonado', 'Montevideo', 'Paysandú', 'Río Negro', 'Rivera', 'Rocha',
  'Salto', 'San José', 'Soriano', 'Tacuarembó', 'Treinta y Tres',
];

const env = (k, d) => process.env[k] ?? d;
// copia local: normalize.js importa este archivo, así que no se puede importar de ahí
const sinTildesCfg = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

export const CONFIG = {
  remitente: { nombre: env('SENDER_NAME', 'Equipo Veocasas'), email: env('SENDER_EMAIL', '') },
  adminEmail: env('ADMIN_EMAIL', ''),
  baseUrl: env('BASE_URL', 'http://localhost:3000'),
  agendaUrl: env('AGENDA_URL', ''),

  cupoDiario: Number(env('DAILY_NEW_LIMIT', 25)),  // primeros correos por día hábil (subir de a poco)
  topePlacesMes: Number(env('PLACES_MONTHLY_LIMIT', 900)), // llamadas a Places por mes; el tramo gratis es 1.000
  secuenciaDias: [3, 7, 10],                         // seguimientos, en días desde el primer correo
  graciaFinalDias: 3,                                // tras el día 10, espera antes de pasar a "sin respuesta"
  conversacionSinRespuestaDias: 7,                   // tras una respuesta automática del agente
  autoResponderInfo: env('AUTO_REPLY_INFO', 'true') === 'true',

  // Pruebas: con MODO_PRUEBA_EMAIL, todo correo va a esa casilla (nunca a inmobiliarias ni ejecutivos).
  // Los crons solo corren con AGENTE_ACTIVO=true; los botones del panel funcionan siempre.
  modoPrueba: env('MODO_PRUEBA_EMAIL', '').trim().toLowerCase(),
  agenteActivo: env('AGENTE_ACTIVO', 'false') === 'true',

  ejecutivos: (() => { try { return JSON.parse(env('EXECUTIVES_JSON', '[]')); } catch { return []; } })(),
  fuentesActivas: env('FUENTES', 'maps,google,directorios').split(',').map(s => s.trim()),

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

// Fuentes de prospección (sin Apify).
// La búsqueda grande se hace una vez; después, una actualización chica cada 3 meses (cron prospectar).

// Maps devuelve como máximo 60 lugares por consulta: por eso se busca por localidad y por barrio, no por departamento.
export const LOCALIDADES = {
  'Artigas': ['Artigas', 'Bella Unión'],
  'Canelones': ['Canelones', 'Las Piedras', 'La Paz', 'Pando', 'Ciudad de la Costa', 'Solymar', 'Lagomar', 'El Pinar',
    'Atlántida', 'Parque del Plata', 'La Floresta', 'Santa Lucía', 'Progreso', 'Sauce', 'Toledo', 'Barros Blancos',
    'Salinas', 'San Ramón', 'Tala', 'Santa Rosa'],
  'Cerro Largo': ['Melo', 'Río Branco'],
  'Colonia': ['Colonia del Sacramento', 'Carmelo', 'Nueva Helvecia', 'Juan Lacaze', 'Rosario', 'Nueva Palmira', 'Tarariras'],
  'Durazno': ['Durazno', 'Sarandí del Yí'],
  'Flores': ['Trinidad'],
  'Florida': ['Florida', 'Sarandí Grande'],
  'Lavalleja': ['Minas', 'José Pedro Varela'],
  'Maldonado': ['Maldonado', 'Punta del Este', 'San Carlos', 'Piriápolis', 'La Barra', 'José Ignacio', 'Pan de Azúcar',
    'Punta Ballena', 'Manantiales', 'Aiguá'],
  'Montevideo': ['Centro', 'Cordón', 'Pocitos', 'Punta Carretas', 'Carrasco', 'Malvín', 'Buceo', 'Parque Rodó',
    'Ciudad Vieja', 'Prado', 'Punta Gorda', 'Unión', 'Tres Cruces', 'La Blanqueada', 'Parque Batlle', 'Sayago', 'Cerro',
    'Colón', 'Piedras Blancas', 'Maroñas', 'Aguada', 'Palermo', 'Malvín Norte', 'Belvedere', 'Paso Molino', 'Atahualpa',
    'Peñarol'],
  'Paysandú': ['Paysandú', 'Guichón'],
  'Río Negro': ['Fray Bentos', 'Young'],
  'Rivera': ['Rivera', 'Tranqueras'],
  'Rocha': ['Rocha', 'La Paloma', 'Chuy', 'Castillos', 'Punta del Diablo', 'Lascano', 'La Pedrera'],
  'Salto': ['Salto'],
  'San José': ['San José de Mayo', 'Ciudad del Plata', 'Libertad'],
  'Soriano': ['Mercedes', 'Dolores', 'Cardona'],
  'Tacuarembó': ['Tacuarembó', 'Paso de los Toros'],
  'Treinta y Tres': ['Treinta y Tres', 'Vergara'],
};

// zonas para buscar perfiles en redes vía Google (no se scrapea Instagram ni Facebook directo)
const ZONAS_REDES = [...DEPARTAMENTOS, 'Punta del Este', 'Ciudad de la Costa', 'Piriápolis', 'Atlántida', 'Las Piedras',
  'Pando', 'Colonia del Sacramento', 'Carmelo', 'La Paloma'];

// Cada consulta lleva { q, depto? }: depto ayuda a ubicar las inmobiliarias cuya dirección no lo dice.
export const FUENTES = {
  // Google Places API: hasta 3 páginas (60 lugares) por consulta; los pueblos chicos devuelven una sola
  maps: {
    consultas: () => [
      ...Object.entries(LOCALIDADES).flatMap(([depto, locs]) =>
        locs.map(l => ({ q: `inmobiliaria en ${l}, ${depto === 'Montevideo' ? 'Montevideo, ' : depto === l ? '' : depto + ', '}Uruguay`, depto }))),
      ...DEPARTAMENTOS.map(depto => ({ q: `negocios inmobiliarios en ${depto}, Uruguay`, depto })),
    ],
    paginas: 3,
  },
  // Google vía Serper: redes por zona, portales, cámaras y guías
  google: {
    consultas: () => [
      ...DEPARTAMENTOS.map(depto => ({ q: `inmobiliaria ${depto} contacto`, depto })),
      ...ZONAS_REDES.flatMap(z => [
        { q: `site:instagram.com inmobiliaria ${z}` },
        { q: `site:facebook.com inmobiliaria ${z}` },
      ]),
      ...DEPARTAMENTOS.map(depto => ({ q: `site:instagram.com "negocios inmobiliarios" ${depto}`, depto })),
      { q: 'site:tiktok.com inmobiliaria uruguay' },
      { q: 'site:casasymas.com.uy inmobiliaria' }, { q: 'site:gallito.com.uy inmobiliaria' },
      { q: 'site:mercadolibre.com.uy inmobiliaria tienda oficial' },
      { q: 'guía de inmobiliarias uruguay' }, { q: 'rematadores y corredores inmobiliarios uruguay' },
    ],
    paginas: 2,
  },
  // Listados de socios de cámaras y directorios de portales, leídos directo desde el agente (verificados 2026-10-29)
  directorios: {
    consultas: () => [
      { q: 'https://www.infocasas.com.uy/inmobiliarias' }, // 756 inmobiliarias en los datos de la página (nombre y dirección)
      { q: 'https://adiu.uy/asociados.aspx' },             // ADIU: nombre y teléfonos
      { q: 'https://cipem.org.uy/socios/nomina/', depto: 'Maldonado' }, // Cámara Inmobiliaria Punta del Este-Maldonado
      { q: 'https://cican.com.uy/', depto: 'Canelones' },               // Cámara Inmobiliaria de Canelones: webs de socios
      { q: 'https://ciu.org.uy/nuestros-socios/' },                     // Cámara Inmobiliaria Uruguaya
      { q: 'https://turismo.gub.uy/Operadores/inmobiliariasJSON.php' }, // registro del Ministerio de Turismo: ~874, con email y web
      { q: 'https://www.casasymas.com.uy/inmobiliarias' },              // ~258, logo (nombre en el alt) + link a su web
      { q: 'archivo:gallito' },                                         // 119 de Gallito, guardadas a mano (data/gallito.js)
      { q: 'https://cic.com.uy/', depto: 'Colonia' },                   // Cámara Inmobiliaria de Colonia
      { q: 'https://www.camarainmobiliariaderocha.com/socios.html', depto: 'Rocha' },
      { q: 'https://www.cuir.com.uy/socios' },                          // inmobiliarias rurales
      // red de portales regionales "propiedadesen{depto}.com" (iddepto en orden alfabético; Florida y Montevideo no tienen)
      ...DEPARTAMENTOS.map((depto, i) => ({ depto, i: i + 1, slug: sinTildesCfg(depto).toLowerCase().replace(/\s+/g, '') }))
        .filter(d => !['florida', 'montevideo'].includes(d.slug))
        .map(d => ({ q: `https://www.propiedadesen${d.slug}.com/index.php?pag=inmobiliarias&iddepto=${d.i}&idciudad=0`, depto: d.depto })),
    ],
  },
};

// Rastreo con navegador real (scripts/crawler.mjs, GitHub Actions). Hoy no tiene credenciales de Firestore;
// los directorios que se pueden leer sin navegador están en FUENTES.directorios.
export const DIRECTORIOS = {
  startUrls: FUENTES.directorios.consultas().map(c => c.q),
  profundidad: 2,
  maxPaginasPorSitio: 120,
  // solo sigue links cuyo texto o URL sugiera un listado de inmobiliarias
  patronLinks: /inmobiliari|socio|agencia|corredor|rematador|directorio|gu[ií]a|empresa/i,
};
