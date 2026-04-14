import { useState } from "react";
import { C, fmt } from "../constants";
import { Card, Btn, Badge, Field, Grid2, Modal, ModalHeader, ModalBody, ModalFooter, EmptyState, BarChart, inp } from "../components/UI";
import { addItem, deleteItem } from "../firebase";

const PLATFORMS_ADS = ["Meta Ads","Google Ads"];

function calcKPIs(m) {
  const imp = parseFloat(m.impresiones)||0;
  const clk = parseFloat(m.clics)||0;
  const conv = parseFloat(m.conversiones)||0;
  const gasto = parseFloat(m.gasto)||0;
  const alcance = parseFloat(m.alcance)||0;
  return {
    ctr: imp>0?((clk/imp)*100).toFixed(2):"-",
    cpm: imp>0?(gasto/(imp/1000)).toFixed(2):"-",
    cpc: clk>0?(gasto/clk).toFixed(2):"-",
    cpa: conv>0?(gasto/conv).toFixed(2):"-",
    roas: gasto>0?((conv*1)/(gasto)).toFixed(2):"-",
    frecuencia: alcance>0?(imp/alcance).toFixed(1):"-",
  };
}

export default function Metricas({ metricas, setMetricas, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [platform, setPlatform] = useState("Meta Ads");
  const [filterPlatform, setFilterPlatform] = useState("Meta Ads");
  const [form, setForm] = useState({
    plataforma:"Meta Ads", semana: new Date().toISOString().split("T")[0].slice(0,7),
    impresiones:"", alcance:"", clics:"", conversiones:"", gasto:"", notas:"",
  });

  const canEdit = ["gerente","marketing"].includes(currentUser.role);

  const num = (key) => ({
    value: form[key],
    onChange: e => setForm(f=>({...f,[key]:e.target.value.replace(/[^\d.]/g,"")})),
    style: inp, type:"text", inputMode:"numeric",
  });

  const handleCreate = async () => {
    if (!form.semana) return;
    const data = await addItem("metricas_ads", { ...form, creado_por: currentUser.id });
    if (data) setMetricas(prev => [data, ...prev]);
    setForm({plataforma:form.plataforma,semana:new Date().toISOString().split("T")[0].slice(0,7),impresiones:"",alcance:"",clics:"",conversiones:"",gasto:"",notas:""});
    setShowForm(false);
  };

  const handleDelete = async id => {
    if (!window.confirm("¿Eliminar este registro?")) return;
    await deleteItem("metricas_ads",id);
    setMetricas(prev=>prev.filter(m=>m.id!==id));
  };

  const filtered = metricas.filter(m=>m.plataforma===filterPlatform);
  const sorted = [...filtered].sort((a,b)=>b.semana.localeCompare(a.semana));

  const gastosChart = sorted.slice(0,6).reverse().map(m=>({
    label: m.semana.slice(5), value: parseFloat(m.gasto)||0, highlight:false
  }));

  return (
    <div style={{padding:"1.5rem",maxWidth:900}}>
      {showForm && (
        <Modal onClose={()=>setShowForm(false)} maxWidth={520}>
          <ModalHeader title="Nuevas métricas" subtitle="Ingresar datos de publicidad" onClose={()=>setShowForm(false)}/>
          <ModalBody>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Grid2>
                <Field label="Plataforma">
                  <select value={form.plataforma} onChange={e=>setForm(f=>({...f,plataforma:e.target.value}))} style={inp}>
                    {PLATFORMS_ADS.map(p=><option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Período (mes)">
                  <input type="month" value={form.semana} onChange={e=>setForm(f=>({...f,semana:e.target.value}))} style={inp}/>
                </Field>
              </Grid2>
              <Grid2>
                <Field label="Impresiones"><input {...num("impresiones")} placeholder="0"/></Field>
                <Field label="Alcance"><input {...num("alcance")} placeholder="0"/></Field>
                <Field label="Clics"><input {...num("clics")} placeholder="0"/></Field>
                <Field label="Conversiones"><input {...num("conversiones")} placeholder="0"/></Field>
              </Grid2>
              <Field label="Gasto ($)"><input {...num("gasto")} placeholder="0"/></Field>
              {/* Live KPI preview */}
              {(form.impresiones||form.gasto)&&(()=>{
                const k=calcKPIs(form);
                return(
                  <div style={{padding:"10px 14px",background:C.redLight,borderRadius:8,border:`1px solid ${C.red}`,fontSize:12}}>
                    <strong>Preview KPIs:</strong>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4,marginTop:6}}>
                      {[["CTR",k.ctr+"%"],["CPM","$"+k.cpm],["CPC","$"+k.cpc],["CPA","$"+k.cpa],["Frecuencia",k.frecuencia]].map(([l,v])=>(
                        <div key={l} style={{background:C.white,borderRadius:6,padding:"4px 8px",textAlign:"center"}}>
                          <div style={{fontSize:10,color:C.gray500}}>{l}</div>
                          <div style={{fontWeight:700,color:C.red}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <Field label="Notas">
                <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} style={{...inp,height:56,resize:"none"}} placeholder="Observaciones…"/>
              </Field>
            </div>
          </ModalBody>
          <ModalFooter>
            <Btn onClick={()=>setShowForm(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={!form.semana}>Guardar</Btn>
          </ModalFooter>
        </Modal>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:C.black}}>Métricas de Publicidad</div>
          <div style={{fontSize:12,color:C.gray500,marginTop:2}}>KPIs calculados automáticamente de los datos ingresados</div>
        </div>
        {canEdit && <Btn variant="primary" onClick={()=>setShowForm(true)}>+ Cargar métricas</Btn>}
      </div>

      {/* Platform tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:`1px solid ${C.gray200}`,paddingBottom:4}}>
        {PLATFORMS_ADS.map(p=>(
          <button key={p} onClick={()=>setFilterPlatform(p)}
            style={{padding:"8px 16px",border:"none",background:"none",fontSize:13,fontWeight:filterPlatform===p?700:400,color:filterPlatform===p?C.red:C.gray500,borderBottom:`2px solid ${filterPlatform===p?C.red:"transparent"}`,cursor:"pointer",transition:"all 0.15s",fontFamily:"'Montserrat',sans-serif"}}>
            {p}
          </button>
        ))}
      </div>

      {gastosChart.some(d=>d.value>0)&&(
        <Card style={{marginBottom:20}}>
          <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:14}}>Evolución del gasto — {filterPlatform}</div>
          <BarChart data={gastosChart} height={80}/>
        </Card>
      )}

      {sorted.length===0
        ? <EmptyState icon="📈" title="Sin métricas" desc={`No hay datos de ${filterPlatform} aún`}/>
        : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {sorted.map(m=>{
              const k=calcKPIs(m);
              return(
                <Card key={m.id}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                        <span style={{fontWeight:700,fontSize:14,color:C.black}}>{m.semana}</span>
                        <Badge color="blue">{m.plataforma}</Badge>
                        {m.gasto&&<span style={{fontSize:13,fontWeight:700,color:C.red}}>Gasto: ${parseFloat(m.gasto).toLocaleString()}</span>}
                      </div>
                      {/* Raw metrics */}
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
                        {[["Impresiones",m.impresiones],["Alcance",m.alcance],["Clics",m.clics],["Conversiones",m.conversiones]].filter(([,v])=>v).map(([l,v])=>(
                          <div key={l} style={{background:C.gray50,borderRadius:6,padding:"6px 8px",border:`1px solid ${C.gray200}`}}>
                            <div style={{fontSize:10,color:C.gray500,marginBottom:2}}>{l}</div>
                            <div style={{fontWeight:600,fontSize:13}}>{parseInt(v).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                      {/* Calculated KPIs */}
                      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
                        {[["CTR",k.ctr+"%"],["CPM","$"+k.cpm],["CPC","$"+k.cpc],["CPA","$"+k.cpa],["Frecuencia",k.frecuencia]].map(([l,v])=>(
                          <div key={l} style={{background:C.redLight,borderRadius:6,padding:"6px 8px",border:`1px solid ${C.red}`,textAlign:"center"}}>
                            <div style={{fontSize:10,color:C.red,fontWeight:600,marginBottom:2}}>{l}</div>
                            <div style={{fontWeight:700,fontSize:12,color:C.black}}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {m.notas&&<div style={{fontSize:12,color:C.gray600,marginTop:8,fontStyle:"italic"}}>{m.notas}</div>}
                    </div>
                    {canEdit&&(
                      <button onClick={()=>handleDelete(m.id)}
                        style={{background:"none",border:"none",color:C.gray400,cursor:"pointer",fontSize:16,padding:0,fontFamily:"'Montserrat',sans-serif"}}
                        onMouseEnter={e=>e.currentTarget.style.color=C.red}
                        onMouseLeave={e=>e.currentTarget.style.color=C.gray400}>🗑</button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
