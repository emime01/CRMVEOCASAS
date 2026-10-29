import { useMemo, useState } from "react";
import { C, fmt, USERS, CRMS, daysUntil } from "../constants";
import { Card, Btn, Badge, Field, Grid2, Stat, EmptyState, inp } from "../components/UI";
import { updateItem } from "../firebase";
import { cuotasDe } from "../cuotas";
import { COL_CLIENTES, resumenCliente, planDeFichas, aplicarPlan } from "../clientes";

// Fichas de cliente: datos de la inmobiliaria, contactos, notas y sus ventas con cuotas.
// La gerencia y administración editan; el gerente general consulta.
const getUser = id => USERS.find(u => u.id === id);
const VENDEDORES = USERS.filter(u => ["vendedor", "gerente"].includes(u.role));
const ESTADOS = { activo: { label: "Activo", color: "green" }, ex_cliente: { label: "Ex cliente", color: "amber" }, sin_ventas: { label: "Sin ventas", color: "gray" } };
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function Clientes({ clientes, setClientes, sales, setSales, currentUser }) {
  const puedeEditar = ["gerente", "admin"].includes(currentUser.role);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("activo");
  const [vendedor, setVendedor] = useState("todos");
  const [abierto, setAbierto] = useState(null);
  const [migrando, setMigrando] = useState(null); // plan en revisión
  const [aplicando, setAplicando] = useState(false);

  const filas = useMemo(() => clientes.map(c => ({ c, r: resumenCliente(c, sales) }))
    .sort((a, b) => String(a.c.nombre).localeCompare(String(b.c.nombre), "es")), [clientes, sales]);
  const conteo = k => filas.filter(f => k === "todos" || f.r.estado === k).length;
  const lista = filas.filter(({ c, r }) =>
    (estado === "todos" || r.estado === estado) &&
    (vendedor === "todos" || c.ejecutivo === vendedor) &&
    (!q || norm(`${c.nombre} ${c.razon_social} ${c.rut} ${c.email}`).includes(norm(q))));

  const ventasSinFicha = sales.filter(v => !v.cliente_id && (v.inmobiliaria || "").trim()).length;

  const aplicar = async () => {
    setAplicando(true);
    const { creadas, ventaACliente } = await aplicarPlan(migrando);
    setClientes(prev => [...prev, ...creadas]);
    setSales(prev => prev.map(v => ventaACliente.has(v.id) ? { ...v, cliente_id: ventaACliente.get(v.id) } : v));
    setAplicando(false); setMigrando(null);
  };

  const guardar = async (id, cambios) => {
    const datos = { ...cambios, actualizado_en: new Date().toISOString() };
    await updateItem(COL_CLIENTES, id, datos);
    setClientes(prev => prev.map(c => c.id === id ? { ...c, ...datos } : c));
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1000 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.black }}>Clientes</div>
      <div style={{ fontSize: 13, color: C.gray500, marginTop: 2, marginBottom: 16 }}>Una ficha por inmobiliaria, con sus contactos y todas sus ventas.</div>

      {ventasSinFicha > 0 && puedeEditar && !migrando && (
        <Card style={{ border: `1px solid ${C.amber}`, background: C.amberLight, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: C.gray700 }}>
              <strong>{ventasSinFicha} venta{ventasSinFicha !== 1 ? "s" : ""} sin ficha de cliente.</strong> Se agrupan por RUT o, si no tienen, por nombre. Antes de crear nada vas a ver cómo quedan.
            </div>
            <Btn size="sm" variant="primary" onClick={() => setMigrando(planDeFichas(sales, clientes))}>Armar fichas</Btn>
          </div>
        </Card>
      )}

      {migrando && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.black, marginBottom: 4 }}>
            {migrando.nuevas.length} fichas nuevas{migrando.asignar.length ? ` · ${migrando.asignar.length} ventas van a fichas que ya existen` : ""}
          </div>
          <div style={{ fontSize: 12, color: C.gray500, marginBottom: 12 }}>
            Revisá que cada ficha junte ventas de la misma inmobiliaria. Si algo quedó mal agrupado, corregí el nombre o el RUT en la venta y volvé a armar.
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto", border: `1px solid ${C.gray200}`, borderRadius: 8 }}>
            {migrando.nuevas.map((g, i) => (
              <div key={i} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.gray100}`, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ color: C.black }}>{g.datos.nombre}</strong>
                  <span style={{ color: C.gray500 }}>{g.ventas.length} venta{g.ventas.length !== 1 ? "s" : ""} · {getUser(g.datos.ejecutivo)?.name || "sin vendedor"}</span>
                </div>
                <div style={{ color: C.gray500, marginTop: 2 }}>
                  {[g.datos.razon_social, g.datos.rut && `RUT ${g.datos.rut}`].filter(Boolean).join(" · ")}
                  {new Set(g.ventas.map(v => v.inmobiliaria.trim())).size > 1 && <span style={{ color: C.amber }}> · junta: {[...new Set(g.ventas.map(v => v.inmobiliaria.trim()))].join(", ")}</span>}
                </div>
              </div>
            ))}
            {migrando.asignar.map(([v, c]) => (
              <div key={v.id} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.gray100}`, fontSize: 12, color: C.gray600 }}>
                Venta de <strong>{v.inmobiliaria}</strong> → ficha existente <strong>{c.nombre}</strong>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <Btn size="sm" onClick={() => setMigrando(null)}>Cancelar</Btn>
            <Btn size="sm" variant="primary" disabled={aplicando} onClick={aplicar}>{aplicando ? "Creando…" : `Crear ${migrando.nuevas.length} fichas`}</Btn>
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(150px,100%),1fr))", gap: 12, marginBottom: 16 }}>
        {[["activo", "Activos"], ["ex_cliente", "Ex clientes"], ["sin_ventas", "Sin ventas"], ["todos", "Todos"]].map(([k, l]) => (
          <div key={k} onClick={() => setEstado(k)} style={{ cursor: "pointer", outline: estado === k ? `2px solid ${C.red}` : "none", borderRadius: 12 }}>
            <Stat label={l} value={conteo(k)} />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, razón social, RUT o email" style={{ ...inp, flex: "1 1 240px" }} />
        <select value={vendedor} onChange={e => setVendedor(e.target.value)} style={{ ...inp, width: "auto" }}>
          <option value="todos">Todos los vendedores</option>
          {VENDEDORES.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {!clientes.length ? <EmptyState icon="👥" title="Todavía no hay fichas" desc={puedeEditar ? "Usá “Armar fichas” para crearlas desde las ventas." : "Las arma la gerencia desde las ventas."} />
        : !lista.length ? <EmptyState icon="🔍" title="Sin resultados" />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lista.map(({ c, r }) => (
              <Ficha key={c.id} c={c} r={r} abierta={abierto === c.id} onToggle={() => setAbierto(abierto === c.id ? null : c.id)}
                puedeEditar={puedeEditar} onGuardar={cambios => guardar(c.id, cambios)} />
            ))}
          </div>
        )}
    </div>
  );
}

function Ficha({ c, r, abierta, onToggle, puedeEditar, onGuardar }) {
  const est = ESTADOS[r.estado];
  const dias = r.vence ? daysUntil(r.vence) : null;
  return (
    <Card>
      <div onClick={onToggle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", cursor: "pointer" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.black }}>{c.nombre}</span>
            <Badge color={est.color}>{est.label}</Badge>
            {dias !== null && dias <= 60 && <Badge color={dias <= 30 ? "red" : "amber"}>Vence en {dias} días</Badge>}
          </div>
          <div style={{ fontSize: 11, color: C.gray500, marginTop: 2 }}>
            {[c.razon_social, c.rut && `RUT ${c.rut}`, getUser(c.ejecutivo)?.name, `${r.ventas.length} venta${r.ventas.length !== 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 700, color: C.red }}>{fmt(r.total)}</span>
          <span style={{ fontSize: 12, color: C.gray400 }}>{abierta ? "▲" : "▼"}</span>
        </div>
      </div>
      {abierta && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.gray100}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 18 }}>
          <Datos c={c} puedeEditar={puedeEditar} onGuardar={onGuardar} />
          <Contactos c={c} puedeEditar={puedeEditar} onGuardar={onGuardar} />
          <Ventas ventas={r.ventas} />
        </div>
      )}
    </Card>
  );
}

const Titulo = ({ children }) => <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, letterSpacing: 0.5, marginBottom: 8 }}>{children}</div>;

function Datos({ c, puedeEditar, onGuardar }) {
  const inicial = { nombre: c.nombre || "", razon_social: c.razon_social || "", rut: c.rut || "", email: c.email || "", telefono: c.telefono || "", direccion: c.direccion || "", crm: c.crm || "", ejecutivo: c.ejecutivo || "", notas: c.notas || "" };
  const [f, setF] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const cambiado = Object.keys(inicial).some(k => f[k] !== inicial[k]);
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  const campo = (k, label, props = {}) => (
    <Field label={label}><input value={f[k]} onChange={set(k)} disabled={!puedeEditar} style={inp} {...props} /></Field>
  );
  return (
    <div>
      <Titulo>DATOS</Titulo>
      <Grid2>
        {campo("nombre", "Nombre")}
        {campo("razon_social", "Razón social")}
        {campo("rut", "RUT")}
        {campo("email", "Email", { type: "email" })}
        {campo("telefono", "Teléfono")}
        {campo("direccion", "Dirección")}
        <Field label="CRM que usa">
          <select value={f.crm} onChange={set("crm")} disabled={!puedeEditar} style={inp}>
            <option value="">—</option>
            {CRMS.map(x => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Vendedor a cargo">
          <select value={f.ejecutivo} onChange={set("ejecutivo")} disabled={!puedeEditar} style={inp}>
            <option value="">Sin asignar</option>
            {VENDEDORES.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
      </Grid2>
      <div style={{ marginTop: 12 }}>
        <Field label="Notas">
          <textarea value={f.notas} onChange={set("notas")} disabled={!puedeEditar} rows={2} style={{ ...inp, resize: "vertical" }} placeholder="Condiciones especiales, cómo prefieren que los contacten…" />
        </Field>
      </div>
      {puedeEditar && cambiado && (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          <Btn size="sm" onClick={() => setF(inicial)}>Descartar</Btn>
          <Btn size="sm" variant="primary" disabled={guardando || !f.nombre.trim()} onClick={async () => { setGuardando(true); await onGuardar({ ...f, nombre: f.nombre.trim() }); setGuardando(false); }}>Guardar</Btn>
        </div>
      )}
    </div>
  );
}

function Contactos({ c, puedeEditar, onGuardar }) {
  const contactos = c.contactos || [];
  const vacio = { nombre: "", cargo: "", email: "", telefono: "" };
  const [nuevo, setNuevo] = useState(null);
  const agregar = async () => { await onGuardar({ contactos: [...contactos, nuevo] }); setNuevo(null); };
  const quitar = async i => { if (window.confirm(`¿Quitar a ${contactos[i].nombre}?`)) await onGuardar({ contactos: contactos.filter((_, j) => j !== i) }); };
  return (
    <div>
      <Titulo>CONTACTOS</Titulo>
      {!contactos.length && !nuevo && <div style={{ fontSize: 12, color: C.gray400 }}>Sin contactos cargados.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {contactos.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", background: C.gray50, borderRadius: 8, fontSize: 12 }}>
            <div>
              <strong style={{ color: C.black }}>{p.nombre}</strong>{p.cargo && <span style={{ color: C.gray500 }}> · {p.cargo}</span>}
              <div style={{ color: C.gray600, marginTop: 2 }}>{[p.email, p.telefono].filter(Boolean).join(" · ")}</div>
            </div>
            {puedeEditar && <Btn size="sm" variant="ghost" onClick={() => quitar(i)}>Quitar</Btn>}
          </div>
        ))}
      </div>
      {nuevo ? (
        <div style={{ marginTop: 8, padding: 10, border: `1px solid ${C.gray200}`, borderRadius: 8 }}>
          <Grid2>
            {[["nombre", "Nombre"], ["cargo", "Cargo"], ["email", "Email"], ["telefono", "Teléfono"]].map(([k, l]) => (
              <Field key={k} label={l}><input value={nuevo[k]} onChange={e => setNuevo(x => ({ ...x, [k]: e.target.value }))} style={inp} /></Field>
            ))}
          </Grid2>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn size="sm" onClick={() => setNuevo(null)}>Cancelar</Btn>
            <Btn size="sm" variant="primary" disabled={!nuevo.nombre.trim()} onClick={agregar}>Agregar</Btn>
          </div>
        </div>
      ) : puedeEditar && <div style={{ marginTop: 8 }}><Btn size="sm" onClick={() => setNuevo(vacio)}>+ Agregar contacto</Btn></div>}
    </div>
  );
}

function Ventas({ ventas }) {
  const [abierta, setAbierta] = useState(null);
  const orden = [...ventas].sort((a, b) => String(b.fecha_inicio || "").localeCompare(String(a.fecha_inicio || "")));
  return (
    <div>
      <Titulo>VENTAS</Titulo>
      {!orden.length && <div style={{ fontSize: 12, color: C.gray400 }}>Sin ventas asociadas.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {orden.map(s => {
          const cuotas = cuotasDe(s);
          const ver = abierta === s.id;
          return (
            <div key={s.id} style={{ borderRadius: 8, border: `1px solid ${C.gray200}`, overflow: "hidden" }}>
              <div onClick={() => cuotas.length && setAbierta(ver ? null : s.id)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 10px", background: C.gray50, flexWrap: "wrap", gap: 6, cursor: cuotas.length ? "pointer" : "default" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: C.black }}>{s.plan} · {s.crm}</div>
                  <div style={{ fontSize: 11, color: C.gray400, marginTop: 2 }}>{getUser(s.ejecutivo)?.name} · {s.fecha_inicio} → {s.fecha_fin}</div>
                  {cuotas.length > 0 && <div style={{ fontSize: 11, color: C.blue, marginTop: 1 }}>{cuotas.length} cuotas · {cuotas.filter(x => x.pagada).length} cobradas {ver ? "▲" : "▼"}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: C.red }}>{fmt(s.total)}</div>
                  <Badge color={s.estado === "cancelada" ? "gray" : "green"}>{s.estado || "activa"}</Badge>
                </div>
              </div>
              {ver && (
                <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                  {cuotas.map(det => (
                    <div key={det.numero} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", borderRadius: 6, background: det.pagada ? C.greenLight : C.gray50, border: `1px solid ${det.pagada ? C.green : C.gray200}`, fontSize: 11 }}>
                      <span><strong>Cuota {det.numero}/{cuotas.length}</strong><span style={{ color: C.gray400, marginLeft: 8 }}>{det.fecha}</span>{det.nro_factura && <span style={{ color: C.gray400, marginLeft: 8 }}>Fact: {det.nro_factura}</span>}</span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <strong style={{ color: det.pagada ? C.green : C.black }}>{fmt(det.monto)}</strong>
                        <Badge color={det.pagada ? "green" : det.gestionado ? "blue" : "amber"}>{det.pagada ? "Pagada" : det.gestionado ? "Gestionada" : "Pendiente"}</Badge>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
