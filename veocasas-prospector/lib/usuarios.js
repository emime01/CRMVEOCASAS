import { db, FieldValue } from './firebase';

// Dar de baja usuarios del CRM (ej. un vendedor que se fue). No se borra nada:
// - usuarios/{uid}.rol pasa a "inactivo": las reglas de Firestore le niegan todo acceso aunque tenga la contraseña.
// - sus tareas abiertas pasan a quien se indique (por defecto Mika), con nota en el historial.
// Sus ventas, gestiones e inmobiliarias quedan a su nombre; Mika reparte las inmobiliarias desde el CRM.
// En el CRM además hay que poner role "inactivo" en USERS (src/constants.js).
export async function bajaUsuarios(ids, { aplicar = false, reasignarA = 'mika' } = {}) {
  const d = db();
  const res = { perfiles: [], tareas: [], inmobiliariasACargo: {}, aplicado: aplicar };
  if (!ids.length) return res;

  const perfiles = await d.collection('usuarios').where('id', 'in', ids).get();
  for (const p of perfiles.docs) {
    res.perfiles.push({ id: p.data().id, rol: p.data().rol });
    if (aplicar && p.data().rol !== 'inactivo') await p.ref.update({ rol: 'inactivo', baja: new Date().toISOString() });
  }

  const ahora = new Date().toISOString();
  const tareas = await d.collection('tareas').where('asignada_a', 'in', ids).get();
  for (const t of tareas.docs) {
    const x = t.data();
    if (x.estado === 'completada') continue;
    res.tareas.push({ titulo: x.titulo, de: x.asignada_a });
    if (aplicar) await t.ref.update({
      asignada_a: reasignarA, reasignada_de: x.asignada_a,
      historial: FieldValue.arrayUnion({ estado: x.estado || 'pendiente', por: 'sistema', at: ahora, nota: `Reasignada: ${x.asignada_a} dado de baja` }),
    });
  }

  for (const id of ids)
    res.inmobiliariasACargo[id] = (await d.collection('prospeccion_leads').where('asignadoA', '==', id).count().get()).data().count;
  return res;
}
