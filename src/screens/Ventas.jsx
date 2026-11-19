import { useMemo, useState } from "react";
import { C, USERS, CRMS, PLANES } from "../constants";
import { Card, Btn, Badge, Stat, EmptyState, inp } from "../components/UI";
import { cuotasDe, enCuotas, hoyISO } from "../cuotas";
import { fmtMoneda, enPesos, fmtTotales, sumarPorMoneda } from "../moneda";

// Ventas: una sola pantalla para todos. La gerencia ve todas y filtra; el vendedor ve las suyas.
// Un vendedor no edita una venta directo: pide el cambio y Mika (gerente comercial) lo aprueba o rechaza acá arriba.
const getUser = id => USERS.find(u => u.id === id);
const VENDEDORES = USERS.filter(u => ["vendedor", "gerente", "inactivo"].includes(u.role));
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const POR_PAGINA = 50;

const estadoVenta = v => v.estado === "cancelada" ? "cancelada" : v.fecha_fin && v.fecha_fin < hoyISO() ? "vencida" : "vigente";
const ESTADOS = { vigente: { label: "Vigente", color: "green" }, vencida: { label: "Vencida", color: "gray" }, cancelada: { label: "Cancelada", color: "gray" } };

export default function Ventas({ sales, currentUser, onOpen, onNueva, onPedirCambio, onAprobar, onRechazar }) {
  const esVendedor = currentUser.role === "vendedor";
  const esGerente = currentUser.role === "gerente";
  const [q, setQ] = useState("");
  const [vendedor, setVendedor] = useState("todos");
  const [estado, setEstado] = useState("vigente");
  const [anio, setAnio] = useState("todos");
  const [crm, setCrm] = useState("todos");
  const [plan, setPlan] = useState("todos");
  const [pagina, setPagina] = useState(1);

  const propias = esVendedor ? sales.filter(v => v.ejecutivo === currentUser.id) : sales;
  const anios = [...new Set(propias.map(v => (v.fecha_inicio || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  const lista = useMemo(() => propias.filter(v =>
    (estado === "todas" || estadoVenta(v) === estado) &&
    (vendedor === "todos" || v.ejecutivo === vendedor) &&
    (anio === "todos" || (v.fecha_inicio || "").startsWith(anio)) &&
    (crm === "todos" || v.crm === crm) &&
    (plan === "todos" || v.plan === plan) &&
    (!q || norm(`${v.inmobiliaria} ${v.razon_social} ${v.rut}`).includes(norm(q))))
    .sort((a, b) => String(b.fecha_inicio || "").localeCompare(String(a.fecha_inicio || ""))), [propias, estado, vendedor, anio, crm, plan, q]);

  const pendientes = sales.filter(v => v.solicitud_modificacion && !v.modificacion_aprobada);
  const validas = lista.filter(v => v.estado !== "cancelada");
  const totalPesos = validas.reduce((a, v) => a + enPesos(v.total, v), 0);
  const porMoneda = sumarPorMoneda(validas, v => v.total);

  const exportar = async () => {
    try {
      const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");
      const filas = lista.map(v => ({
        Inmobiliaria: v.inmobiliaria, "Razón social": v.razon_social || "", RUT: v.rut || "", Vendedor: getUser(v.ejecutivo)?.name || v.ejecutivo,
        Plan: v.plan, CRM: v.crm, "Comisión CRM": v.comision_crm ? `${v.comision_crm_pct || 6}%` : "", Inicio: v.fecha_inicio, Fin: v.fecha_fin,
        Moneda: v.moneda || "UYU", "Subtotal s/IVA": v.subtotal, "Total c/IVA": v.total, "Tipo de cambio": v.tipo_cambio || "",
        "Forma de pago": v.metodo_pago, Cuotas: v.num_cuotas || 1, "Cuotas cobradas": cuotasDe(v).filter(c => c.pagada).length, Estado: ESTADOS[estadoVenta(v)].label,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), "Ventas");
      XLSX.writeFile(wb, `ventas-${hoyISO()}.xlsx`);
    } catch (e) { alert("No se pudo exportar: " + e.message); }
  };

  const filtro = (valor, set, opciones, todas) => (
    <select value={valor} onChange={e => { set(e.target.value); setPagina(1); }} style={{ ...inp, width: "auto" }}>
      <option value="todos">{todas}</option>
      {opciones.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.black }}>{esVendedor ? "Mis ventas" : "Ventas"}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {!esVendedor && <Btn onClick={exportar}>📊 Exportar Excel</Btn>}
          {(esVendedor || esGerente) && <Btn variant="primary" onClick={onNueva}>+ Nueva venta</Btn>}
        </div>
      </div>

      {esGerente && pendientes.length > 0 && (
        <Card style={{ border: `1px solid ${C.amber}`, background: C.amberLight, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.black, marginBottom: 8 }}>Cambios para aprobar ({pendientes.length})</div>
          {pendientes.map(v => (
            <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 0", borderTop: `1px solid ${C.gray200}` }}>
              <div style={{ fontSize: 13 }}>
                <strong>{v.inmobiliaria}</strong> · {getUser(v.ejecutivo)?.name} · {fmtMoneda(v.total, v.moneda)}
                {v.solicitud_motivo && <div style={{ fontSize: 12, color: C.gray600 }}>“{v.solicitud_motivo}”</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn size="sm" onClick={() => onOpen(v)}>Ver</Btn>
                <Btn size="sm" variant="success" onClick={() => onAprobar(v.id)}>Aprobar</Btn>
                <Btn size="sm" variant="danger" onClick={() => onRechazar(v.id)}>Rechazar</Btn>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(170px,100%),1fr))", gap: 12, marginBottom: 16 }}>
        <Stat label="Ventas" value={validas.length} color={C.red} />
        <Stat label="Total" value={fmtTotales(porMoneda)} sub={porMoneda.USD ? `≈ ${fmtMoneda(totalPesos)} en pesos` : undefined} />
        <Stat label="Ticket promedio" value={validas.length ? fmtMoneda(totalPesos / validas.length) : "-"} sub="en pesos" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={q} onChange={e => { setQ(e.target.value); setPagina(1); }} placeholder="Buscar inmobiliaria, razón social o RUT" style={{ ...inp, flex: "1 1 200px" }} />
        <select value={estado} onChange={e => { setEstado(e.target.value); setPagina(1); }} style={{ ...inp, width: "auto" }}>
          <option value="vigente">Vigentes</option><option value="vencida">Vencidas</option><option value="cancelada">Canceladas</option><option value="todas">Todas</option>
        </select>
        {!esVendedor && filtro(vendedor, setVendedor, VENDEDORES.map(u => [u.id, u.name]), "Todos los vendedores")}
        {filtro(anio, setAnio, anios.map(a => [a, `Inicio en ${a}`]), "Cualquier año")}
        {filtro(crm, setCrm, CRMS.map(c => [c, c]), "Cualquier CRM")}
        {filtro(plan, setPlan, PLANES.map(p => [p, `Plan ${p}`]), "Cualquier plan")}
      </div>

      {!lista.length ? <EmptyState icon="📋" title="Sin ventas con estos filtros" /> : (
        <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.gray50, textAlign: "left" }}>
                {["Inmobiliaria", !esVendedor && "Vendedor", "Plan", "Período", "Total", "Pago", "Estado", esVendedor && ""].filter(h => h !== false).map((h, i) =>
                  <th key={i} style={{ padding: "10px 12px", fontSize: 11, color: C.gray500, fontWeight: 600, textTransform: "uppercase" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, pagina * POR_PAGINA).map(v => {
                const e = estadoVenta(v);
                const cuotas = cuotasDe(v);
                const pendiente = v.solicitud_modificacion && !v.modificacion_aprobada;
                return (
                  <tr key={v.id} onClick={() => onOpen(v)} style={{ borderTop: `1px solid ${C.gray100}`, cursor: "pointer", opacity: e === "cancelada" ? 0.6 : 1 }}
                    onMouseEnter={ev => ev.currentTarget.style.background = C.gray50} onMouseLeave={ev => ev.currentTarget.style.background = ""}>
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ fontWeight: 600, color: C.black }}>{v.inmobiliaria}</div>
                      <div style={{ fontSize: 11, color: C.gray500 }}>{v.crm}{v.comision_crm ? ` · comisión ${v.comision_crm_pct || 6}%` : ""}</div>
                    </td>
                    {!esVendedor && <td style={{ padding: "8px 12px" }}>{getUser(v.ejecutivo)?.name || v.ejecutivo}</td>}
                    <td style={{ padding: "8px 12px" }}>{v.plan}</td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: C.gray600, whiteSpace: "nowrap" }}>{v.fecha_inicio} → {v.fecha_fin}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>{fmtMoneda(v.total, v.moneda)}</td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: C.gray600 }}>
                      {enCuotas(v) ? `${cuotas.filter(c => c.pagada).length}/${cuotas.length} cuotas cobradas` : v.cobrado ? "Contado, cobrado" : "Contado"}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <Badge color={ESTADOS[e].color}>{ESTADOS[e].label}</Badge>
                      {pendiente && <div style={{ marginTop: 3 }}><Badge color="amber">Cambio pedido</Badge></div>}
                      {v.modificacion_aprobada && <div style={{ marginTop: 3 }}><Badge color="green">Edición aprobada</Badge></div>}
                    </td>
                    {esVendedor && (
                      <td style={{ padding: "8px 12px" }} onClick={ev => ev.stopPropagation()}>
                        {e !== "cancelada" && !v.solicitud_modificacion && !v.modificacion_aprobada &&
                          <Btn size="sm" onClick={() => onPedirCambio(v)}>Pedir cambio</Btn>}
                        {v.modificacion_aprobada && <Btn size="sm" variant="success" onClick={() => onOpen(v)}>Editar</Btn>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pagina * POR_PAGINA < lista.length && (
        <div style={{ textAlign: "center", marginTop: 12 }}><Btn size="sm" onClick={() => setPagina(p => p + 1)}>Ver más ({lista.length - pagina * POR_PAGINA})</Btn></div>
      )}
    </div>
  );
}
