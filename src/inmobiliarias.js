import { updateItem, addItem } from "./firebase";
import { COL_PROSPECTOS } from "./prospectos";
import { hoyISO } from "./cuotas";

// Base de inmobiliarias: una sola lista con todas (clientes, ex clientes y prospectos), cada una con su vendedor.
// Vive en prospeccion_leads (la colección que armó el agente de prospección y donde se cargó la base oficial).
// La ficha de cada inmobiliaria (datos, contactos, notas, gestiones) es el mismo registro; las ventas apuntan a ella
// con lead_id. Las ventas viejas sin lead_id se asocian por nombre.

export const slugNombre = n => {
  const s = String(n || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(inmobiliaria|inmobiliarias|negocios inmobiliarios|propiedades|bienes raices|real estate|s\.?a\.?|s\.?r\.?l\.?|ltda)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
  return s.length >= 3 ? s : null;
};

export const ESTADOS_COMERCIALES = {
  cliente:       { label: "Cliente",       color: "green" },
  ex_cliente:    { label: "Ex cliente",    color: "amber" },
  prospecto:     { label: "Prospecto",     color: "blue" },
  no_interesada: { label: "No interesada", color: "gray" },
};

// ventas por inmobiliaria: por lead_id y, para las que no lo tienen, por nombre
export const indexarVentas = ventas => {
  const porLead = new Map(), porNombre = new Map();
  for (const v of ventas) {
    const m = v.lead_id ? porLead : porNombre, k = v.lead_id || slugNombre(v.inmobiliaria);
    if (k) m.set(k, [...(m.get(k) || []), v]);
  }
  return { porLead, porNombre };
};
export const ventasDe = (l, idx) => [...(idx.porLead.get(l.id) || []), ...(idx.porNombre.get(slugNombre(l.nombre)) || [])];

const vigente = v => v.estado !== "cancelada" && (!v.fecha_fin || v.fecha_fin >= hoyISO());
// Con ventas en el CRM manda eso; si no, lo que dice la base (la planilla oficial marcaba los clientes)
export const estadoComercial = (l, ventas) => {
  if (ventas.some(vigente)) return "cliente";
  if (ventas.some(v => v.estado !== "cancelada")) return "ex_cliente";
  if (l.estado === "cliente") return "cliente";
  if (l.estado === "ex_cliente") return "ex_cliente";
  if (l.estado === "no_interesado") return "no_interesada";
  return "prospecto";
};

export const CAMPOS_FICHA = ["nombre", "razon_social", "rut", "email", "telefono", "whatsapp", "web", "instagram", "direccion", "departamento", "crm_usa", "notas"];

// Cambios en la ficha. Si cambia el nombre se agrega su clave, así el agente no la vuelve a cargar como nueva.
export const guardarFicha = async (l, cambios) => {
  const datos = { ...cambios, actualizadoCRM: new Date().toISOString() };
  const s = cambios.nombre && slugNombre(cambios.nombre);
  if (s) datos.keys = [...new Set([...(l.keys || []), `nm:${s}`])];
  await updateItem(COL_PROSPECTOS, l.id, datos);
  return datos;
};

// Inmobiliaria nueva cargada a mano (o al registrar una venta de alguien que no estaba en la base)
export const crearInmobiliaria = async (datos, { asignadoA = null, porId = null, estado = "manual" } = {}) => {
  const s = slugNombre(datos.nombre);
  const nueva = {
    ...datos, keys: s ? [`nm:${s}`] : [], fuentes: ["crm"], estado,
    asignadoA, asignadoPor: asignadoA ? porId : null, asignadoEn: asignadoA ? new Date().toISOString() : null,
    gestiones: [], historial: [{ tipo: "alta_desde_crm", fecha: new Date().toISOString(), por: porId }],
  };
  return addItem(COL_PROSPECTOS, nueva);
};

// Busca la inmobiliaria de una venta (por lead_id o por nombre)
export const buscarInmobiliaria = (leads, venta) =>
  (venta.lead_id && leads.find(l => l.id === venta.lead_id)) ||
  leads.find(l => slugNombre(l.nombre) && slugNombre(l.nombre) === slugNombre(venta.inmobiliaria)) || null;
