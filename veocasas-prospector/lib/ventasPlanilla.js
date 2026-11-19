import { db, FieldValue, COL } from './firebase.js';
import { slugNombre } from './normalize.js';

// Carga de la planilla de ventas (Google Sheets del equipo comercial) en la colección 'ventas' del CRM.
// Llega ya armada con el formato del CRM (cuotas, comisión del CRM, factura y cobro). Cada venta:
// - si ya existe en el CRM (misma inmobiliaria y misma fecha de inicio), se actualiza con lo de la planilla;
// - si no, se crea.
// Además queda vinculada a su inmobiliaria de la base (lead_id): si no estaba, se agrega, y si no tenía vendedor,
// queda a cargo del vendedor de la venta.
const VENTAS = 'ventas';
const ACTIVOS = ['paty', 'sebastian', 'stefano', 'juanba', 'mika'];
const clave = n => slugNombre(n) || String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const hoy = () => new Date().toISOString().slice(0, 10);

export async function importarVentasPlanilla(ventas, { aplicar = false } = {}) {
  const d = db();
  const [existentes, leadsSnap] = await Promise.all([
    d.collection(VENTAS).get(),
    d.collection(COL).select('nombre', 'keys', 'estado', 'asignadoA').get(),
  ]);
  const porVenta = new Map();
  for (const doc of existentes.docs) {
    const v = doc.data();
    const k = `${clave(v.inmobiliaria)}|${v.fecha_inicio || ''}`;
    porVenta.set(k, [...(porVenta.get(k) || []), doc]);
  }
  const porNombre = new Map();
  for (const doc of leadsSnap.docs) {
    const l = doc.data();
    if (['descartado', 'duplicado'].includes(l.estado)) continue;
    for (const k of (l.keys || []).filter(k => k.startsWith('nm:'))) if (!porNombre.has(k.slice(3))) porNombre.set(k.slice(3), doc);
    const s = slugNombre(l.nombre); if (s && !porNombre.has(s)) porNombre.set(s, doc);
  }

  const res = { ventas: ventas.length, actualizadas: 0, creadas: 0, inmobiliariasNuevas: 0, inmobiliariasAsignadas: 0, noListadasEnPlanilla: [] };
  const usadas = new Set();
  const ops = [];
  const ahora = new Date().toISOString();
  for (const { fila, no_es_inmobiliaria, ...v } of ventas) {
    const k = `${clave(v.inmobiliaria)}|${v.fecha_inicio || ''}`;
    const existente = (porVenta.get(k) || []).find(doc => !usadas.has(doc.id));
    let leadId = null;
    if (!no_es_inmobiliaria) {
      const s = slugNombre(v.inmobiliaria);
      const lead = s && porNombre.get(s);
      const vigente = !v.fecha_fin || v.fecha_fin >= hoy();
      if (lead) {
        leadId = lead.id;
        const l = lead.data();
        const patch = { actualizado: FieldValue.serverTimestamp() };
        if (!l.asignadoA && ACTIVOS.includes(v.ejecutivo)) { Object.assign(patch, { asignadoA: v.ejecutivo, asignadoPor: 'planilla_ventas', asignadoEn: ahora }); res.inmobiliariasAsignadas++; }
        if (vigente && l.estado !== 'cliente') patch.estado = 'cliente';
        ops.push([lead.ref, patch, 'update']);
      } else {
        const ref = d.collection(COL).doc(`venta_${s || clave(v.inmobiliaria)}`);
        ops.push([ref, {
          nombre: v.inmobiliaria, keys: s ? [`nm:${s}`] : [], fuentes: ['planilla_ventas'], estado: vigente ? 'cliente' : 'ex_cliente',
          asignadoA: ACTIVOS.includes(v.ejecutivo) ? v.ejecutivo : null, asignadoSugerido: ACTIVOS.includes(v.ejecutivo) ? null : v.ejecutivo,
          asignadoPor: 'planilla_ventas', asignadoEn: ahora, crm_usa: v.crm !== 'SIN CRM' ? v.crm : null,
          gestiones: [], historial: [{ tipo: 'alta_desde_planilla_ventas', fecha: ahora }],
          creado: FieldValue.serverTimestamp(), actualizado: FieldValue.serverTimestamp(),
        }, 'merge']);
        porNombre.set(s, { id: ref.id, ref, data: () => ({ asignadoA: v.ejecutivo, estado: 'cliente' }) });
        leadId = ref.id;
        res.inmobiliariasNuevas++;
      }
    }
    const datos = { ...v, ...(leadId ? { lead_id: leadId } : {}), importado_planilla: ahora };
    if (existente) {
      usadas.add(existente.id);
      ops.push([existente.ref, datos, 'merge']);
      res.actualizadas++;
    } else {
      ops.push([d.collection(VENTAS).doc(), { ...datos, created_at: `${v.fecha_venta || v.fecha_inicio || hoy()}T12:00:00.000Z` }, 'merge']);
      res.creadas++;
    }
  }
  // ventas del CRM que no están en la planilla (se dejan como están: pueden ser historial anterior o repetidas)
  for (const doc of existentes.docs) if (!usadas.has(doc.id)) {
    const v = doc.data();
    res.noListadasEnPlanilla.push(`${v.inmobiliaria} · ${v.fecha_inicio || 'sin fecha'} → ${v.fecha_fin || ''} · ${v.estado || 'activa'}`);
  }
  res.noListadasEnPlanilla.sort();

  if (aplicar) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = d.batch();
      for (const [ref, data, modo] of ops.slice(i, i + 400)) modo === 'update' ? b.update(ref, data) : b.set(ref, data, { merge: true });
      await b.commit();
    }
  }
  return { aplicado: aplicar, escrituras: ops.length, ...res };
}
