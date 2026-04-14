import { useState } from "react";
import { C } from "../constants";
import { Card, Btn, Badge, Field, Grid2, Modal, ModalHeader, ModalBody, ModalFooter, EmptyState, inp } from "../components/UI";
import { addItem, deleteItem } from "../firebase";

export default function Presentaciones({ presentaciones, setPresentaciones, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [filterTipo, setFilterTipo] = useState("todos");
  const [form, setForm] = useState({ titulo:"", descripcion:"", url:"", tipo:"crm" });

  const canManage = ["gerente","marketing"].includes(currentUser.role);

  const visible = presentaciones.filter(p =>
    filterTipo === "todos" || p.tipo === filterTipo
  );

  const handleCreate = async () => {
    if (!form.titulo || !form.url) return;
    const data = await addItem("presentaciones", { ...form, subido_por: currentUser.id });
    if (data) setPresentaciones(prev => [data, ...prev]);
    setForm({ titulo:"", descripcion:"", url:"", tipo:"crm" });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta presentación?")) return;
    await deleteItem("presentaciones", id);
    setPresentaciones(prev => prev.filter(p => p.id !== id));
  };

  const tipoLabel = { crm:"CRM", producto:"Producto", comercial:"Comercial", otro:"Otro" };
  const tipoColor = { crm:"blue", producto:"red", comercial:"green", otro:"gray" };

  return (
    <div style={{ padding:"1.5rem", maxWidth:900 }}>
      {showForm && (
        <Modal onClose={()=>setShowForm(false)} maxWidth={500}>
          <ModalHeader title="Nueva Presentación" subtitle="Agregar material de ventas" onClose={()=>setShowForm(false)}/>
          <ModalBody>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Field label="Título">
                <input value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} style={inp} placeholder="Ej: Presentación Tokko CRM 2025"/>
              </Field>
              <Field label="URL (Google Slides, PDF, etc.)">
                <input value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))} style={inp} placeholder="https://slides.google.com/..."/>
              </Field>
              <Field label="Descripción">
                <textarea value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} style={{...inp,height:64,resize:"none"}} placeholder="Para qué sirve o cuándo usarla…"/>
              </Field>
              <Field label="Categoría">
                <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} style={inp}>
                  <option value="crm">Presentación CRM</option>
                  <option value="producto">Productos Veocasas</option>
                  <option value="comercial">Material Comercial</option>
                  <option value="otro">Otro</option>
                </select>
              </Field>
            </div>
          </ModalBody>
          <ModalFooter>
            <Btn onClick={()=>setShowForm(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={!form.titulo||!form.url}>Agregar</Btn>
          </ModalFooter>
        </Modal>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div style={{fontSize:20,fontWeight:800,color:C.black}}>Presentaciones</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <select value={filterTipo} onChange={e=>setFilterTipo(e.target.value)} style={{...inp,width:"auto",padding:"7px 12px",fontSize:12}}>
            <option value="todos">Todas</option>
            {Object.entries(tipoLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          {canManage && <Btn variant="primary" onClick={()=>setShowForm(true)}>+ Agregar</Btn>}
        </div>
      </div>

      {visible.length === 0 && <EmptyState icon="📊" title="Sin presentaciones" desc="No hay presentaciones cargadas aún"/>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {visible.map(p => (
          <Card key={p.id} style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <Badge color={tipoColor[p.tipo]||"gray"}>{tipoLabel[p.tipo]||p.tipo}</Badge>
              {canManage && (
                <button onClick={()=>handleDelete(p.id)} style={{background:"none",border:"none",color:C.gray400,cursor:"pointer",fontSize:16,padding:0,fontFamily:"'Montserrat',sans-serif"}}
                  onMouseEnter={e=>e.currentTarget.style.color=C.red}
                  onMouseLeave={e=>e.currentTarget.style.color=C.gray400}>🗑</button>
              )}
            </div>
            <div style={{fontWeight:700,fontSize:14,color:C.black}}>{p.titulo}</div>
            {p.descripcion && <div style={{fontSize:12,color:C.gray600,flex:1,lineHeight:1.5}}>{p.descripcion}</div>}
            <Btn variant="primary" onClick={()=>window.open(p.url,"_blank")} style={{width:"100%",justifyContent:"center"}}>
              🔗 Abrir presentación
            </Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}
