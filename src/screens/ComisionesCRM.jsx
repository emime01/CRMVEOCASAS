import { useMemo, useState } from "react";
import { C, CRMS } from "../constants";
import { Card, Btn, Badge, Stat, EmptyState, inp } from "../components/UI";
import { hoyISO, mesDe } from "../cuotas";
import { todosLosPagos, comisionCRM, cambiosDePago } from "../cobros";
import { fmtMoneda, fmtTotales, sumarPorMoneda } from "../moneda";

// Comisiones de los CRM: cuando el cliente es del CRM (Tera, Tokko, Casasweb…), se le paga un porcentaje (6% por
// defecto) de cada pago COBRADO: cuota por cuota, no de lo facturado. Como no hay una fecha fija de pago al CRM,
// lo pendiente se acumula hasta que administración lo marca como pagado.
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function ComisionesCRM({ sales, currentUser, onUpdateSale }) {
  const esAdmin = currentUser.role === "admin";
  const hoy = hoyISO();
  const [crm, setCrm] = useState("todos");
  const [estado, setEstado] = useState("pendientes");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(new Set());
  const [guardando, setGuardando] = useState(false);

  const conComision = useMemo(() => sales.filter(v => v.comision_crm), [sales]);
  const pagos = useMemo(() => todosLosPagos(conComision).filter(p => p.pagada).map(p => ({ ...p, comision: comisionCRM(p) })), [conComision]);
  // pagos de clientes del CRM que todavía no se cobraron: generan comisión cuando entren
  const aCobrar = useMemo(() => todosLosPagos(conComision).filter(p => p.pagada === false), [conComision]);

  const porCrm = CRMS.filter(c => c !== "SIN CRM").map(c => {
    const ps = pagos.filter(p => p.venta.crm === c);
    return {
      crm: c, clientes: new Set(conComision.filter(v => v.crm === c).map(v => v.inmobiliaria)).size,
      pendiente: sumarPorMoneda(ps.filter(p => !p.crm_pagado), p => p.comision),
      pagado: sumarPorMoneda(ps.filter(p => p.crm_pagado), p => p.comision),
      futuro: sumarPorMoneda(aCobrar.filter(p => p.venta.crm === c), p => Math.round(p.monto * (Number(p.venta.comision_crm_pct) || 6)) / 100),
    };
  }).filter(x => x.clientes);

  const lista = pagos.filter(p =>
    (crm === "todos" || p.venta.crm === crm) &&
    (estado === "todos" || (estado === "pendientes" ? !p.crm_pagado : p.crm_pagado)) &&
    (!q || norm(p.venta.inmobiliaria).includes(norm(q))))
    .sort((a, b) => String(a.venta.crm).localeCompare(String(b.venta.crm)) || String(a.fecha_pago).localeCompare(String(b.fecha_pago)));

  const marcar = async pagado => {
    setGuardando(true);
    const porVenta = new Map();
    for (const p of lista.filter(p => sel.has(p.clave))) porVenta.set(p.venta.id, [...(porVenta.get(p.venta.id) || []), p]);
    for (const ps of porVenta.values()) {
      let v = ps[0].venta, cambios = {};
      for (const p of ps) { const c = cambiosDePago(v, p, { crm_pagado: pagado, crm_pagado_fecha: pagado ? hoy : "" }); cambios = { ...cambios, ...c }; v = { ...v, ...c }; }
      await onUpdateSale(v.id, cambios);
    }
    setSel(new Set()); setGuardando(false);
  };

  const exportar = async () => {
    try {
      const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");
      const filas = lista.map(p => ({
        CRM: p.venta.crm, Inmobiliaria: p.venta.inmobiliaria, Pago: p.contado ? "Contado" : `Cuota ${p.numero}/${p.venta.num_cuotas}`,
        "Fecha de cobro": p.fecha_pago || p.fecha, Moneda: p.moneda, "Monto cobrado": p.monto, "%": Number(p.venta.comision_crm_pct) || 6,
        Comisión: p.comision, "Pagado al CRM": p.crm_pagado ? `Sí (${p.crm_pagado_fecha})` : "No",
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), "Comisiones CRM");
      XLSX.writeFile(wb, `comisiones-crm-${crm === "todos" ? "todos" : crm}-${hoy}.xlsx`);
    } catch (e) { alert("No se pudo exportar: " + e.message); }
  };

  const toggle = k => setSel(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.black }}>Comisiones CRM</div>
          <div style={{ fontSize: 13, color: C.gray500, marginTop: 2, maxWidth: 720 }}>
            Cuando el cliente es de un CRM, se le paga un porcentaje de cada pago cobrado. Lo pendiente se acumula hasta que se le paga al CRM.
            Qué ventas pagan comisión se marca en la venta.
          </div>
        </div>
        <Btn onClick={exportar}>📊 Exportar Excel</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(230px,100%),1fr))", gap: 12, marginBottom: 18 }}>
        {porCrm.map(x => (
          <Card key={x.crm} onClick={() => setCrm(x.crm === crm ? "todos" : x.crm)} style={{ cursor: "pointer", outline: crm === x.crm ? `2px solid ${C.red}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>{x.crm}</strong><span style={{ fontSize: 11, color: C.gray500 }}>{x.clientes} cliente{x.clientes !== 1 ? "s" : ""}</span>
            </div>
            <div style={{ fontSize: 12, color: C.gray600, marginTop: 8, lineHeight: 1.7 }}>
              <div>A pagar: <strong style={{ color: C.red }}>{fmtTotales(x.pendiente)}</strong></div>
              <div>Ya pagado: {fmtTotales(x.pagado)}</div>
              <div style={{ color: C.gray400 }}>Cuando se cobre lo pendiente: {fmtTotales(x.futuro)}</div>
            </div>
          </Card>
        ))}
        {!porCrm.length && <EmptyState icon="🤝" title="Todavía no hay ventas marcadas con comisión de CRM" desc="Se marca en cada venta: “El cliente es del CRM”." />}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select value={estado} onChange={e => { setEstado(e.target.value); setSel(new Set()); }} style={{ ...inp, width: "auto" }}>
          <option value="pendientes">A pagar al CRM</option><option value="pagadas">Ya pagadas</option><option value="todos">Todas</option>
        </select>
        <select value={crm} onChange={e => setCrm(e.target.value)} style={{ ...inp, width: "auto" }}>
          <option value="todos">Todos los CRM</option>{porCrm.map(x => <option key={x.crm}>{x.crm}</option>)}
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar inmobiliaria" style={{ ...inp, flex: "1 1 200px" }} />
      </div>

      {esAdmin && sel.size > 0 && (
        <Card style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{sel.size} seleccionada{sel.size !== 1 ? "s" : ""} · {fmtTotales(sumarPorMoneda(lista.filter(p => sel.has(p.clave)), p => p.comision))}</span>
          {estado !== "pagadas" && <Btn size="sm" variant="success" disabled={guardando} onClick={() => marcar(true)}>Marcar pagadas al CRM hoy</Btn>}
          {estado !== "pendientes" && <Btn size="sm" disabled={guardando} onClick={() => marcar(false)}>Volver a pendiente</Btn>}
          <Btn size="sm" onClick={() => setSel(new Set())}>Cancelar</Btn>
        </Card>
      )}

      <div style={{ fontSize: 12, color: C.gray500, marginBottom: 6 }}>{lista.length} pago{lista.length !== 1 ? "s" : ""} cobrado{lista.length !== 1 ? "s" : ""} · comisión {fmtTotales(sumarPorMoneda(lista, p => p.comision))}</div>
      {!lista.length ? <EmptyState icon="✅" title="Nada con estos filtros" /> : (
        <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.gray50, textAlign: "left" }}>
                {esAdmin && <th style={{ padding: "10px 12px", width: 30 }}><input type="checkbox" checked={lista.length > 0 && lista.every(p => sel.has(p.clave))} onChange={e => setSel(e.target.checked ? new Set(lista.map(p => p.clave)) : new Set())} /></th>}
                {["CRM", "Inmobiliaria", "Pago", "Cobrado el", "Monto cobrado", "Comisión", "Al CRM"].map(h =>
                  <th key={h} style={{ padding: "10px 12px", fontSize: 11, color: C.gray500, fontWeight: 600, textTransform: "uppercase" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {lista.map(p => (
                <tr key={p.clave} style={{ borderTop: `1px solid ${C.gray100}` }}>
                  {esAdmin && <td style={{ padding: "8px 12px" }}><input type="checkbox" checked={sel.has(p.clave)} onChange={() => toggle(p.clave)} /></td>}
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>{p.venta.crm}</td>
                  <td style={{ padding: "8px 12px" }}>{p.venta.inmobiliaria}</td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{p.contado ? "Contado" : `Cuota ${p.numero}/${p.venta.num_cuotas}`}</td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{p.fecha_pago || <span style={{ color: C.gray400 }}>{mesDe(p.fecha)}</span>}</td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{fmtMoneda(p.monto, p.moneda)}</td>
                  <td style={{ padding: "8px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>{fmtMoneda(p.comision, p.moneda)} <span style={{ fontSize: 11, color: C.gray400, fontWeight: 400 }}>{Number(p.venta.comision_crm_pct) || 6}%</span></td>
                  <td style={{ padding: "8px 12px" }}>{p.crm_pagado ? <Badge color="green">Pagada {p.crm_pagado_fecha}</Badge> : <Badge color="amber">A pagar</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
