import { useEffect, useMemo } from "react";
import { C, USERS, getWeekDates } from "../constants";
import { Card, Btn, Spinner } from "../components/UI";
import { fmtMoneda, enPesos } from "../moneda";

// KPIs semanales calculados solos, sin carga manual:
// - contactos y reuniones salen de las gestiones que cada vendedor registra en las inmobiliarias,
// - ventas y montos, de las ventas cargadas esa semana (las de dólares, en pesos al tipo de cambio de la venta).
const VENDEDORES = USERS.filter(u => u.role === "vendedor");
const enSemana = (fecha, w) => { const f = String(fecha || "").slice(0, 10); return f >= w.inicio && f <= w.fin; };

export const kpisDe = (uid, w, gestiones, ventas) => {
  const g = gestiones.filter(x => x.por === uid && enSemana(x.fecha, w));
  const contactadas = new Set(g.map(x => x.leadId));
  const efectivas = new Set(g.filter(x => x.resultado !== "sin_respuesta").map(x => x.leadId));
  const vs = ventas.filter(v => v.ejecutivo === uid && v.estado !== "cancelada" && enSemana(v.created_at || v.fecha_venta, w));
  const monto = vs.reduce((a, v) => a + enPesos(v.total, v), 0);
  return {
    contactadas: contactadas.size, efectivas: efectivas.size,
    agendadas: g.filter(x => x.resultado === "reunion_agendada").length,
    realizadas: g.filter(x => x.resultado === "reunion_realizada").length,
    interesadas: g.filter(x => x.resultado === "interesada").length,
    ventas: vs.length, monto, ticket: vs.length ? monto / vs.length : 0,
    concrecion: efectivas.size ? Math.round(vs.length / efectivas.size * 100) : 0,
  };
};

const CAMPOS = [
  ["contactadas", "Inmobiliarias contactadas"], ["efectivas", "Contactos efectivos"], ["agendadas", "Reuniones agendadas"],
  ["realizadas", "Reuniones realizadas"], ["interesadas", "Pidieron propuesta"], ["ventas", "Ventas"],
  ["monto", "Vendido", fmtMoneda], ["ticket", "Ticket promedio", fmtMoneda], ["concrecion", "Concreción", v => `${v}%`],
];

export default function KPIs({ currentUser, kpiWeekOffset, setKpiWeekOffset, prospectos, cargar, cargando, sales }) {
  useEffect(() => { if (!prospectos && !cargando) cargar(); }, []);
  const w = getWeekDates(kpiWeekOffset);
  const gestiones = useMemo(() => (prospectos || []).flatMap(l => (l.gestiones || []).map(g => ({ ...g, leadId: l.id }))), [prospectos]);
  const personas = currentUser.role === "vendedor" ? VENDEDORES.filter(u => u.id === currentUser.id) : VENDEDORES;

  if (cargando || !prospectos) return <Spinner />;
  const filas = personas.map(u => ({ u, k: kpisDe(u.id, w, gestiones, sales) }));
  const total = Object.fromEntries(CAMPOS.map(([c]) => [c, filas.reduce((a, f) => a + f.k[c], 0)]));
  total.ticket = total.ventas ? total.monto / total.ventas : 0;
  total.concrecion = total.efectivas ? Math.round(total.ventas / total.efectivas * 100) : 0;

  const Bloque = ({ titulo, k }) => (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{titulo}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(140px,100%),1fr))", gap: 8 }}>
        {CAMPOS.map(([c, label, f]) => (
          <div key={c} style={{ background: C.gray50, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.gray100}` }}>
            <div style={{ fontSize: 10, color: C.gray500, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: 600 }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.gray900 }}>{f ? f(k[c]) : k[c]}</div>
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.black }}>{currentUser.role === "vendedor" ? "Mis KPIs" : "KPIs del equipo"}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Btn size="sm" onClick={() => setKpiWeekOffset(x => x - 1)}>←</Btn>
          <span style={{ fontSize: 12, color: C.gray500, minWidth: 130, textAlign: "center", fontWeight: 500 }}>Semana {w.label}</span>
          <Btn size="sm" onClick={() => setKpiWeekOffset(x => Math.min(x + 1, 0))}>→</Btn>
        </div>
      </div>
      <div style={{ fontSize: 13, color: C.gray500, marginBottom: 16 }}>
        Se calculan solos con las gestiones registradas en cada inmobiliaria (WhatsApp, llamadas, reuniones) y con las ventas cargadas.
      </div>
      {personas.length > 1 && <Bloque titulo="Equipo" k={total} />}
      {filas.map(({ u, k }) => <Bloque key={u.id} titulo={u.name} k={k} />)}
    </div>
  );
}
