import dns from 'node:dns/promises';
import { buscarGoogle } from './fuentes.js';
import { domainOf, esBloqueado, extractEmails, mejorEmail } from './normalize.js';
import { pool } from './util.js';

export async function tieneMX(email) {
  try { return (await dns.resolveMx(email.split('@')[1])).length > 0; } catch { return false; }
}

const RUTAS = ['', '/contacto', '/contact', '/contactenos', '/contactanos', '/nosotros'];

export async function buscarEmailEnWeb(web) {
  let base;
  try { base = new URL(/^https?:\/\//i.test(web) ? web : `https://${web}`); } catch { return null; }
  const encontrados = new Set();
  for (const ruta of RUTAS) {
    try {
      const res = await fetch(ruta ? new URL(ruta, base.origin) : base, {
        signal: AbortSignal.timeout(7000), redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; VeocasasBot/1.0; +https://veocasas.com.uy)' },
      });
      if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) continue;
      extractEmails(await res.text()).forEach(e => encontrados.add(e));
      if (encontrados.size) break;
    } catch { /* timeout o bloqueo: siguiente ruta */ }
  }
  return mejorEmail([...encontrados], domainOf(base.href));
}

// Busca el sitio web (o un email en el snippet) de inmobiliarias que solo tenemos por nombre
export async function buscarWebs(nombres) {
  const out = new Map();
  await pool(nombres, 5, async n => {
    const res = await buscarGoogle(`"${n}" inmobiliaria Uruguay`);
    const url = res.map(r => r.url).find(u => !esBloqueado(domainOf(u)));
    const email = extractEmails(res.map(r => r.description).join(' '))[0];
    if (url || email) out.set(n, { web: url || null, email: email || null });
  });
  return out;
}
