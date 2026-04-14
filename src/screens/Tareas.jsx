import { useState } from "react";
import { C, USERS, getISOWeek } from "../constants";
import { Card, Btn, Badge, Field, Grid2, Modal, ModalHeader, ModalBody, ModalFooter, EmptyState, inp } from "../components/UI";
import { addItem, updateItem } from "../firebase";

const getUser = id => USERS.find(u => u.id === id);

const isoWeekLabel = wk => {
  const [y,w] = wk.split("-W");
  return `Semana ${w} · ${y}`;
};

export default function Tareas({ tareas, setTareas, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [filterUser, setFilterUser] = useState("todos");
  const [completando, setCompletando] = useState(null);
  const [comentario, setComentario] = useState("");
  const currentWeek = getISOWeek(0);
  const isGerente = currentUser.role === "gerente";

  const [form, setForm] = useState({
    titulo:"", descripcion:"", asignada_a:"sebastian",
    semana: currentWeek,
  });

  const handleCreate = async () => {
    if (!form.titulo) return;
    const data = await addItem("tareas", {
      titulo: form.titulo, descripcion: form.descripcion,
      asignada_a: form.asignada_a, creada_por: currentUser.id,
      semana: form.semana, estado:"pendiente",
    });
    if (data) setTareas(prev => [data, ...prev]);
    setForm({titulo:"",descripcion:"",asignada_a:"sebastian",semana:currentWeek});
    setShowForm(false);
  };

  const handleCompletar = async () => {
    if (!completando) return;
    const now = new Date().toISOString();
    const changes = { estado:"completada", comentario_completado: comentario, completada_at: now };
    await updateItem("tareas", completando.id, changes);
    setTareas(prev => prev.map(t => t.id === completando.id ? { ...t, ...changes } : t));
    setCompletando(null); setComentario("");
  };

  // My pending tasks: current week + carryover from prior weeks
  const myTareas = tareas.filter(t =>
    t.asignada_a === currentUser.id && t.estado === "pendiente"
  );

  const allTareas = isGerente
    ? tareas.filter(t => filterUser === "todos" || t.asignada_a === filterUser)
    : myTareas;

  // Group by semana
  const grouped = allTareas.reduce((acc,t) => {
    const k = t.semana || "sin-semana";
    if (!acc[k]) acc[k] = [];
    acc[k].push(t);
    return acc;
  }, {});
  const weeks = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  const assignees = USERS.filter(u => !["inactivo"].includes(u.role));

  return (
    <div style={{ padding:"1.5rem", maxWidth:800 }}>
      {showForm && (
        <Modal onClose={()=>setShowForm(false)} maxWidth={460}>
          <ModalHeader title="Nueva Tarea" subtitle="Asignar tarea semanal" onClose={()=>setShowForm(false)}/>
          <ModalBody>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Field label="Título">
                <input value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} style={inp} placeholder="Descripción breve de la tarea"/>
              </Field>
              <Field label="Descripción (opcional)">
                <textarea value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} style={{...inp,height:64,resize:"none"}} placeholder="Detalles adicionales…"/>
              </Field>
              <Grid2>
                <Field label="Asignar a">
                  <select value={form.asignada_a} onChange={e=>setForm(f=>({...f,asignada_a:e.target.value}))} style={inp}>
                    {assignees.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label="Semana">
                  <select value={form.semana} onChange={e=>setForm(f=>({...f,semana:e.target.value}))} style={inp}>
                    {[-1,0,1,2].map(o=>{const w=getISOWeek(o*7/7);return<option key={w} value={w}>{isoWeekLabel(w)}{o===0?" (actual)":""}</option>;})}
                  </select>
                </Field>
              </Grid2>
            </div>
          </ModalBody>
          <ModalFooter>
            <Btn onClick={()=>setShowForm(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={!form.titulo}>Crear tarea</Btn>
          </ModalFooter>
        </Modal>
      )}

      {completando && (
        <Modal onClose={()=>{setCompletando(null);setComentario("");}} maxWidth={420}>
          <ModalHeader title="Completar tarea" subtitle={completando.titulo} onClose={()=>{setCompletando(null);setComentario("");}}/>
          <ModalBody>
            <Field label="Comentario (opcional)">
              <textarea value={comentario} onChange={e=>setComentario(e.target.value)} style={{...inp,height:80,resize:"none"}} placeholder="¿Qué hiciste? ¿Algún detalle?"/>
            </Field>
          </ModalBody>
          <ModalFooter>
            <Btn onClick={()=>{setCompletando(null);setComentario("");}}>Cancelar</Btn>
            <Btn variant="primary" onClick={handleCompletar}>Marcar como completada</Btn>
          </ModalFooter>
        </Modal>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div style={{fontSize:20,fontWeight:800,color:C.black}}>Tareas</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {isGerente && (
            <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} style={{...inp,width:"auto",padding:"7px 12px",fontSize:12}}>
              <option value="todos">Todos</option>
              {USERS.filter(u=>u.role!=="inactivo").map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          {isGerente && <Btn variant="primary" onClick={()=>setShowForm(true)}>+ Nueva tarea</Btn>}
        </div>
      </div>

      {weeks.length === 0 && <EmptyState icon="✅" title="Sin tareas" desc={isGerente?"Creá la primera tarea":"No tenés tareas asignadas"}/>}

      {weeks.map(wk => {
        const isCurrentWeek = wk === currentWeek;
        return (
          <div key={wk} style={{marginBottom:24}}>
            <div style={{fontSize:12,fontWeight:700,color:isCurrentWeek?C.red:C.gray500,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10}}>
              {isoWeekLabel(wk)}{isCurrentWeek?" · Semana actual":""}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {grouped[wk].map(t=>{
                const assignee = getUser(t.asignada_a);
                const completed = t.estado === "completada";
                const isCarryover = !isCurrentWeek && !completed;
                return (
                  <Card key={t.id} style={{border:`1px solid ${completed?C.green:isCarryover?C.amber:C.gray200}`,opacity:completed?0.75:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                          <span style={{fontWeight:600,fontSize:13,color:completed?C.green:C.black}}>{t.titulo}</span>
                          {isCarryover&&<Badge color="amber">Arrastrada</Badge>}
                          {completed&&<Badge color="green">Completada</Badge>}
                        </div>
                        {t.descripcion&&<div style={{fontSize:12,color:C.gray600,marginBottom:4}}>{t.descripcion}</div>}
                        <div style={{fontSize:11,color:C.gray500}}>
                          Asignada a: <strong>{assignee?.name}</strong>
                          {isGerente&&<span> · Por: {getUser(t.creada_por)?.name}</span>}
                        </div>
                        {completed&&t.comentario_completado&&(
                          <div style={{fontSize:11,color:C.green,marginTop:4,fontStyle:"italic"}}>"{t.comentario_completado}"</div>
                        )}
                      </div>
                      {!completed && t.asignada_a === currentUser.id && (
                        <Btn size="sm" variant="success" onClick={()=>setCompletando(t)}>Completar</Btn>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
