import { useState } from "react";
import { C, fmt, USERS } from "../constants";
import { Btn, inp } from "../components/UI";
import { updateItem } from "../firebase";

const getUser = id => USERS.find(u => u.id === id);

export default function CorreccionFechas({ sales, setSales }) {
  const [dates, setDates] = useState(() => {
    const obj = {};
    sales.forEach(s => {
      obj[s.id] = {
        fecha_inicio: s.fecha_inicio || "",
        fecha_fin: s.fecha_fin || "",
      };
    });
    return obj;
  });
  const [savedIds, setSavedIds] = useState(new Set());
  const [savingId, setSavingId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);

  const activeSales = sales.filter(s => s.estado !== "cancelada");

  const changedSales = activeSales.filter(s => {
    const d = dates[s.id];
    return d && (d.fecha_inicio !== (s.fecha_inicio || "") || d.fecha_fin !== (s.fecha_fin || ""));
  });

  const buildChanges = (s) => {
    const d = dates[s.id];
    const changes = { fecha_inicio: d.fecha_inicio, fecha_fin: d.fecha_fin };

    // Recalculate cuota dates when fecha_inicio changes
    if ((s.num_cuotas || 1) > 1 && d.fecha_inicio && (s.cuotas_detalle || []).length > 0) {
      const fi = new Date(d.fecha_inicio);
      changes.cuotas_detalle = s.cuotas_detalle.map((c, i) => {
        const fc = new Date(fi);
        fc.setMonth(fi.getMonth() + i);
        return { ...c, fecha: fc.toISOString().split("T")[0] };
      });
    }
    return changes;
  };

  const handleSaveOne = async (s) => {
    setSavingId(s.id);
    const changes = buildChanges(s);
    await updateItem("ventas", s.id, changes);
    setSales(prev => prev.map(x => x.id === s.id ? { ...x, ...changes } : x));
    setSavedIds(prev => new Set([...prev, s.id]));
    setSavingId(null);
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    for (const s of changedSales) {
      const changes = buildChanges(s);
      await updateItem("ventas", s.id, changes);
      setSales(prev => prev.map(x => x.id === s.id ? { ...x, ...changes } : x));
      setSavedIds(prev => new Set([...prev, s.id]));
    }
    setSavingAll(false);
  };

  const setDate = (id, field, value) => {
    setDates(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setSavedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.black }}>Corrección de Fechas</div>
        <div style={{ fontSize: 13, color: C.gray400, marginTop: 4 }}>
          Corregí fecha_inicio y fecha_fin para cada venta. Al guardar también se recalculan las fechas de las cuotas automáticamente.
        </div>
      </div>

      <div style={{ background: C.amberLight, border: `1px solid ${C.amber}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: C.amber, display: "flex", alignItems: "center", gap: 10 }}>
        <span>⚠️</span>
        <span>
          <strong>{activeSales.length} ventas activas</strong> · {changedSales.length} con cambios sin guardar · {savedIds.size} guardadas en esta sesión
        </span>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.gray200}`, marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.gray900 }}>
              {["Inmobiliaria", "Ejecutivo", "Plan", "Cuotas", "Total", "Fecha Inicio", "Fecha Fin", ""].map((h, i) => (
                <th key={i} style={{ padding: "10px 14px", textAlign: "left", color: C.gray300, fontWeight: 500, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSales.map(s => {
              const d = dates[s.id] || { fecha_inicio: "", fecha_fin: "" };
              const isSaved = savedIds.has(s.id);
              const isChanged = d.fecha_inicio !== (s.fecha_inicio || "") || d.fecha_fin !== (s.fecha_fin || "");
              const isSaving = savingId === s.id;
              const rowBg = isSaved ? "#f0fdf4" : isChanged ? "#fffbeb" : "white";

              return (
                <tr key={s.id} style={{ borderBottom: `1px solid ${C.gray100}`, background: rowBg }}>
                  <td style={{ padding: "8px 14px", fontWeight: 600, color: C.black }}>{s.inmobiliaria}</td>
                  <td style={{ padding: "8px 14px", color: C.gray600 }}>{getUser(s.ejecutivo)?.name}</td>
                  <td style={{ padding: "8px 14px", color: C.gray600 }}>{s.plan}</td>
                  <td style={{ padding: "8px 14px", color: C.gray500, textAlign: "center" }}>{s.num_cuotas || 1}</td>
                  <td style={{ padding: "8px 14px", fontWeight: 600, color: C.gray900, whiteSpace: "nowrap" }}>{fmt(s.total)}</td>
                  <td style={{ padding: "6px 10px" }}>
                    <input
                      type="date"
                      value={d.fecha_inicio}
                      onChange={e => setDate(s.id, "fecha_inicio", e.target.value)}
                      style={{ ...inp, width: 140, padding: "5px 8px", fontSize: 12, borderColor: isChanged ? C.amber : C.gray200 }}
                    />
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <input
                      type="date"
                      value={d.fecha_fin}
                      onChange={e => setDate(s.id, "fecha_fin", e.target.value)}
                      style={{ ...inp, width: 140, padding: "5px 8px", fontSize: 12, borderColor: isChanged ? C.amber : C.gray200 }}
                    />
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                    {isSaved
                      ? <span style={{ color: C.green, fontWeight: 600, fontSize: 11 }}>✓ Guardado</span>
                      : isChanged
                        ? <Btn size="sm" variant="primary" onClick={() => handleSaveOne(s)} disabled={isSaving}>
                            {isSaving ? "..." : "Guardar"}
                          </Btn>
                        : <span style={{ color: C.gray300, fontSize: 11 }}>Sin cambios</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 12, color: C.gray400 }}>
          {savedIds.size === activeSales.length
            ? <span style={{ color: C.green, fontWeight: 600 }}>✓ Todas las ventas están actualizadas</span>
            : `${activeSales.length - savedIds.size} ventas sin confirmar`
          }
        </div>
        <Btn
          variant="primary"
          onClick={handleSaveAll}
          disabled={savingAll || changedSales.length === 0}
        >
          {savingAll
            ? `Guardando... (${savedIds.size}/${changedSales.length + savedIds.size})`
            : `Guardar todas las modificaciones (${changedSales.length})`
          }
        </Btn>
      </div>
    </div>
  );
}
