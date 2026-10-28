import { db, FieldValue, COL, EXCL } from './firebase.js';
import {
  domainOf, esBloqueado, esSocial, esGenerico, dominioEmail, cleanEmail, igHandle, slugNombre, adivinarDepto,
} from './normalize.js';

export function clavesDe({ nombre, web, email, instagram, tiktok }) {
  const k = [];
  const em = cleanEmail(email);
  if (em) { k.push(`em:${em}`); const d = dominioEmail(em); if (!esGenerico(d)) k.push(`dom:${d}`); }
  const wd = domainOf(web);
  if (wd && !esBloqueado(wd)) k.push(`dom:${wd}`);
  if (instagram) k.push(`ig:${instagram}`);
  if (tiktok) k.push(`tt:${String(tiktok).toLowerCase()}`);
  const sl = nombre && slugNombre(nombre);
  if (sl) k.push(`nm:${sl}`);
  return [...new Set(k)].slice(0, 30);
}

export async function upsertLead(c, fuente) {
  const nombre = (c.nombre || '').toString().trim().slice(0, 120) || null;
  let web = c.web ? String(c.web).trim() : null;
  const wd = domainOf(web);
  const instagram = igHandle(c.instagram) || (wd === 'instagram.com' ? igHandle(web) : null);
  const facebook = c.facebook || (wd && wd.endsWith('facebook.com') ? web : null);
  if (wd && (esSocial(wd) && wd !== 'linktr.ee' || esBloqueado(wd) && !esSocial(wd))) web = null;

  const data = {
    nombre, web,
    email: cleanEmail(c.email),
    telefono: c.telefono ? String(c.telefono).slice(0, 40) : null,
    instagram, facebook: facebook || null,
    tiktok: c.tiktok ? String(c.tiktok).toLowerCase() : null,
    departamento: c.departamento || adivinarDepto(`${nombre || ''} ${c.direccion || ''}`),
  };
  const keys = clavesDe(data);
  if (!keys.length || (!nombre && !data.email && !web)) return null;
  if (!data.nombre) data.nombre = domainOf(web) || data.email;

  const d = db();
  const existente = await d.collection(COL).where('keys', 'array-contains-any', keys).limit(1).get();
  if (!existente.empty) {
    const doc = existente.docs[0];
    const cur = doc.data();
    const patch = { keys: FieldValue.arrayUnion(...keys), fuentes: FieldValue.arrayUnion(fuente), actualizado: FieldValue.serverTimestamp() };
    for (const [k, v] of Object.entries(data)) if (v && !cur[k]) patch[k] = v;
    if (patch.email && cur.estado === 'sin_email') patch.estado = 'nuevo';
    await doc.ref.update(patch);
    return doc.id;
  }
  const ref = d.collection(COL).doc();
  await ref.set({
    ...data, keys, fuentes: [fuente],
    estado: estadoExcluido(await motivoExclusion(keys)) || 'nuevo',
    paso: 0, intentosEnriquecer: 0, proximoEnvio: null, threadId: null,
    historial: [], creado: FieldValue.serverTimestamp(), actualizado: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// motivo de la exclusión que coincide con alguna clave, o null si se le puede escribir
export async function motivoExclusion(keys) {
  if (!keys?.length) return null;
  const s = await db().collection(EXCL).where('keys', 'array-contains-any', keys.slice(0, 30)).limit(1).get();
  return s.empty ? null : s.docs[0].data().motivo || 'excluido';
}
export const estadoExcluido = motivo => (!motivo ? null : motivo === 'cliente' ? 'cliente' : 'baja');

export async function excluir(lead, motivo) {
  await db().collection(EXCL).add({ keys: lead.keys || clavesDe(lead), nombre: lead.nombre || null, motivo, fecha: new Date() });
}
