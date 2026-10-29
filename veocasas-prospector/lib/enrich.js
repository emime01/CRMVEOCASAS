import dns from 'node:dns/promises';
import { buscarGoogle } from './fuentes.js';
import {
  domainOf, esBloqueado, esGenerico, dominioEmail, extractEmails, mejorEmail, decodificarCloudflare, extraerWhatsapp,
  extraerCelular, sinTildes,
} from './normalize.js';
import { pool } from './util.js';

export async function tieneMX(email) {
  try { return (await dns.resolveMx(email.split('@')[1])).length > 0; } catch { return false; }
}

const RUTAS = ['', '/contacto', '/contact', '/contactenos', '/contactanos', '/nosotros'];

// Recorre la web de la inmobiliaria buscando email (también los que esconde Cloudflare) y WhatsApp
export async function buscarContactoEnWeb(web) {
  let base;
  try { base = new URL(/^https?:\/\//i.test(web) ? web : `https://${web}`); } catch { return {}; }
  const encontrados = new Set();
  let whatsapp = null;
  for (const ruta of RUTAS) {
    try {
      const res = await fetch(ruta ? new URL(ruta, base.origin) : base, {
        signal: AbortSignal.timeout(7000), redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; VeocasasBot/1.0; +https://veocasas.com.uy)' },
      });
      if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) continue;
      const html = decodificarCloudflare(await res.text());
      extractEmails(html).forEach(e => encontrados.add(e));
      whatsapp ||= extraerWhatsapp(html);
      if (encontrados.size) break;
    } catch { /* timeout o bloqueo: siguiente ruta */ }
  }
  return { email: mejorEmail([...encontrados], domainOf(base.href)), whatsapp };
}

// Segundo intento, en Google: por dominio si tiene web, por perfil si tiene Instagram, si no por nombre.
// Serper gratis rechaza las comillas con puntos o @ ("Query pattern not allowed"): consultas sin comillas.
// Solo se aceptan datos que se puedan atribuir a esta inmobiliaria: los resultados traen contactos de otras.
const GENERICAS = new Set(['inmobiliaria', 'inmobiliarias', 'inmobiliarios', 'negocios', 'propiedades', 'bienes', 'raices',
  'real', 'estate', 'estudio', 'escritorio', 'gestoria', 'asociados', 'uruguay', 'administracion', 'servicios']);
const tokensNombre = n => sinTildes(n || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 4 && !GENERICAS.has(t));
const pareceSuyo = (texto, tokens) => tokens.some(t => texto.includes(t));

function consultaGoogle(l) {
  const dom = domainOf(l.web);
  if (dom && !esBloqueado(dom)) return { q: `${dom} email`, dom };
  if (l.instagram) return { q: `site:instagram.com ${l.instagram}`, ig: l.instagram.toLowerCase() };
  return { q: `"${l.nombre}" inmobiliaria Uruguay` };
}

// vivo: deja de buscar cuando se acaba el tiempo de la corrida; solo vuelven en el Map las que se buscaron
export async function buscarContactosEnGoogle(leads, vivo = () => true) {
  const out = new Map();
  await pool(leads, 5, async l => {
    const { q, dom, ig } = consultaGoogle(l);
    let res = await buscarGoogle(q);
    if (ig) res = res.filter(r => r.url.toLowerCase().includes(`instagram.com/${ig}`)); // solo el perfil, no posts de otros
    const texto = res.map(r => `${r.title} ${r.description}`).join(' ');
    const tokens = tokensNombre(l.nombre);

    // por nombre: la web tiene que parecerse al nombre (si no, suele ser una guía o un directorio)
    const web = l.web ? null
      : res.map(r => r.url).find(u => { const d = domainOf(u); return d && !esBloqueado(d) && pareceSuyo(d, tokens); }) || null;
    const domPropio = dom || domainOf(web);
    const emails = extractEmails(texto).filter(e => {
      const d = dominioEmail(e);
      if (domPropio && d === domPropio) return true;
      return esGenerico(d) && pareceSuyo(e.split('@')[0], [...tokens, ...(ig ? [ig.replace(/[^a-z0-9]/g, '')] : [])]);
    });
    const r = { web, email: mejorEmail(emails, domPropio), whatsapp: extraerWhatsapp(texto) || (ig ? extraerCelular(texto) : null) };
    out.set(l.id, r);
  }, vivo);
  return out;
}
