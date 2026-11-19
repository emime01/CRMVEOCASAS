// Monedas de las ventas: pesos uruguayos (UYU, la mayoría) o dólares (USD).
// Cada venta en dólares guarda el tipo de cambio del día de la venta (tipo_cambio), para sumarla en pesos en los
// totales y objetivos. Las listas de cobro y las facturas muestran siempre la moneda original.
export const MONEDAS = [{ id: "UYU", label: "Pesos ($)" }, { id: "USD", label: "Dólares (US$)" }];
export const TIPO_CAMBIO_DEFECTO = 40;

const num = n => new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
export const fmtMoneda = (n, moneda = "UYU") => `${moneda === "USD" ? "US$" : "$"} ${num(n)}`;

export const esUSD = v => v?.moneda === "USD";
// Importe de una venta (o de una parte de ella) llevado a pesos
export const enPesos = (monto, v) => esUSD(v) ? Math.round((monto || 0) * (Number(v.tipo_cambio) || TIPO_CAMBIO_DEFECTO)) : (monto || 0);

// Suma por moneda: {UYU: n, USD: n}; para mostrar "$ 1.000 + US$ 200"
export const sumarPorMoneda = (items, monto = x => x.monto, moneda = x => x.moneda) => {
  const t = { UYU: 0, USD: 0 };
  for (const x of items) t[moneda(x) === "USD" ? "USD" : "UYU"] += monto(x) || 0;
  return t;
};
export const fmtTotales = t => [t.UYU || !t.USD ? fmtMoneda(t.UYU, "UYU") : null, t.USD ? fmtMoneda(t.USD, "USD") : null].filter(Boolean).join(" + ");
