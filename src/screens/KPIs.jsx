import { C, fmt, USERS, getWeekDates, pct } from "../constants";
import { Card, Btn, Field, inp } from "../components/UI";

const SELLERS = USERS.filter(u => ["vendedor","inactivo"].includes(u.role));

export default function KPIs({ currentUser, kpis, kpiForm, setKpiForm, kpiWeekOffset, setKpiWeekOffset, onSave }) {
  const week = getWeekDates(kpiWeekOffset);
  const myKpi = (uid, week) => kpis.find(k => k.ejecutivo === uid && k.semana === week) || {};

  const Nav = () => (
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      <Btn size="sm" onClick={()=>setKpiWeekOffset(w=>w-1)}>←</Btn>
      <span style={{fontSize:12,color:C.gray500,minWidth:130,textAlign:"center",fontWeight:500}}>{week.label}</span>
      <Btn size="sm" onClick={()=>setKpiWeekOffset(w=>Math.min(w+1,0))}>→</Btn>
    </div>
  );

  if (currentUser.role === "gerente") return (
    <div style={{padding:"1.5rem",maxWidth:960}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:800,color:C.black}}>KPIs del Equipo</div>
        <Nav/>
      </div>
      {SELLERS.filter(s=>s.id!=="lucas").map(s=>{
        const k=myKpi(s.id,kpiWeekOffset);
        return(
          <Card key={s.id} style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:34,height:34,borderRadius:9,background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:11,fontWeight:700}}>{s.avatar}</div>
              <div style={{fontWeight:600,fontSize:14}}>{s.name}</div>
              {k.fecha_inicio&&<span style={{fontSize:11,color:C.gray400,marginLeft:"auto"}}>Sem. {k.fecha_inicio}</span>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(140px,100%),1fr))",gap:8}}>
              {[["Contactados",k.contactados||0,"contactados"],["C. efectivos",k.contactados_efectivos||0,"contactados_efectivos"],["R. agendadas",k.reuniones_agendadas||0,"reuniones_agendadas"],["R. efectivas",k.reuniones_efectivas||0,"reuniones_efectivas"],["Concreción",`${k.concrecion||0}%`,null],["Ticket prom.",fmt(k.ticket_promedio||0),null],["Pos. concreción",fmt(k.posible_concrecion||0),null],["Control",k.control_calidad||"—",null]].map(([lbl,v,nk])=>(
                <div key={lbl} style={{background:C.gray50,borderRadius:8,padding:"10px 12px",border:`1px solid ${C.gray100}`}}>
                  <div style={{fontSize:9,color:C.gray400,marginBottom:3,textTransform:"uppercase",letterSpacing:0.3,fontWeight:500}}>{lbl}</div>
                  <div style={{fontWeight:600,fontSize:13,color:C.gray900}}>{v}</div>
                  {nk&&k[nk+"_nombres"]&&<div style={{fontSize:9,color:C.gray500,marginTop:3,borderTop:`1px solid ${C.gray200}`,paddingTop:3,lineHeight:1.3}}>{k[nk+"_nombres"]}</div>}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );

  const cur = myKpi(currentUser.id, kpiWeekOffset);
  const fields = [
    ["contactados","Contactados"],
    ["contactados_efectivos","Contactados efectivos"],
    ["reuniones_agendadas","Reuniones agendadas"],
    ["reuniones_efectivas","Reuniones efectivas"],
    ["concrecion","Concreción (%)"],
    ["ticket_promedio","Ticket promedio"],
    ["posible_concrecion","Posible concreción"],
    ["control_calidad","Control calidad"],
  ];
  const nameFields = ["contactados","contactados_efectivos","reuniones_agendadas","reuniones_efectivas"];

  return (
    <div style={{padding:"1.5rem",maxWidth:700}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:800,color:C.black}}>Mis KPIs</div>
        <Nav/>
      </div>
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(220px,100%),1fr))",gap:"12px 20px",marginBottom:14}}>
          {fields.map(([f,lbl])=>(
            <Field key={f} label={lbl}>
              <input
                type="text"
                inputMode={f==="control_calidad"?undefined:"numeric"}
                value={kpiForm[f]!==undefined?kpiForm[f]:cur[f]||""}
                onChange={e=>{const v=f==="control_calidad"?e.target.value:e.target.value.replace(/[^\d.]/g,"");setKpiForm(p=>({...p,[f]:v}));}}
                style={inp}
                placeholder="0"
              />
              {nameFields.includes(f)&&(
                <textarea
                  value={kpiForm[f+"_nombres"]!==undefined?kpiForm[f+"_nombres"]:cur[f+"_nombres"]||""}
                  onChange={e=>setKpiForm(p=>({...p,[f+"_nombres"]:e.target.value}))}
                  style={{...inp,height:52,resize:"none",marginTop:4,fontSize:11}}
                  placeholder="Ej: García Props, Del Rey..."
                />
              )}
            </Field>
          ))}
        </div>
        <div style={{padding:"10px 14px",background:C.gray50,borderRadius:8,fontSize:13,marginBottom:14,border:`1px solid ${C.gray100}`}}>
          <span style={{color:C.gray400}}>% Contactos efectivos: </span>
          <strong>{pct(parseInt(kpiForm.contactados_efectivos||cur.contactados_efectivos)||0,parseInt(kpiForm.contactados||cur.contactados)||0)}%</strong>
        </div>
        <Btn variant="primary" onClick={onSave} style={{width:"100%",justifyContent:"center"}}>
          Guardar KPIs — {week.label}
        </Btn>
      </Card>
    </div>
  );
}
