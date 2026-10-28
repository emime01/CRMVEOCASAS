import { db, META } from './firebase.js';
import { CONFIG } from './config.js';
import { sleep, mesUY } from './util.js';

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
