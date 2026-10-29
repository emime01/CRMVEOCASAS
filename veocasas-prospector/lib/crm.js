import { db, FieldValue, COL, EXCL } from './firebase.js';
import { clavesDe } from './leads.js';
import { slugNombre, cleanEmail } from './normalize.js';
import { CONFIG } from './config.js';

// Integración con el CRM/ERP de Veocasas (mismo proyecto de Firebase, app aparte en la raíz del repo).
// - Los clientes son las inmobiliarias con ventas ('ventas'; el vendedor es 'ejecutivo'). Las ventas apuntan a su
//   ficha ('clientes', campo cliente_id), que tiene RUT, emails, teléfonos y contactos: se cruza por todo eso.
//   Las ventas viejas sin ficha se agrupan por nombre.
// - La gerente comercial asigna prospectos a vendedores desde el CRM: escribe asignadoA/asignadoPor/asignadoEn
//   en prospeccion_leads. El agente nunca asigna por su cuenta.

export const VENTAS = 'ventas';
export const CLIENTES = 'clientes';

const tel8 = t => { const d = String(t || '').replace(/\D/g, ''); return d.length >= 8 ? d.slice(-8) : null; };
const hoyISO = () => new Date().toISOString().slice(0, 10);
// estados del agente que un cruce con el CRM puede pisar; los demás (conversando, derivado…) los maneja una persona
const PISABLES = ['nuevo', 'listo', 'sin_email', 'en_secuencia', 'sin_respuesta', 'no_interesado', 'manual', 'cliente', 'ex_cliente'];

// Agrupa las ventas por inmobiliaria: vigente = alguna venta no cancelada y sin vencer
async function clientesDelCRM() {
  const [ventas, fichas] = await Promise.all([db().collection(VENTAS).get(), db().collection(CLIENTES).get()]);
  const ficha = new Map(fichas.docs.map(f => [f.id, f.data()]));
  const porNombre = new Map();
  for (const doc of ventas.docs) {
    const v = doc.data();
    const f = v.cliente_id && ficha.get(v.cliente_id);
    const nombre = String(f?.nombre || v.inmobiliaria || '').trim();
    const clave = f ? `id:${v.cliente_id}` : slugNombre(nombre) || nombre.toLowerCase();
    if (!clave) continue;
    const c = porNombre.get(clave) || { nombre, nombres: new Set(), telefonos: new Set(), emails: new Set(), ventaIds: [], ejecutivo: null, activo: false, ultima: '' };
    if (f && !porNombre.has(clave)) {
      for (const n of [f.nombre, f.razon_social]) if (n) c.nombres.add(String(n).trim());
      for (const p of [f, ...(f.contactos || [])]) {
        const t = tel8(p.telefono); if (t) c.telefonos.add(t);
        const e = cleanEmail(p.email); if (e) c.emails.add(e);
      }
      c.ejecutivoFicha = f.ejecutivo || null;
    }
    c.nombres.add(String(v.inmobiliaria || '').trim() || nombre);
    if (v.razon_social) c.nombres.add(String(v.razon_social).trim());
    const t = tel8(v.telefono); if (t) c.telefonos.add(t);
    const e = cleanEmail(v.mail); if (e) c.emails.add(e);
    c.ventaIds.push(doc.id);
    const vigente = v.estado !== 'cancelada' && (!v.fecha_fin || v.fecha_fin >= hoyISO());
    if (vigente) c.activo = true;
    // el vendedor del cliente es el de su venta más reciente
    const fecha = v.fecha_inicio || v.created_at || '';
    if (fecha >= c.ultima) { c.ultima = fecha; c.ejecutivo = v.ejecutivo || c.ejecutivo; }
    porNombre.set(clave, c);
  }
  // el vendedor a cargo que fija la ficha manda sobre el de la última venta
  return [...porNombre.values()].map(c => ({ ...c, ejecutivo: c.ejecutivoFicha || c.ejecutivo }));
}

// Marca en la base del prospector a los clientes del CRM, agrega los que faltan y los excluye de los correos.
export async function sincronizarClientesCRM() {
  const d = db();
  const clientes = await clientesDelCRM();
  const leads = (await d.collection(COL).select('keys', 'telefono', 'whatsapp', 'estado', 'crm', 'asignadoA').get()).docs
    .filter(x => !['descartado', 'duplicado'].includes(x.data().estado));

  const porClave = new Map(); const porTel = new Map();
  for (const x of leads) {
    for (const k of x.data().keys || []) porClave.set(k, [...(porClave.get(k) || []), x]);
    for (const t of [tel8(x.data().telefono), tel8(x.data().whatsapp)].filter(Boolean)) porTel.set(t, [...(porTel.get(t) || []), x]);
  }

  const res = { clientesCRM: clientes.length, vigentes: 0, marcados: 0, agregados: 0, frenados: 0 };
  const ops = [];
  for (const c of clientes) {
    if (c.activo) res.vigentes++;
    const claves = [...c.nombres].map(n => slugNombre(n)).filter(Boolean).map(s => `nm:${s}`)
      .concat([...c.emails].map(e => `em:${e}`));
    const encontrados = new Map();
    for (const k of claves) for (const x of porClave.get(k) || []) encontrados.set(x.id, x);
    for (const t of c.telefonos) for (const x of porTel.get(t) || []) encontrados.set(x.id, x);

    const crm = { cliente: true, activo: c.activo, ejecutivo: c.ejecutivo, ventaIds: c.ventaIds, nombreCRM: c.nombre, sincronizado: new Date() };
    const estadoCliente = c.activo ? 'cliente' : 'ex_cliente';
    if (!encontrados.size) {
      const nuevo = { nombre: c.nombre, telefono: [...c.telefonos][0] || null, email: [...c.emails][0] || null };
      ops.push([d.collection(COL).doc(), {
        ...nuevo, web: null, whatsapp: null, instagram: null, facebook: null, departamento: null,
        keys: clavesDe(nuevo), fuentes: ['crm'], estado: estadoCliente, crm, paso: 0, intentosEnriquecer: 0,
        proximoEnvio: null, threadId: null, historial: [{ tipo: 'alta_desde_crm', fecha: new Date() }],
        // el cliente ya tiene vendedor: el de su venta
        asignadoA: c.activo ? c.ejecutivo : null, asignadoSugerido: c.ejecutivo,
        creado: FieldValue.serverTimestamp(), actualizado: FieldValue.serverTimestamp(),
      }, 'set']);
      res.agregados++;
    }
    for (const x of encontrados.values()) {
      const l = x.data();
      const patch = { crm, asignadoSugerido: c.ejecutivo, actualizado: FieldValue.serverTimestamp() };
      if (PISABLES.includes(l.estado) && l.estado !== estadoCliente) {
        if (l.estado === 'en_secuencia') res.frenados++;
        Object.assign(patch, { estado: estadoCliente, proximoEnvio: null, historial: FieldValue.arrayUnion({ tipo: 'cruce_crm', fecha: new Date(), estado: estadoCliente }) });
      }
      if (c.activo && !l.asignadoA) patch.asignadoA = c.ejecutivo;
      ops.push([x.ref, patch, 'update']);
      res.marcados++;
    }
    // exclusión: las búsquedas futuras y el envío también los frenan aunque lleguen con otro registro
    const slug = slugNombre(c.nombre) || c.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    ops.push([d.collection(EXCL).doc(`crm_${slug}`.slice(0, 140)), {
      keys: [...new Set([...claves, ...[...encontrados.values()].flatMap(x => (x.data().keys || []).filter(k => /^(em|dom):/.test(k)))])].slice(0, 30),
      nombre: c.nombre, motivo: estadoCliente === 'cliente' ? 'cliente' : 'ex_cliente', ejecutivo: c.ejecutivo, fecha: new Date(), fuente: 'crm',
    }, 'set']);
  }

  for (let i = 0; i < ops.length; i += 400) {
    const b = d.batch();
    for (const [ref, data, tipo] of ops.slice(i, i + 400)) tipo === 'set' ? b.set(ref, data) : b.update(ref, data);
    await b.commit();
  }
  return res;
}

export const crmUrl = () => CONFIG.crmUrl;
