import { useState } from "react";
import { C, USERS } from "../constants";
import { Card, Btn, Badge, Field, Grid2, Modal, ModalHeader, ModalBody, ModalFooter, EmptyState, inp } from "../components/UI";
import { addItem, updateItem, deleteItem } from "../firebase";
import { fechaCorta } from "../prospectos";
import {
  COLUMNAS, LISTA, ESTADO_LABEL, DIAS_FRENADA, abierta, estadoDe, ultimoMovimiento, diasDesde, atrasada, frenada,
  cambiosAlMover, puedeMover, puedeEditar, AUTOMATICAS,
} from "../tareas";

// Tareas en tablero: Por hacer → En curso → En espera → Listo. Las listas salen del tablero y van al Histórico.
// Cualquiera crea tareas y se las asigna a quien sea; Mika ve las de todo el equipo en "Equipo".

const getUser = id => USERS.find(u => u.id === id);
const nombre = id => getUser(id)?.name || "—";
const ASIGNABLES = USERS.filter(u => !["inactivo", "gerente_general"].includes(u.role));
const fechaHora = iso => (iso ? `${fechaCorta(iso.slice(0, 10))} ${iso.slice(11, 16)}` : "");
const VACIA = { titulo: "", descripcion: "", asignada_a: "", vence: "", prioridad: "normal" };

export default function Tareas({ tareas, setTareas, currentUser, vistaInicial }) {
  const esGerente = currentUser.role === "gerente";
  const [vista, setVista] = useState(vistaInicial === "equipo" && esGerente ? "equipo" : "mias");
  const [persona, setPersona] = useState("todos");
  const [busca, setBusca] = useState("");
  const [nueva, setNueva] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [editando, setEditando] = useState(null);
  const [completando, setCompletando] = useState(null);
  const [comentario, setComentario] = useState("");
  const [arrastrando, setArrastrando] = useState(null);
  const [sobre, setSobre] = useState(null);

  const guardarLocal = (id, cambios) => setTareas(prev => prev.map(t => (t.id === id ? { ...t, ...cambios } : t)));

  const mover = async (t, estado, coment = "") => {
    if (estadoDe(t) === estado || !puedeMover(t, currentUser)) return;
    const cambios = cambiosAlMover(t, estado, currentUser.id, coment);
    guardarLocal(t.id, cambios);
    if (!(await updateItem("tareas", t.id, cambios))) {
      guardarLocal(t.id, { estado: t.estado, historial: t.historial || [], movida_at: t.movida_at || null });
      window.alert("No se pudo mover la tarea. Revisá la conexión y probá de nuevo.");
    }
  };
  const pedirListo = t => { setCompletando(t); setComentario(""); };
  const confirmarListo = async () => {
    await mover(completando, LISTA, comentario.trim());
    setCompletando(null); setDetalle(null); setComentario("");
  };

  const crear = async () => {
    if (!nueva.titulo.trim() || !nueva.asignada_a) return;
    const at = new Date().toISOString();
    const data = await addItem("tareas", {
      titulo: nueva.titulo.trim(), descripcion: nueva.descripcion.trim(), asignada_a: nueva.asignada_a,
      creada_por: currentUser.id, vence: nueva.vence, prioridad: nueva.prioridad, estado: "pendiente",
      movida_at: at, historial: [],
    });
    if (data) setTareas(prev => [data, ...prev.filter(t => t.id !== data.id)]);
    else window.alert("No se pudo crear la tarea. Revisá la conexión y probá de nuevo.");
    setNueva(null);
  };

  const guardarEdicion = async () => {
    const cambios = {
      titulo: editando.titulo.trim(), descripcion: editando.descripcion || "", asignada_a: editando.asignada_a,
      vence: editando.vence || "", prioridad: editando.prioridad || "normal",
    };
    if (!cambios.titulo) return;
    if (await updateItem("tareas", editando.id, cambios)) { guardarLocal(editando.id, cambios); setDetalle(d => d && { ...d, ...cambios }); }
    setEditando(null);
  };

  const borrar = async t => {
    if (!window.confirm(`¿Borrar la tarea "${t.titulo}"? No se puede deshacer.`)) return;
    if (await deleteItem("tareas", t.id)) { setTareas(prev => prev.filter(x => x.id !== t.id)); setDetalle(null); }
  };

  // ── Qué tareas muestra cada vista ──
  const coincide = t => !busca || `${t.titulo} ${t.descripcion || ""}`.toLowerCase().includes(busca.toLowerCase());
  const deLaPersona = t => persona === "todos" || t.asignada_a === persona;
  const abiertas = tareas.filter(abierta);
  const mias = abiertas.filter(t => t.asignada_a === currentUser.id);
  const pedidas = abiertas.filter(t => t.creada_por === currentUser.id && t.asignada_a !== currentUser.id);
  const enTablero = (vista === "mias" ? mias : vista === "pedidas" ? pedidas : abiertas.filter(deLaPersona)).filter(coincide);
  const historico = tareas
    .filter(t => !abierta(t))
    .filter(t => (esGerente ? deLaPersona(t) : t.asignada_a === currentUser.id || t.creada_por === currentUser.id))
    .filter(coincide)
    .sort((a, b) => String(b.completada_at || "").localeCompare(String(a.completada_at || "")));

  const mostrarAsignada = vista !== "mias";
  const ordenar = l => [...l].sort((a, b) =>
    (b.prioridad === "alta") - (a.prioridad === "alta") ||
    String(a.vence || "9999").localeCompare(String(b.vence || "9999")) ||
    String(b.created_at || "").localeCompare(String(a.created_at || "")));

  // Las partes de la pantalla se llaman como funciones (no como <Componente/>) para que los campos no pierdan el foco
  // al escribir y el arrastre no se corte cuando el tablero se redibuja.
  // ── Tarjeta ──
  const tarjeta = t => {
    const est = estadoDe(t);
    const i = COLUMNAS.findIndex(c => c.id === est);
    const mueve = puedeMover(t, currentUser);
    const atr = atrasada(t), fren = frenada(t);
    const btn = { border: `1px solid ${C.gray200}`, background: C.white, borderRadius: 6, cursor: "pointer", fontSize: 11, padding: "3px 8px", fontFamily: "inherit", color: C.gray700, whiteSpace: "nowrap" };
    return (
      <div key={t.id} draggable={mueve} onDragStart={e => { setArrastrando(t); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setArrastrando(null); setSobre(null); }}
        onClick={() => setDetalle(t)}
        style={{ background: C.white, border: `1px solid ${atr ? C.red : C.gray200}`, borderLeft: `3px solid ${t.prioridad === "alta" ? C.red : atr ? C.red : C.gray200}`,
          borderRadius: 8, padding: "9px 10px", cursor: mueve ? "grab" : "pointer", opacity: arrastrando?.id === t.id ? 0.4 : 1, boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.black, lineHeight: 1.35, wordBreak: "break-word" }}>{t.titulo}</div>
        {t.descripcion && <div style={{ fontSize: 11, color: C.gray500, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.descripcion}</div>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6, fontSize: 11, color: C.gray500 }}>
          {mostrarAsignada && <span>👤 <strong style={{ color: C.gray700 }}>{nombre(t.asignada_a)}</strong></span>}
          {t.creada_por && t.creada_por !== t.asignada_a && <span>de {nombre(t.creada_por)}</span>}
          {t.auto && <Badge color="blue" style={{ padding: "1px 7px", fontSize: 10 }}>⚙ {AUTOMATICAS[t.auto]?.label || "Automática"}</Badge>}
          {t.prioridad === "alta" && <Badge color="red" style={{ padding: "1px 7px", fontSize: 10 }}>Urgente</Badge>}
          {t.vence && <span style={{ color: atr ? C.red : C.gray500, fontWeight: atr ? 600 : 400 }}>📅 {atr ? "venció " : ""}{fechaCorta(t.vence)}</span>}
          {fren && <span style={{ color: C.amber }} title="Hace mucho que no cambia de columna">⏸ {diasDesde(ultimoMovimiento(t))} días sin moverse</span>}
        </div>
        {mueve && (
          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
            {i > 0 && <button style={btn} title={`Pasar a ${COLUMNAS[i - 1].label}`} onClick={() => mover(t, COLUMNAS[i - 1].id)}>← {COLUMNAS[i - 1].label}</button>}
            {i < COLUMNAS.length - 1 && <button style={btn} title={`Pasar a ${COLUMNAS[i + 1].label}`} onClick={() => mover(t, COLUMNAS[i + 1].id)}>{COLUMNAS[i + 1].label} →</button>}
            <button style={{ ...btn, marginLeft: "auto", color: C.green, borderColor: C.green }} onClick={() => pedirListo(t)}>✓ Listo</button>
          </div>
        )}
      </div>
    );
  };

  // ── Tablero ──
  const soltar = id => e => {
    e.preventDefault(); setSobre(null);
    const t = arrastrando; setArrastrando(null);
    if (!t) return;
    if (id === LISTA) pedirListo(t); else mover(t, id);
  };
  const zona = id => ({
    onDragOver: e => { if (arrastrando) { e.preventDefault(); if (sobre !== id) setSobre(id); } },
    onDragLeave: () => setSobre(s => (s === id ? null : s)),
    onDrop: soltar(id),
  });
  const tablero = () => (
    <div style={{ overflowX: "auto", paddingBottom: 6 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLUMNAS.length}, minmax(210px, 1fr)) minmax(130px, 0.5fr)`, gap: 10, minWidth: 780 }}>
        {COLUMNAS.map(col => {
          const lista = ordenar(enTablero.filter(t => estadoDe(t) === col.id));
          return (
            <div key={col.id} {...zona(col.id)}
              style={{ background: sobre === col.id ? C.blueLight : C.gray50, border: `1px dashed ${sobre === col.id ? C.blue : "transparent"}`, borderRadius: 10, padding: 10, minHeight: 220 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.gray700, textTransform: "uppercase", letterSpacing: 0.6 }}>{col.label}</span>
                  {col.ayuda && <div style={{ fontSize: 10, color: C.gray500 }}>{col.ayuda}</div>}
                </div>
                <Badge color={col.color}>{lista.length}</Badge>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lista.map(tarjeta)}
                {!lista.length && <div style={{ fontSize: 11, color: C.gray400, textAlign: "center", padding: "18px 0" }}>Sin tareas</div>}
              </div>
            </div>
          );
        })}
        <div {...zona(LISTA)}
          style={{ background: sobre === LISTA ? C.greenLight : C.white, border: `1px dashed ${sobre === LISTA ? C.green : C.gray200}`, borderRadius: 10, padding: 10, minHeight: 220,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 6 }}>
          <div style={{ fontSize: 22 }}>✓</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: 0.6 }}>Listo</div>
          <div style={{ fontSize: 11, color: C.gray500 }}>Soltá acá la tarea terminada: sale del tablero y pasa al histórico.</div>
        </div>
      </div>
    </div>
  );

  // ── Resumen del equipo (Mika) ──
  const resumen = () => {
    const hace30 = new Date(Date.now() - 30 * 864e5).toISOString();
    const filas = ASIGNABLES.map(u => {
      const suyas = abiertas.filter(t => t.asignada_a === u.id);
      return {
        u, total: suyas.length,
        cols: COLUMNAS.map(c => suyas.filter(t => estadoDe(t) === c.id).length),
        atr: suyas.filter(atrasada).length, fren: suyas.filter(frenada).length,
        listas: tareas.filter(t => t.asignada_a === u.id && !abierta(t) && (t.completada_at || "") >= hace30).length,
      };
    });
    const th = { textAlign: "right", padding: "6px 8px", fontSize: 11, color: C.gray500, fontWeight: 600, whiteSpace: "nowrap" };
    const td = { textAlign: "right", padding: "7px 8px", fontSize: 13 };
    return (
      <Card style={{ marginBottom: 16, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.gray200}` }}>
              <th style={{ ...th, textAlign: "left", paddingLeft: 14 }}>Persona</th>
              {COLUMNAS.map(c => <th key={c.id} style={th}>{c.label}</th>)}
              <th style={th}>Vencidas</th>
              <th style={th} title={`${DIAS_FRENADA} días o más sin cambiar de columna`}>Sin moverse</th>
              <th style={{ ...th, paddingRight: 14 }}>Listas (30 días)</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.u.id} onClick={() => setPersona(persona === f.u.id ? "todos" : f.u.id)}
                style={{ borderTop: `1px solid ${C.gray100}`, cursor: "pointer", background: persona === f.u.id ? C.redLight : "transparent" }}>
                <td style={{ ...td, textAlign: "left", paddingLeft: 14, fontWeight: 600 }}>{f.u.name}</td>
                {f.cols.map((n, i) => <td key={i} style={{ ...td, color: n ? C.black : C.gray400 }}>{n}</td>)}
                <td style={{ ...td, color: f.atr ? C.red : C.gray400, fontWeight: f.atr ? 700 : 400 }}>{f.atr}</td>
                <td style={{ ...td, color: f.fren ? C.amber : C.gray400, fontWeight: f.fren ? 700 : 400 }}>{f.fren}</td>
                <td style={{ ...td, paddingRight: 14, color: f.listas ? C.green : C.gray400 }}>{f.listas}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: C.gray500, padding: "8px 14px", borderTop: `1px solid ${C.gray100}` }}>Tocá una persona para ver solo sus tareas en el tablero.</div>
      </Card>
    );
  };

  // ── Histórico ──
  const historicoVista = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!historico.length && <EmptyState icon="🗂️" title="Sin tareas terminadas" desc="Cuando una tarea pasa a Listo, aparece acá." />}
      {historico.map(t => (
        <Card key={t.id} onClick={() => setDetalle(t)} style={{ cursor: "pointer", padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: C.black }}>{t.titulo}</div>
              <div style={{ fontSize: 11, color: C.gray500, marginTop: 2 }}>
                {nombre(t.asignada_a)}{t.creada_por && t.creada_por !== t.asignada_a ? ` · pedida por ${nombre(t.creada_por)}` : ""}
                {t.created_at && t.completada_at ? ` · tardó ${Math.max(0, diasDesde(t.created_at) - diasDesde(t.completada_at))} días` : ""}
              </div>
              {t.comentario_completado && <div style={{ fontSize: 12, color: C.green, marginTop: 4, fontStyle: "italic" }}>“{t.comentario_completado}”</div>}
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: C.gray500, whiteSpace: "nowrap" }}>
              <Badge color="green">Listo</Badge>
              <div style={{ marginTop: 4 }}>{t.completada_at ? fechaCorta(t.completada_at.slice(0, 10)) : ""}{t.completada_por ? ` · ${nombre(t.completada_por)}` : ""}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  // ── Formulario (nueva o editar) ──
  const formulario = (f, set) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Field label="Qué hay que hacer">
        <input autoFocus value={f.titulo} onChange={e => set({ ...f, titulo: e.target.value })} style={inp} placeholder="Ej.: Mandar propuesta a Casas del Sur" />
      </Field>
      <Field label="Detalle (opcional)">
        <textarea value={f.descripcion} onChange={e => set({ ...f, descripcion: e.target.value })} style={{ ...inp, height: 64, resize: "none" }} />
      </Field>
      <Grid2>
        <Field label="Para">
          <select value={f.asignada_a} onChange={e => set({ ...f, asignada_a: e.target.value })} style={inp}>
            <option value="">Elegí a quién…</option>
            {ASIGNABLES.map(u => <option key={u.id} value={u.id}>{u.id === currentUser.id ? `${u.name} (yo)` : u.name}</option>)}
          </select>
        </Field>
        <Field label="Para cuándo (opcional)">
          <input type="date" value={f.vence || ""} onChange={e => set({ ...f, vence: e.target.value })} style={inp} />
        </Field>
      </Grid2>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" checked={f.prioridad === "alta"} onChange={e => set({ ...f, prioridad: e.target.checked ? "alta" : "normal" })} /> Urgente
      </label>
    </div>
  );

  // detalle siempre con los datos al día (el tablero se actualiza solo)
  const det = detalle && (tareas.find(t => t.id === detalle.id) || detalle);
  const subtabs = [
    { id: "mias", label: `Mis tareas${mias.length ? ` (${mias.length})` : ""}` },
    { id: "pedidas", label: `Pedidas por mí${pedidas.length ? ` (${pedidas.length})` : ""}` },
    ...(esGerente ? [{ id: "equipo", label: "Equipo" }] : []),
    { id: "historico", label: "Histórico" },
  ];

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1240 }}>
      {nueva && (
        <Modal onClose={() => setNueva(null)} maxWidth={480}>
          <ModalHeader title="Nueva tarea" subtitle="Aparece en el tablero de la persona, en Por hacer" onClose={() => setNueva(null)} />
          <ModalBody>{formulario(nueva, setNueva)}</ModalBody>
          <ModalFooter>
            <Btn onClick={() => setNueva(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={crear} disabled={!nueva.titulo.trim() || !nueva.asignada_a}>Crear tarea</Btn>
          </ModalFooter>
        </Modal>
      )}

      {editando && (
        <Modal onClose={() => setEditando(null)} maxWidth={480}>
          <ModalHeader title="Editar tarea" onClose={() => setEditando(null)} />
          <ModalBody>{formulario(editando, setEditando)}</ModalBody>
          <ModalFooter>
            <Btn onClick={() => setEditando(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={guardarEdicion} disabled={!editando.titulo.trim() || !editando.asignada_a}>Guardar</Btn>
          </ModalFooter>
        </Modal>
      )}

      {completando && (
        <Modal onClose={() => setCompletando(null)} maxWidth={420}>
          <ModalHeader title="Tarea lista" subtitle={completando.titulo} onClose={() => setCompletando(null)} />
          <ModalBody>
            <Field label="Comentario (opcional)">
              <textarea autoFocus value={comentario} onChange={e => setComentario(e.target.value)} style={{ ...inp, height: 80, resize: "none" }} placeholder="¿Qué se hizo? ¿Algún detalle?" />
            </Field>
            <div style={{ fontSize: 11, color: C.gray500, marginTop: 8 }}>Sale del tablero y queda en el Histórico. Desde ahí se puede reabrir.</div>
          </ModalBody>
          <ModalFooter>
            <Btn onClick={() => setCompletando(null)}>Cancelar</Btn>
            <Btn variant="success" onClick={confirmarListo}>Marcar lista</Btn>
          </ModalFooter>
        </Modal>
      )}

      {det && !editando && !completando && (
        <Modal onClose={() => setDetalle(null)} maxWidth={520}>
          <ModalHeader title={det.titulo} subtitle={`Para ${nombre(det.asignada_a)}${det.creada_por ? ` · creada por ${nombre(det.creada_por)}` : ""}`} onClose={() => setDetalle(null)} />
          <ModalBody>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <Badge color={estadoDe(det) === LISTA ? "green" : COLUMNAS.find(c => c.id === estadoDe(det))?.color}>{ESTADO_LABEL[estadoDe(det)]}</Badge>
              {det.prioridad === "alta" && <Badge color="red">Urgente</Badge>}
              {det.vence && <Badge color={atrasada(det) ? "red" : "gray"}>Para el {fechaCorta(det.vence)}</Badge>}
              {frenada(det) && <Badge color="amber">{diasDesde(ultimoMovimiento(det))} días sin moverse</Badge>}
            </div>
            {det.auto && (
              <div style={{ background: C.blueLight, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.blue, marginBottom: 12 }}>
                ⚙ La creó el CRM. Pasa sola a Listo {AUTOMATICAS[det.auto]?.cierre || "cuando se resuelve"}.
              </div>
            )}
            {det.descripcion && <p style={{ fontSize: 13, color: C.gray700, lineHeight: 1.6, margin: "0 0 12px", whiteSpace: "pre-wrap" }}>{det.descripcion}</p>}
            {det.comentario_completado && (
              <div style={{ background: C.greenLight, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.green, marginBottom: 12 }}>
                <strong>Al terminarla:</strong> {det.comentario_completado}
              </div>
            )}
            {puedeMover(det, currentUser) && abierta(det) && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.gray500, marginBottom: 6 }}>Mover a</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {COLUMNAS.filter(c => c.id !== estadoDe(det)).map(c => <Btn key={c.id} size="sm" onClick={() => mover(det, c.id)}>{c.label}</Btn>)}
                  <Btn size="sm" variant="success" onClick={() => pedirListo(det)}>✓ Listo</Btn>
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, color: C.gray500, marginBottom: 4 }}>Movimientos</div>
            <div style={{ borderTop: `1px solid ${C.gray100}` }}>
              {[...(det.historial || []).map(h => ({ ...h, txt: `→ ${ESTADO_LABEL[h.estado] || h.estado}` })).reverse(),
                { txt: "Creada", por: det.creada_por, at: det.created_at }].map((h, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${C.gray100}` }}>
                  <span>{h.txt}{h.por ? ` · ${nombre(h.por)}` : ""}</span>
                  <span style={{ color: C.gray500, whiteSpace: "nowrap" }}>{fechaHora(h.at)}</span>
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            {puedeEditar(det, currentUser) && <Btn variant="danger" onClick={() => borrar(det)}>Borrar</Btn>}
            {!abierta(det) && puedeMover(det, currentUser) && <Btn onClick={() => { mover(det, "pendiente"); setDetalle(null); }}>Reabrir</Btn>}
            {puedeEditar(det, currentUser) && abierta(det) && <Btn onClick={() => setEditando({ ...VACIA, ...det })}>Editar</Btn>}
            <Btn onClick={() => setDetalle(null)}>Cerrar</Btn>
          </ModalFooter>
        </Modal>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.black }}>Tareas</div>
        <Btn variant="primary" onClick={() => setNueva({ ...VACIA, asignada_a: esGerente ? "" : currentUser.id })}>+ Nueva tarea</Btn>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: `1px solid ${C.gray200}`, overflowX: "auto" }}>
        {subtabs.map(s => (
          <button key={s.id} onClick={() => setVista(s.id)}
            style={{ padding: "8px 14px", border: "none", background: "none", fontSize: 13, fontWeight: vista === s.id ? 700 : 400, color: vista === s.id ? C.red : C.gray500,
              borderBottom: `2px solid ${vista === s.id ? C.red : "transparent"}`, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{s.label}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar tarea…" style={{ ...inp, width: 220, padding: "7px 12px", fontSize: 12 }} />
        {esGerente && ["equipo", "historico"].includes(vista) && (
          <select value={persona} onChange={e => setPersona(e.target.value)} style={{ ...inp, width: "auto", padding: "7px 12px", fontSize: 12 }}>
            <option value="todos">Todo el equipo</option>
            {ASIGNABLES.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>

      {vista === "equipo" && resumen()}
      {vista === "historico" ? historicoVista() : (
        <>
          {vista === "mias" && !mias.length && !busca && (
            <div style={{ fontSize: 13, color: C.gray500, marginBottom: 10 }}>No tenés tareas pendientes. Las que te asignen van a aparecer en Por hacer.</div>
          )}
          {tablero()}
          <div style={{ fontSize: 11, color: C.gray500, marginTop: 8 }}>
            Arrastrá las tarjetas entre columnas, o usá los botones de cada tarjeta (en el celular). Las urgentes y las que vencen antes aparecen arriba.
          </div>
        </>
      )}
    </div>
  );
}
