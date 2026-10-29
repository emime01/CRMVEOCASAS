import { useState } from "react";
import { C } from "../constants";

// Estructura de todas las pantallas: menú lateral agrupado por área (en el celular, un menú desplegable)
// y el contenido centrado con un ancho máximo común.
const AREAS = [
  { titulo: "Comercial", ids: ["dashboard", "dashboard_gerente", "dashboard_ggeneral", "ventas", "ventas_ggeneral", "mis_prospectos", "prospectos", "clientes", "renovaciones", "kpis", "cobros", "competencias"] },
  { titulo: "Administración", ids: ["facturacion", "contratos", "comisiones", "reportes", "reportes_ggeneral", "alertas", "alertas_admin", "modificaciones", "correccion_fechas"] },
  { titulo: "Marketing y operaciones", ids: ["producciones", "disponibilidad", "social", "assets", "metricas", "presentaciones", "documentos"] },
  { titulo: "Equipo", ids: ["tareas", "tickets"] },
];
const ANCHO_MENU = 232;

const agrupar = tabs => {
  const usados = new Set();
  const grupos = AREAS.map(a => {
    const items = tabs.filter(t => a.ids.includes(t.id));
    items.forEach(t => usados.add(t.id));
    return { titulo: a.titulo, items };
  });
  const otros = tabs.filter(t => !usados.has(t.id));
  return [...grupos, { titulo: "Otros", items: otros }].filter(g => g.items.length);
};

export default function Layout({ tabs, tab, setTab, user, onPassword, onLogout, children }) {
  const [abierto, setAbierto] = useState(false);
  const grupos = agrupar(tabs);
  const actual = tabs.find(t => t.id === tab);
  const ir = id => { setTab(id); setAbierto(false); window.scrollTo(0, 0); };

  const menu = (
    <nav style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "18px 20px 14px", fontSize: 20, fontWeight: 800, color: C.red, letterSpacing: "-0.5px" }}>veocasas</div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 12px" }}>
        {grupos.map(g => (
          <div key={g.titulo} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.38)", letterSpacing: 0.8, textTransform: "uppercase", padding: "6px 10px" }}>{g.titulo}</div>
            {g.items.map(t => {
              const activo = t.id === tab;
              return (
                <button key={t.id} onClick={() => ir(t.id)} className="vc-item"
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "none",
                    background: activo ? "rgba(242,0,0,0.16)" : "transparent", color: activo ? "#ff4d4d" : "rgba(255,255,255,0.75)",
                    fontSize: 13, fontWeight: activo ? 600 : 500, cursor: "pointer", fontFamily: "inherit",
                  }}>
                  {t.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{user.avatar}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>{user.name}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
            <button onClick={onPassword} className="vc-link">Contraseña</button>
            <button onClick={onLogout} className="vc-link">Salir</button>
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.gray50 }}>
      <style>{`
        .vc-menu { position: fixed; top: 0; left: 0; bottom: 0; width: ${ANCHO_MENU}px; background: #1c1c1c; z-index: 100; }
        .vc-barra { display: none; }
        .vc-contenido { margin-left: ${ANCHO_MENU}px; }
        .vc-item:hover { color: #fff !important; background: rgba(255,255,255,0.06); }
        .vc-link { border: none; background: none; padding: 0; color: rgba(255,255,255,0.55); font-size: 11px; cursor: pointer; font-family: inherit; }
        .vc-link:hover { color: #fff; }
        /* cada pantalla trae su propio ancho: se unifica y se centra */
        .vc-pantalla > div { max-width: 1200px !important; margin-left: auto !important; margin-right: auto !important; }
        @media (max-width: 900px) {
          .vc-menu { transform: translateX(-100%); transition: transform .2s ease; box-shadow: none; }
          .vc-menu.abierto { transform: none; box-shadow: 0 0 40px rgba(0,0,0,.35); }
          .vc-barra { display: flex; }
          .vc-contenido { margin-left: 0; }
          .vc-pantalla > div { padding: 1rem !important; }
        }
      `}</style>

      <aside className={`vc-menu${abierto ? " abierto" : ""}`}>{menu}</aside>
      {abierto && <div onClick={() => setAbierto(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 99 }} />}

      <div className="vc-contenido">
        <header className="vc-barra" style={{ position: "sticky", top: 0, zIndex: 50, height: 52, background: "#1c1c1c", alignItems: "center", gap: 12, padding: "0 12px" }}>
          <button onClick={() => setAbierto(true)} aria-label="Abrir menú"
            style={{ width: 36, height: 36, border: "none", borderRadius: 8, background: "rgba(255,255,255,0.08)", color: C.white, fontSize: 18, cursor: "pointer" }}>☰</button>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.red, letterSpacing: "-0.5px" }}>veocasas</span>
          <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{actual?.label}</span>
        </header>
        <main className="vc-pantalla">{children}</main>
      </div>
    </div>
  );
}
