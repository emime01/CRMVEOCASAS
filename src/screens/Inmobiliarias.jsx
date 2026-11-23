import { useEffect, useMemo, useState } from "react";
import { C, USERS, ASIGNABLES, CRMS, RESULTADOS_GESTION, CANALES_GESTION } from "../constants";
import { Card, Btn, Badge, Stat, Field, Grid2, Modal, ModalHeader, ModalBody, ModalFooter, Spinner, EmptyState, inp } from "../components/UI";
import { asignar, registrarGestion, linkWhatsapp, fechaCorta, nombreUsuario } from "../prospectos";
import { ESTADOS_COMERCIALES, indexarVentas, ventasDe, estadoComercial, guardarFicha, crearInmobiliaria } from "../inmobiliarias";
import { hoyISO } from "../cuotas";
import { fmtMoneda } from "../moneda";
import { linkCalendario } from "../seguimientos";

// Base de inmobiliarias: todas en una lista, con su vendedor y su estado (cliente, ex cliente, prospecto).
// La gerente ve todas, asigna y reasigna; cada vendedor ve las suyas. Al abrir una se ve su ficha completa.
const DEPTOS = ["Montevideo", "Canelones", "Maldonado", "Colonia", "Rocha", "San José", "Lavalleja", "Florida", "Durazno", "Flores",
  "Soriano", "Río Negro", "Paysandú", "Salto", "Artigas", "Rivera", "Tacuarembó", "Cerro Largo", "Treinta y Tres"];
const POR_PAGINA = 100;
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const proximo = l => l.ultimaGestion?.proximoContacto || "";

// vistaInicial / vendedorInicial: para llegar filtrado desde el aviso del panel ("para contactar hoy")
export default function Inmobiliarias({ currentUser, prospectos, setProspectos, cargar, cargando, sales, onCrearVenta, vistaInicial = "todas", vendedorInicial = "" }) {
  const esGerente = currentUser.role === "gerente";
  const esVendedor = currentUser.role === "vendedor";
  const puedeEditar = esGerente || esVendedor;
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [vendedor, setVendedor] = useState(esVendedor ? currentUser.id : vendedorInicial);
  const [depto, setDepto] = useState("");
  const [vista, setVista] = useState(vistaInicial); // todas | hoy | sin_gestion
  const [sel, setSel] = useState(new Set());
  const [destino, setDestino] = useState(ASIGNABLES[0]);
  const [pagina, setPagina] = useState(1);
  const [abierta, setAbierta] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { if (!prospectos && !cargando) cargar(); }, []);
  useEffect(() => setPagina(1), [q, estado, vendedor, depto, vista]);

  const idx = useMemo(() => indexarVentas(sales), [sales]);
  const todas = useMemo(() => (prospectos || []).map(l => {
    const ventas = ventasDe(l, idx);
    return { l, ventas, estado: estadoComercial(l, ventas) };
  }), [prospectos, idx]);

  const visibles = todas.filter(x => !esVendedor || x.l.asignadoA === currentUser.id);
  const hoy = hoyISO();
  const lista = visibles.filter(({ l, estado: e }) =>
    (!estado || e === estado) &&
    (!vendedor || (vendedor === "sin" ? !l.asignadoA : l.asignadoA === vendedor)) &&
    (!depto || (depto === "sin" ? !l.departamento : l.departamento === depto)) &&
    (vista !== "hoy" || (proximo(l) && proximo(l) <= hoy)) &&
    (vista !== "sin_gestion" || !(l.gestiones || []).length) &&
    (!q || norm(`${l.nombre} ${l.email} ${l.telefono} ${l.razon_social} ${l.rut}`).includes(norm(q))))
    .sort((a, b) => vista === "hoy" ? proximo(a.l).localeCompare(proximo(b.l)) : String(a.l.nombre).localeCompare(String(b.l.nombre), "es"));
  const cuenta = f => visibles.filter(f).length;

  const actualizar = (id, cambios) => setProspectos(prev => prev.map(l => l.id === id ? { ...l, ...cambios } : l));
  const asignarSel = async () => {
    setGuardando(true);
    for (const id of sel) {
      const l = prospectos.find(x => x.id === id);
      if (l) actualizar(id, await asignar(l, destino === "_ninguno" ? null : destino, currentUser.id));
    }
    setSel(new Set()); setGuardando(false);
  };
  const toggle = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pagina_ = lista.slice(0, pagina * POR_PAGINA);
  const fichaAbierta = abierta && todas.find(x => x.l.id === abierta);

  if (cargando || !prospectos) return <Spinner />;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.black }}>{esVendedor ? "Mis inmobiliarias" : "Inmobiliarias"}</div>
          <div style={{ fontSize: 13, color: C.gray500, marginTop: 2 }}>
            {esVendedor ? "Las inmobiliarias a tu cargo: clientes y prospectos." : "Toda la base, con el vendedor a cargo de cada una."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn size="sm" onClick={cargar}>Actualizar</Btn>
          {puedeEditar && <Btn size="sm" variant="primary" onClick={() => setNueva(true)}>+ Nueva inmobiliaria</Btn>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(140px,100%),1fr))", gap: 10, marginBottom: 14 }}>
        {[["", "Todas", () => true], ["cliente", "Clientes", x => x.estado === "cliente"], ["ex_cliente", "Ex clientes", x => x.estado === "ex_cliente"],
          ["prospecto", "Prospectos", x => x.estado === "prospecto"], ["no_interesada", "No interesadas", x => x.estado === "no_interesada"]].map(([k, label, f]) => (
          <div key={k} onClick={() => setEstado(k)} style={{ cursor: "pointer", outline: estado === k ? `2px solid ${C.red}` : "none", borderRadius: 12 }}>
            <Stat label={label} value={cuenta(f)} />
          </div>
        ))}
        {!esVendedor && (
          <div onClick={() => { setVendedor("sin"); setEstado(""); }} style={{ cursor: "pointer", outline: vendedor === "sin" ? `2px solid ${C.red}` : "none", borderRadius: 12 }}>
            <Stat label="Sin vendedor" value={cuenta(x => !x.l.asignadoA)} color={C.amber} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, email, teléfono o RUT" style={{ ...inp, flex: "1 1 220px" }} />
        {!esVendedor && (
          <select value={vendedor} onChange={e => setVendedor(e.target.value)} style={{ ...inp, width: "auto" }}>
            <option value="">Todos los vendedores</option>
            <option value="sin">Sin vendedor</option>
            {ASIGNABLES.map(id => <option key={id} value={id}>{nombreUsuario(id)}</option>)}
            <option value="lucas">Lucas (ya no está)</option>
          </select>
        )}
        <select value={depto} onChange={e => setDepto(e.target.value)} style={{ ...inp, width: "auto" }}>
          <option value="">Todos los departamentos</option>
          {DEPTOS.map(d => <option key={d}>{d}</option>)}
          <option value="sin">Sin departamento</option>
        </select>
        <select value={vista} onChange={e => setVista(e.target.value)} style={{ ...inp, width: "auto" }}>
          <option value="todas">Todas</option>
          <option value="hoy">Para volver a contactar hoy</option>
          <option value="sin_gestion">Nunca contactadas</option>
        </select>
      </div>

      {esGerente && sel.size > 0 && (
        <Card style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{sel.size} seleccionada{sel.size !== 1 ? "s" : ""}</span>
          <span style={{ fontSize: 13, color: C.gray500 }}>Asignar a</span>
          <select value={destino} onChange={e => setDestino(e.target.value)} style={{ ...inp, width: "auto" }}>
            {ASIGNABLES.map(id => <option key={id} value={id}>{nombreUsuario(id)}</option>)}
            <option value="_ninguno">Nadie (sacar vendedor)</option>
          </select>
          <Btn size="sm" variant="primary" disabled={guardando} onClick={asignarSel}>{guardando ? "Guardando…" : "Asignar"}</Btn>
          <Btn size="sm" onClick={() => setSel(new Set())}>Cancelar</Btn>
        </Card>
      )}

      <div style={{ fontSize: 12, color: C.gray500, marginBottom: 6 }}>{lista.length} inmobiliaria{lista.length !== 1 ? "s" : ""}</div>
      {!lista.length ? <EmptyState icon="🔍" title="No hay inmobiliarias con estos filtros" /> : (
        <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.gray50, textAlign: "left" }}>
                {esGerente && <th style={{ padding: "10px 12px", width: 30 }}>
                  <input type="checkbox" checked={pagina_.length > 0 && pagina_.every(x => sel.has(x.l.id))}
                    onChange={e => setSel(e.target.checked ? new Set(pagina_.map(x => x.l.id)) : new Set())} />
                </th>}
                {["Inmobiliaria", "Estado", !esVendedor && "Vendedor", "Contacto", "Última gestión"].filter(Boolean).map(h =>
                  <th key={h} style={{ padding: "10px 12px", fontSize: 11, color: C.gray500, fontWeight: 600, textTransform: "uppercase" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {pagina_.map(({ l, estado: e }) => {
                const est = ESTADOS_COMERCIALES[e];
                const vence = proximo(l) && proximo(l) <= hoy;
                return (
                  <tr key={l.id} onClick={() => setAbierta(l.id)} style={{ borderTop: `1px solid ${C.gray100}`, cursor: "pointer" }}
                    onMouseEnter={ev => ev.currentTarget.style.background = C.gray50} onMouseLeave={ev => ev.currentTarget.style.background = ""}>
                    {esGerente && <td style={{ padding: "8px 12px" }} onClick={ev => ev.stopPropagation()}>
                      <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} />
                    </td>}
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ fontWeight: 600, color: C.black }}>{l.nombre}</div>
                      <div style={{ fontSize: 11, color: C.gray500 }}>{l.departamento || "Sin departamento"}</div>
                    </td>
                    <td style={{ padding: "8px 12px" }}><Badge color={est.color}>{est.label}</Badge></td>
                    {!esVendedor && <td style={{ padding: "8px 12px", color: l.asignadoA ? C.gray700 : C.amber }}>{l.asignadoA ? nombreUsuario(l.asignadoA) : "Sin vendedor"}</td>}
                    <td style={{ padding: "8px 12px", fontSize: 12, color: C.gray600 }}>
                      {l.telefono || (l.whatsapp && `+${l.whatsapp}`) || ""}{l.email && <div>{l.email}</div>}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: vence ? C.red : C.gray500 }}>
                      {l.ultimaGestion ? `${RESULTADOS_GESTION.find(r => r.id === l.ultimaGestion.resultado)?.label || ""} · ${fechaCorta(l.ultimaGestion.fecha)}` : "—"}
                      {proximo(l) && <div>volver el {fechaCorta(proximo(l))}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pagina_.length < lista.length && (
        <div style={{ textAlign: "center", marginTop: 12 }}><Btn size="sm" onClick={() => setPagina(p => p + 1)}>Ver más ({lista.length - pagina_.length})</Btn></div>
      )}

      {fichaAbierta && (
        <Ficha x={fichaAbierta} currentUser={currentUser} puedeEditar={puedeEditar} esGerente={esGerente}
          onClose={() => setAbierta(null)} onCambios={c => actualizar(fichaAbierta.l.id, c)}
          onCrearVenta={() => { setAbierta(null); onCrearVenta(fichaAbierta.l); }} />
      )}
      {nueva && (
        <NuevaInmobiliaria currentUser={currentUser} esGerente={esGerente} onClose={() => setNueva(false)}
          onCreada={l => { setProspectos(prev => [...prev, l]); setNueva(false); setAbierta(l.id); }} />
      )}
    </div>
  );
}

const Titulo = ({ children }) => <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, letterSpacing: 0.5, margin: "4px 0 8px" }}>{children}</div>;

function Ficha({ x, currentUser, puedeEditar, esGerente, onClose, onCambios, onCrearVenta }) {
  const { l, ventas, estado } = x;
  const inicial = { nombre: l.nombre || "", razon_social: l.razon_social || "", rut: l.rut || "", email: l.email || "", telefono: l.telefono || "",
    whatsapp: l.whatsapp || "", web: l.web || "", instagram: l.instagram || "", direccion: l.direccion || "", departamento: l.departamento || "",
    crm_usa: l.crm_usa || "", notas: l.notas || "" };
  const [f, setF] = useState(inicial);
  const [g, setG] = useState({ canal: "WhatsApp", resultado: "contactado", nota: "", proximoContacto: "" });
  const [guardando, setGuardando] = useState(false);
  const [contacto, setContacto] = useState(null);
  const cambiado = Object.keys(inicial).some(k => f[k] !== inicial[k]);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const wa = linkWhatsapp(l, currentUser.id);
  const est = ESTADOS_COMERCIALES[estado];

  const guardar = async () => { setGuardando(true); onCambios(await guardarFicha(l, f)); setGuardando(false); };
  const gestionar = async () => { setGuardando(true); onCambios(await registrarGestion(l, { ...g, por: currentUser.id })); setG({ ...g, nota: "", proximoContacto: "" }); setGuardando(false); };
  const reasignar = async id => onCambios(await asignar(l, id || null, currentUser.id));
  const agregarContacto = async () => { onCambios(await guardarFicha(l, { contactos: [...(l.contactos || []), contacto] })); setContacto(null); };
  const campo = (k, label) => <Field label={label}><input value={f[k]} onChange={set(k)} disabled={!puedeEditar} style={inp} /></Field>;

  return (
    <Modal onClose={onClose} maxWidth={860}>
      <ModalHeader title={l.nombre} subtitle={`${est.label}${l.asignadoA ? ` · ${nombreUsuario(l.asignadoA)}` : " · Sin vendedor"}`} onClose={onClose} />
      <ModalBody>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {wa && <a href={wa} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn size="sm" variant="success">WhatsApp</Btn></a>}
          {l.telefono && <a href={`tel:${String(l.telefono).replace(/[^\d+]/g, "")}`} style={{ textDecoration: "none" }}><Btn size="sm">Llamar</Btn></a>}
          {l.email && <a href={`mailto:${l.email}`} style={{ textDecoration: "none" }}><Btn size="sm">Email</Btn></a>}
          {puedeEditar && <Btn size="sm" variant="primary" onClick={onCrearVenta}>Crear venta</Btn>}
          {esGerente && (
            <select value={l.asignadoA || ""} onChange={e => reasignar(e.target.value)} style={{ ...inp, width: "auto", marginLeft: "auto" }}>
              <option value="">Sin vendedor</option>
              {ASIGNABLES.map(id => <option key={id} value={id}>{nombreUsuario(id)}</option>)}
              {l.asignadoA === "lucas" && <option value="lucas">Lucas</option>}
            </select>
          )}
        </div>

        <Titulo>DATOS</Titulo>
        <Grid2>
          {campo("nombre", "Nombre")}{campo("razon_social", "Razón social")}{campo("rut", "RUT")}{campo("email", "Email")}
          {campo("telefono", "Teléfono")}{campo("whatsapp", "WhatsApp")}{campo("web", "Web")}{campo("instagram", "Instagram")}
          {campo("direccion", "Dirección")}{campo("departamento", "Departamento")}
          <Field label="CRM que usa">
            <select value={f.crm_usa} onChange={set("crm_usa")} disabled={!puedeEditar} style={inp}>
              <option value="">—</option>{CRMS.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </Grid2>
        <div style={{ marginTop: 10 }}>
          <Field label="Notas"><textarea value={f.notas} onChange={set("notas")} disabled={!puedeEditar} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
        </div>
        {puedeEditar && cambiado && (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn size="sm" onClick={() => setF(inicial)}>Descartar</Btn>
            <Btn size="sm" variant="primary" disabled={guardando || !f.nombre.trim()} onClick={guardar}>Guardar datos</Btn>
          </div>
        )}

        <div style={{ marginTop: 18 }}><Titulo>CONTACTOS</Titulo></div>
        {(l.contactos || []).map((p, i) => (
          <div key={i} style={{ fontSize: 12, padding: "6px 10px", background: C.gray50, borderRadius: 8, marginBottom: 4 }}>
            <strong>{p.nombre}</strong>{p.cargo && ` · ${p.cargo}`}<span style={{ color: C.gray500 }}>{[p.email, p.telefono].filter(Boolean).map(v => ` · ${v}`).join("")}</span>
          </div>
        ))}
        {contacto ? (
          <div style={{ padding: 10, border: `1px solid ${C.gray200}`, borderRadius: 8 }}>
            <Grid2>{[["nombre", "Nombre"], ["cargo", "Cargo"], ["email", "Email"], ["telefono", "Teléfono"]].map(([k, lb]) =>
              <Field key={k} label={lb}><input value={contacto[k]} onChange={e => setContacto(c => ({ ...c, [k]: e.target.value }))} style={inp} /></Field>)}</Grid2>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn size="sm" onClick={() => setContacto(null)}>Cancelar</Btn>
              <Btn size="sm" variant="primary" disabled={!contacto.nombre.trim()} onClick={agregarContacto}>Agregar</Btn>
            </div>
          </div>
        ) : puedeEditar && <Btn size="sm" onClick={() => setContacto({ nombre: "", cargo: "", email: "", telefono: "" })}>+ Agregar contacto</Btn>}

        <div style={{ marginTop: 18 }}><Titulo>GESTIONES</Titulo></div>
        {puedeEditar && (
          <div style={{ padding: 10, border: `1px solid ${C.gray200}`, borderRadius: 8, marginBottom: 8 }}>
            <Grid2>
              <Field label="Canal"><select value={g.canal} onChange={e => setG(v => ({ ...v, canal: e.target.value }))} style={inp}>{CANALES_GESTION.map(c => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Resultado"><select value={g.resultado} onChange={e => setG(v => ({ ...v, resultado: e.target.value }))} style={inp}>{RESULTADOS_GESTION.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Field>
              <Field label="Nota"><input value={g.nota} onChange={e => setG(v => ({ ...v, nota: e.target.value }))} style={inp} placeholder="Qué te dijeron, con quién hablaste…" /></Field>
              <Field label="Volver a contactar el"><input type="date" value={g.proximoContacto} min={hoyISO()} onChange={e => setG(v => ({ ...v, proximoContacto: e.target.value }))} style={inp} /></Field>
            </Grid2>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {g.proximoContacto && <BotonCalendario href={linkCalendario({ nombre: l.nombre, fecha: g.proximoContacto, telefono: l.telefono, nota: g.nota, vendedor: l.asignadoA })} />}
              <Btn size="sm" variant="primary" disabled={guardando} onClick={gestionar}>Registrar gestión</Btn>
            </div>
          </div>
        )}
        {[...(l.gestiones || [])].reverse().map((h, i) => (
          <div key={i} style={{ fontSize: 12, color: C.gray600, padding: "4px 0", borderBottom: `1px solid ${C.gray100}` }}>
            <strong>{fechaCorta(h.fecha)}</strong> · {h.canal} · {RESULTADOS_GESTION.find(r => r.id === h.resultado)?.label} · {nombreUsuario(h.por)}
            {h.nota && <span style={{ color: C.gray500 }}> — “{h.nota}”</span>}
            {h.proximoContacto && <span> · volver el {fechaCorta(h.proximoContacto)}</span>}
            {h.proximoContacto && h.proximoContacto >= hoyISO() && i === 0 &&
              <a href={linkCalendario({ nombre: l.nombre, fecha: h.proximoContacto, telefono: l.telefono, nota: h.nota, vendedor: l.asignadoA })} target="_blank" rel="noreferrer" style={{ marginLeft: 6, color: C.red, fontWeight: 600, textDecoration: "none" }}>📅 Agendar</a>}
          </div>
        ))}
        {!(l.gestiones || []).length && <div style={{ fontSize: 12, color: C.gray400 }}>Sin gestiones todavía.</div>}

        <div style={{ marginTop: 18 }}><Titulo>VENTAS</Titulo></div>
        {!ventas.length && <div style={{ fontSize: 12, color: C.gray400 }}>Sin ventas en el CRM.</div>}
        {[...ventas].sort((a, b) => String(b.fecha_inicio || "").localeCompare(String(a.fecha_inicio || ""))).map(v => (
          <div key={v.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 10px", background: C.gray50, borderRadius: 8, marginBottom: 4 }}>
            <span><strong>{v.plan || "Plan"}</strong> · {v.fecha_inicio} → {v.fecha_fin} · {nombreUsuario(v.ejecutivo)}</span>
            <span><strong>{fmtMoneda(v.total, v.moneda)}</strong> {v.estado === "cancelada" && <Badge color="gray">cancelada</Badge>}</span>
          </div>
        ))}
      </ModalBody>
      <ModalFooter><Btn onClick={onClose}>Cerrar</Btn></ModalFooter>
    </Modal>
  );
}

// Abre Google Calendar con el recordatorio armado: el vendedor lo guarda y Google le avisa ese día
export const BotonCalendario = ({ href }) => (
  <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }} title="Abre tu Google Calendar con el recordatorio armado">
    <Btn size="sm">📅 Agregar a Google Calendar</Btn>
  </a>
);

function NuevaInmobiliaria({ currentUser, esGerente, onClose, onCreada }) {
  const [f, setF] = useState({ nombre: "", telefono: "", email: "", departamento: "", asignadoA: esGerente ? "" : currentUser.id });
  const [guardando, setGuardando] = useState(false);
  const crear = async () => {
    setGuardando(true);
    const { asignadoA, ...datos } = f;
    const l = await crearInmobiliaria({ ...datos, nombre: datos.nombre.trim() }, { asignadoA: asignadoA || null, porId: currentUser.id });
    setGuardando(false);
    if (l) onCreada(l); else alert("No se pudo guardar. Revisá la conexión.");
  };
  return (
    <Modal onClose={onClose} maxWidth={520}>
      <ModalHeader title="Nueva inmobiliaria" onClose={onClose} />
      <ModalBody>
        <Grid2>
          {[["nombre", "Nombre"], ["telefono", "Teléfono"], ["email", "Email"], ["departamento", "Departamento"]].map(([k, lb]) =>
            <Field key={k} label={lb}><input value={f[k]} onChange={e => setF(v => ({ ...v, [k]: e.target.value }))} style={inp} /></Field>)}
          {esGerente && (
            <Field label="Vendedor">
              <select value={f.asignadoA} onChange={e => setF(v => ({ ...v, asignadoA: e.target.value }))} style={inp}>
                <option value="">Sin vendedor</option>{ASIGNABLES.map(id => <option key={id} value={id}>{nombreUsuario(id)}</option>)}
              </select>
            </Field>
          )}
        </Grid2>
      </ModalBody>
      <ModalFooter>
        <Btn onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={guardando || !f.nombre.trim()} onClick={crear}>Crear</Btn>
      </ModalFooter>
    </Modal>
  );
}
