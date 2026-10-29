// Cuotas de una venta: único cálculo para Facturación, Cobros, Clientes, el detalle de la venta y los dashboards.
//
// La fuente es venta.cuotas_detalle ({numero, fecha, monto, pagada, gestionado, nro_factura}), que guarda el
// formulario de venta y actualizan Facturación y Cobros. Las ventas viejas sin detalle se completan igual que
// las arma el formulario. Las fechas se manejan como texto AAAA-MM-DD sin pasar por Date: en hora de Uruguay,
// new Date("2026-03-01") es el 28 de febrero, y una cuota del día 1 caía en el mes anterior.

const pad = n => String(n).padStart(2, "0");

// Suma meses a una fecha AAAA-MM-DD. Si el día no existe en el mes destino, usa el último (31/01 + 1 → 28/02).
export const sumarMeses = (iso, n) => {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  const anio = Math.floor(total / 12), mes = total % 12 + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${pad(mes)}-${pad(Math.min(d, ultimo))}`;
};

export const mesDe = iso => (iso || "").slice(0, 7); // "2026-03"
export const mesClave = (mes, anio) => `${anio}-${pad(mes)}`;
export const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const mesActual = () => mesDe(hoyISO());

export const numCuotas = venta => parseInt(venta.num_cuotas) || 1; // el formulario guarda 1 en las ventas al contado
export const enCuotas = venta => numCuotas(venta) > 1;

// Todas las cuotas de una venta en cuotas (una venta al contado no tiene cuotas).
export const cuotasDe = venta => {
  const nc = numCuotas(venta);
  if (nc <= 1) return [];
  const detalle = venta.cuotas_detalle || [];
  const montoBase = Math.round((venta.total || 0) / nc);
  return Array.from({ length: nc }, (_, i) => {
    const d = detalle[i] || {};
    return {
      numero: i + 1,
      fecha: d.fecha || sumarMeses(venta.fecha_inicio, i),
      monto: d.monto || montoBase,
      // cuotas_pagadas es el contador de las primeras ventas, antes de que existiera el detalle por cuota
      pagada: d.pagada ?? i < (venta.cuotas_pagadas || 0),
      gestionado: Boolean(d.gestionado),
      nro_factura: d.nro_factura || "",
      fecha_pago: d.fecha_pago || "",
    };
  });
};

// Detalle completo con un cambio en una cuota (índice desde 0), listo para guardar en cuotas_detalle.
export const conCambioEnCuota = (venta, idx, cambios) =>
  cuotasDe(venta).map((c, i) => (i === idx ? { ...c, ...cambios } : c));

export const cuotasDelMes = (venta, ym) => cuotasDe(venta).filter(c => mesDe(c.fecha) === ym);

// Arma cuotas_detalle al guardar el formulario de venta. Las cuotas ya pagadas, gestionadas o facturadas
// conservan su fecha y monto; el resto se recalcula con la fecha de inicio y el total nuevos.
export const armarDetalle = (venta, total, nc) => {
  if (nc <= 1) return [];
  const previas = venta.cuotas_detalle || [];
  const montoCuota = Math.round(total / nc);
  return Array.from({ length: nc }, (_, i) => {
    const prev = previas[i] || {};
    const fija = prev.pagada || prev.gestionado || prev.nro_factura;
    return {
      numero: i + 1,
      fecha: (fija && prev.fecha) || sumarMeses(venta.fecha_inicio, i) || prev.fecha || "",
      monto: fija ? prev.monto || montoCuota : montoCuota,
      pagada: prev.pagada || false,
      gestionado: prev.gestionado || false,
      nro_factura: prev.nro_factura || "",
      fecha_pago: prev.fecha_pago || "",
    };
  });
};
