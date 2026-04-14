import { useState } from "react";
import { C, USERS } from "../constants";
import { Card, Btn, Badge, Field, Grid2, Modal, ModalHeader, ModalBody, ModalFooter, EmptyState, inp } from "../components/UI";
import { addItem, deleteItem } from "../firebase";

export default function Documentos({ documentos, setDocumentos, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [filterTipo, setFilterTipo] = useState("todos");
  const [form, setForm] = useState({ titulo:"", descripcion:"", url:"", tipo:"contrato", para:"todos" });

  const canUpload = ["gerente","marketing"].includes(currentUser.role);

  const visible = documentos.filter(d =>
    canUpload
      ? (filterTipo === "todos" || d.tipo === filterTipo)
      : (d.para === currentUser.id || d.para === "todos") && (filterTipo === "todos" || d.tipo === filterTipo)
  );

  const handleCreate = async () => {
    if (!form.titulo || !form.url) return;
    const data = await addItem("documentos", { ...form, subido_por: currentUser.id });
    if (data) setDocumentos(prev => [data, ...prev]);
    setForm({ titulo:"", descripcion:"", url:"", tipo:"contrato", para:"todos" });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este documento?")) return;
    await deleteItem("documentos", id);
    setDocumentos(prev => prev.filter(d => d.id !== id));
  };

  const tipoColor = { contrato:"blue", presentación:"red", otro:"gray" };
  const recipients = [
    { id:"todos", name:"Todos" },
    ...USERS.filter(u => u.role !== "inactivo"),
  ];

  return (
    <div style={{ padding:"1.5rem", maxWidth:800 }}>
      {showForm && (
        <Modal onClose={()=>setShowForm(false)} maxWidth={500}>
          <ModalHeader title="Subir documento" subtitle="Pegar enlace de Google Drive, Dropbox, etc." onClose={()=>setShowForm(false)}/>
          <ModalBody>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Field label="Título">
                <input value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} style={inp} placeholder="Ej: Contrato Premium 2025"/>
              </Field>
              <Field label="URL del documento">
                <input value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))} style={inp} placeholder="https://drive.google.com/..."/>
              </Field>
              <Field label="Descripción (opcional)">
                <textarea value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} style={{...inp,height:56,resize:"none"}} placeholder="Para qué sirve este documento…"/>
              </Field>
              <Grid2>
                <Field label="Tipo">
                  <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} style={inp}>
                    <option value="contrato">Contrato</option>
                    <option value="presentación">Presentación</option>
                    <option value="otro">Otro</option>
                  </select>
                </Field>
                <Field label="Destinatario">
                  <select value={form.para} onChange={e=>setForm(f=>({...f,para:e.target.value}))} style={inp}>
                    {recipients.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
              </Grid2>
            </div>
          </ModalBody>
          <ModalFooter>
            <Btn onClick={()=>setShowForm(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={!form.titulo||!form.url}>Subir</Btn>
          </ModalFooter>
        </Modal>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div style={{fontSize:20,fontWeight:800,color:C.black}}>Documentos</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <select value={filterTipo} onChange={e=>setFilterTipo(e.target.value)} style={{...inp,width:"auto",padding:"7px 12px",fontSize:12}}>
            <option value="todos">Todos los tipos</option>
            <option value="contrato">Contratos</option>
            <option value="presentación">Presentaciones</option>
            <option value="otro">Otros</option>
          </select>
          {canUpload && <Btn variant="primary" onClick={()=>setShowForm(true)}>+ Subir documento</Btn>}
        </div>
      </div>

      {visible.length === 0 && <EmptyState icon="📁" title="Sin documentos" desc="No hay documentos disponibles aún"/>}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {visible.map(d => {
          const uploader = USERS.find(u=>u.id===d.subido_por);
          const dest = d.para === "todos" ? "Todos" : USERS.find(u=>u.id===d.para)?.name || d.para;
          return (
            <Card key={d.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontWeight:600,fontSize:13,color:C.black}}>{d.titulo}</span>
                    <Badge color={tipoColor[d.tipo]||"gray"}>{d.tipo}</Badge>
                    {d.para !== "todos" && <Badge color="blue">Para: {dest}</Badge>}
                  </div>
                  {d.descripcion && <div style={{fontSize:12,color:C.gray600,marginBottom:6}}>{d.descripcion}</div>}
                  <div style={{fontSize:11,color:C.gray500}}>
                    Subido por: {uploader?.name || "—"}
                    {d.created_at && <span style={{marginLeft:8}}>{d.created_at.slice(0,10)}</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <Btn size="sm" variant="primary" onClick={()=>window.open(d.url,"_blank")}>📄 Abrir</Btn>
                  {canUpload && <Btn size="sm" variant="danger" onClick={()=>handleDelete(d.id)}>🗑</Btn>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
