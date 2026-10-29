import { DEPARTAMENTOS } from './config.js';

const GENERICOS = ['gmail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'yahoo.com', 'yahoo.es',
  'yahoo.com.ar', 'live.com', 'icloud.com', 'adinet.com.uy', 'vera.com.uy', 'montevideo.com.uy', 'msn.com'];
const SOCIALES = ['instagram.com', 'facebook.com', 'fb.com', 'tiktok.com', 'wa.me', 'whatsapp.com',
  'linktr.ee', 'youtube.com', 'twitter.com', 'x.com', 'linkedin.com', 'beacons.ai'];
const PORTALES = ['infocasas.com.uy', 'casasymas.com.uy', 'gallito.com.uy', 'mercadolibre.com.uy', 'veocasas.com.uy',
  'veocasas.com', 'properati.com.uy', 'zonaprop.com.ar', 'casashub.uy', 'gopunta.uy', 'todosnegocios.com', 'cybo.com', 'tuugo.uy', 'infoisinfo.com.uy', 'google.com', 'goo.gl', 'g.page', 'cylex.com.uy',
  'paginasamarillas.com.uy', 'guiamovil.com', 'tripadvisor.com', 'booking.com', 'airbnb.com'];

export const RE_INMOBILIARIA = /inmobili|propiedades|real\s?estate|bienes\s?ra[ií]ces|negocios\s?inmob|corredor|rematador|realty|realtor/i;

export function domainOf(url) {
  if (!url) return null;
  try {
    const s = String(url).trim();
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

const enLista = (dom, lista) => !!dom && lista.some(d => dom === d || dom.endsWith('.' + d));
export const esSocial = dom => enLista(dom, SOCIALES);
export const esBloqueado = dom => !dom || enLista(dom, SOCIALES) || enLista(dom, PORTALES);
export const esGenerico = dom => GENERICOS.includes(dom);
export const dominioEmail = e => (e ? e.split('@')[1] : null);

const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function cleanEmail(e) {
  if (!e) return null;
  const m = String(e).toLowerCase().replace(/^mailto:/, '').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  if (!m) return null;
  const em = m[0].replace(/\.$/, '');
  if (/\.(png|jpe?g|gif|webp|svg|css|js)$/.test(em)) return null;
  if (/(noreply|no-reply|donotreply|sentry|wixpress|example\.|domain\.com|tusitio|tuemail|email\.com|@2x|mailer-daemon)/.test(em)) return null;
  if (enLista(dominioEmail(em), PORTALES)) return null;
  return em;
}

// Cloudflare reemplaza los emails por un hex XOR (data-cfemail o /cdn-cgi/l/email-protection#hex): el primer byte es la clave
export function decodificarCloudflare(html) {
  const dec = hex => {
    const k = parseInt(hex.slice(0, 2), 16);
    let out = '';
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k);
    return out;
  };
  return String(html || '')
    .replace(/data-cfemail="([0-9a-f]+)"/gi, (_, h) => ` ${dec(h)} `)
    .replace(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/gi, (_, h) => ` ${dec(h)} `);
}

// número de WhatsApp de un link wa.me o api.whatsapp.com, con código de país (598 si viene local)
export function extraerWhatsapp(html) {
  const m = String(html || '').match(/(?:wa\.me\/|whatsapp\.com\/send\/?\?phone=)(?:%2B|\+)?([0-9 ]{8,16})/i);
  if (!m) return null;
  const n = m[1].replace(/\D/g, '').replace(/^0/, '');
  return n.length === 8 ? `598${n}` : n.length >= 10 ? n : null;
}

// celular uruguayo escrito en texto (09X XXX XXX), por ejemplo en la bio de Instagram que muestra Google
export function extraerCelular(texto) {
  const m = String(texto || '').match(/(?:\+?598[\s.-]?)?\b0?(9[1-9])[\s.-]?(\d{3})[\s.-]?(\d{3})\b/);
  return m ? `598${m[1]}${m[2]}${m[3]}` : null;
}

export function extractEmails(text) {
  const t = String(text || '').replace(/&#64;|&#x40;|\s?\[at\]\s?|\s?\(at\)\s?/gi, '@');
  return [...new Set((t.match(RE_EMAIL) || []).map(cleanEmail).filter(Boolean))];
}

const PREFIJOS = ['info', 'contacto', 'ventas', 'comercial', 'administracion', 'hola', 'consultas', 'inmobiliaria'];
export function mejorEmail(emails, webDom) {
  if (!emails.length) return null;
  const score = e => (webDom && dominioEmail(e) === webDom ? 3 : 0) + (PREFIJOS.includes(e.split('@')[0]) ? 2 : 0);
  return [...emails].sort((a, b) => score(b) - score(a))[0];
}

export function igHandle(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const h = (m ? m[1] : s.replace(/^@/, '')).toLowerCase();
  if (['p', 'reel', 'explore', 'stories'].includes(h)) return null;
  return /^[a-z0-9._]{2,30}$/.test(h) ? h : null;
}

export const sinTildes = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function slugNombre(n) {
  const s = sinTildes(n).toLowerCase()
    .replace(/\b(inmobiliaria|inmobiliarias|negocios inmobiliarios|propiedades|bienes raices|real estate|s\.?a\.?|s\.?r\.?l\.?|ltda)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
  return s.length >= 4 ? s : null;
}

export function adivinarDepto(texto) {
  const t = sinTildes(texto || '').toLowerCase();
  if (!t) return null;
  if (/punta del este|piriapolis|la barra|jose ignacio|san carlos/.test(t)) return 'Maldonado';
  if (/ciudad de la costa|las piedras|pando|atlantida|solymar/.test(t)) return 'Canelones';
  if (/la paloma|punta del diablo|chuy/.test(t)) return 'Rocha';
  if (/colonia del sacramento|carmelo|nueva helvecia/.test(t)) return 'Colonia';
  return DEPARTAMENTOS.find(d => t.includes(sinTildes(d).toLowerCase())) || null;
}
