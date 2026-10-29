import { useMemo, useState } from "react";
import { C, fmt, USERS, CANALES_GESTION, MENSAJE_RENOVACION } from "../constants";
import { Card, Btn, Badge, Field, Grid2, Stat, Modal, ModalHeader, ModalBody, ModalFooter, EmptyState, inp } from "../components/UI";
import { numeroWhatsapp, nombreUsuario, fechaCorta } from "../prospectos";
import { hoyISO } from "../cuotas";
import { renovaciones, registrarGestionRenovacion, ESTADOS_RENOVACION, RESULTADOS_RENOVACION, MOTIVOS_NO_RENUEVA, DIAS_ANTES, DIAS_DESPUES } from "../renovaciones";

// Ventas que vencen o vencieron hace poco: el vendedor contacta, registra cómo va y crea la venta de renovación.
// La gerencia ve las de todos; cada vendedor, las suyas (por la venta o por ser el vendedor a cargo de la ficha).
const VENDEDORES = USERS.filter(u => ["vendedor", "gerente"].includes(u.role));
const GRUPOS = [
  { id: "pendientes", label: "Para gestionar", f: r => ["vencida", "vence_30", "vence_60"].includes(r.estado) },
  { id: "renovada", label: "Renovadas", f: r => r.estado === "renovada" },
  { id: "no_renueva", label: "No renuevan", f: r => r.estado === "no_renueva" },
];
const fechaLarga = iso => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("es-UY", { day: "numeric", month: "long" }) : "";

const linkWhatsapp = (v, vendedorId) => {
  const n = numeroWhatsapp({ telefono: v.telefono });
  if (!n) return null;
  const texto = MENSAJE_RENOVACION.replace("{nombre}", v.inmobiliaria || "").replace("{vendedor}", nombreUsuario(vendedorId)).replace("{fecha}", fechaLarga(v.fecha_fin));
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
};

export default function Renovaciones({ sales, setSales, clientes, currentUser, onRenovar }) {
  const esVendedor = currentUser.role === "vendedor";
  const [grupo, setGrupo] = useState("pendientes");
  const [vendedor, setVendedor] = useState("todos");
  const [gestionando, setGestionando] = useState(null);

  const aCargo = useMemo(() => new Map(clientes.map(c => [c.id, c.ejecutivo])), [clientes]);
  const todas = useMemo(() => renovaciones(sales).filter(r => {
    const resp = [r.venta.ejecutivo, aCargo.get(r.venta.cliente_id)];
    if (esVendedor) return resp.includes(currentUser.id);
    return vendedor === "todos" || resp.includes(vendedor);
  }), [sales, aCargo, esVendedor, vendedor, currentUser.id]);

  const g = GRUPOS.find(x => x.id === grupo);
  const lista = todas.filter(g.f).sort((a, b) => a.dias - b.dias);
  const cuenta = e => todas.filter(r => r.estado === e).length;
  const montoEnJuego = todas.filter(GRUPOS[0].f).reduce((a, r) => a + (r.venta.total || 0), 0);

  const guardarGestion = async gestion => {
    const v = gestionando.venta;
    const cambios = await registrarGestionRenovacion(v, { ...gestion, por: currentUser.id });
    setSales(prev => prev.map(s => s.id === v.id ? { ...s, ...cambios } : s));
    setGestionando(null);
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.black }}>Renovaciones</div>
          <div style={{ fontSize: 13, color: C.gray500, marginTop: 2 }}>
            Ventas que vencen en los próximos {DIAS_ANTES} días o vencieron hace menos de {DIAS_DESPUES}.
          </div>
        </div>
        {!esVendedor && (
          <select value={vendedor} onChange={e => setVendedor(e.target.value)} style={{ ...inp, width: "auto" }}>
            <option value="todos">Todos los vendedores</option>
            {VENDEDORES.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(150px,100%),1fr))", gap: 12, marginBottom: 16 }}>
        <Stat label="Vencidas sin renovar" value={cuenta("vencida")} color={cuenta("vencida") ? C.red : undefined} />
        <Stat label="Vencen en 30 días" value={cuenta("vence_30")} color={cuenta("vence_30") ? C.amber : undefined} />
        <Stat label="Vencen en 31 a 60 días" value={cuenta("vence_60")} />
        <Stat label="En juego" value={fmt(montoEnJuego)} sub="total de las ventas a renovar" />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {GRUPOS.map(x => (
          <Btn key={x.id} size="sm" variant={grupo === x.id ? "primary" : "outline"} onClick={() => setGrupo(x.id)}>
            {x.label} ({todas.filter(x.f).length})
          </Btn>
        ))}
      </div>

      {!lista.length ? <EmptyState icon="✅" title="Nada en esta sección" />
        : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(340px,100%),1fr))", gap: 12 }}>
            {lista.map(r => <Tarjeta key={r.venta.id} r={r} usuario={currentUser} onGestion={() => setGestionando(r)} onRenovar={() => onRenovar(r.venta)} />)}
          </div>
        )}

      {gestionando && <ModalGestion r={gestionando} onClose={() => setGestionando(null)} onGuardar={guardarGestion} />}
    </div>
  );
}

function Tarjeta({ r, usuario, onGestion, onRenovar }) {
  const { venta: v, dias, estado, siguiente, ultimaGestion: ug } = r;
  const est = ESTADOS_RENOVACION[estado];
  const wa = linkWhatsapp(v, usuario.id);
  const vencido = ug?.proximoContacto && ug.proximoContacto <= hoyISO();
  const abierta = ["vencida", "vence_30", "vence_60"].includes(estado);
  return (
    <Card style={vencido && abierta ? { border: `1px solid ${C.red}` } : {}}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.black }}>{v.inmobiliaria}</div>
          <div style={{ fontSize: 11, color: C.gray500 }}>{[v.plan && `Plan ${v.plan}`, nombreUsuario(v.ejecutivo)].filter(Boolean).join(" · ")}</div>
        </div>
        <Badge color={est.color}>{est.label}</Badge>
      </div>
      <div style={{ fontSize: 12, color: C.gray600, marginTop: 8, lineHeight: 1.6 }}>
        <div>
          {dias < 0 ? `Venció hace ${-dias} día${dias === -1 ? "" : "s"}` : dias === 0 ? "Vence hoy" : `Vence en ${dias} día${dias === 1 ? "" : "s"}`}
          {" · "}{v.fecha_fin} · <strong>{fmt(v.total)}</strong>
        </div>
        {siguiente && <div style={{ color: C.green }}>Renovada: nueva venta hasta {siguiente.fecha_fin}</div>}
        {estado === "no_renueva" && v.renovacion?.motivo && <div>Motivo: {v.renovacion.motivo}</div>}
        {v.mail && <div>{v.mail}</div>}
        {v.telefono && <div>{v.telefono}</div>}
      </div>
      {ug && (
        <div style={{ fontSize: 11, color: vencido && abierta ? C.red : C.gray500, marginTop: 8 }}>
          Última: {ug.canal} · {RESULTADOS_RENOVACION.find(x => x.id === ug.resultado)?.label} · {fechaCorta(ug.fecha)}
          {ug.proximoContacto && abierta && ` · volver el ${fechaCorta(ug.proximoContacto)}`}
          {ug.nota && <div style={{ color: C.gray600, marginTop: 2 }}>“{ug.nota}”</div>}
        </div>
      )}
      {abierta && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {wa && <a href={wa} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn size="sm" variant="success">WhatsApp</Btn></a>}
          {v.telefono && <a href={`tel:${String(v.telefono).replace(/[^\d+]/g, "")}`} style={{ textDecoration: "none" }}><Btn size="sm">Llamar</Btn></a>}
          {v.mail && <a href={`mailto:${v.mail}`} style={{ textDecoration: "none" }}><Btn size="sm">Email</Btn></a>}
          <Btn size="sm" onClick={onGestion}>Registrar gestión</Btn>
          <Btn size="sm" variant="primary" onClick={onRenovar}>Crear renovación</Btn>
        </div>
      )}
    </Card>
  );
}

function ModalGestion({ r, onClose, onGuardar }) {
  const [f, setF] = useState({ canal: "WhatsApp", resultado: "contactado", nota: "", proximoContacto: "", motivo: "" });
  const [guardando, setGuardando] = useState(false);
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  const noRenueva = f.resultado === "no_renueva";
  return (
    <Modal onClose={onClose} maxWidth={520}>
      <ModalHeader title="Registrar gestión de renovación" subtitle={r.venta.inmobiliaria} onClose={onClose} />
      <ModalBody>
        <Grid2>
          <Field label="Canal">
            <select value={f.canal} onChange={set("canal")} style={inp}>{CANALES_GESTION.map(c => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Resultado">
            <select value={f.resultado} onChange={set("resultado")} style={inp}>{RESULTADOS_RENOVACION.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
          </Field>
        </Grid2>
        {noRenueva && (
          <div style={{ marginTop: 12 }}>
            <Field label="Motivo" hint="La inmobiliaria pasa a ex cliente cuando vence: sigue en Prospectos para otro acercamiento más adelante.">
              <select value={f.motivo} onChange={set("motivo")} style={inp}>
                <option value="">Elegí un motivo</option>
                {MOTIVOS_NO_RENUEVA.map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <Field label="Nota">
            <textarea value={f.nota} onChange={set("nota")} rows={3} style={{ ...inp, minHeight: 70, resize: "vertical" }} placeholder="Qué te dijeron, condiciones que piden…" />
          </Field>
        </div>
        {["contactado", "volver", "renueva"].includes(f.resultado) && (
          <div style={{ marginTop: 12 }}>
            <Field label="Próximo contacto" hint="La tarjeta se marca en rojo cuando llega la fecha.">
              <input type="date" value={f.proximoContacto} min={hoyISO()} onChange={set("proximoContacto")} style={inp} />
            </Field>
          </div>
        )}
        {f.resultado === "renueva" && (
          <div style={{ fontSize: 12, color: C.gray500, marginTop: 12 }}>Cuando cierres, usá “Crear renovación” para cargar la venta nueva.</div>
        )}
      </ModalBody>
      <ModalFooter>
        <Btn onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={guardando || (noRenueva && !f.motivo)} onClick={async () => { setGuardando(true); await onGuardar(f); }}>Guardar</Btn>
      </ModalFooter>
    </Modal>
  );
}
