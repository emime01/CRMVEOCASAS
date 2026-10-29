import { db, META } from './firebase.js';
import { CONFIG } from './config.js';
import { sleep, mesUY } from './util.js';
import { adivinarDepto } from './normalize.js';

// Google no deja bajar la cuota diaria de Text Search: el tope mensual lo lleva el agente en Firestore.
// Cada llamada se cuenta antes de hacerla, aunque después falle.
async function reservarLlamadaPlaces() {
  const ref = db().collection(META).doc(`places_${mesUY()}`);
  const ok = await db().runTransaction(async t => {
    const s = await t.get(ref);
    const n = s.exists ? s.data().n : 0;
    if (n >= CONFIG.topePlacesMes) return false;
    t.set(ref, { n: n + 1, actualizado: new Date() });
    return true;
  });
  if (!ok) throw Object.assign(new Error(`Tope mensual de Places alcanzado (${CONFIG.topePlacesMes} llamadas)`), { code: 'TOPE_PLACES' });
}

// Google Places API (New): Text Search con web y teléfono (SKU Text Search Enterprise, 1.000 llamadas gratis/mes)
const CAMPOS = ['places.displayName', 'places.formattedAddress', 'places.websiteUri', 'places.nationalPhoneNumber',
  'places.types', 'places.primaryTypeDisplayName', 'places.googleMapsUri', 'nextPageToken'].join(',');

export async function buscarPlaces(textQuery, paginas = 3) {
  const out = [];
  let pageToken;
  for (let i = 0; i < paginas; i++) {
    try { await reservarLlamadaPlaces(); } catch (e) {
      if (e.code !== 'TOPE_PLACES' || !out.length) throw e;
      out.topeAlcanzado = true; // se queda con las páginas ya pagadas
      break;
    }
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': CAMPOS },
      body: JSON.stringify({ textQuery, languageCode: 'es', regionCode: 'UY', pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
    });
    if (!r.ok) throw new Error(`Places ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    for (const p of j.places || []) {
      out.push({
        title: p.displayName?.text, website: p.websiteUri, phone: p.nationalPhoneNumber, address: p.formattedAddress,
        categoryName: p.primaryTypeDisplayName?.text || '', types: p.types || [], url: p.googleMapsUri,
      });
    }
    pageToken = j.nextPageToken;
    if (!pageToken) break;
    await sleep(400);
  }
  return out;
}

// "MALDONADO", "RIO NEGRO", "CARMELO" → nombre del departamento como en DEPARTAMENTOS
const deptoDeTexto = t => (t && t !== 'SIN ESPECIFICAR' ? adivinarDepto(t) : null);
const celularUY = c => { const n = String(c || '').replace(/\D/g, '').replace(/^0/, ''); return /^9\d{7}$/.test(n) ? `598${n}` : null; };

// Directorios (cámaras, portales): devuelve ítems para la cola.
// - Si la página trae los datos estructurados (Next.js de InfoCasas), van directo como { nombre, direccion }.
// - Si no, el texto (con las URLs de los links, donde suelen estar las webs de los socios) en pedazos para Claude.
export async function leerDirectorio(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(25000), redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; VeocasasBot/1.0; +https://veocasas.com.uy)' },
  });
  if (!r.ok) throw new Error(`Directorio ${r.status}: ${url}`);
  const html = await r.text();

  // Registro de inmobiliarias del Ministerio de Turismo (JSON de DataTables): filas con email, web y teléfonos
  if (url.includes('turismo.gub.uy')) {
    const filas = JSON.parse(html).data || [];
    return filas.map(f => ({
      estructurado: true, url, nombre: f[1], direccion: [f[3], f[7]].filter(Boolean).join(', '),
      departamento: deptoDeTexto(f[8]) || deptoDeTexto(f[7]),
      telefono: f[9] || f[12] || null, whatsapp: celularUY(f[12]), email: f[13] || null, web: f[14] || null,
    })).filter(x => x.nombre);
  }

  // Listas de logos con link a la web (Casas y Más): <a href="web"><img alt="Logo inmobiliaria Nombre"></a>.
  // Se sacan directo: con listas largas la IA se saltea entradas.
  const logos = [...html.matchAll(/<a\s[^>]*href="(https?:\/\/[^"]+)"[^>]*>\s*<img\s[^>]*alt="Logo inmobiliaria ([^"]+)"/gi)];
  if (logos.length >= 10) return logos.map(([, web, nombre]) => ({ estructurado: true, url, nombre: nombre.trim(), web }));

  const next = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (next) {
    try {
      const estado = JSON.parse(next[1]).props?.pageProps?.apolloState || {};
      const agentes = Object.entries(estado).filter(([k]) => k.startsWith('RealEstateAgent:')).map(([, v]) => v);
      if (agentes.length) return agentes.map(a => ({ estructurado: true, nombre: a.name, direccion: a.address || null, url }));
    } catch { /* sigue como texto */ }
  }

  const texto = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<img\s[^>]*alt="([^"]+)"[^>]*>/gi, ' $1 ') // listas de logos (Casas y Más): el nombre está en el alt
    .replace(/<a\s[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, ' $2 ($1) ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
  const pedazos = [];
  for (let i = 0; i < texto.length; i += 8000) pedazos.push({ url, texto: texto.slice(i, i + 8000) });
  return pedazos;
}

// Serper.dev: resultados orgánicos de Google
export async function buscarGoogle(q, paginas = 1) {
  const out = [];
  for (let page = 1; page <= paginas; page++) {
    const r = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY },
      body: JSON.stringify({ q, gl: 'uy', hl: 'es', num: 10, page }),
    });
    if (!r.ok) throw new Error(`Serper ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const organic = (await r.json()).organic || [];
    out.push(...organic.map(o => ({ title: o.title, url: o.link, description: o.snippet || '' })));
    if (organic.length < 10) break;
  }
  return out;
}
