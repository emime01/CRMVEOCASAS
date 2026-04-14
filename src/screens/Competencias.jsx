import { useState } from "react";
import { C } from "../constants";
import { Card, Btn, Badge, Field, Grid2, Modal, ModalHeader, ModalBody, ModalFooter, EmptyState, BarChart, inp } from "../components/UI";
import { addItem, deleteItem } from "../firebase";

export default function Competencias({ competencias, setCompetencias, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    fuente:"Infocasas", num_propiedades:"", num_inmobiliarias:"",
    inmobiliarias_lista:"", notas:"",
  });

  const canEdit = ["gerente","gerente_general"].includes(currentUser.role);

  const handleCreate = async () => {
    if (!form.fecha) return;
    const data = await addItem("competencias", {
      ...form,
      num_propiedades: parseInt(form.num_propiedades)||0,
      num_inmobiliarias: parseInt(form.num_inmobiliarias)||0,
      creado_por: currentUser.id,
    });
    if (data) setCompetencias(prev => [data, ...prev]);
    setForm({fecha:new Date().toISOString().split("T")[0],fuente:"Infocasas",num_propiedades:"",num_inmobiliarias:"",inmobiliarias_lista:"",notas:""});
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este registro?")) return;
    await deleteItem("competencias",id);
    setCompetencias(prev=>prev.filter(c=>c.id!==id));
  };

  const sorted = [...competencias].sort((a,b)=>b.fecha.localeCompare(a.fecha));

  const chartData = sorted.slice(0,8).reverse().map(c=>({
    label: c.fecha.slice(5), value: c.num_propiedades||0,
  }));

  return (
    <div style={{padding:"1.5rem",maxWidth:900}}>
      {showForm && (
        <Modal onClose={()=>setShowForm(false)} maxWidth={520}>
          <ModalHeader title="Nuevo registro de competencia" subtitle="Datos extraídos de Infocasas u otras fuentes" onClose={()=>setShowForm(false)}/>
          <ModalBody>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Grid2>
                <Field label="Fecha">
                  <input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} style={inp}/>
                </Field>
                <Field label="Fuente">
                  <select value={form.fuente} onChange={e=>setForm(f=>({...f,fuente:e.target.value}))} style={inp}>
                    <option>Infocasas</option>
                    <option>MercadoLibre</option>
                    <option>ZonaProp</option>
                    <option>Otro</option>
                  </select>
                </Field>
              </Grid2>
              <Grid2>
                <Field label="N° de propiedades">
                  <input type="text" inputMode="numeric" value={form.num_propiedades}
                    onChange={e=>setForm(f=>({...f,num_propiedades:e.target.value.replace(/\D/g,"")}))}
                    style={inp} placeholder="Ej: 45000"/>
                </Field>
                <Field label="N° de inmobiliarias">
                  <input type="text" inputMode="numeric" value={form.num_inmobiliarias}
                    onChange={e=>setForm(f=>({...f,num_inmobiliarias:e.target.value.replace(/\D/g,"")}))}
                    style={inp} placeholder="Ej: 1200"/>
                </Field>
              </Grid2>
              <Field label="Lista de inmobiliarias principales (una por línea)">
                <textarea value={form.inmobiliarias_lista}
                  onChange={e=>setForm(f=>({...f,inmobiliarias_lista:e.target.value}))}
                  style={{...inp,height:100,resize:"none"}}
                  placeholder="García Propiedades&#10;Del Rey&#10;Costas del Este…"/>
              </Field>
              <Field label="Notas adicionales">
                <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
                  style={{...inp,height:56,resize:"none"}} placeholder="Tendencias, cambios observados…"/>
              </Field>
            </div>
          </ModalBody>
          <ModalFooter>
            <Btn onClick={()=>setShowForm(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={!form.fecha}>Guardar</Btn>
          </ModalFooter>
        </Modal>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:C.black}}>Competencias</div>
          <div style={{fontSize:12,color:C.gray500,marginTop:2}}>Datos ingresados manualmente desde Infocasas y otras fuentes</div>
        </div>
        {canEdit && <Btn variant="primary" onClick={()=>setShowForm(true)}>+ Nuevo registro</Btn>}
      </div>

      {sorted.length > 1 && (
        <Card style={{marginBottom:20}}>
          <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:14}}>Evolución de propiedades publicadas</div>
          <BarChart data={chartData} height={90}/>
        </Card>
      )}

      {sorted.length === 0
        ? <EmptyState icon="🏢" title="Sin registros" desc="Ingresá datos de Infocasas para ver la evolución del mercado"/>
        : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {sorted.map(c=>(
              <Card key={c.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:14,color:C.black}}>{c.fecha}</span>
                      <Badge color="blue">{c.fuente}</Badge>
                    </div>
                    <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:c.inmobiliarias_lista||c.notas?8:0}}>
                      {c.num_propiedades>0&&(
                        <div style={{fontSize:13}}>
                          <span style={{color:C.gray500}}>Propiedades: </span>
                          <strong style={{color:C.black}}>{c.num_propiedades.toLocaleString()}</strong>
                        </div>
                      )}
                      {c.num_inmobiliarias>0&&(
                        <div style={{fontSize:13}}>
                          <span style={{color:C.gray500}}>Inmobiliarias: </span>
                          <strong style={{color:C.black}}>{c.num_inmobiliarias.toLocaleString()}</strong>
                        </div>
                      )}
                    </div>
                    {c.inmobiliarias_lista&&(
                      <div style={{fontSize:11,color:C.gray600,background:C.gray50,padding:"6px 10px",borderRadius:6,marginBottom:4,border:`1px solid ${C.gray200}`}}>
                        <strong>Inmobiliarias:</strong> {c.inmobiliarias_lista.replace(/\n/g," · ")}
                      </div>
                    )}
                    {c.notas&&<div style={{fontSize:12,color:C.gray600,fontStyle:"italic"}}>{c.notas}</div>}
                  </div>
                  {canEdit&&(
                    <button onClick={()=>handleDelete(c.id)}
                      style={{background:"none",border:"none",color:C.gray400,cursor:"pointer",fontSize:16,padding:0,fontFamily:"'Montserrat',sans-serif"}}
                      onMouseEnter={e=>e.currentTarget.style.color=C.red}
                      onMouseLeave={e=>e.currentTarget.style.color=C.gray400}>🗑</button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  );
}
