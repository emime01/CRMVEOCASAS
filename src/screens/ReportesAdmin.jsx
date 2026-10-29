import { useMemo, useState } from "react";
import { C, fmt, USERS } from "../constants";
import { Card, Btn, Stat, Table, BarChart, EmptyState, inp } from "../components/UI";
import { mesActual } from "../cuotas";
import { resumenMensual, cuentasPorCobrar, pagosDe, TRAMOS } from "../reportes";

// Reportes para administración y el contador: ingreso por mes, cobranza y cuentas por cobrar, con exportación a Excel.
const getUser = id => USERS.find(u => u.id === id);
const VENDEDORES = USERS.filter(u => ["vendedor", "gerente", "inactivo"].includes(u.role));
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const nombreMes = ym => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export default function ReportesAdmin({ sales }) {
  const hoyAnio = new Date().getFullYear();
  const [anio, setAnio] = useState(hoyAnio);
  const [vendedor, setVendedor] = useState("todos");
  const [exportando, setExportando] = useState(false);

  const ventas = useMemo(() => sales.filter(v => vendedor === "todos" || v.ejecutivo === vendedor), [sales, vendedor]);
  const { meses, sinFechas } = useMemo(() => resumenMensual(ventas, anio), [ventas, anio]);
  const deudas = useMemo(() => cuentasPorCobrar(ventas), [ventas]);
  const anios = [...new Set(sales.map(v => Number((v.fecha_inicio || "").slice(0, 4))).filter(Boolean).concat(hoyAnio))].sort();

  const esteMes = meses.find(m => m.mes === mesActual());
  const totalAnio = k => meses.reduce((a, m) => a + m[k], 0);
  const porTramo = TRAMOS.map(t => ({ ...t, monto: deudas.filter(d => d.tramo === t.id).reduce((a, d) => a + d.cuota.monto, 0) }));
  const totalDeuda = porTramo.reduce((a, t) => a + t.monto, 0);

  // deuda agrupada por venta: una fila por cliente/venta con sus cuotas vencidas
  const porVenta = [...deudas.reduce((m, d) => {
    const x = m.get(d.venta.id) || { venta: d.venta, cuotas: 0, monto: 0, dias: 0 };
    x.cuotas++; x.monto += d.cuota.monto; x.dias = Math.max(x.dias, d.dias);
    return m.set(d.venta.id, x);
  }, new Map()).values()].sort((a, b) => b.dias - a.dias);

  const exportar = async () => {
    setExportando(true);
    try {
      const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");
      const wb = XLSX.utils.book_new();
      const hoja = (filas, nombre) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), nombre);
      hoja(meses.map(m => ({
        Mes: nombreMes(m.mes), "Ingreso devengado (sin IVA)": m.devengado, "A cobrar (con IVA)": m.aCobrar,
        "Cobrado (cuotas)": m.cobrado, "Pendiente (cuotas)": m.pendiente, "Contado sin registrar": m.contado, Facturado: m.facturado,
      })), `Mensual ${anio}`);
      hoja(deudas.map(d => ({
        Inmobiliaria: d.venta.inmobiliaria, "Razón social": d.venta.razon_social || "", RUT: d.venta.rut || "",
        Vendedor: getUser(d.venta.ejecutivo)?.name || d.venta.ejecutivo || "", Cuota: d.cuota.contado ? "Contado" : `${d.cuota.numero}/${d.venta.num_cuotas}`,
        Vencimiento: d.cuota.fecha, "Días de atraso": d.dias, Monto: d.cuota.monto, "Nº factura": d.cuota.nro_factura,
      })), "Cuentas por cobrar");
      hoja(ventas.filter(v => v.estado !== "cancelada").flatMap(v => pagosDe(v)
        .filter(p => p.fecha.startsWith(String(anio)))
        .map(p => ({
          Inmobiliaria: v.inmobiliaria, RUT: v.rut || "", Vendedor: getUser(v.ejecutivo)?.name || v.ejecutivo || "",
          Tipo: p.contado ? "Contado" : `Cuota ${p.numero}/${v.num_cuotas}`, Vencimiento: p.fecha, Monto: p.monto,
          "Nº factura": p.nro_factura || "", Facturada: p.facturada ? "Sí" : "No",
          Cobrada: p.pagada === null ? "Sin registrar" : p.pagada ? "Sí" : "No", "Fecha de cobro": p.fecha_pago || "",
        }))), `Cobros ${anio}`);
      hoja(ventas.map(v => ({
        Inmobiliaria: v.inmobiliaria, "Razón social": v.razon_social || "", RUT: v.rut || "",
        Vendedor: getUser(v.ejecutivo)?.name || v.ejecutivo || "", Plan: v.plan || "", Inicio: v.fecha_inicio || "", Fin: v.fecha_fin || "",
        "Subtotal sin IVA": v.subtotal || Math.round((v.total || 0) / 1.22), IVA: (v.total || 0) - (v.subtotal || Math.round((v.total || 0) / 1.22)), Total: v.total || 0,
        "Forma de pago": v.metodo_pago || "", Estado: v.estado || "activa",
      })), "Ventas");
      XLSX.writeFile(wb, `administracion-veocasas-${anio}.xlsx`);
    } catch (e) { alert("No se pudo exportar: " + e.message); }
    setExportando(false);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ ...inp, width: "auto" }}>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={vendedor} onChange={e => setVendedor(e.target.value)} style={{ ...inp, width: "auto" }}>
          <option value="todos">Todos los vendedores</option>
          {VENDEDORES.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <Btn variant="primary" disabled={exportando} onClick={exportar}>{exportando ? "Exportando…" : "📊 Excel para el contador"}</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(170px,100%),1fr))", gap: 12, marginBottom: 20 }}>
        <Stat label="Ingreso del mes (sin IVA)" value={fmt(esteMes?.devengado)} sub="devengado: ventas repartidas por mes" />
        <Stat label={`Ingreso ${anio} (sin IVA)`} value={fmt(totalAnio("devengado"))} />
        <Stat label="Vencido sin cobrar" value={fmt(totalDeuda)} sub={`${deudas.length} pago${deudas.length !== 1 ? "s" : ""}`} color={totalDeuda ? C.red : C.green} />
        <Stat label="Más de 90 días" value={fmt(porTramo[3].monto)} color={porTramo[3].monto ? C.red : undefined} />
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: C.gray700, marginBottom: 14 }}>Ingreso devengado por mes, sin IVA — {anio}</div>
        <BarChart data={meses.map(m => ({ label: MESES[Number(m.mes.slice(5)) - 1], value: m.devengado, highlight: m.mes === mesActual() }))} height={110} />
      </Card>

      <div style={{ fontWeight: 700, fontSize: 14, color: C.black, marginBottom: 6 }}>Mes a mes</div>
      <div style={{ fontSize: 12, color: C.gray500, marginBottom: 10 }}>
        Cuotas por mes de vencimiento, con IVA. Las ventas al contado cuentan en su mes de inicio; las viejas que todavía no tienen marcado si se cobraron van en “Contado sin registrar” (se marcan en Facturación → Contado).
        {sinFechas > 0 && <span style={{ color: C.amber }}> {sinFechas} venta{sinFechas !== 1 ? "s" : ""} sin fecha de inicio o fin no entran en el ingreso.</span>}
      </div>
      <div style={{ marginBottom: 24 }}>
        <Table
          cols={[
            { key: "mes", label: "Mes" }, { key: "dev", label: "Ingreso s/IVA" }, { key: "ac", label: "A cobrar" },
            { key: "co", label: "Cobrado" }, { key: "pe", label: "Pendiente" }, { key: "ct", label: "Contado sin registrar" }, { key: "fa", label: "Facturado" },
          ]}
          rows={[...meses, { mes: "total", devengado: totalAnio("devengado"), aCobrar: totalAnio("aCobrar"), cobrado: totalAnio("cobrado"), pendiente: totalAnio("pendiente"), contado: totalAnio("contado"), facturado: totalAnio("facturado") }]
            .map(m => {
              const tot = m.mes === "total", b = x => tot ? <strong>{x}</strong> : x;
              return {
                mes: b(tot ? "Total" : nombreMes(m.mes)), dev: b(fmt(m.devengado)), ac: b(fmt(m.aCobrar)),
                co: <span style={{ color: C.green, fontWeight: tot ? 700 : 400 }}>{fmt(m.cobrado)}</span>,
                pe: <span style={{ color: m.pendiente && m.mes < mesActual() ? C.red : C.gray700, fontWeight: tot ? 700 : 400 }}>{fmt(m.pendiente)}</span>,
                ct: b(fmt(m.contado)), fa: b(fmt(m.facturado)),
              };
            })}
        />
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, color: C.black, marginBottom: 10 }}>Cuentas por cobrar</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(150px,100%),1fr))", gap: 12, marginBottom: 12 }}>
        {porTramo.map(t => <Stat key={t.id} label={t.label} value={fmt(t.monto)} color={t.monto && t.hasta > 60 ? C.red : undefined} />)}
      </div>
      {!porVenta.length ? <EmptyState icon="✅" title="No hay cuotas vencidas sin cobrar" />
        : (
          <Table
            cols={[{ key: "i", label: "Inmobiliaria" }, { key: "v", label: "Vendedor" }, { key: "c", label: "Pagos vencidos" }, { key: "m", label: "Monto" }, { key: "d", label: "Atraso" }]}
            rows={porVenta.map(x => ({
              i: <span style={{ fontWeight: 600 }}>{x.venta.inmobiliaria}</span>,
              v: getUser(x.venta.ejecutivo)?.name || x.venta.ejecutivo || "—",
              c: x.cuotas,
              m: <span style={{ fontWeight: 700, color: C.red }}>{fmt(x.monto)}</span>,
              d: <span style={{ color: x.dias > 60 ? C.red : C.gray700 }}>{x.dias} días</span>,
            }))}
          />
        )}
    </div>
  );
}
