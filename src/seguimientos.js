import { hoyISO } from "./cuotas";
import { renovaciones } from "./renovaciones";
import { nombreUsuario } from "./prospectos";

// Seguimientos: las gestiones con fecha de "volver a contactar". Cuando la fecha llega (o ya pasó), aparecen en el
// panel del vendedor y en el número rojo del menú. Para que además le suene el celular, cada gestión con fecha
// tiene un botón que la agenda en su Google Calendar.

export const proximoDe = l => l.ultimaGestion?.proximoContacto || "";
const ABIERTAS = ["vencida", "vence_30", "vence_60"];

// Inmobiliarias para contactar hoy o atrasadas; uid = vendedor (sin uid, las de todos)
export const pendientesInmobiliarias = (leads, uid, hoy = hoyISO()) => (leads || [])
  .filter(l => proximoDe(l) && proximoDe(l) <= hoy && (!uid || l.asignadoA === uid))
  .map(l => ({ tipo: "inmobiliaria", id: l.id, nombre: l.nombre, fecha: proximoDe(l), nota: l.ultimaGestion?.nota || "", vendedor: l.asignadoA || null }));

// Renovaciones en gestión con fecha de próximo contacto que ya llegó (responsable: el de la venta o el de la ficha)
export const pendientesRenovaciones = (ventas, leads, uid, hoy = hoyISO()) => {
  const aCargo = new Map((leads || []).map(l => [l.id, l.asignadoA]));
  return renovaciones(ventas || [], hoy)
    .filter(r => ABIERTAS.includes(r.estado) && r.ultimaGestion?.proximoContacto && r.ultimaGestion.proximoContacto <= hoy)
    .map(r => ({ r, resp: aCargo.get(r.venta.lead_id) || r.venta.ejecutivo }))
    .filter(({ r, resp }) => !uid || resp === uid || r.venta.ejecutivo === uid)
    .map(({ r, resp }) => ({ tipo: "renovacion", id: r.venta.id, nombre: r.venta.inmobiliaria, fecha: r.ultimaGestion.proximoContacto, nota: r.ultimaGestion.nota || "", vendedor: resp }));
};

export const pendientes = (ventas, leads, uid, hoy = hoyISO()) =>
  [...pendientesInmobiliarias(leads, uid, hoy), ...pendientesRenovaciones(ventas, leads, uid, hoy)]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.nombre).localeCompare(String(b.nombre), "es"));

// Link que abre Google Calendar con el evento ya armado (todo el día, en la fecha de volver a contactar).
// No conecta nada: el vendedor lo guarda en su calendario y Google le avisa.
export const linkCalendario = ({ nombre, fecha, telefono, nota, tipo = "inmobiliaria", vendedor }) => {
  if (!fecha) return null;
  const d = fecha.replace(/-/g, "");
  const [a, m, dia] = fecha.split("-").map(Number);
  const sig = new Date(Date.UTC(a, m - 1, dia + 1)).toISOString().slice(0, 10).replace(/-/g, "");
  const titulo = `${tipo === "renovacion" ? "Renovación" : "Contactar"}: ${nombre}`;
  const detalle = [
    telefono && `Teléfono: ${telefono}`,
    nota && `Última gestión: ${nota}`,
    vendedor && `A cargo: ${nombreUsuario(vendedor)}`,
    "Registrá la gestión en el CRM: https://crmveocasas.vercel.app",
  ].filter(Boolean).join("\n");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${d}/${sig}&details=${encodeURIComponent(detalle)}`;
};
