import { useEffect, useMemo, useState } from "react";
import { C, USERS, CRMS, RESULTADOS_GESTION, CANALES_GESTION } from "../constants";
import { Card, Btn, Badge, Stat, Spinner, EmptyState, inp } from "../components/UI";
import { nombreUsuario, fechaCorta } from "../prospectos";
import { RESULTADOS_RENOVACION } from "../renovaciones";
import { hoyISO } from "../cuotas";

// Registro de todas las gestiones (WhatsApp, llamadas, visitas…) que hicieron los vendedores, en una sola lista:
// las de las inmobiliarias (prospectos y clientes) y las de renovaciones. Se filtra por fecha, vendedor,
// inmobiliaria, CRM que usa, canal, resultado, tipo y departamento, y se descarga en Excel.
// Mika y Gonzalo ven las de todos; cada vendedor, las suyas.

const POR_PAGINA = 150;
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pad = n => String(n).padStart(2, "0");
const diaLocal = iso => { const d = new Date(iso); return isNaN(d) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const horaLocal = iso => { const d = new Date(iso); return isNaN(d) || !String(iso).includes("T") ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const sumarDias = (iso, n) => { const [a, m, d] = iso.split("-").map(Number); const x = new Date(a, m - 1, d + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const lunes = iso => { const [a, m, d] = iso.split("-").map(Number); const dow = new Date(a, m - 1, d).getDay(); return sumarDias(iso, -(dow === 0 ? 6 : dow - 1)); };

const PERIODOS = [
  { id: "hoy", label: "Hoy", rango: h => [h, h] },
  { id: "ayer", label: "Ayer", rango: h => [sumarDias(h, -1), sumarDias(h, -1)] },
  { id: "semana", label: "Esta semana", rango: h => [lunes(h), h] },
  { id: "semana_pasada", label: "Semana pasada", rango: h => [sumarDias(lunes(h), -7), sumarDias(lunes(h), -1)] },
  { id: "mes", label: "Este mes", rango: h => [h.slice(0, 8) + "01", h] },
  { id: "30", label: "Últimos 30 días", rango: h => [sumarDias(h, -29), h] },
  { id: "todo", label: "Todo", rango: () => ["", ""] },
  { id: "elegir", label: "Elegir fechas", rango: null },
];

const RESULTADOS = [
  ...RESULTADOS_GESTION.map(r => ({ ...r, tipo: "inmobiliaria" })),
  ...RESULTADOS_RENOVACION.filter(r => !RESULTADOS_GESTION.some(g => g.id === r.id)).map(r => ({ ...r, tipo: "renovacion" })),
];
const etiquetaResultado = (tipo, id) =>
  (tipo === "renovacion" ? RESULTADOS_RENOVACION : RESULTADOS_GESTION).find(r => r.id === id)?.label || id || "";
const colorResultado = id => ({ reunion_agendada: "blue", reunion_realizada: "blue", interesada: "green", renueva: "green",
  no_interesada: "gray", no_renueva: "gray", sin_respuesta: "amber" })[id] || "gray";

// Todas las gestiones, con los datos de su inmobiliaria para poder filtrar
export const todasLasGestiones = (prospectos, ventas) => {
  const porId = new Map((prospectos || []).map(l => [l.id, l]));
  const deInmobiliarias = (prospectos || []).flatMap(l => (l.gestiones || []).map((g, i) => ({
    key: `i_${l.id}_${i}`, tipo: "inmobiliaria", ...g, inmobiliaria: l.nombre, leadId: l.id,
    crm: l.crm_usa || "", departamento: l.departamento || "", aCargo: l.asignadoA || "",
  })));
  const deRenovaciones = (ventas || []).flatMap(v => (v.renovacion?.gestiones || []).map((g, i) => {
    const l = porId.get(v.lead_id);
    return {
      key: `r_${v.id}_${i}`, tipo: "renovacion", ...g, inmobiliaria: v.inmobiliaria || l?.nombre, leadId: v.lead_id || "",
      crm: l?.crm_usa || "", departamento: l?.departamento || "", aCargo: l?.asignadoA || v.ejecutivo || "",
    };
  }));
  return [...deInmobiliarias, ...deRenovaciones]
    .map(g => ({ ...g, dia: diaLocal(g.fecha), por: g.por || "" }))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
};

export default function Gestiones({ currentUser, prospectos, cargar, cargando, sales }) {
  const esVendedor = currentUser.role === "vendedor";
  const hoy = hoyISO();
  const [periodo, setPeriodo] = useState("semana");
  const [desde, setDesde] = useState(lunes(hoy));
  const [hasta, setHasta] = useState(hoy);
  const [vendedor, setVendedor] = useState(esVendedor ? currentUser.id : "");
  const [q, setQ] = useState("");
  const [crm, setCrm] = useState("");
  const [canal, setCanal] = useState("");
  const [resultado, setResultado] = useState("");
  const [tipo, setTipo] = useState("");
  const [depto, setDepto] = useState("");
  const [pagina, setPagina] = useState(1);

  useEffect(() => { if (!prospectos && !cargando) cargar(); }, []);
  useEffect(() => setPagina(1), [periodo, desde, hasta, vendedor, q, crm, canal, resultado, tipo, depto]);

  const elegirPeriodo = id => {
    setPeriodo(id);
    const p = PERIODOS.find(x => x.id === id);
    if (p.rango) { const [d, h] = p.rango(hoy); setDesde(d); setHasta(h); }
  };

  const todas = useMemo(() => todasLasGestiones(prospectos, sales), [prospectos, sales]);
  const propias = esVendedor ? todas.filter(g => g.por === currentUser.id) : todas;
  const lista = propias.filter(g =>
    (!desde || g.dia >= desde) && (!hasta || g.dia <= hasta) &&
    (!vendedor || g.por === vendedor) &&
    (!crm || (crm === "sin_dato" ? !g.crm : g.crm === crm)) &&
    (!canal || g.canal === canal) &&
    (!resultado || g.resultado === resultado) &&
    (!tipo || g.tipo === tipo) &&
    (!depto || (depto === "sin" ? !g.departamento : g.departamento === depto)) &&
    (!q || norm(`${g.inmobiliaria} ${g.nota}`).includes(norm(q))));

  // Para los filtros: solo las opciones que aparecen en las gestiones
  const vendedores = [...new Set(todas.map(g => g.por).filter(Boolean))].sort((a, b) => nombreUsuario(a).localeCompare(nombreUsuario(b), "es"));
  const deptos = [...new Set(todas.map(g => g.departamento).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const crms = [...new Set([...CRMS, ...todas.map(g => g.crm).filter(Boolean)])];

  const inmobiliariasDistintas = new Set(lista.map(g => g.leadId || g.inmobiliaria)).size;
  const reuniones = lista.filter(g => ["reunion_agendada", "reunion_realizada"].includes(g.resultado)).length;
  const interesadas = lista.filter(g => ["interesada", "renueva"].includes(g.resultado)).length;
  const porVendedor = [...lista.reduce((m, g) => m.set(g.por, (m.get(g.por) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]);

  const hayFiltros = q || crm || canal || resultado || tipo || depto || (!esVendedor && vendedor);
  const limpiar = () => { setQ(""); setCrm(""); setCanal(""); setResultado(""); setTipo(""); setDepto(""); if (!esVendedor) setVendedor(""); };

  const descargar = () => {
    const celda = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const filas = [["Fecha", "Hora", "Vendedor", "Inmobiliaria", "Tipo", "Canal", "Resultado", "Nota", "Volver a contactar", "CRM que usa", "Departamento"],
      ...lista.map(g => [g.dia, horaLocal(g.fecha), nombreUsuario(g.por), g.inmobiliaria, g.tipo === "renovacion" ? "Renovación" : "Inmobiliaria",
        g.canal, etiquetaResultado(g.tipo, g.resultado), g.nota, g.proximoContacto || "", g.crm, g.departamento])];
    const csv = "﻿" + filas.map(f => f.map(celda).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `gestiones_${desde || "inicio"}_${hasta || hoy}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  if (cargando || !prospectos) return <Spinner />;
  const pagina_ = lista.slice(0, pagina * POR_PAGINA);
  const sel = { ...inp, width: "auto" };

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.black }}>{esVendedor ? "Mis gestiones" : "Gestiones del equipo"}</div>
          <div style={{ fontSize: 13, color: C.gray500, marginTop: 2 }}>
            Todos los contactos registrados en las inmobiliarias y en las renovaciones{esVendedor ? "" : ", de todos los vendedores"}.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn size="sm" onClick={cargar}>Actualizar</Btn>
          <Btn size="sm" disabled={!lista.length} onClick={descargar}>⬇ Descargar Excel</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {PERIODOS.map(p => (
          <button key={p.id} onClick={() => elegirPeriodo(p.id)} style={{
            padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${periodo === p.id ? C.red : C.gray200}`, background: periodo === p.id ? C.red : C.white, color: periodo === p.id ? C.white : C.gray700,
          }}>{p.label}</button>
        ))}
      </div>
      {periodo === "elegir" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10, fontSize: 13, color: C.gray600 }}>
          Desde <input type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} style={sel} />
          hasta <input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} style={sel} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar inmobiliaria o texto de la nota" style={{ ...inp, flex: "1 1 220px" }} />
        {!esVendedor && (
          <select value={vendedor} onChange={e => setVendedor(e.target.value)} style={sel}>
            <option value="">Todos los vendedores</option>
            {vendedores.map(id => <option key={id} value={id}>{nombreUsuario(id)}{USERS.find(u => u.id === id)?.role === "inactivo" ? " (ya no está)" : ""}</option>)}
          </select>
        )}
        <select value={crm} onChange={e => setCrm(e.target.value)} style={sel}>
          <option value="">Cualquier CRM</option>
          {crms.map(c => <option key={c}>{c}</option>)}
          <option value="sin_dato">CRM sin cargar</option>
        </select>
        <select value={canal} onChange={e => setCanal(e.target.value)} style={sel}>
          <option value="">Todos los canales</option>
          {CANALES_GESTION.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={resultado} onChange={e => setResultado(e.target.value)} style={sel}>
          <option value="">Todos los resultados</option>
          {RESULTADOS.map(r => <option key={r.id} value={r.id}>{r.label}{r.tipo === "renovacion" ? " (renovación)" : ""}</option>)}
        </select>
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={sel}>
          <option value="">Inmobiliarias y renovaciones</option>
          <option value="inmobiliaria">Solo inmobiliarias</option>
          <option value="renovacion">Solo renovaciones</option>
        </select>
        <select value={depto} onChange={e => setDepto(e.target.value)} style={sel}>
          <option value="">Todos los departamentos</option>
          {deptos.map(d => <option key={d}>{d}</option>)}
          <option value="sin">Sin departamento</option>
        </select>
        {hayFiltros && <Btn size="sm" onClick={limpiar}>Limpiar filtros</Btn>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(150px,100%),1fr))", gap: 10, marginBottom: 14 }}>
        <Stat label="Gestiones" value={lista.length} />
        <Stat label="Inmobiliarias contactadas" value={inmobiliariasDistintas} />
        <Stat label="Reuniones" value={reuniones} color={C.blue} />
        <Stat label="Interesadas / renuevan" value={interesadas} color={C.green} />
      </div>

      {!esVendedor && porVendedor.length > 1 && (
        <Card style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.gray500, fontWeight: 600 }}>Por vendedor:</span>
          {porVendedor.map(([id, n]) => (
            <button key={id || "_"} onClick={() => setVendedor(vendedor === id ? "" : id)} style={{
              padding: "4px 10px", borderRadius: 999, fontSize: 12, cursor: "pointer",
              border: `1px solid ${vendedor === id ? C.red : C.gray200}`, background: vendedor === id ? C.redLight : C.white, color: C.gray800,
            }}><b>{nombreUsuario(id) || "Sin dato"}</b> {n}</button>
          ))}
        </Card>
      )}

      {!lista.length ? <EmptyState icon="🗂️" title="No hay gestiones con estos filtros" desc={periodo !== "todo" ? "Probá con otro período o con «Todo»." : ""} /> : (
        <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.gray50, textAlign: "left" }}>
                {["Fecha", !esVendedor && "Vendedor", "Inmobiliaria", "Canal", "Resultado", "Nota"].filter(Boolean).map(h =>
                  <th key={h} style={{ padding: "10px 12px", fontSize: 11, color: C.gray500, fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {pagina_.map(g => (
                <tr key={g.key} style={{ borderTop: `1px solid ${C.gray100}`, verticalAlign: "top" }}>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap", color: C.gray700 }}>
                    {fechaCorta(g.dia)}<div style={{ fontSize: 11, color: C.gray400 }}>{horaLocal(g.fecha)}</div>
                  </td>
                  {!esVendedor && <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{nombreUsuario(g.por) || "—"}</td>}
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ fontWeight: 600, color: C.black }}>{g.inmobiliaria}</div>
                    <div style={{ fontSize: 11, color: C.gray500 }}>
                      {[g.tipo === "renovacion" && "Renovación", g.departamento, g.crm && `CRM: ${g.crm}`].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{g.canal}</td>
                  <td style={{ padding: "8px 12px" }}><Badge color={colorResultado(g.resultado)}>{etiquetaResultado(g.tipo, g.resultado)}</Badge></td>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: C.gray600, minWidth: 180 }}>
                    {g.nota}
                    {g.motivo && <div>Motivo: {g.motivo}</div>}
                    {g.proximoContacto && <div style={{ color: C.gray500 }}>volver el {fechaCorta(g.proximoContacto)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pagina_.length < lista.length && (
        <div style={{ textAlign: "center", marginTop: 12 }}><Btn size="sm" onClick={() => setPagina(p => p + 1)}>Ver más ({lista.length - pagina_.length})</Btn></div>
      )}
    </div>
  );
}
