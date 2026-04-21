import { useState } from "react";
import { C, fmt, USERS } from "../constants";
import { Card, Btn, Badge, EmptyState, inp } from "../components/UI";
import { updateItem, addItem } from "../firebase";

const getUser = id => USERS.find(u => u.id === id);

export default function Cobros({ sales, setSales, setTickets, currentUser }) {
  const now = new Date();
  const [filterMes, setFilterMes] = useState(now.getMonth() + 1);
  const [filterAnio, setFilterAnio] = useState(now.getFullYear());
  const [saving, setSaving] = useState(null);

  const mesLabel = (m, a) => new Date(a, m - 1, 1).toLocaleString("es-UY", { month: "long", year: "numeric" });

  // Build cuotas list for this vendedor
  const mySales = sales.filter(s =>
    s.ejecutivo === currentUser.id &&
    s.estado !== "cancelada" &&
    (s.num_cuotas || 1) > 1 &&
    s.fecha_inicio
  );

  const allCuotas = [];
  mySales.forEach(s => {
    const nc = parseInt(s.num_cuotas) || 1;
    const fi = new Date(s.fecha_inicio);
    for (let i = 0; i < nc; i++) {
      const cuotaFecha = new Date(fi);
      cuotaFecha.setMonth(fi.getMonth() + i);
      const cuotaMes = cuotaFecha.getMonth() + 1;
      const cuotaAnio = cuotaFecha.getFullYear();
      const cuotaDetalle = (s.cuotas_detalle || [])[i] || {};
      allCuotas.push({
        saleId: s.id,
        saleInm: s.inmobiliaria,
        idx: i,
        numero: i + 1,
        total: nc,
        monto: cuotaDetalle.monto || Math.round(s.total / nc),
        fecha: cuotaFecha.toISOString().split("T")[0],
        mes: cuotaMes,
        anio: cuotaAnio,
        pagada: cuotaDetalle.pagada || false,
        gestionado: cuotaDetalle.gestionado || false,
        nro_factura: cuotaDetalle.nro_factura || "",
      });
    }
  });

  const filtered = allCuotas.filter(c => c.mes === filterMes && c.anio === filterAnio);
  filtered.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const pending = filtered.filter(c => !c.pagada);
  const gestionadas = filtered.filter(c => c.gestionado && !c.pagada);
  const pagadas = filtered.filter(c => c.pagada);

  const handleGestionar = async (cuota) => {
    setSaving(`${cuota.saleId}_${cuota.idx}`);
    const sale = sales.find(s => s.id === cuota.saleId);
    if (!sale) { setSaving(null); return; }

    // Update cuota gestionado flag (build default array if legacy sale has none)
    const nc = parseInt(sale.num_cuotas) || 1;
    const buildDefault = () => Array.from({ length: nc }, (_, i) => {
      let fecha = "";
      if (sale.fecha_inicio) {
        const f = new Date(sale.fecha_inicio);
        f.setMonth(f.getMonth() + i);
        fecha = f.toISOString().split("T")[0];
      }
      return {
        numero: i + 1,
        fecha,
        monto: Math.round(sale.total / nc),
        pagada: false,
        gestionado: false,
        nro_factura: "",
      };
    });
    const nuevasCuotas = (sale.cuotas_detalle?.length ? sale.cuotas_detalle : buildDefault())
      .map((c, i) => i === cuota.idx ? { ...c, gestionado: true } : c);

    await updateItem("ventas", cuota.saleId, { cuotas_detalle: nuevasCuotas });
    setSales(prev => prev.map(s => s.id === cuota.saleId ? { ...s, cuotas_detalle: nuevasCuotas } : s));

    // Create ticket to admin
    const adminUser = USERS.find(u => u.role === "admin");
    if (adminUser) {
      const ticket = await addItem("tickets", {
        titulo: "Cuota lista para facturar",
        descripcion: `${currentUser.name} informa que la cuota ${cuota.numero}/${cuota.total} de ${cuota.saleInm} (${fmt(cuota.monto)}) fue gestionada y está lista para facturar. Fecha: ${cuota.fecha}.`,
        de: currentUser.id,
        para: adminUser.id,
        estado: "pendiente",
      });
      if (ticket && setTickets) setTickets(prev => [ticket, ...prev]);
    }

    setSaving(null);
  };

  const statusBadge = (c) => {
    if (c.pagada) return <Badge color="green">Pagada ✓</Badge>;
    if (c.gestionado) return <Badge color="blue">Gestionada</Badge>;
    return <Badge color="amber">Pendiente</Badge>;
  };

  // Month selector options: current month ± 6
  const monthOptions = [];
  for (let offset = -5; offset <= 1; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    monthOptions.push({ mes: d.getMonth() + 1, anio: d.getFullYear() });
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.black }}>Cobros a gestionar</div>
          <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>Cuotas de tus ventas. Marcá como gestionada cuando hayas cobrado — se notifica a administración.</div>
        </div>
        <select value={`${filterMes}-${filterAnio}`} onChange={e => {
          const [m, a] = e.target.value.split("-");
          setFilterMes(parseInt(m)); setFilterAnio(parseInt(a));
        }} style={{ ...inp, width: "auto", padding: "7px 12px", fontSize: 12 }}>
          {monthOptions.map(({ mes, anio }) => (
            <option key={`${mes}-${anio}`} value={`${mes}-${anio}`}>{mesLabel(mes, anio)}</option>
          ))}
        </select>
      </div>

      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(150px,100%),1fr))", gap: 12, marginBottom: 20 }}>
        <div style={{ padding: "12px 16px", borderRadius: 10, background: C.amberLight, border: `1px solid ${C.amber}` }}>
          <div style={{ fontSize: 11, color: C.amber, fontWeight: 600, marginBottom: 4 }}>SIN GESTIONAR</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.amber }}>{pending.filter(c => !c.gestionado).length}</div>
          <div style={{ fontSize: 11, color: C.amber }}>{fmt(pending.filter(c => !c.gestionado).reduce((a, c) => a + c.monto, 0))}</div>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 10, background: C.blueLight, border: `1px solid ${C.blue}` }}>
          <div style={{ fontSize: 11, color: C.blue, fontWeight: 600, marginBottom: 4 }}>GESTIONADAS</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.blue }}>{gestionadas.length}</div>
          <div style={{ fontSize: 11, color: C.blue }}>{fmt(gestionadas.reduce((a, c) => a + c.monto, 0))}</div>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: 10, background: C.greenLight, border: `1px solid ${C.green}` }}>
          <div style={{ fontSize: 11, color: C.green, fontWeight: 600, marginBottom: 4 }}>PAGADAS</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{pagadas.length}</div>
          <div style={{ fontSize: 11, color: C.green }}>{fmt(pagadas.reduce((a, c) => a + c.monto, 0))}</div>
        </div>
      </div>

      {filtered.length === 0
        ? <EmptyState icon="💰" title="Sin cuotas" desc={`No hay cuotas para ${mesLabel(filterMes, filterAnio)}`} />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(c => {
              const key = `${c.saleId}_${c.idx}`;
              const isSaving = saving === key;
              return (
                <Card key={key} style={{ border: `1px solid ${c.pagada ? C.green : c.gestionado ? C.blue : C.amber}`, background: c.pagada ? C.greenLight : c.gestionado ? C.blueLight : C.white }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.black }}>{c.saleInm}</div>
                      <div style={{ fontSize: 12, color: C.gray500, marginTop: 3 }}>
                        Cuota {c.numero}/{c.total} · {c.fecha} · {fmt(c.monto)}
                        {c.nro_factura && <span style={{ marginLeft: 8, color: C.gray400 }}>Factura: {c.nro_factura}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {statusBadge(c)}
                      {!c.pagada && !c.gestionado && (
                        <Btn size="sm" variant="primary" onClick={() => handleGestionar(c)} disabled={isSaving}>
                          {isSaving ? "..." : "Gestionar"}
                        </Btn>
                      )}
                      {c.gestionado && !c.pagada && (
                        <span style={{ fontSize: 11, color: C.blue }}>Notificado a admin</span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
