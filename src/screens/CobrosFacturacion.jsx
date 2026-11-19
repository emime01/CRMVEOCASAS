import { useMemo, useState } from "react";
import { C, USERS } from "../constants";
import { Card, Btn, Badge, Stat, EmptyState, inp } from "../components/UI";
import { hoyISO, mesActual, mesDe } from "../cuotas";
import { todosLosPagos, estadoPago, ESTADOS_PAGO, cambiosDePago } from "../cobros";
import { fmtMoneda, fmtTotales, sumarPorMoneda } from "../moneda";

// Cobros y facturación: una sola lista con todo lo que hay que cobrar (cuotas y ventas al contado).
// Administración carga el número de factura y marca lo cobrado; la gerencia consulta; cada vendedor ve sus
// cobros y avisa cuando un cliente le dice que ya pagó (administración lo confirma).
const getUser = id => USERS.find(u => u.id === id);
const VENDEDORES = USERS.filter(u => ["vendedor", "gerente", "inactivo"].includes(u.role));
const MEDIOS = ["Transferencia", "Link de pago", "Depósito", "Cheque", "Efectivo"];
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = ym => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const POR_PAGINA = 80;

export default function CobrosFacturacion({ sales, currentUser, onUpdateSale }) {
  const esAdmin = currentUser.role === "admin";
  const esVendedor = currentUser.role === "vendedor";
  const hoy = hoyISO();
  const [mes, setMes] = useState(mesActual());
  const [estado, setEstado] = useState("pendientes");
  const [vendedor, setVendedor] = useState("todos");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(new Set());
  const [pagina, setPagina] = useState(1);
  const [guardando, setGuardando] = useState(null);

  const propias = esVendedor ? sales.filter(v => v.ejecutivo === currentUser.id) : sales;
  const pagos = useMemo(() => todosLosPagos(propias), [propias]);
  const meses = [...new Set(pagos.map(p => mesDe(p.fecha)).filter(Boolean).concat(mesActual()))].sort().reverse();

  const delMes = pagos.filter(p => mesDe(p.fecha) === mesActual());
  const resumen = {
    paraCobrar: sumarPorMoneda(delMes.filter(p => p.pagada === false)),
    cobradoMes: sumarPorMoneda(pagos.filter(p => p.pagada && mesDe(p.fecha_pago || p.fecha) === mesActual())),
    vencido: pagos.filter(p => estadoPago(p, hoy) === "vencido"),
    porFacturar: pagos.filter(p => !p.facturada && p.pagada !== null && p.fecha && mesDe(p.fecha) <= mesActual()),
  };

  const lista = pagos.filter(p => {
    const e = estadoPago(p, hoy);
    if (estado === "pendientes" && !["vencido", "por_facturar", "facturado"].includes(e)) return false;
    if (estado === "vencidos" && e !== "vencido") return false;
    if (estado === "por_facturar" && p.facturada) return false;
    if (estado === "cobrados" && e !== "cobrado") return false;
    if (estado === "avisos" && !(p.gestionado && !p.pagada)) return false;
    if (estado === "sin_registrar" && e !== "sin_registrar") return false;
    if (mes !== "todos" && !(estado === "vencidos" || estado === "avisos") && mesDe(p.fecha) !== mes) return false;
    if (vendedor !== "todos" && p.venta.ejecutivo !== vendedor) return false;
    if (q && !norm(`${p.venta.inmobiliaria} ${p.venta.razon_social} ${p.venta.rut} ${p.nro_factura}`).includes(norm(q))) return false;
    return true;
  }).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.venta.inmobiliaria).localeCompare(String(b.venta.inmobiliaria)));
  const avisos = pagos.filter(p => p.gestionado && !p.pagada).length;

  const guardar = async (p, cambios) => {
    setGuardando(p.clave);
    await onUpdateSale(p.venta.id, cambiosDePago(p.venta, p, cambios));
    setGuardando(null);
  };
  // varias a la vez: se agrupan por venta para no pisar el detalle de cuotas
  const enGrupo = async cambios => {
    setGuardando("grupo");
    const elegidos = lista.filter(p => sel.has(p.clave));
    const porVenta = new Map();
    for (const p of elegidos) porVenta.set(p.venta.id, [...(porVenta.get(p.venta.id) || []), p]);
    for (const ps of porVenta.values()) {
      let v = ps[0].venta, cambiosVenta = {};
      for (const p of ps) { const c = cambiosDePago(v, p, cambios); cambiosVenta = { ...cambiosVenta, ...c }; v = { ...v, ...c }; }
      await onUpdateSale(v.id, cambiosVenta);
    }
    setSel(new Set()); setGuardando(null);
  };

  const exportar = async () => {
    try {
      const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");
      const filas = lista.map(p => ({
        Inmobiliaria: p.venta.inmobiliaria, "Razón social": p.venta.razon_social || "", RUT: p.venta.rut || "",
        Vendedor: getUser(p.venta.ejecutivo)?.name || "", Pago: p.contado ? "Contado" : `Cuota ${p.numero}/${p.venta.num_cuotas}`,
        Vence: p.fecha, Moneda: p.moneda, Monto: p.monto, "Nº factura": p.nro_factura || "", "Fecha factura": p.fecha_factura || "",
        Cobrado: p.pagada ? "Sí" : p.pagada === null ? "Sin registrar" : "No", "Fecha de cobro": p.fecha_pago || "", Medio: p.medio_pago || "",
        Estado: ESTADOS_PAGO[estadoPago(p, hoy)].label,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), "Cobros");
      XLSX.writeFile(wb, `cobros-${mes === "todos" ? "todos" : mes}.xlsx`);
    } catch (e) { alert("No se pudo exportar: " + e.message); }
  };

  const visibles = lista.slice(0, pagina * POR_PAGINA);
  const toggle = k => setSel(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const filtroBtn = (k, label) => <Btn key={k} size="sm" variant={estado === k ? "primary" : "outline"} onClick={() => { setEstado(k); setPagina(1); setSel(new Set()); }}>{label}</Btn>;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.black }}>{esVendedor ? "Mis cobros" : "Cobros y facturación"}</div>
          <div style={{ fontSize: 13, color: C.gray500, marginTop: 2 }}>
            {esVendedor ? "Las cuotas y pagos de tus ventas. Cuando un cliente te avise que pagó, marcalo: administración lo confirma."
              : "Cada cuota o pago al contado: se factura, se cobra y queda registrado."}
          </div>
        </div>
        {!esVendedor && <Btn onClick={exportar}>📊 Exportar Excel</Btn>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(180px,100%),1fr))", gap: 12, marginBottom: 16 }}>
        <Stat label={`Para cobrar en ${MESES[new Date().getMonth()]}`} value={fmtTotales(resumen.paraCobrar)} />
        <Stat label="Cobrado este mes" value={fmtTotales(resumen.cobradoMes)} color={C.green} />
        <Stat label="Vencido sin cobrar" value={fmtTotales(sumarPorMoneda(resumen.vencido))} sub={`${resumen.vencido.length} pago${resumen.vencido.length !== 1 ? "s" : ""}`} color={resumen.vencido.length ? C.red : undefined} />
        {!esVendedor && <Stat label="Por facturar (hasta este mes)" value={resumen.porFacturar.length} color={resumen.porFacturar.length ? C.amber : undefined} />}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {filtroBtn("pendientes", "Pendientes")}
        {filtroBtn("vencidos", `Vencidos (${resumen.vencido.length})`)}
        {!esVendedor && filtroBtn("por_facturar", "Por facturar")}
        {filtroBtn("cobrados", "Cobrados")}
        {!esVendedor && filtroBtn("avisos", `Avisos de vendedores (${avisos})`)}
        {!esVendedor && filtroBtn("sin_registrar", "Contado sin registrar")}
        {filtroBtn("todos", "Todos")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select value={mes} onChange={e => { setMes(e.target.value); setPagina(1); }} style={{ ...inp, width: "auto" }} disabled={estado === "vencidos" || estado === "avisos"}>
          <option value="todos">Todos los meses</option>
          {meses.map(m => <option key={m} value={m}>Vencen en {nombreMes(m)}</option>)}
        </select>
        {!esVendedor && (
          <select value={vendedor} onChange={e => { setVendedor(e.target.value); setPagina(1); }} style={{ ...inp, width: "auto" }}>
            <option value="todos">Todos los vendedores</option>
            {VENDEDORES.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <input value={q} onChange={e => { setQ(e.target.value); setPagina(1); }} placeholder="Buscar inmobiliaria, RUT o nº de factura" style={{ ...inp, flex: "1 1 200px" }} />
      </div>

      {esAdmin && sel.size > 0 && (
        <Card style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{sel.size} seleccionado{sel.size !== 1 ? "s" : ""}</span>
          <Btn size="sm" variant="success" disabled={guardando === "grupo"} onClick={() => enGrupo({ pagada: true, fecha_pago: hoy })}>Marcar cobrados hoy</Btn>
          <Btn size="sm" disabled={guardando === "grupo"} onClick={() => enGrupo({ facturada: true, fecha_factura: hoy })}>Marcar facturados</Btn>
          <Btn size="sm" onClick={() => setSel(new Set())}>Cancelar</Btn>
        </Card>
      )}

      <div style={{ fontSize: 12, color: C.gray500, marginBottom: 6 }}>{lista.length} pago{lista.length !== 1 ? "s" : ""} · {fmtTotales(sumarPorMoneda(lista))}</div>
      {!lista.length ? <EmptyState icon="✅" title="Nada para mostrar con estos filtros" /> : (
        <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.gray50, textAlign: "left" }}>
                {esAdmin && <th style={{ padding: "10px 12px", width: 30 }}>
                  <input type="checkbox" checked={visibles.length > 0 && visibles.every(p => sel.has(p.clave))}
                    onChange={e => setSel(e.target.checked ? new Set(visibles.map(p => p.clave)) : new Set())} />
                </th>}
                {["Inmobiliaria", "Pago", "Vence", "Monto", "Factura", "Cobro", "Estado"].map(h =>
                  <th key={h} style={{ padding: "10px 12px", fontSize: 11, color: C.gray500, fontWeight: 600, textTransform: "uppercase" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibles.map(p => {
                const e = estadoPago(p, hoy);
                const ocupado = guardando === p.clave;
                return (
                  <tr key={p.clave} style={{ borderTop: `1px solid ${C.gray100}`, background: e === "vencido" ? "#fff5f5" : undefined }}>
                    {esAdmin && <td style={{ padding: "8px 12px" }}><input type="checkbox" checked={sel.has(p.clave)} onChange={() => toggle(p.clave)} /></td>}
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ fontWeight: 600, color: C.black }}>{p.venta.inmobiliaria}</div>
                      <div style={{ fontSize: 11, color: C.gray500 }}>{[p.venta.razon_social, p.venta.rut && `RUT ${p.venta.rut}`, !esVendedor && getUser(p.venta.ejecutivo)?.name].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{p.contado ? "Contado" : `Cuota ${p.numero}/${p.venta.num_cuotas}`}</td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap", color: e === "vencido" ? C.red : C.gray700 }}>{p.fecha}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>{fmtMoneda(p.monto, p.moneda)}</td>
                    <td style={{ padding: "6px 12px" }}>
                      {esAdmin ? (
                        <input defaultValue={p.nro_factura || ""} placeholder="Nº" disabled={ocupado}
                          onBlur={ev => { const val = ev.target.value.trim(); if (val !== (p.nro_factura || "")) guardar(p, { nro_factura: val, facturada: Boolean(val), fecha_factura: val ? (p.fecha_factura || hoy) : "" }); }}
                          style={{ ...inp, width: 80, padding: "4px 8px" }} />
                      ) : <span style={{ color: p.nro_factura ? C.gray700 : C.gray400 }}>{p.nro_factura || (p.facturada ? "Sí" : "—")}</span>}
                      {p.fecha_factura && <div style={{ fontSize: 10, color: C.gray400 }}>{p.fecha_factura}</div>}
                    </td>
                    <td style={{ padding: "6px 12px", whiteSpace: "nowrap" }}>
                      {esAdmin ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input type="checkbox" checked={Boolean(p.pagada)} disabled={ocupado}
                            onChange={ev => guardar(p, { pagada: ev.target.checked, fecha_pago: ev.target.checked ? hoy : "", ...(ev.target.checked ? {} : { medio_pago: "" }) })}
                            style={{ width: 16, height: 16, accentColor: C.green }} />
                          {p.pagada && (
                            <select value={p.medio_pago || ""} disabled={ocupado} onChange={ev => guardar(p, { medio_pago: ev.target.value })} style={{ ...inp, width: "auto", padding: "3px 6px", fontSize: 11 }}>
                              <option value="">Medio…</option>{MEDIOS.map(m => <option key={m}>{m}</option>)}
                            </select>
                          )}
                        </div>
                      ) : esVendedor && !p.pagada && p.pagada !== null ? (
                        p.gestionado ? <span style={{ fontSize: 11, color: C.blue }}>Avisaste que pagó</span>
                          : <Btn size="sm" disabled={ocupado} onClick={() => guardar(p, { gestionado: true, gestionado_en: hoy })}>Avisar que pagó</Btn>
                      ) : null}
                      {p.fecha_pago && <div style={{ fontSize: 10, color: C.gray400 }}>{p.fecha_pago}</div>}
                      {!esVendedor && p.gestionado && !p.pagada && <div style={{ fontSize: 10, color: C.blue }}>El vendedor avisó que pagó</div>}
                    </td>
                    <td style={{ padding: "8px 12px" }}><Badge color={ESTADOS_PAGO[e].color}>{ESTADOS_PAGO[e].label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {visibles.length < lista.length && (
        <div style={{ textAlign: "center", marginTop: 12 }}><Btn size="sm" onClick={() => setPagina(p => p + 1)}>Ver más ({lista.length - visibles.length})</Btn></div>
      )}
    </div>
  );
}
