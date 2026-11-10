import { db, FieldValue, COL } from './firebase.js';

// Une registros de la misma inmobiliaria que llegaron de fuentes distintas: mismo email, mismo dominio web
// ("Administración Martín-Sabella" / "Inmobiliaria Martin-Sabella") o mismo nombre normalizado ("Marta Young" /
// "Marta Young Propiedades"). El nombre solo une si no es genérico y si no están en departamentos distintos.
// El registro principal se queda con todos los datos; los otros pasan a 'duplicado' sin claves,
// para que el deduplicado de nuevas búsquedas siempre encuentre al principal.

// el que ya está más avanzado en el flujo manda; entre iguales, el que tiene más datos y después el más viejo
const PRIORIDAD = ['derivado', 'conversando', 'en_secuencia', 'sin_respuesta', 'cliente', 'ex_cliente', 'manual', 'listo', 'nuevo', 'sin_email'];
// con una conversación en curso en más de un registro, la fusión la decide una persona
const EN_CONVERSACION = ['derivado', 'conversando', 'en_secuencia', 'sin_respuesta'];
const A_MANUAL = ['nuevo', 'listo', 'sin_email', 'ex_cliente'];
// nombres que comparten inmobiliarias distintas (lugares y palabras comunes)
const NOMBRES_GENERICOS = ['puntadeleste', 'punta', 'uruguay', 'montevideo', 'maldonado', 'colonia', 'carrasco', 'pocitos',
  'broker', 'brokers', 'grupo', 'group', 'inversiones', 'negocios', 'inmuebles', 'casas', 'home', 'homes', 'estudio', 'rural',
  'urbana', 'boutique', 'costa', 'atlantida', 'piriapolis', 'lapaloma', 'solymar', 'hogar', 'remax', 'century21'];
const NO_TOCAR = ['descartado', 'duplicado', 'baja', 'no_interesado', 'rebotado'];
const CAMPOS = ['web', 'email', 'telefono', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'departamento'];
// dominios compartidos por inmobiliarias distintas: franquicias y hostings
const DOMINIOS_COMPARTIDOS = ['remax.com.uy', 'century21.com.uy', 'engelvoelkers.com', 'kw.com', 'sites.google.com', 'business.site'];
const MAX_POR_CLAVE = 3; // una clave en más registros suele ser una franquicia o un email de grupo: no se une

// vendedores que hoy trabajan (Lucas ya no está): ante dos vendedores distintos, gana uno de estos
const VENDEDORES_ACTIVOS = ['paty', 'sebastian', 'stefano', 'juanba', 'mika'];
// núcleo del nombre, sin las palabras de rubro: dos registros del mismo grupo tienen que tener nombres parecidos
const RUBRO = /\b(inmobiliarias?|negocios inmobiliarios|propiedades|bienes raices|real estate|asesores inmobiliarios|desarrollos inmobiliarios|s\.?r\.?l\.?|s\.?a\.?s?\.?|ltda)\b/g;
const nucleo = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(RUBRO, ' ').replace(/[^a-z0-9]/g, '');
const parecidos = (a, b) => {
  const x = nucleo(a), y = nucleo(b);
  if (!x || !y) return false;
  const [c, l] = x.length <= y.length ? [x, y] : [y, x];
  return (c.length >= 4 && l.includes(c)) || x.slice(0, 6) === y.slice(0, 6);
};

const datos = d => d.data();
const llenos = x => CAMPOS.filter(k => x[k]).length;
const orden = (a, b) => {
  const pa = PRIORIDAD.indexOf(datos(a).estado), pb = PRIORIDAD.indexOf(datos(b).estado);
  if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
  if (llenos(datos(a)) !== llenos(datos(b))) return llenos(datos(b)) - llenos(datos(a));
  return (datos(a).creado?.toMillis?.() || 0) - (datos(b).creado?.toMillis?.() || 0);
};

export async function fusionarRepetidas({ aplicar = false } = {}) {
  const d = db();
  const docs = (await d.collection(COL).get()).docs.filter(x => !NO_TOCAR.includes(datos(x).estado));

  const usos = new Map();
  const deptos = new Map(); // nm: → departamentos de los registros con ese nombre
  for (const x of docs) for (const k of datos(x).keys || []) if (/^(em|dom|nm):/.test(k)) {
    usos.set(k, (usos.get(k) || 0) + 1);
    if (k.startsWith('nm:') && datos(x).departamento) deptos.set(k, new Set([...(deptos.get(k) || []), datos(x).departamento]));
  }
  const nombreSirve = k => k.slice(3).length >= 5 && !NOMBRES_GENERICOS.includes(k.slice(3)) && (deptos.get(k)?.size || 0) <= 1;
  const sirve = k => /^(em|dom|nm):/.test(k) && usos.get(k) > 1 && usos.get(k) <= MAX_POR_CLAVE
    && !DOMINIOS_COMPARTIDOS.some(dc => k === `dom:${dc}` || k.endsWith(`@${dc}`))
    && (!k.startsWith('nm:') || nombreSirve(k));

  // unión por claves (union-find)
  const padre = new Map(docs.map(x => [x.id, x.id]));
  const raiz = id => { while (padre.get(id) !== id) id = padre.get(id); return id; };
  const primero = new Map();
  for (const x of docs) for (const k of (datos(x).keys || []).filter(sirve)) {
    if (primero.has(k)) padre.set(raiz(x.id), raiz(primero.get(k))); else primero.set(k, x.id);
  }
  const grupos = new Map();
  for (const x of docs) { const r = raiz(x.id); grupos.set(r, [...(grupos.get(r) || []), x]); }

  const res = { grupos: 0, fusionados: 0, omitidos: 0, vendedoresDistintos: 0, ejemplos: [], conflictos: [], omitidosEjemplos: [] };
  const ops = [];
  for (const g of grupos.values()) {
    if (g.length < 2) continue;
    if (g.filter(x => EN_CONVERSACION.includes(datos(x).estado)).length > 1) { res.omitidos++; continue; } // eso lo decide una persona
    g.sort(orden);
    const [principal, ...otros] = g;
    const p = datos(principal);
    // un email o una web compartida puede encadenar inmobiliarias distintas: si algún nombre no se parece, no se une
    if (otros.some(o => !parecidos(p.nombre, datos(o).nombre))) {
      res.omitidos++;
      if (res.omitidosEjemplos.length < 15) res.omitidosEjemplos.push(`${p.nombre} / ${otros.map(o => datos(o).nombre).join(' / ')}`);
      continue;
    }
    const patch = { actualizado: FieldValue.serverTimestamp() };
    for (const o of otros.map(datos)) for (const k of CAMPOS) if (!p[k] && !patch[k] && o[k]) patch[k] = o[k];
    // si alguno es cliente, el principal también; el vendedor asignado y la fila de la base oficial se heredan
    if (otros.some(o => datos(o).estado === 'cliente') && p.estado !== 'cliente' && !EN_CONVERSACION.includes(p.estado)) Object.assign(patch, { estado: 'cliente', proximoEnvio: null });
    const vendedores = [...new Set(g.map(x => datos(x).asignadoA).filter(Boolean))];
    // se queda el vendedor del principal si está activo; si no, el primero activo de los otros
    const activo = VENDEDORES_ACTIVOS.includes(p.asignadoA) ? null : otros.map(datos).find(o => VENDEDORES_ACTIVOS.includes(o.asignadoA));
    const conVendedor = activo || (!p.asignadoA && otros.map(datos).find(o => o.asignadoA));
    if (conVendedor) {
      Object.assign(patch, { asignadoA: conVendedor.asignadoA, asignadoPor: conVendedor.asignadoPor || null, asignadoEn: conVendedor.asignadoEn || null });
      if (p.asignadoA && p.asignadoA !== conVendedor.asignadoA) patch.asignadoSugerido = p.asignadoA;
      if (!patch.estado && A_MANUAL.includes(p.estado)) Object.assign(patch, { estado: 'manual', estadoPrevio: p.estado, proximoEnvio: null });
    }
    if (vendedores.length > 1) { res.vendedoresDistintos++; if (res.conflictos.length < 40) res.conflictos.push(`${p.nombre}: ${vendedores.join(' / ')} (queda ${patch.asignadoA || p.asignadoA})`); }
    for (const k of ['asignadoSugerido', 'baseOficial']) { const o = otros.map(datos).find(x => x[k]); if (!p[k] && !patch[k] && o) patch[k] = o[k]; }
    // email heredado: si venía validado (listo) se queda listo; si no, se valida en la próxima pasada
    if (patch.email && !patch.estado && ['nuevo', 'sin_email'].includes(p.estado)) {
      const deListo = otros.some(o => datos(o).estado === 'listo' && datos(o).email === patch.email);
      Object.assign(patch, deListo ? { estado: 'listo' } : { estado: 'nuevo', intentosEnriquecer: 0, googleBuscado: false });
    }
    const keys = [...new Set(otros.flatMap(o => datos(o).keys || []))];
    const fuentes = [...new Set(otros.flatMap(o => datos(o).fuentes || []))];
    if (keys.length) patch.keys = FieldValue.arrayUnion(...keys);
    if (fuentes.length) patch.fuentes = FieldValue.arrayUnion(...fuentes);
    patch.historial = FieldValue.arrayUnion({ tipo: 'fusion', fecha: new Date(), con: otros.map(o => o.id) });
    ops.push([principal.ref, patch]);
    for (const o of otros) {
      ops.push([o.ref, {
        estado: 'duplicado', duplicadoDe: principal.id, keys: [], proximoEnvio: null, actualizado: FieldValue.serverTimestamp(),
        historial: FieldValue.arrayUnion({ tipo: 'duplicado', fecha: new Date(), de: principal.id, motivo: 'mismo email, web o nombre' }),
      }]);
    }
    res.grupos++; res.fusionados += otros.length;
    if (res.ejemplos.length < 15) res.ejemplos.push(`${p.nombre} ← ${otros.map(o => datos(o).nombre).join(' / ')}`);
  }

  if (aplicar) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = d.batch();
      for (const [ref, patch] of ops.slice(i, i + 400)) b.update(ref, patch);
      await b.commit();
    }
  }
  return { aplicado: aplicar, ...res };
}
