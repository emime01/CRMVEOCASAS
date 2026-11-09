import { db, FieldValue, COL, EXCL } from './firebase.js';
import { slugNombre, adivinarDepto } from './normalize.js';

// Carga de la base oficial de Veocasas (la planilla repartida entre los vendedores) en el agente.
// Llega ya cruzada con la base del agente: cada fila trae los ids de los registros que le corresponden.
// - "Esta en Veocasas: Si" → cliente: el agente no le escribe y se agrega a excluidos.
// - Asignada a un vendedor → la trabaja esa persona (asignadoA): el agente no le escribe.
// - Sin vendedor activo (Lucas o "Sin Asignar") → queda para el agente, con el vendedor anterior como sugerido.
// En la planilla los emails y teléfonos a veces están en la fila de otra inmobiliaria, así que de la base solo se
// usa el nombre para cruzar, y su email y web se guardan aparte (emailBase, webBase) sin usarlos para escribir.
const A_MANUAL = ['nuevo', 'listo', 'sin_email', 'sin_respuesta', 'no_interesado', 'ex_cliente', 'rebotado'];
const NO_PISAR = ['conversando', 'derivado', 'baja', 'descartado', 'duplicado'];

export async function importarBaseOficial(filas, { aplicar = false } = {}) {
  const d = db();
  const res = { filas: filas.length, marcadosCliente: 0, asignados: 0, sugeridos: 0, creados: 0, excluidos: 0, sinCambio: 0 };
  const ops = [];
  const ahora = new Date();
  const ids = [...new Set(filas.flatMap(f => f.leads))];
  const leads = new Map();
  for (let i = 0; i < ids.length; i += 300) {
    const refs = ids.slice(i, i + 300).map(id => d.collection(COL).doc(id));
    for (const s of await d.getAll(...refs)) if (s.exists) leads.set(s.id, s.data());
  }

  for (const f of filas) {
    const base = {
      fila: f.fila, nombre: f.nombre, enVeocasas: f.enVeocasas, asignado: f.asignadoBase || null, tipo: f.tipo || null,
      propiedades: f.propiedades ?? null, crm: f.crmUsa || null, cargada: ahora,
    };
    const slug = slugNombre(f.nombre);
    if (f.enVeocasas) {
      ops.push([d.collection(EXCL).doc(`base_${slug || f.fila}`), { keys: slug ? [`nm:${slug}`] : [], nombre: f.nombre, motivo: 'cliente', origen: 'base_oficial', fecha: ahora }]);
      res.excluidos++;
    }
    for (const id of f.leads) {
      const l = leads.get(id);
      if (!l) continue;
      const patch = { baseOficial: base, actualizado: FieldValue.serverTimestamp() };
      let cambio = false;
      if (f.enVeocasas && !NO_PISAR.includes(l.estado) && l.estado !== 'cliente') {
        Object.assign(patch, { estado: 'cliente', proximoEnvio: null, historial: FieldValue.arrayUnion({ tipo: 'cliente_base_oficial', fecha: ahora }) });
        res.marcadosCliente++; cambio = true;
      }
      // el vendedor de la base, también para los clientes (así aparecen en "Mis clientes" del CRM)
      if (f.asignadoA && !l.asignadoA) {
        Object.assign(patch, { asignadoA: f.asignadoA, asignadoPor: 'base_oficial', asignadoEn: ahora.toISOString() });
        if (!f.enVeocasas && A_MANUAL.includes(l.estado)) Object.assign(patch, { estado: 'manual', estadoPrevio: l.estado, reintentarEn: null, proximoEnvio: null });
        res.asignados++; cambio = true;
      } else if (f.sugerido && !l.asignadoSugerido) {
        patch.asignadoSugerido = f.sugerido; res.sugeridos++; cambio = true;
      }
      if (!cambio) res.sinCambio++;
      ops.push([d.collection(COL).doc(id), patch, 'update']);
    }
    if (!f.leads.length) {
      // solo estaba en la base: se agrega para que el CRM la muestre y las búsquedas no la repitan
      const estado = f.enVeocasas ? 'cliente' : f.asignadoA ? 'manual' : 'nuevo';
      ops.push([d.collection(COL).doc(`base_${f.fila}`), {
        nombre: f.nombre, email: null, emailBase: f.emailBase || null, web: null, webBase: f.webBase || null,
        telefono: f.telefono || null, whatsapp: null, instagram: null, facebook: null, contacto: f.contacto || null,
        departamento: adivinarDepto(`${f.nombre} ${f.barrio || ''}`) || null, barrio: f.barrio || null,
        keys: slug ? [`nm:${slug}`] : [], fuentes: ['base_oficial'], estado, baseOficial: base,
        asignadoA: f.asignadoA || null, asignadoPor: f.asignadoA ? 'base_oficial' : null,
        asignadoEn: f.asignadoA ? ahora.toISOString() : null, asignadoSugerido: f.sugerido || null,
        paso: 0, intentosEnriquecer: 0, proximoEnvio: null, threadId: null,
        historial: [{ tipo: 'alta_desde_base_oficial', fecha: ahora }],
        creado: FieldValue.serverTimestamp(), actualizado: FieldValue.serverTimestamp(),
      }]);
      res.creados++;
    }
  }

  if (aplicar) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = d.batch();
      for (const [ref, data, modo] of ops.slice(i, i + 400)) modo === 'update' ? b.update(ref, data) : b.set(ref, data, { merge: true });
      await b.commit();
    }
  }
  return { aplicado: aplicar, escrituras: ops.length, ...res };
}
