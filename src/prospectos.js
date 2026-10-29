import { updateItem } from "./firebase";
import { MENSAJE_WHATSAPP, USERS } from "./constants";

// Prospectos = inmobiliarias que encontró el agente de prospección (colección prospeccion_leads, mismo Firebase).
// El agente escribe por email y clasifica respuestas; desde acá la gerente asigna y los vendedores gestionan.
export const COL_PROSPECTOS = "prospeccion_leads";

// estados del agente que, al asignar, pasan a contacto humano (el agente deja de escribirles)
const A_MANUAL = ["nuevo","listo","sin_email","sin_respuesta","no_interesado","ex_cliente","rebotado"];

export const fechaCorta = v => {
  if(!v) return "";
  const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
  return isNaN(d) ? "" : d.toLocaleDateString("es-UY",{day:"numeric",month:"short"});
};
export const hoyISO = () => new Date().toISOString().split("T")[0];
export const nombreUsuario = id => USERS.find(u=>u.id===id)?.name || id || "";

// WhatsApp: el número guardado o un celular uruguayo del teléfono (09X XXX XXX)
export const numeroWhatsapp = l => {
  if(l.whatsapp) return String(l.whatsapp).replace(/\D/g,"");
  const d = String(l.telefono||"").replace(/\D/g,"").replace(/^598/,"").replace(/^0/,"");
  return /^9\d{7}$/.test(d) ? `598${d}` : null;
};
export const linkWhatsapp = (l, vendedorId) => {
  const n = numeroWhatsapp(l);
  if(!n) return null;
  const texto = MENSAJE_WHATSAPP.replace("{nombre}", l.nombre||"").replace("{vendedor}", nombreUsuario(vendedorId));
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
};

// Asignar o quitar vendedor. Devuelve los cambios aplicados para actualizar el estado local.
export const asignar = async (l, vendedorId, porId) => {
  const cambios = vendedorId
    ? {
        asignadoA: vendedorId, asignadoPor: porId, asignadoEn: new Date().toISOString(),
        ...(A_MANUAL.includes(l.estado) ? { estado:"manual", estadoPrevio:l.estado, reintentarEn:null } : {}),
      }
    : {
        asignadoA: null, asignadoPor: porId, asignadoEn: null,
        ...(l.estado==="manual" && l.estadoPrevio ? { estado:l.estadoPrevio, estadoPrevio:null } : {}),
      };
  await updateItem(COL_PROSPECTOS, l.id, cambios);
  return cambios;
};

// Gestión de un vendedor (WhatsApp, llamada…). "Interesada" la deja como interesada ya presentada
// (el vendedor ya está en contacto); "No interesada" la cierra sin que el agente vuelva a escribirle.
export const registrarGestion = async (l, gestion) => {
  const g = { ...gestion, fecha: new Date().toISOString() };
  const cambios = { gestiones: [...(l.gestiones||[]), g], ultimaGestion: g };
  if(g.resultado==="interesada") Object.assign(cambios, { estado:"derivado", presentado:true, reintentarEn:null });
  if(g.resultado==="no_interesada") Object.assign(cambios, { estado:"no_interesado", reintentarEn:null });
  await updateItem(COL_PROSPECTOS, l.id, cambios);
  return cambios;
};

// Al crear una venta desde un prospecto, pasa a cliente del vendedor que la cerró
export const marcarCliente = async (leadId, venta) => {
  const cambios = {
    estado:"cliente", asignadoA: venta.ejecutivo, proximoEnvio:null, reintentarEn:null,
    crm:{ cliente:true, activo:true, ejecutivo:venta.ejecutivo, nombreCRM:venta.inmobiliaria, desdeProspecto:true },
  };
  await updateItem(COL_PROSPECTOS, leadId, cambios);
  return cambios;
};
