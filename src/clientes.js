import { collection, doc, writeBatch } from "firebase/firestore";
import { db, addItem, updateItem } from "./firebase";
import { hoyISO } from "./cuotas";

// Ficha de cliente: clientes/{id} = {nombre, razon_social, rut, email, telefono, direccion, crm, ejecutivo,
// contactos: [{nombre, cargo, email, telefono}], notas, lead_id, creado_en, actualizado_en}.
// Cada venta apunta a su ficha con cliente_id. La venta guarda además una copia de los datos del cliente
// tal como estaban al venderse (la usan facturación y los reportes); la ficha es la versión al día.
export const COL_CLIENTES = "clientes";

const sinTildes = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
export const claveRut = rut => { const d = String(rut || "").replace(/\D/g, ""); return d.length >= 8 ? `rut:${d}` : null; };
// mismo criterio que el agente (slugNombre): sin tildes, sin "inmobiliaria", "S.A.", "SRL", etc.
export const claveNombre = n => {
  const s = sinTildes(n).toLowerCase()
    .replace(/\b(inmobiliaria|inmobiliarias|negocios inmobiliarios|propiedades|bienes raices|real estate|s\.?a\.?|s\.?r\.?l\.?|ltda)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
  return s.length >= 3 ? `nm:${s}` : null;
};

export const DATOS_CLIENTE = ["nombre", "razon_social", "rut", "email", "telefono", "direccion", "crm"];
const desdeVenta = v => ({
  nombre: (v.inmobiliaria || "").trim(), razon_social: v.razon_social || "", rut: v.rut || "",
  email: v.mail || "", telefono: v.telefono || "", direccion: v.direccion || "", crm: v.crm || "",
});

// Busca la ficha que corresponde a unos datos de venta: primero por RUT, después por nombre.
export const buscarCliente = (clientes, datos) => {
  const r = claveRut(datos.rut), n = claveNombre(datos.inmobiliaria ?? datos.nombre);
  return (r && clientes.find(c => claveRut(c.rut) === r))
    || (n && clientes.find(c => claveNombre(c.nombre) === n || claveNombre(c.razon_social) === n))
    || null;
};

// Estado comercial de una ficha según sus ventas
export const resumenCliente = (cliente, ventas) => {
  const propias = ventas.filter(v => v.cliente_id === cliente.id);
  const validas = propias.filter(v => v.estado !== "cancelada");
  const vigentes = validas.filter(v => !v.fecha_fin || v.fecha_fin >= hoyISO());
  const vence = vigentes.map(v => v.fecha_fin).filter(Boolean).sort().pop() || "";
  return {
    ventas: propias, vigentes,
    estado: vigentes.length ? "activo" : validas.length ? "ex_cliente" : "sin_ventas",
    total: validas.reduce((a, v) => a + (v.total || 0), 0),
    vence,
  };
};

// Para una venta nueva o editada: devuelve el cliente_id, creando la ficha si no existe.
// Si la ficha ya existe, completa los datos que le falten con los de la venta (nunca pisa los que tiene).
export const asegurarCliente = async (clientes, venta) => {
  const datos = desdeVenta(venta);
  const existente = (venta.cliente_id && clientes.find(c => c.id === venta.cliente_id)) || buscarCliente(clientes, venta);
  const ahora = new Date().toISOString();
  if (existente) {
    const faltan = Object.fromEntries(DATOS_CLIENTE.filter(k => !existente[k] && datos[k]).map(k => [k, datos[k]]));
    if (venta.lead_id && !existente.lead_id) faltan.lead_id = venta.lead_id;
    if (Object.keys(faltan).length) await updateItem(COL_CLIENTES, existente.id, { ...faltan, actualizado_en: ahora });
    return { id: existente.id, cliente: { ...existente, ...faltan } };
  }
  const nuevo = await addItem(COL_CLIENTES, {
    ...datos, ejecutivo: venta.ejecutivo || "", contactos: [], notas: "", lead_id: venta.lead_id || "",
    creado_en: ahora, actualizado_en: ahora,
  });
  return nuevo ? { id: nuevo.id, cliente: nuevo, nueva: true } : { id: null };
};

// Migración: agrupa las ventas sin ficha (por RUT; si no tienen, por nombre) y propone una ficha por grupo.
// Las ventas que coinciden con una ficha que ya existe se asignan a esa ficha.
export const planDeFichas = (ventas, clientes) => {
  const sinFicha = ventas.filter(v => !v.cliente_id && (v.inmobiliaria || "").trim());
  const asignar = []; // [venta, clienteExistente]
  const grupos = new Map(); // clave → {ventas, claves}
  const indice = new Map(); // rut:/nm: → clave del grupo
  // primero las que tienen RUT, así una venta sin RUT se suma al grupo de su RUT y no arma uno aparte
  const orden = [...sinFicha].sort((a, b) => Boolean(claveRut(b.rut)) - Boolean(claveRut(a.rut)));
  for (const v of orden) {
    const ex = buscarCliente(clientes, v);
    if (ex) { asignar.push([v, ex]); continue; }
    const rut = claveRut(v.rut);
    const ks = [rut, claveNombre(v.inmobiliaria), claveNombre(v.razon_social)].filter(Boolean);
    // con RUT se agrupa solo por RUT (otro RUT con el mismo nombre es otra empresa); sin RUT, por nombre
    const g = rut ? indice.get(rut) || rut : ks.map(k => indice.get(k)).find(Boolean) || ks[0] || `id:${v.id}`;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(v);
    ks.forEach(k => { if (!indice.has(k)) indice.set(k, g); });
  }
  const nuevas = [...grupos.values()].map(vs => {
    // datos de la venta más reciente; los vacíos se completan con las anteriores
    const orden = [...vs].sort((a, b) => String(b.fecha_inicio || b.created_at || "").localeCompare(String(a.fecha_inicio || a.created_at || "")));
    const datos = {};
    for (const v of orden) for (const [k, val] of Object.entries(desdeVenta(v))) if (!datos[k] && val) datos[k] = val;
    // el nombre que más se repite; si empatan, el de la venta más reciente
    const nombres = orden.map(v => (v.inmobiliaria || "").trim());
    datos.nombre = nombres.reduce((m, n) => (nombres.filter(x => x === n).length > nombres.filter(x => x === m).length ? n : m), nombres[0]);
    return { datos: { ...datos, ejecutivo: orden[0].ejecutivo || "" }, ventas: orden };
  });
  return { nuevas, asignar, sinFicha: sinFicha.length };
};

// Aplica el plan en lotes (Firestore acepta hasta 500 escrituras por lote)
export const aplicarPlan = async ({ nuevas, asignar }) => {
  const ops = [];
  const ahora = new Date().toISOString();
  const creadas = [];
  for (const g of nuevas) {
    const ref = doc(collection(db, COL_CLIENTES));
    const ficha = { ...g.datos, contactos: [], notas: "", lead_id: g.ventas.find(v => v.lead_id)?.lead_id || "", creado_en: ahora, actualizado_en: ahora, created_at: ahora };
    ops.push(b => b.set(ref, ficha));
    creadas.push({ id: ref.id, ...ficha });
    for (const v of g.ventas) ops.push(b => b.update(doc(db, "ventas", v.id), { cliente_id: ref.id }));
  }
  for (const [v, c] of asignar) ops.push(b => b.update(doc(db, "ventas", v.id), { cliente_id: c.id }));
  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(db);
    ops.slice(i, i + 450).forEach(op => op(b));
    await b.commit();
  }
  const ventaACliente = new Map([
    ...nuevas.flatMap((g, i) => g.ventas.map(v => [v.id, creadas[i].id])),
    ...asignar.map(([v, c]) => [v.id, c.id]),
  ]);
  return { creadas, ventaACliente };
};
