import { updateItem } from "./firebase";
import { hoyISO, sumarMeses } from "./cuotas";
import { claveNombre } from "./clientes";

// Renovaciones: ventas que vencen en los próximos 60 días o vencieron hace menos de 90 y no se renovaron.
// El seguimiento se guarda en la misma venta: venta.renovacion = {estado, gestiones[], ultimaGestion, motivo,
// venta_nueva}. Una venta cuenta como renovada si el cliente tiene otra venta que termina después (aunque se
// haya cargado por fuera de esta pantalla) o si se marcó a mano.
export const DIAS_ANTES = 60;
export const DIAS_DESPUES = 90;

export const ESTADOS_RENOVACION = {
  vencida:    { label: "Vencida sin renovar", color: "red" },
  vence_30:   { label: "Vence en 30 días",    color: "amber" },
  vence_60:   { label: "Vence en 60 días",    color: "gray" },
  renovada:   { label: "Renovada",            color: "green" },
  no_renueva: { label: "No renueva",          color: "gray" },
};
export const RESULTADOS_RENOVACION = [
  { id: "contactado", label: "Contactado, en conversación" },
  { id: "volver",     label: "Volver a contactar" },
  { id: "renueva",    label: "Va a renovar" },
  { id: "no_renueva", label: "No renueva" },
];
export const MOTIVOS_NO_RENUEVA = ["Precio", "No le dio resultado", "Se pasa a otro portal", "Cerró o dejó el rubro", "Otro"];

const utc = iso => { const [a, m, d] = iso.slice(0, 10).split("-").map(Number); return Date.UTC(a, m - 1, d); };
export const diasHasta = (iso, hoy = hoyISO()) => Math.round((utc(iso) - utc(hoy)) / 86400000);
const sumarDias = (iso, n) => new Date(utc(iso) + n * 86400000).toISOString().slice(0, 10);
const clienteDe = v => (v.cliente_id ? `id:${v.cliente_id}` : claveNombre(v.inmobiliaria) || String(v.inmobiliaria || "").trim());

export const renovaciones = (ventas, hoy = hoyISO()) => {
  const validas = ventas.filter(v => v.estado !== "cancelada" && v.fecha_fin);
  const porCliente = new Map();
  for (const v of validas) {
    const k = clienteDe(v);
    porCliente.set(k, [...(porCliente.get(k) || []), v]);
  }
  return validas
    .map(v => ({ v, dias: diasHasta(v.fecha_fin, hoy) }))
    .filter(({ dias }) => dias <= DIAS_ANTES && dias >= -DIAS_DESPUES)
    .map(({ v, dias }) => {
      const siguiente = (porCliente.get(clienteDe(v)) || []).find(o => o.id !== v.id && o.fecha_fin > v.fecha_fin) || null;
      const r = v.renovacion || {};
      const estado = siguiente || r.estado === "renovada" ? "renovada"
        : r.estado === "no_renueva" ? "no_renueva"
        : dias < 0 ? "vencida" : dias <= 30 ? "vence_30" : "vence_60";
      return { venta: v, dias, estado, siguiente, ultimaGestion: r.ultimaGestion || null };
    });
};

// Registra una gestión de renovación. Devuelve los cambios para actualizar el estado local.
export const registrarGestionRenovacion = async (venta, g) => {
  const r = venta.renovacion || {};
  const gestion = { ...g, fecha: new Date().toISOString() };
  const renovacion = {
    ...r,
    estado: g.resultado === "no_renueva" ? "no_renueva" : r.estado === "renovada" ? "renovada" : "en_gestion",
    motivo: g.resultado === "no_renueva" ? g.motivo || "" : r.motivo || "",
    gestiones: [...(r.gestiones || []), gestion],
    ultimaGestion: gestion,
  };
  await updateItem("ventas", venta.id, { renovacion });
  return { renovacion };
};

// La venta vieja queda marcada como renovada por la nueva
export const marcarRenovada = async (ventaVieja, ventaNuevaId) => {
  const renovacion = { ...(ventaVieja.renovacion || {}), estado: "renovada", venta_nueva: ventaNuevaId, renovadaEn: new Date().toISOString() };
  await updateItem("ventas", ventaVieja.id, { renovacion });
  return { renovacion };
};

// Borrador de la venta de renovación: mismos productos y condiciones, y el período siguiente de igual duración
const COPIAR = ["inmobiliaria", "razon_social", "rut", "mail", "telefono", "direccion", "crm", "plan", "detalle",
  "propiedades", "destacadas_q", "superdestacadas_q", "produccion_q", "indice", "destacadas_home", "productos_seleccionados",
  "tipo_pago", "subtipo_contado", "subtipo_cuotas", "num_cuotas", "valor_mensual", "subtotal", "ejecutivo", "cliente_id"];
export const borradorRenovacion = v => {
  // duración en meses: del inicio al día siguiente del fin (1/1 → 31/12 son 12 meses)
  const inicio = sumarDias(v.fecha_fin, 1);
  const [ai, mi] = (v.fecha_inicio || "").split("-").map(Number);
  const [af, mf] = inicio.split("-").map(Number);
  const meses = v.fecha_inicio ? (af * 12 + mf) - (ai * 12 + mi) || 12 : 12; // sin fecha de inicio: un año
  return {
    ...Object.fromEntries(COPIAR.filter(k => v[k] !== undefined).map(k => [k, v[k]])),
    fecha_inicio: inicio, fecha_fin: sumarMeses(v.fecha_fin, meses),
    renovacion_de: v.id,
  };
};
