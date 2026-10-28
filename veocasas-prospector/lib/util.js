import crypto from 'node:crypto';
import { CONFIG } from './config.js';

const UY = -3 * 3600e3; // Uruguay UTC-3, sin horario de verano

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400e3);

export function diaUY(d = new Date()) { return new Date(new Date(d).getTime() + UY).getUTCDay(); }
export const esFinDeSemana = (d = new Date()) => [0, 6].includes(diaUY(d));

export function ajustarHabil(d) {
  const dia = diaUY(d);
  return dia === 6 ? addDays(d, 2) : dia === 0 ? addDays(d, 1) : d;
}

export function inicioDiaUY(now = new Date()) {
  const local = new Date(now.getTime() + UY);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - UY);
}

// presupuesto de tiempo por función serverless: hasta(ms)() === true mientras quede tiempo
export function reloj(t0 = Date.now()) { return ms => () => Date.now() - t0 < ms; }

export function render(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

export function parseJSON(text) {
  const t = String(text).replace(/```json|```/g, '').trim();
  const i = t.search(/[[{]/);
  if (i < 0) return null;
  const close = t[i] === '[' ? ']' : '}';
  try { return JSON.parse(t.slice(i, t.lastIndexOf(close) + 1)); } catch { return null; }
}

export async function pool(items, n, fn, vivo = () => true) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length && vivo()) {
      const it = items[i++];
      try { await fn(it); } catch (e) { console.error('[pool]', e?.message || e); }
    }
  }));
}

export function firmar(id) {
  if (!process.env.UNSUB_SECRET) throw new Error('Falta UNSUB_SECRET'); // sin clave, cualquiera podría firmar bajas
  return crypto.createHmac('sha256', process.env.UNSUB_SECRET).update(id).digest('hex').slice(0, 24);
}
export const bajaUrl = id => `${CONFIG.baseUrl}/api/baja?id=${id}&t=${firmar(id)}`;

export function autorizadoCron(req) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export function toISO(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return v;
}
