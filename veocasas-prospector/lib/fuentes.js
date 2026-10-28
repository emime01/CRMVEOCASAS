import { sleep } from './util.js';

// Google Places API (New): Text Search con web y teléfono (SKU Text Search Enterprise, 1.000 llamadas gratis/mes)
const CAMPOS = ['places.displayName', 'places.formattedAddress', 'places.websiteUri', 'places.nationalPhoneNumber',
  'places.types', 'places.primaryTypeDisplayName', 'places.googleMapsUri', 'nextPageToken'].join(',');

export async function buscarPlaces(textQuery, paginas = 3) {
  const out = [];
  let pageToken;
  for (let i = 0; i < paginas; i++) {
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
