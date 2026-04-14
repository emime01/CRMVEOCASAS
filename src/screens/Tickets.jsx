import { useState } from "react";
import { C, USERS } from "../constants";
import { Card, Btn, Badge, Field, Modal, ModalHeader, ModalBody, ModalFooter, EmptyState, inp } from "../components/UI";
import { addItem, updateItem } from "../firebase";

const getUser = id => USERS.find(u => u.id === id);

export default function Tickets({ tickets, setTickets, currentUser }) {
  const [subtab, setSubtab] = useState("recibidos");
  const [showForm, setShowForm] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [comentarioCierre, setComentarioCierre] = useState("");
  const [form, setForm] = useState({ titulo:"", descripcion:"", para:"" });

  const recibidos = tickets.filter(t => t.para === currentUser.id && t.estado !== "cerrado");
  const enviados  = tickets.filter(t => t.de === currentUser.id);
  const todos     = tickets; // gerente sees all
  const isGerente = currentUser.role === "gerente" || currentUser.role === "gerente_general";

  const handleCreate = async () => {
    if (!form.titulo || !form.para) return;
    const data = await addItem("tickets", {
      titulo: form.titulo, descripcion: form.descripcion,
      de: currentUser.id, para: form.para, estado: "pendiente",
    });
    if (data) setTickets(prev => [data, ...prev]);
    setForm({ titulo:"", descripcion:"", para:"" }); setShowForm(false);
  };

  const handleAccion = async (ticket, accion) => {
    const changes = accion === "cerrar"
      ? { estado:"cerrado", comentario_cierre: comentarioCierre }
      : { estado: "aprobado" };
    await updateItem("tickets", ticket.id, changes);
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, ...changes } : t));
    setDetalle(null); setComentarioCierre("");
  };

  const badgeColor = e => ({ pendiente:"amber", aprobado:"green", cerrado:"gray" }[e] || "gray");

  const list = isGerente && subtab === "todos" ? todos
    : subtab === "recibidos" ? recibidos : enviados;

  const recipients = USERS.filter(u => u.id !== currentUser.id && u.role !== "inactivo");

  return (
    <div style={{ padding:"1.5rem", maxWidth:800 }}>
      {showForm && (
        <Modal onClose={() => setShowForm(false)} maxWidth={460}>
          <ModalHeader title="Nuevo Ticket" subtitle="Enviar ticket a un compañero" onClose={() => setShowForm(false)}/>
          <ModalBody>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <Field label="Para">
                <select value={form.para} onChange={e => setForm(f=>({...f,para:e.target.value}))} style={inp}>
                  <option value="">Seleccioná un destinatario…</option>
                  {recipients.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </Field>
              <Field label="Título">
                <input value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} style={inp} placeholder="Breve descripción del ticket"/>
              </Field>
              <Field label="Descripción">
                <textarea value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} style={{...inp,height:80,resize:"none"}} placeholder="Detalle del ticket…"/>
              </Field>
            </div>
          </ModalBody>
          <ModalFooter>
            <Btn onClick={()=>setShowForm(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={!form.titulo||!form.para}>Enviar ticket</Btn>
          </ModalFooter>
        </Modal>
      )}

      {detalle && (
        <Modal onClose={()=>{setDetalle(null);setComentarioCierre("");}} maxWidth={500}>
          <ModalHeader title={detalle.titulo} subtitle={`De: ${getUser(detalle.de)?.name} → Para: ${getUser(detalle.para)?.name}`} onClose={()=>{setDetalle(null);setComentarioCierre("")}}/>
          <ModalBody>
            <p style={{fontSize:13,color:C.gray700,marginBottom:12,lineHeight:1.6}}>{detalle.descripcion||"(sin descripción)"}</p>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <Badge color={badgeColor(detalle.estado)}>{detalle.estado}</Badge>
            </div>
            {detalle.comentario_cierre && (
              <div style={{background:C.gray50,borderRadius:8,padding:"10px 12px",fontSize:12,color:C.gray600,border:`1px solid ${C.gray200}`,marginTop:8}}>
                <strong>Comentario de cierre:</strong> {detalle.comentario_cierre}
              </div>
            )}
            {detalle.para === currentUser.id && detalle.estado === "pendiente" && (
              <div style={{marginTop:14}}>
                <Field label="Comentario al cerrar (opcional)">
                  <textarea value={comentarioCierre} onChange={e=>setComentarioCierre(e.target.value)} style={{...inp,height:64,resize:"none"}} placeholder="Explicá qué hiciste o por qué cerrás el ticket…"/>
                </Field>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {detalle.para === currentUser.id && detalle.estado === "pendiente" && (
              <>
                <Btn variant="success" onClick={()=>handleAccion(detalle,"aprobar")}>Aprobar</Btn>
                <Btn variant="primary" onClick={()=>handleAccion(detalle,"cerrar")}>Cerrar ticket</Btn>
              </>
            )}
            <Btn onClick={()=>{setDetalle(null);setComentarioCierre("");}}>Cerrar</Btn>
          </ModalFooter>
        </Modal>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div style={{fontSize:20,fontWeight:800,color:C.black}}>Tickets</div>
        <Btn variant="primary" onClick={()=>setShowForm(true)}>+ Nuevo ticket</Btn>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:`1px solid ${C.gray200}`,paddingBottom:4}}>
        {[
          {id:"recibidos",label:`Recibidos${recibidos.length>0?` (${recibidos.length})`:""}`},
          {id:"enviados",label:"Enviados"},
          ...(isGerente?[{id:"todos",label:"Todos"}]:[]),
        ].map(t=>(
          <button key={t.id} onClick={()=>setSubtab(t.id)}
            style={{padding:"8px 16px",border:"none",background:"none",fontSize:13,fontWeight:subtab===t.id?700:400,color:subtab===t.id?C.red:C.gray500,borderBottom:`2px solid ${subtab===t.id?C.red:"transparent"}`,cursor:"pointer",transition:"all 0.15s",fontFamily:"'Montserrat',sans-serif"}}>
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 && <EmptyState icon="🎫" title="Sin tickets" desc={subtab==="recibidos"?"No tenés tickets pendientes":"No enviaste tickets aún"}/>}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {list.map(t => (
          <Card key={t.id} onClick={()=>setDetalle(t)} style={{cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,color:C.black,marginBottom:3}}>{t.titulo}</div>
                <div style={{fontSize:11,color:C.gray500}}>
                  {getUser(t.de)?.name} → {getUser(t.para)?.name}
                  {t.created_at && <span style={{marginLeft:8}}>{t.created_at.slice(0,10)}</span>}
                </div>
                {t.descripcion && <div style={{fontSize:12,color:C.gray600,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:400}}>{t.descripcion}</div>}
              </div>
              <Badge color={badgeColor(t.estado)}>{t.estado}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
