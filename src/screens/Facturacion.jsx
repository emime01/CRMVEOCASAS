import { useState } from "react";
import { C, fmt, daysUntil, USERS } from "../constants";
import { Stat, Card, Btn, Badge, Field, inp, Modal, ModalHeader, ModalBody, ModalFooter, EmptyState } from "../components/UI";

const getUser = id => USERS.find(u => u.id === id);

export default function Facturacion({ sales, invoices, onUpdateInvoice, onAddInvoice, onUpdateSale, isGerente }) {
  const [tabMain, setTabMain] = useState("cuotas");
  const [filterEjecutivo, setFilterEjecutivo] = useState("todos");
  const [filterEstado, setFilterEstado] = useState("todas");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ folio:"", client:"", amount:0, date:"", status:"pendiente", vencimiento:"" });
  const [saving, setSaving] = useState(null); // id de la cuota que se está guardando

  const now = new Date();
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();

  // ── Ventas con cuotas ──────────────────────────────────
  const ventasConCuotas = sales
    .filter(s => s.estado !== "cancelada" && (s.num_cuotas || 1) > 1)
    .filter(s => filterEjecutivo === "todos" || s.ejecutivo === filterEjecutivo);

  const ventasContado = sales
    .filter(s => s.estado !== "cancelada" && (s.num_cuotas || 1) === 1)
    .filter(s => filterEjecutivo === "todos" || s.ejecutivo === filterEjecutivo)
    .filter(s => filterEstado === "todas" || (filterEstado === "facturado" ? s.facturado : !s.facturado));

  // Cuotas del mes actual (para alerta)
  const cuotasMesActual = [];
  ventasConCuotas.forEach(s => {
    (s.cuotas_detalle || []).forEach(c => {
      if (c.fecha && c.fecha.slice(0, 7) === `${anio}-${String(mes).padStart(2, "0")}`) {
        cuotasMesActual.push({ ...c, venta: s });
      }
    });
  });

  const pendientesCobro = cuotasMesActual.filter(c => !c.pagada).length;
  const totalPendiente = sales.filter(s => !s.facturado && s.estado !== "cancelada").reduce((a, s) => a + (s.total || 0), 0);

  // Build default cuotas_detalle for a sale (fallback for legacy data)
  const buildDefaultCuotas = (venta) => {
    const nc = parseInt(venta.num_cuotas) || 1;
    return Array.from({ length: nc }, (_, i) => {
      let fecha = "";
      if (venta.fecha_inicio) {
        const f = new Date(venta.fecha_inicio);
        f.setMonth(f.getMonth() + i);
        fecha = f.toISOString().split("T")[0];
      }
      return {
        numero: i + 1, fecha,
        monto: Math.round((venta.total || 0) / nc),
        pagada: false, gestionado: false, nro_factura: "",
      };
    });
  };

  // ── Guardar cambio en cuota ────────────────────────────
  const updateCuota = async (ventaId, cuotaIdx, changes) => {
    setSaving(`${ventaId}_${cuotaIdx}`);
    const venta = sales.find(s => s.id === ventaId);
    if (!venta) { setSaving(null); return; }
    const base = venta.cuotas_detalle?.length ? venta.cuotas_detalle : buildDefaultCuotas(venta);
    const nuevasCuotas = base.map((c, i) =>
      i === cuotaIdx ? { ...c, ...changes } : c
    );
    await onUpdateSale(ventaId, { cuotas_detalle: nuevasCuotas });
    setSaving(null);
  };

  const vendedoresEnVentas = [...new Set(sales.map(s => s.ejecutivo))].map(id => getUser(id)).filter(Boolean);

  const mainTabs = [
    { id: "cuotas", label: `Cuotas (${ventasConCuotas.length} contratos)` },
    { id: "contado", label: `Contado (${ventasContado.length})` },
    { id: "resumen_mes", label: `Este mes (${cuotasMesActual.length})` },
    { id: "facturas", label: "Facturas emitidas" },
  ];

  // ── Export ─────────────────────────────────────────────
  const exportExcel = async () => {
    try {
      const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");
      const rows = [];
      ventasConCuotas.forEach(s => {
        (s.cuotas_detalle || []).forEach(c => {
          rows.push({
            Inmobiliaria: s.inmobiliaria,
            Ejecutivo: getUser(s.ejecutivo)?.name,
            "Total venta": s.total,
            "Cuota #": c.numero,
            "Fecha cuota": c.fecha,
            "Monto cuota": c.monto,
            "Nº Factura": c.nro_factura || "",
            Pagada: c.pagada ? "Sí" : "No",
          });
        });
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cuotas");
      XLSX.writeFile(wb, "cuotas-veocasas.xlsx");
    } catch (e) { alert("Error: " + e.message); }
  };

  const exportPDF = async () => {
    try {
      if (!window.jspdf) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("Control de Cuotas — Veocasas", 14, 16);
      doc.setFontSize(9);
      doc.text(`Generado: ${now.toLocaleDateString("es-CL")}`, 14, 22);
      const rows = [];
      ventasConCuotas.forEach(s => {
        (s.cuotas_detalle || []).forEach(c => {
          rows.push([s.inmobiliaria, getUser(s.ejecutivo)?.name || "", `${c.numero}/${s.num_cuotas}`, c.fecha, fmt(c.monto), c.nro_factura || "—", c.pagada ? "✓" : "—"]);
        });
      });
      doc.autoTable({
        head: [["Inmobiliaria", "Ejecutivo", "Cuota", "Fecha", "Monto", "Nº Factura", "Pagada"]],
        body: rows,
        startY: 26,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [192, 0, 26] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
      });
      doc.save("cuotas-veocasas.pdf");
    } catch (e) { alert("Error al generar PDF: " + e.message); }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.black }}>Facturación y Cobros</div>
          <div style={{ fontSize: 12, color: C.gray400, marginTop: 2 }}>Control de cuotas y pagos</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn onClick={exportExcel}>📊 Excel</Btn>
          <Btn onClick={exportPDF}>📄 PDF</Btn>
          {!isGerente && <Btn variant="primary" onClick={() => setShowForm(true)}>+ Factura manual</Btn>}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(150px,100%),1fr))", gap: 12, marginBottom: 20 }}>
        <Stat label="Contratos en cuotas" value={ventasConCuotas.length} color={C.red} />
        <Stat label={`Cuotas este mes (${mes}/${anio})`} value={cuotasMesActual.length} sub={`${pendientesCobro} sin cobrar`} />
        <Stat label="Monto a cobrar este mes" value={fmt(cuotasMesActual.filter(c => !c.pagada).reduce((a, c) => a + (c.monto || 0), 0))} color={pendientesCobro > 0 ? C.amber : C.green} alert={pendientesCobro > 0} />
        <Stat label="Contado pendiente facturar" value={sales.filter(s => !s.facturado && s.estado !== "cancelada" && (s.num_cuotas || 1) === 1).length} color={C.amber} />
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterEjecutivo} onChange={e => setFilterEjecutivo(e.target.value)}
          style={{ ...inp, width: "auto", padding: "6px 12px", fontSize: 12 }}>
          <option value="todos">Todos los ejecutivos</option>
          {vendedoresEnVentas.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${C.gray200}`, marginBottom: 20, display: "flex", gap: 2, overflowX: "auto" }}>
        {mainTabs.map(t => (
          <button key={t.id} onClick={() => setTabMain(t.id)}
            style={{ padding: "10px 16px", border: "none", background: "none", fontSize: 13, fontWeight: tabMain === t.id ? 600 : 400, color: tabMain === t.id ? C.red : C.gray500, borderBottom: `2px solid ${tabMain === t.id ? C.red : "transparent"}`, cursor: "pointer", whiteSpace: "nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: CUOTAS ── */}
      {tabMain === "cuotas" && (
        <div>
          {ventasConCuotas.length === 0 && <EmptyState icon="📋" title="Sin contratos en cuotas" />}
          {ventasConCuotas.map(venta => {
            const cuotas = venta.cuotas_detalle?.length ? venta.cuotas_detalle : buildDefaultCuotas(venta);
            const pagadas = cuotas.filter(c => c.pagada).length;
            return (
              <div key={venta.id} style={{ marginBottom: 24 }}>
                {/* Header de la venta */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: C.gray900 }}>{venta.inmobiliaria}</span>
                    <Badge color="blue">{venta.num_cuotas} cuotas</Badge>
                    <Badge color={pagadas === venta.num_cuotas ? "green" : pagadas > 0 ? "amber" : "gray"}>
                      {pagadas}/{venta.num_cuotas} cobradas
                    </Badge>
                    <span style={{ fontSize: 11, color: C.gray400 }}>{getUser(venta.ejecutivo)?.name} · {venta.subtipo_cuotas}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: C.red, fontSize: 14 }}>{fmt(venta.total)}</span>
                </div>

                {/* Grilla de cuotas — estilo sheet */}
                <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.gray200}` }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.gray900 }}>
                        <th style={{ padding: "8px 14px", textAlign: "left", color: C.gray300, fontWeight: 500, fontSize: 11, whiteSpace: "nowrap" }}>Cuota</th>
                        <th style={{ padding: "8px 14px", textAlign: "left", color: C.gray300, fontWeight: 500, fontSize: 11 }}>Fecha</th>
                        <th style={{ padding: "8px 14px", textAlign: "right", color: C.gray300, fontWeight: 500, fontSize: 11 }}>Monto</th>
                        <th style={{ padding: "8px 14px", textAlign: "left", color: C.gray300, fontWeight: 500, fontSize: 11, minWidth: 130 }}>Nº Factura</th>
                        <th style={{ padding: "8px 14px", textAlign: "center", color: C.gray300, fontWeight: 500, fontSize: 11 }}>Pagada</th>
                        <th style={{ padding: "8px 14px", textAlign: "left", color: C.gray300, fontWeight: 500, fontSize: 11 }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuotas.map((c, idx) => {
                        const esMesActual = c.fecha && c.fecha.slice(0, 7) === `${anio}-${String(mes).padStart(2, "0")}`;
                        const esPasada = c.fecha && c.fecha < now.toISOString().split("T")[0];
                        const isSaving = saving === `${venta.id}_${idx}`;
                        return (
                          <tr key={idx}
                            style={{ borderBottom: `1px solid ${C.gray100}`, background: c.pagada ? "#f0fdf4" : esMesActual ? "#fffbeb" : "white" }}
                            onMouseEnter={e => e.currentTarget.style.background = c.pagada ? "#dcfce7" : esMesActual ? "#fef9c3" : C.gray50}
                            onMouseLeave={e => e.currentTarget.style.background = c.pagada ? "#f0fdf4" : esMesActual ? "#fffbeb" : "white"}>
                            <td style={{ padding: "8px 14px", fontWeight: 600, color: C.gray700 }}>#{c.numero}</td>
                            <td style={{ padding: "8px 14px", color: C.gray600, whiteSpace: "nowrap" }}>
                              {c.fecha}
                              {esMesActual && <span style={{ marginLeft: 6, fontSize: 10, background: C.amberLight, color: C.amber, padding: "1px 6px", borderRadius: 4, fontWeight: 500 }}>Este mes</span>}
                            </td>
                            <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 600, color: C.gray900 }}>{fmt(c.monto)}</td>
                            <td style={{ padding: "6px 10px" }}>
                              {isGerente ? (
                                <span style={{ color: c.nro_factura ? C.red : C.gray400, fontWeight: c.nro_factura ? 600 : 400 }}>
                                  {c.nro_factura || "—"}
                                </span>
                              ) : (
                                <input
                                  type="text"
                                  defaultValue={c.nro_factura || ""}
                                  placeholder="Ej: 335"
                                  style={{ ...inp, padding: "5px 8px", fontSize: 12, width: 110, color: C.red, fontWeight: 600 }}
                                  onBlur={e => {
                                    const val = e.target.value.trim();
                                    if (val !== (c.nro_factura || "")) {
                                      updateCuota(venta.id, idx, { nro_factura: val });
                                    }
                                  }}
                                />
                              )}
                            </td>
                            <td style={{ padding: "8px 14px", textAlign: "center" }}>
                              {isGerente ? (
                                <span style={{ fontSize: 16 }}>{c.pagada ? "✅" : "⬜"}</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={c.pagada || false}
                                  disabled={isSaving}
                                  onChange={e => updateCuota(venta.id, idx, { pagada: e.target.checked })}
                                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.green }}
                                />
                              )}
                            </td>
                            <td style={{ padding: "8px 14px" }}>
                              {c.pagada
                                ? <Badge color="green">Cobrada</Badge>
                                : esPasada && !esMesActual
                                  ? <Badge color="red">Vencida</Badge>
                                  : esMesActual
                                    ? <Badge color="amber">Pendiente</Badge>
                                    : <Badge color="gray">Futura</Badge>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: C.gray50, borderTop: `2px solid ${C.gray200}` }}>
                        <td colSpan={2} style={{ padding: "8px 14px", fontWeight: 600, fontSize: 12, color: C.gray600 }}>Total</td>
                        <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700, color: C.gray900 }}>{fmt(venta.total)}</td>
                        <td colSpan={3} style={{ padding: "8px 14px", fontSize: 11, color: C.gray400 }}>
                          Cobrado: <strong style={{ color: C.green }}>{fmt(cuotas.filter(c => c.pagada).reduce((a, c) => a + c.monto, 0))}</strong>
                          {" · "}Pendiente: <strong style={{ color: C.amber }}>{fmt(cuotas.filter(c => !c.pagada).reduce((a, c) => a + c.monto, 0))}</strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: CONTADO ── */}
      {tabMain === "contado" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {[{ k: "todas", l: "Todas" }, { k: "pendiente", l: "Pendiente facturar" }, { k: "facturado", l: "Facturadas" }].map(f => (
              <button key={f.k} onClick={() => setFilterEstado(f.k)}
                style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${filterEstado === f.k ? C.red : C.gray200}`, background: filterEstado === f.k ? C.redLight : C.white, color: filterEstado === f.k ? C.red : C.gray600, fontSize: 12, cursor: "pointer" }}>
                {f.l}
              </button>
            ))}
          </div>
          <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.gray200}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.gray900 }}>
                  {["Inmobiliaria", "Ejecutivo", "Método pago", "Total", "Nº Factura", "Facturado", isGerente ? "" : "Acción"].map((h, i) => (
                    <th key={i} style={{ padding: "10px 14px", textAlign: "left", color: C.gray300, fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ventasContado.map(s => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.gray100}` }}
                    onMouseEnter={e => e.currentTarget.style.background = C.gray50}
                    onMouseLeave={e => e.currentTarget.style.background = "white"}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: C.gray900 }}>{s.inmobiliaria}</td>
                    <td style={{ padding: "10px 14px", color: C.gray600 }}>{getUser(s.ejecutivo)?.name}</td>
                    <td style={{ padding: "10px 14px", color: C.gray600 }}>{s.subtipo_contado || s.metodo_pago}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: C.gray900 }}>{fmt(s.total)}</td>
                    <td style={{ padding: "10px 14px", color: C.red, fontWeight: 600 }}>{s.nro_factura || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <Badge color={s.facturado ? "green" : "amber"}>{s.facturado ? "Sí" : "Pendiente"}</Badge>
                    </td>
                    {!isGerente && (
                      <td style={{ padding: "8px 14px" }}>
                        <select value={s.facturado ? "si" : "no"}
                          onChange={e => onUpdateSale(s.id, { facturado: e.target.value === "si" })}
                          style={{ ...inp, width: "auto", padding: "4px 8px", fontSize: 11 }}>
                          <option value="no">Pendiente</option>
                          <option value="si">Facturado</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
                {!ventasContado.length && (
                  <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: C.gray400 }}>Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: ESTE MES ── */}
      {tabMain === "resumen_mes" && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: C.gray700, marginBottom: 16 }}>
            Cuotas de {mes}/{anio} — {cuotasMesActual.length} cuotas · {fmt(cuotasMesActual.reduce((a, c) => a + c.monto, 0))} total
          </div>
          {cuotasMesActual.length === 0 && <EmptyState icon="📅" title="Sin cuotas este mes" />}
          <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.gray200}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.gray900 }}>
                  {["Inmobiliaria", "Ejecutivo", "Cuota #", "Monto", "Nº Factura", "Pagada", "Estado"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.gray300, fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cuotasMesActual.map((c, i) => {
                  const idx = (c.venta.cuotas_detalle || []).findIndex(x => x.numero === c.numero);
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.gray100}`, background: c.pagada ? "#f0fdf4" : "white" }}
                      onMouseEnter={e => e.currentTarget.style.background = c.pagada ? "#dcfce7" : C.gray50}
                      onMouseLeave={e => e.currentTarget.style.background = c.pagada ? "#f0fdf4" : "white"}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{c.venta.inmobiliaria}</td>
                      <td style={{ padding: "10px 14px", color: C.gray600 }}>{getUser(c.venta.ejecutivo)?.name}</td>
                      <td style={{ padding: "10px 14px", color: C.gray600 }}>#{c.numero}/{c.venta.num_cuotas}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700 }}>{fmt(c.monto)}</td>
                      <td style={{ padding: "8px 10px" }}>
                        {isGerente ? (
                          <span style={{ color: c.nro_factura ? C.red : C.gray400, fontWeight: c.nro_factura ? 600 : 400 }}>{c.nro_factura || "—"}</span>
                        ) : (
                          <input type="text" defaultValue={c.nro_factura || ""} placeholder="Nº factura"
                            style={{ ...inp, padding: "5px 8px", fontSize: 12, width: 100, color: C.red, fontWeight: 600 }}
                            onBlur={e => { const val = e.target.value.trim(); if (val !== (c.nro_factura || "")) updateCuota(c.venta.id, idx, { nro_factura: val }); }} />
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        {isGerente ? (
                          <span>{c.pagada ? "✅" : "⬜"}</span>
                        ) : (
                          <input type="checkbox" checked={c.pagada || false}
                            onChange={e => updateCuota(c.venta.id, idx, { pagada: e.target.checked })}
                            style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.green }} />
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <Badge color={c.pagada ? "green" : "amber"}>{c.pagada ? "Cobrada" : "Pendiente"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: C.gray50, borderTop: `2px solid ${C.gray200}` }}>
                  <td colSpan={3} style={{ padding: "8px 14px", fontWeight: 600, fontSize: 12, color: C.gray600 }}>Total del mes</td>
                  <td style={{ padding: "8px 14px", fontWeight: 700 }}>{fmt(cuotasMesActual.reduce((a, c) => a + c.monto, 0))}</td>
                  <td colSpan={3} style={{ padding: "8px 14px", fontSize: 11, color: C.gray400 }}>
                    Cobrado: <strong style={{ color: C.green }}>{fmt(cuotasMesActual.filter(c => c.pagada).reduce((a, c) => a + c.monto, 0))}</strong>
                    {" · "}Pendiente: <strong style={{ color: C.amber }}>{fmt(cuotasMesActual.filter(c => !c.pagada).reduce((a, c) => a + c.monto, 0))}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: FACTURAS ── */}
      {tabMain === "facturas" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(160px,100%),1fr))", gap: 12, marginBottom: 16 }}>
            <Stat label="Emitidas" value={invoices.length} />
            <Stat label="Cobradas" value={invoices.filter(i => i.status === "pagada").length} color={C.green} />
            <Stat label="Total cobrado" value={fmt(invoices.filter(i => i.status === "pagada").reduce((a, i) => a + (i.amount || 0), 0))} color={C.green} />
          </div>
          <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.gray200}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.gray900 }}>
                  {["Folio", "Cliente", "Monto", "Fecha", "Vencimiento", "Estado", isGerente ? "" : "Acción"].map((h, i) => (
                    <th key={i} style={{ padding: "10px 14px", textAlign: "left", color: C.gray300, fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: `1px solid ${C.gray100}` }}
                    onMouseEnter={e => e.currentTarget.style.background = C.gray50}
                    onMouseLeave={e => e.currentTarget.style.background = "white"}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: C.red }}>{inv.folio}</td>
                    <td style={{ padding: "10px 14px" }}>{inv.client}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{fmt(inv.amount)}</td>
                    <td style={{ padding: "10px 14px", color: C.gray500 }}>{inv.date}</td>
                    <td style={{ padding: "10px 14px", color: daysUntil(inv.vencimiento) <= 7 ? C.red : daysUntil(inv.vencimiento) <= 30 ? C.amber : C.gray500 }}>
                      {inv.vencimiento || "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <Badge color={inv.status === "pagada" ? "green" : inv.status === "vencida" ? "red" : "amber"}>{inv.status}</Badge>
                    </td>
                    {!isGerente && (
                      <td style={{ padding: "8px 14px" }}>
                        <select value={inv.status} onChange={e => onUpdateInvoice(inv.id, { status: e.target.value })}
                          style={{ ...inp, width: "auto", padding: "4px 8px", fontSize: 11 }}>
                          <option value="pendiente">Pendiente</option>
                          <option value="pagada">Pagada</option>
                          <option value="vencida">Vencida</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
                {!invoices.length && <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: C.gray400 }}>Sin facturas</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nueva factura manual */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)} maxWidth={480}>
          <ModalHeader title="Nueva Factura Manual" onClose={() => setShowForm(false)} />
          <ModalBody>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(180px,100%),1fr))", gap: "10px 14px" }}>
              <Field label="Folio"><input value={form.folio} onChange={e => setForm(f => ({ ...f, folio: e.target.value }))} style={inp} placeholder="F-400" /></Field>
              <Field label="Cliente"><input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} style={inp} /></Field>
              <Field label="Monto">
                <input type="text" inputMode="numeric" value={form.amount || ""} onChange={e => { const v = e.target.value.replace(/\D/g, ""); setForm(f => ({ ...f, amount: v === "" ? 0 : parseInt(v) })); }} style={inp} placeholder="0" />
              </Field>
              <Field label="Estado">
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagada">Pagada</option>
                  <option value="vencida">Vencida</option>
                </select>
              </Field>
              <Field label="Fecha emisión"><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} /></Field>
              <Field label="Fecha vencimiento"><input type="date" value={form.vencimiento} onChange={e => setForm(f => ({ ...f, vencimiento: e.target.value }))} style={inp} /></Field>
            </div>
          </ModalBody>
          <ModalFooter>
            <Btn onClick={() => setShowForm(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={() => { onAddInvoice(form); setShowForm(false); setForm({ folio: "", client: "", amount: 0, date: "", status: "pendiente", vencimiento: "" }); }}>Guardar</Btn>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
