import { mesDe, hoyISO, sumarMeses } from "./cuotas";
import { pagosDe } from "./cobros";
import { enPesos } from "./moneda";

// Cálculos de los reportes administrativos. Todo sale de las ventas no canceladas y sus cuotas (src/cuotas.js).
// - Ingreso devengado: el subtotal sin IVA de cada venta repartido en partes iguales entre los meses de su período.
// - A cobrar / cobrado / pendiente: cuotas por mes de vencimiento (con IVA). Una venta al contado es un solo pago
//   en su mes de inicio (cobrado y fecha_pago). Las ventas al contado viejas, sin el dato, van aparte ("sin registrar").
// - Cuentas por cobrar: cuotas y pagos al contado vencidos sin cobrar, por antigüedad.
// Los importes van en pesos: las ventas en dólares se pasan con el tipo de cambio guardado en la venta.

const utc = iso => { const [a, m, d] = iso.slice(0, 10).split("-").map(Number); return Date.UTC(a, m - 1, d); };
const diasEntre = (desde, hasta) => Math.round((utc(hasta) - utc(desde)) / 86400000);

// meses del período: del inicio al día siguiente del fin (1/1 → 31/12 son 12)
export const mesesDelPeriodo = v => {
  if (!v.fecha_inicio || !v.fecha_fin || v.fecha_fin < v.fecha_inicio) return 0;
  const sig = new Date(utc(v.fecha_fin) + 86400000).toISOString().slice(0, 10);
  const [ai, mi] = v.fecha_inicio.split("-").map(Number);
  const [af, mf] = sig.split("-").map(Number);
  return Math.max(1, af * 12 + mf - (ai * 12 + mi));
};
const sinIva = v => v.subtotal || Math.round((v.total || 0) / 1.22);

// Lo que se cobra de una venta: sus cuotas, o un único pago si es al contado (src/cobros.js)
export { pagosDe };

export const resumenMensual = (ventas, anio) => {
  const meses = Array.from({ length: 12 }, (_, i) => ({
    mes: `${anio}-${String(i + 1).padStart(2, "0")}`, devengado: 0, aCobrar: 0, cobrado: 0, pendiente: 0, contado: 0, facturado: 0,
  }));
  const fila = ym => meses.find(m => m.mes === ym);
  const validas = ventas.filter(v => v.estado !== "cancelada");
  for (const v of validas) {
    const n = mesesDelPeriodo(v);
    for (let i = 0; i < n; i++) {
      const f = fila(mesDe(sumarMeses(v.fecha_inicio, i)));
      if (f) f.devengado += enPesos(sinIva(v), v) / n;
    }
    for (const p of pagosDe(v)) {
      const f = fila(mesDe(p.fecha));
      if (!f) continue;
      const m = enPesos(p.monto, v); // todo en pesos: las ventas en dólares al tipo de cambio de la venta
      f.aCobrar += m;
      if (p.facturada) f.facturado += m;
      if (p.pagada === null) f.contado += m; // contado sin registrar
      else if (p.pagada) f.cobrado += m;
      else f.pendiente += m;
    }
  }
  return {
    meses: meses.map(m => ({ ...m, devengado: Math.round(m.devengado) })),
    sinFechas: validas.filter(v => !v.fecha_inicio || !v.fecha_fin).length,
  };
};

export const TRAMOS = [
  { id: "t30", label: "1 a 30 días", hasta: 30 },
  { id: "t60", label: "31 a 60 días", hasta: 60 },
  { id: "t90", label: "61 a 90 días", hasta: 90 },
  { id: "t90mas", label: "Más de 90 días", hasta: Infinity },
];

// Cuotas y pagos al contado vencidos sin cobrar, con su antigüedad
export const cuentasPorCobrar = (ventas, hoy = hoyISO()) =>
  ventas.filter(v => v.estado !== "cancelada")
    .flatMap(v => pagosDe(v)
      .filter(c => c.pagada === false && c.fecha && c.fecha < hoy)
      .map(c => {
        const dias = diasEntre(c.fecha, hoy);
        return { venta: v, cuota: { ...c, monto: enPesos(c.monto, v), montoOriginal: c.monto }, dias, tramo: TRAMOS.find(t => dias <= t.hasta).id };
      }))
    .sort((a, b) => b.dias - a.dias);
