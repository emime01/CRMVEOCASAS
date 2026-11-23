import { cuotasDe, conCambioEnCuota, enCuotas, hoyISO } from "./cuotas";

// Pagos de una venta: cada cuota, o un único pago si es al contado. Es la unidad de Cobros y facturación,
// de los reportes y de las comisiones de los CRM. Cada pago avanza: por facturar → facturado → cobrado.
// - Cuotas: los datos viven en venta.cuotas_detalle[i].
// - Contado: en la venta (facturado, nro_factura, fecha_factura, cobrado, fecha_pago, crm_pagado…).
//   Las ventas al contado viejas sin el dato de cobro quedan "sin registrar" (pagada: null).
export const pagosDe = v => enCuotas(v)
  ? cuotasDe(v).map(c => ({ ...c, contado: false, facturada: Boolean(c.nro_factura || c.facturada) }))
  : v.fecha_inicio ? [{
      numero: 1, fecha: v.fecha_inicio, monto: v.total || 0, contado: true,
      facturada: Boolean(v.facturado || v.nro_factura), nro_factura: v.nro_factura || "", fecha_factura: v.fecha_factura || "",
      pagada: v.cobrado === undefined ? null : Boolean(v.cobrado), fecha_pago: v.fecha_pago || "", medio_pago: v.medio_pago_cobro || "",
      gestionado: Boolean(v.gestionado), crm_pagado: Boolean(v.crm_pagado), crm_pagado_fecha: v.crm_pagado_fecha || "",
    }] : [];

// Cambios de un pago → cambios a guardar en la venta
const CONTADO = { pagada: "cobrado", medio_pago: "medio_pago_cobro", facturada: "facturado" };
export const cambiosDePago = (v, pago, cambios) => {
  if (!pago.contado) return { cuotas_detalle: conCambioEnCuota(v, pago.numero - 1, cambios) };
  return Object.fromEntries(Object.entries(cambios).map(([k, val]) => [CONTADO[k] || k, val]));
};

export const ESTADOS_PAGO = {
  vencido:      { label: "Vencido",        color: "red" },
  por_facturar: { label: "Por facturar",   color: "amber" },
  facturado:    { label: "Facturado",      color: "blue" },
  cobrado:      { label: "Cobrado",        color: "green" },
  sin_registrar:{ label: "Sin registrar",  color: "gray" },
};
export const estadoPago = (p, hoy = hoyISO()) =>
  p.pagada ? "cobrado" : p.pagada === null ? "sin_registrar" : p.fecha && p.fecha < hoy ? "vencido" : p.facturada ? "facturado" : "por_facturar";

// Todos los pagos de las ventas, con su venta. Las canceladas solo aportan lo que ya se cobró (lo demás se anula).
export const todosLosPagos = ventas => ventas.flatMap(v => pagosDe(v)
  .filter(p => v.estado !== "cancelada" || p.pagada)
  .map(p => ({ ...p, venta: v, moneda: v.moneda || "UYU", clave: `${v.id}_${p.numero}` })));

// Comisión del CRM: si el cliente es del CRM, un porcentaje (6% por defecto) de cada pago cobrado, sin el IVA
// (el pago incluye IVA; la base es la parte proporcional del subtotal de la venta).
export const baseSinIVA = p => { const { subtotal, total } = p.venta; return subtotal > 0 && total > 0 ? p.monto * subtotal / total : p.monto; };
export const comisionDe = p => p.venta.comision_crm ? Math.round(baseSinIVA(p) * (Number(p.venta.comision_crm_pct) || 6)) / 100 : 0;
export const comisionCRM = p => p.pagada ? comisionDe(p) : 0;
