import { google } from 'googleapis';
import { CONFIG } from './config.js';

let _g;
export function gmail() {
  if (!_g) {
    // sin remitente, esMio() da true para todo y nunca se detectaría una respuesta
    if (!CONFIG.remitente.email) throw new Error('Falta SENDER_EMAIL');
    const auth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
    _g = google.gmail({ version: 'v1', auth });
  }
  return _g;
}

const enc = s => `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`;
const b64 = s => Buffer.from(s).toString('base64').replace(/.{76}/g, '$&\r\n');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function textoAHtml(t) {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">${
    esc(t).split(/\n{2,}/).map(p => `<p style="margin:0 0 12px">${p.replace(/\n/g, '<br>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`).join('')}</div>`;
}

export const esMio = from => String(from || '').toLowerCase().includes(CONFIG.remitente.email.toLowerCase());

export async function enviarCorreo({ to, cc, subject, text, threadId, inReplyTo, references, unsubscribeUrl }) {
  if (CONFIG.modoPrueba) {
    // si fuera la misma casilla que envía, esMio() descartaría las respuestas de prueba
    if (CONFIG.modoPrueba === CONFIG.remitente.email.toLowerCase()) throw new Error('MODO_PRUEBA_EMAIL tiene que ser distinto de SENDER_EMAIL');
    text = `[PRUEBA] Este correo iba a: ${to}${cc ? ` (cc: ${cc})` : ''}\n\n${text}`;
    to = CONFIG.modoPrueba;
    cc = undefined;
  }
  const boundary = 'vc_' + Math.random().toString(36).slice(2);
  const headers = [
    `From: ${enc(CONFIG.remitente.nombre)} <${CONFIG.remitente.email}>`,
    `To: ${to}`,
    cc && `Cc: ${cc}`,
    `Subject: ${enc(subject)}`,
    'MIME-Version: 1.0',
    inReplyTo && `In-Reply-To: ${inReplyTo}`,
    references && `References: ${references}`,
    unsubscribeUrl && `List-Unsubscribe: <${unsubscribeUrl}>`,
    unsubscribeUrl && 'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const body = [
    `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', b64(text),
    `--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', b64(textoAHtml(text)),
    `--${boundary}--`,
  ];
  const raw = Buffer.from([...headers, '', ...body].join('\r\n')).toString('base64url');
  const g = gmail();
  const res = await g.users.messages.send({ userId: 'me', requestBody: { raw, ...(threadId ? { threadId } : {}) } });
  const meta = await g.users.messages.get({ userId: 'me', id: res.data.id, format: 'metadata', metadataHeaders: ['Message-ID'] });
  const messageId = (meta.data.payload?.headers || []).find(h => h.name.toLowerCase() === 'message-id')?.value || null;
  return { id: res.data.id, threadId: res.data.threadId, messageId };
}

const hdr = (m, name) => (m.payload?.headers || []).find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
const dec = d => Buffer.from(d, 'base64url').toString('utf8');

function extraerTexto(p) {
  if (!p) return '';
  if (p.mimeType === 'text/plain' && p.body?.data) return dec(p.body.data);
  for (const part of p.parts || []) { const t = extraerTexto(part); if (t) return t; }
  if (p.mimeType === 'text/html' && p.body?.data) return dec(p.body.data).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ');
  return '';
}

function limpiarCita(t) {
  let s = t.replace(/\r/g, '');
  const corte = s.search(/\n[^\n]*(El|On)\s[^\n]*(\n[^\n]*)?(escribi[oó]|wrote):/);
  if (corte > 0) s = s.slice(0, corte);
  const corte2 = s.search(/\n-{2,}\s*(Mensaje original|Original Message)|\nDe:\s.+\nEnviado/i);
  if (corte2 > 0) s = s.slice(0, corte2);
  return s.split('\n').filter(l => !l.startsWith('>')).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000);
}

export async function leerHilo(threadId) {
  const { data } = await gmail().users.threads.get({ userId: 'me', id: threadId, format: 'full' });
  return (data.messages || []).map(m => ({
    id: m.id,
    internalDate: Number(m.internalDate),
    from: hdr(m, 'From'),
    messageId: hdr(m, 'Message-ID'),
    failed: hdr(m, 'X-Failed-Recipients'),
    texto: limpiarCita(extraerTexto(m.payload)),
  }));
}

export async function hayRespuestaNueva(threadId, desdeMs) {
  if (!threadId) return false;
  const msgs = await leerHilo(threadId);
  return msgs.some(m => !esMio(m.from) && m.internalDate > desdeMs);
}

export async function listarMensajes(q, max = 1000) {
  const ids = [];
  let pageToken;
  do {
    const { data } = await gmail().users.messages.list({ userId: 'me', q, maxResults: 200, pageToken });
    ids.push(...(data.messages || []));
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

export async function destinatarioRebotado(id) {
  const { data } = await gmail().users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['X-Failed-Recipients'] });
  return hdr(data, 'X-Failed-Recipients').toLowerCase().trim() || null;
}
