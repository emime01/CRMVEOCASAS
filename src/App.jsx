import { useState, useEffect } from "react";
import { getAll, addItem, updateItem, deleteItem, upsertItem } from "./firebase";
import { C, fmt, USERS, SELLERS, TABS, CREDENTIALS, daysUntil, getWeekDates, calcCuotas } from "./constants";
import { Stat, Card, Btn, Badge, Field, Grid2, Sec, Modal, ModalHeader, ModalBody, ModalFooter, PieChart, BarChart, ProgressBar, Table, Spinner, EmptyState, inp } from "./components/UI";
import { SaleCard, SaleDetailModal } from "./components/SaleCard";
import SaleForm from "./components/SaleForm";
import Comisiones from "./screens/Comisiones";
import Facturacion from "./screens/Facturacion";

const SELLERS_OBJ = USERS.filter(u=>["vendedor","inactivo"].includes(u.role));
const getUser = id => USERS.find(u=>u.id===id);
const PLATFORMS = ["Instagram","Facebook","LinkedIn","TikTok","Twitter/X"];

const INIT_DISP = [
  {id:"Propiedades",producto:"Propiedades",total:10,used:3},
  {id:"Destacadas",producto:"Destacadas",total:10,used:5},
  {id:"Superdestacadas",producto:"Superdestacadas",total:10,used:2},
  {id:"Super destacada Home Venta",producto:"Super destacada Home Venta",total:10,used:4},
  {id:"Destacada Home Venta",producto:"Destacada Home Venta",total:10,used:6},
  {id:"Super destacada Home Alquiler",producto:"Super destacada Home Alquiler",total:10,used:1},
  {id:"Destacada Home Alquiler",producto:"Destacada Home Alquiler",total:10,used:3},
  {id:"Índice",producto:"Índice",total:10,used:7},
  {id:"Producción",producto:"Producción",total:10,used:2},
  {id:"Banner",producto:"Banner",total:10,used:4},
  {id:"Desarrollos",producto:"Desarrollos",total:10,used:1},
];

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sales, setSales] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [productions, setProductions] = useState([]);
  const [posts, setPosts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [objetivos, setObjetivos] = useState([]);
  const [comisiones, setComisiones] = useState({vendedores:{},gerente:0,crm:0});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailSale, setDetailSale] = useState(null);
  const [editSale, setEditSale] = useState(null);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [showObjetivoForm, setShowObjetivoForm] = useState(false);
  const [kpiWeekOffset, setKpiWeekOffset] = useState(0);
  const [editAvail, setEditAvail] = useState(null);
  const [kpiForm, setKpiForm] = useState({});
  const [postForm, setPostForm] = useState({fecha:"",platform:"Instagram",content:"",status:"borrador"});
  const [objetivoForm, setObjetivoForm] = useState({ejecutivo:"sebastian",objetivo:0,q:1,anio:new Date().getFullYear()});
  const [filterVendedor, setFilterVendedor] = useState("todos");

  const defaultTab = r => ({gerente:"dashboard_gerente",vendedor:"dashboard",marketing:"producciones",admin:"facturacion"}[r]||"dashboard");

  const login = async (u) => {
    setUser(u); setTab(defaultTab(u.role)); setLoading(true);
    const [s,av,k,pr,po,inv,obj,com] = await Promise.all([
      getAll("ventas","created_at"), getAll("disponibilidad"), getAll("kpis"),
      getAll("producciones","created_at"), getAll("posts_social","fecha"),
      getAll("facturas","created_at"), getAll("objetivos"), getAll("comisiones"),
    ]);
    setSales(s); setKpis(k); setProductions(pr); setPosts(po); setInvoices(inv); setObjetivos(obj);
    if(com.length>0){ const c=com[0]; setComisiones({vendedores:c.vendedores||{},gerente:c.gerente||0,crm:c.crm||0}); }
    if(av.length===0){ for(const d of INIT_DISP) await upsertItem("disponibilidad",d.id,d); setAvailability(INIT_DISP); }
    else setAvailability(av);
    setLoading(false);
  };

  const logout = () => { setUser(null); setSales([]); };

  const mySales = user ? sales.filter(s=>s.ejecutivo===user.id) : [];
  const activeSales = sales.filter(s=>s.estado!=="cancelada");
  const alertas = activeSales.filter(s=>{const d=daysUntil(s.fecha_fin);return d!==null&&d>=0&&d<=30;});

  // ── CRUD ──────────────────────────────────────────────────
  const saveSale = async (form) => {
    setSaving(true);
    const data = await addItem("ventas",form);
    if(data){
      setSales(prev=>[data,...prev]);
      if(parseInt(form.produccion_q)>0){
        const pd=await addItem("producciones",{cliente:form.inmobiliaria,ejecutivo:form.ejecutivo,produccion_q:parseInt(form.produccion_q),fecha:"",confirmado:false,venta_id:data.id});
        if(pd) setProductions(prev=>[pd,...prev]);
      }
    }
    setSaving(false); setShowSaleForm(false);
  };

  const handleUpdateSale = async (id, changes) => {
    await updateItem("ventas",id,changes);
    setSales(prev=>prev.map(s=>s.id===id?{...s,...changes}:s));
  };

  const handleCancelSale = async (sale) => {
    if(!window.confirm(`¿Cancelar la venta de ${sale.inmobiliaria}? La comisión asociada se anulará.`)) return;
    await handleUpdateSale(sale.id,{estado:"cancelada",modificacion_aprobada:false,solicitud_modificacion:false});
    setDetailSale(null);
  };

  const handleApproveMod = (id) => handleUpdateSale(id,{modificacion_aprobada:true});
  const handleRejectMod = (id) => handleUpdateSale(id,{solicitud_modificacion:false,modificacion_aprobada:false});

  const saveKPI = async () => {
    setSaving(true);
    const week=getWeekDates(kpiWeekOffset);
    const kpiId=`${user.id}_${week.inicio}`;
    const payload={ejecutivo:user.id,semana:kpiWeekOffset,fecha_inicio:week.inicio,fecha_fin:week.fin,...kpiForm};
    await upsertItem("kpis",kpiId,payload);
    setKpis(prev=>[...prev.filter(k=>k.id!==kpiId),{...payload,id:kpiId}]);
    setKpiForm({}); setSaving(false);
  };

  const saveObjetivo = async () => {
    const objId=`${objetivoForm.ejecutivo}_${objetivoForm.mes}_${objetivoForm.anio}`;
    await upsertItem("objetivos",objId,objetivoForm);
    setObjetivos(prev=>[...prev.filter(o=>o.id!==objId),{...objetivoForm,id:objId}]);
    setShowObjetivoForm(false);
  };

  const updateComision = async (key, value) => {
    let newCom;
    if(key.startsWith("vendedor_")){
      const uid=key.replace("vendedor_","");
      newCom={...comisiones,vendedores:{...comisiones.vendedores,[uid]:value}};
    } else {
      newCom={...comisiones,[key]:value};
    }
    setComisiones(newCom);
    await upsertItem("comisiones","config",newCom);
  };

  const myKpi=(uid,week)=>kpis.find(k=>k.ejecutivo===uid&&k.semana===week)||{};

  const ventasDelQ=(uid)=>{
    const now=new Date();
    const q=Math.ceil((now.getMonth()+1)/3);
    const qStart=new Date(now.getFullYear(),(q-1)*3,1).toISOString().split("T")[0];
    const qEnd=new Date(now.getFullYear(),q*3,0).toISOString().split("T")[0];
    return sales.filter(s=>s.ejecutivo===uid&&s.estado!=="cancelada"&&s.fecha_venta>=qStart&&s.fecha_venta<=qEnd);
  };

  const totalVentasQ=(uid)=>ventasDelQ(uid).reduce((a,s)=>a+(s.total||0),0);

  const myObjetivo=(uid)=>{const now=new Date();return objetivos.find(o=>o.ejecutivo===uid&&o.mes===now.getMonth()+1&&o.anio===now.getFullYear())?.objetivo||0;};
  const pct=(a,b)=>b>0?Math.round((a/b)*100):0;

  // ── LOGIN ─────────────────────────────────────────────────
  if(!user) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg, #0A0A0A 0%, #1a0005 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{marginBottom:"2rem",textAlign:"center"}}>
        <div style={{fontSize:36,fontWeight:800,color:C.white,letterSpacing:3,marginBottom:4}}>VEO<span style={{color:C.red}}>CASAS</span></div>
        <div style={{color:C.gray500,fontSize:13}}>CRM Comercial · Modo prueba</div>
      </div>
      <div style={{background:C.white,borderRadius:20,padding:"2rem",width:"100%",maxWidth:480,boxShadow:"0 25px 60px rgba(0,0,0,0.4)"}}>
        <div style={{fontSize:14,fontWeight:600,color:C.gray700,marginBottom:16}}>Seleccioná tu perfil</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {USERS.filter(u=>u.role!=="inactivo").map(u=>(
            <button key={u.id} onClick={()=>login(u)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",border:`1.5px solid ${C.gray200}`,borderRadius:12,background:C.white,cursor:"pointer",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red;e.currentTarget.style.background=C.gray50;e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.gray200;e.currentTarget.style.background=C.white;e.currentTarget.style.transform="none";}}>
              <div style={{width:38,height:38,borderRadius:10,background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontWeight:700,fontSize:12,flexShrink:0}}>{u.avatar}</div>
              <div style={{textAlign:"left"}}>
                <div style={{fontWeight:600,fontSize:13,color:C.gray900}}>{u.name}</div>
                <div style={{fontSize:10,color:C.gray400,textTransform:"capitalize",marginTop:1}}>{u.role}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{padding:"12px 14px",background:C.gray50,borderRadius:10,fontSize:11,color:C.gray500,border:`1px solid ${C.gray200}`}}>
          <div style={{fontWeight:600,color:C.gray700,marginBottom:6}}>Credenciales para login real:</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
            {CREDENTIALS.map(c=><div key={c.id}><span style={{color:C.gray700,fontWeight:500}}>{c.username}:</span> {c.password}</div>)}
          </div>
        </div>
      </div>
    </div>
  );

  const currentTabs = (TABS[user.role]||[]).map(t=>t.id==="alertas"||t.id==="alertas_admin"?{...t,label:`Alertas${alertas.length>0?` (${alertas.length})`:""}`}:t);

  // ── NAVBAR ────────────────────────────────────────────────
  const NavBar = () => (
    <>
      <div style={{background:C.gray900,padding:"0 1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between",height:54,position:"sticky",top:0,zIndex:100,borderBottom:`1px solid ${C.gray800}`}}>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          <span style={{fontSize:16,fontWeight:800,color:C.white,letterSpacing:2,flexShrink:0}}>VEO<span style={{color:C.red}}>CASAS</span></span>
          <div style={{display:"flex",gap:2}} id="desktop-nav">
            {currentTabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"6px 12px",borderRadius:7,border:"none",background:tab===t.id?"rgba(192,0,26,0.15)":"transparent",color:tab===t.id?C.red:C.gray400,fontSize:12,fontWeight:tab===t.id?600:400,cursor:"pointer",transition:"all 0.15s",whiteSpace:"nowrap"}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {saving&&<span style={{fontSize:11,color:C.gray500,animation:"pulse 1s infinite"}}>Guardando...</span>}
          {alertas.length>0&&<div style={{width:7,height:7,borderRadius:"50%",background:C.red}}/>}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,borderRadius:9,background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:11,fontWeight:700}}>{user.avatar}</div>
            <span style={{color:C.gray300,fontSize:13,fontWeight:500}}>{user.name}</span>
          </div>
          <button onClick={logout} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${C.gray700}`,background:"transparent",color:C.gray500,fontSize:11,cursor:"pointer"}}>Salir</button>
          <button onClick={()=>setMenuOpen(m=>!m)} id="mobile-menu-btn" style={{display:"none",padding:"5px 8px",border:`1px solid ${C.gray700}`,borderRadius:7,background:"transparent",color:C.white,fontSize:16,cursor:"pointer",lineHeight:1}}>☰</button>
        </div>
      </div>
      <style>{`
        @media(max-width:768px){#desktop-nav{display:none!important;}#mobile-menu-btn{display:flex!important;}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>
      {menuOpen&&(
        <div style={{background:C.gray900,borderBottom:`1px solid ${C.gray800}`,padding:"8px 1rem",display:"flex",flexDirection:"column",gap:2}}>
          {currentTabs.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setMenuOpen(false);}} style={{padding:"10px 14px",borderRadius:8,border:"none",background:tab===t.id?"rgba(192,0,26,0.15)":"transparent",color:tab===t.id?C.red:C.gray400,fontSize:13,fontWeight:tab===t.id?600:400,cursor:"pointer",textAlign:"left"}}>
              {t.label}
            </button>
          ))}
        </div>
      )}
    </>
  );

  // ── SCREENS ───────────────────────────────────────────────

  const DashboardVendedor = () => {
    const lastKpi=myKpi(user.id,0);
    const hoy=new Date();
    const q=Math.ceil((hoy.getMonth()+1)/3);
    const qLabel=`Q${q} ${hoy.getFullYear()}`;
    const totalQ=totalVentasQ(user.id);
    const totalVentas=mySales.filter(s=>s.estado!=="cancelada").reduce((a,s)=>a+(s.total||0),0);
    const objetivo=myObjetivo(user.id);
    const comPct=comisiones?.vendedores?.[user.id]||0;
    const now=hoy;
    const mes=hoy.getMonth()+1; const anio=hoy.getFullYear();
    const getCuotaMes=(v)=>{
      if(!v.fecha_inicio) return v.total;
      const nc=v.num_cuotas||1; const mc=v.total/nc;
      for(let i=0;i<nc;i++){const f=new Date(v.fecha_inicio);f.setMonth(f.getMonth()+i);if(f.getMonth()+1===mes&&f.getFullYear()===anio)return mc;}
      return 0;
    };
    const comisionMes=Math.round(mySales.filter(s=>s.estado!=="cancelada").reduce((a,s)=>a+getCuotaMes(s)*(comPct/100),0));
    const weeklyData=[-3,-2,-1,0].map(w=>{const wd=getWeekDates(w);return{label:wd.label,value:mySales.filter(s=>s.estado!=="cancelada"&&s.created_at>=wd.inicio).reduce((a,s)=>a+(s.total||0),0),highlight:w===0};});
    return (
      <div style={{padding:"1.5rem",maxWidth:960}}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:22,fontWeight:800,color:C.gray900}}>Hola, {user.name} 👋</div>
          <div style={{fontSize:13,color:C.gray400,marginTop:4}}>Semana: {getWeekDates(0).label}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
          <Stat label="Ventas activas" value={mySales.filter(s=>s.estado!=="cancelada").length} color={C.red}/>
          <Stat label="Facturación total" value={fmt(totalVentas)}/>
          <Stat label="Comisión este mes" value={fmt(comisionMes)} color={C.green} sub={`${comPct}% mensualizado`}/>
          <Stat label="Concreción" value={`${lastKpi.concrecion||0}%`} sub="Esta semana"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
          <Card>
            <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:6}}>Objetivo {qLabel}</div>
            <div style={{fontSize:11,color:C.gray400,marginBottom:12}}>Ventas cerradas en el trimestre</div>
            <div style={{display:"flex",justifyContent:"center"}}><PieChart value={totalQ} max={objetivo} label={qLabel}/></div>
            {objetivo===0&&<div style={{textAlign:"center",fontSize:11,color:C.gray400,marginTop:8}}>Sin objetivo asignado para {qLabel}</div>}
          </Card>
          <Card>
            <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:14}}>Ventas — últimas 4 semanas</div>
            <BarChart data={weeklyData} height={90}/>
          </Card>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div>
            <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:10}}>Últimas ventas</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {mySales.slice(0,3).map(s=>(
                <SaleCard key={s.id} sale={s} onClick={setDetailSale} showActions
                  onRequestEdit={id=>handleUpdateSale(id,{solicitud_modificacion:true})}/>
              ))}
              {!mySales.length&&<EmptyState icon="📊" title="Sin ventas" desc="Registrá tu primera venta"/>}
            </div>
          </div>
          <Card>
            <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:12}}>KPIs esta semana</div>
            {[["Contactados",lastKpi.contactados||0],["C. efectivos",lastKpi.contactados_efectivos||0],["R. agendadas",lastKpi.reuniones_agendadas||0],["R. efectivas",lastKpi.reuniones_efectivas||0],["Ticket promedio",fmt(lastKpi.ticket_promedio||0)],["Posible concreción",fmt(lastKpi.posible_concrecion||0)]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.gray100}`,fontSize:13}}>
                <span style={{color:C.gray400}}>{k}</span><span style={{fontWeight:600,color:C.gray900}}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    );
  };

  const DashboardGerente = () => {
    const now=new Date();const mes=now.getMonth()+1;const anio=now.getFullYear();
    const q=Math.ceil(mes/3);
    const qLabel=`Q${q} ${anio}`;
    const total=activeSales.reduce((a,s)=>a+(s.total||0),0);
    const vxv=SELLERS_OBJ.map(s=>({...s,
      totalQ:totalVentasQ(s.id),
      total:activeSales.filter(v=>v.ejecutivo===s.id).reduce((a,v)=>a+(v.total||0),0),
      cantidad:activeSales.filter(v=>v.ejecutivo===s.id).length,
      objetivo:objetivos.find(o=>o.ejecutivo===s.id&&o.q===q&&o.anio===anio)?.objetivo||0
    }));
    const weeklyTeam=[-4,-3,-2,-1,0].map(w=>{const wd=getWeekDates(w);return{label:wd.label,value:activeSales.filter(s=>s.created_at>=wd.inicio).reduce((a,s)=>a+(s.total||0),0),highlight:w===0};});
    const totalObj=vxv.reduce((a,v)=>a+v.objetivo,0);
    const pending=sales.filter(s=>s.solicitud_modificacion&&!s.modificacion_aprobada);
    return (
      <div style={{padding:"1.5rem",maxWidth:1100}}>
        {showObjetivoForm&&(
          <Modal onClose={()=>setShowObjetivoForm(false)} maxWidth={380}>
            <ModalHeader title="Objetivo por Q" subtitle="Asignar objetivo trimestral" onClose={()=>setShowObjetivoForm(false)}/>
            <ModalBody>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <Field label="Vendedor">
                  <select value={objetivoForm.ejecutivo} onChange={e=>setObjetivoForm(f=>({...f,ejecutivo:e.target.value}))} style={inp}>
                    {SELLERS_OBJ.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Objetivo ($)">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={objetivoForm.objetivo===0?"":objetivoForm.objetivo}
                    onChange={e=>{const v=e.target.value.replace(/\D/g,"");setObjetivoForm(f=>({...f,objetivo:v===""?0:parseInt(v)}));}}
                    style={inp}
                    placeholder="Ej: 500000"
                  />
                </Field>
                <Grid2>
                  <Field label="Trimestre (Q)">
                    <select value={objetivoForm.q} onChange={e=>setObjetivoForm(f=>({...f,q:parseInt(e.target.value)}))} style={inp}>
                      <option value={1}>Q1 — Ene/Feb/Mar</option>
                      <option value={2}>Q2 — Abr/May/Jun</option>
                      <option value={3}>Q3 — Jul/Ago/Sep</option>
                      <option value={4}>Q4 — Oct/Nov/Dic</option>
                    </select>
                  </Field>
                  <Field label="Año">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={objetivoForm.anio}
                      onChange={e=>{const v=e.target.value.replace(/\D/g,"");setObjetivoForm(f=>({...f,anio:v===""?2026:parseInt(v)}));}}
                      style={inp}
                    />
                  </Field>
                </Grid2>
                <div style={{padding:"10px 14px",background:C.gray50,borderRadius:8,fontSize:12,color:C.gray500,border:`1px solid ${C.gray200}`}}>
                  Objetivo para <strong>{SELLERS_OBJ.find(s=>s.id===objetivoForm.ejecutivo)?.name}</strong> en <strong>Q{objetivoForm.q} {objetivoForm.anio}</strong>: <strong style={{color:C.red}}>{new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(objetivoForm.objetivo)}</strong>
                </div>
              </div>
            </ModalBody>
            <ModalFooter><Btn onClick={()=>setShowObjetivoForm(false)}>Cancelar</Btn><Btn variant="primary" onClick={saveObjetivo}>Guardar</Btn></ModalFooter>
          </Modal>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
          <div><div style={{fontSize:22,fontWeight:800,color:C.gray900}}>Dashboard Equipo</div><div style={{fontSize:13,color:C.gray400}}>Semana: {getWeekDates(0).label}</div></div>
          <Btn variant="primary" onClick={()=>setShowObjetivoForm(true)}>+ Asignar objetivo</Btn>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
          <Stat label="Ventas activas" value={activeSales.length} color={C.red}/>
          <Stat label="Facturación total" value={fmt(total)}/>
          <Stat label="Modificaciones pendientes" value={pending.length} color={pending.length>0?C.amber:C.green} alert={pending.length>0}/>
          <Stat label="Alertas vencimiento" value={alertas.length} color={alertas.length>0?C.red:C.green} alert={alertas.length>0}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:20}}>
          <Card><div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:14}}>Facturación por semana</div><BarChart data={weeklyTeam} height={110}/></Card>
          <Card>
            <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:12}}>Progreso equipo {qLabel}</div>
            <div style={{marginBottom:12}}><div style={{fontSize:11,color:C.gray400,marginBottom:4}}>Total equipo</div><ProgressBar value={vxv.reduce((a,v)=>a+v.totalQ,0)} max={totalObj}/></div>
            {vxv.map(v=>(
              <div key={v.id} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                  <span style={{fontWeight:500,color:C.gray700}}>{v.name}</span>
                  <span style={{color:C.gray400}}>{v.objetivo>0?`${pct(v.totalQ,v.objetivo)}%`:"—"}</span>
                </div>
                <ProgressBar value={v.totalQ} max={v.objetivo} showLabel={false}/>
              </div>
            ))}
          </Card>
        </div>
        <div style={{fontWeight:600,fontSize:14,color:C.gray800,marginBottom:12}}>Objetivos {qLabel}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
          {vxv.map(v=>(
            <Card key={v.id} style={{textAlign:"center"}}>
              <PieChart value={v.totalQ} max={v.objetivo} label={v.name} size={100}/>
              <div style={{fontSize:11,color:C.gray400,marginTop:6}}>{v.cantidad} ventas · {fmt(v.totalQ)} en {qLabel}</div>
            </Card>
          ))}
        </div>
        <div style={{fontWeight:600,fontSize:14,color:C.gray800,marginBottom:12}}>KPIs esta semana</div>
        <Table
          cols={[{key:"v",label:"Vendedor"},{key:"c",label:"Contactados"},{key:"ce",label:"C. efectivos"},{key:"pct",label:"%"},{key:"ra",label:"R. agendadas"},{key:"re",label:"R. efectivas"},{key:"con",label:"Concreción"},{key:"tk",label:"Ticket"},{key:"pc",label:"Pos. concreción"}]}
          rows={SELLERS_OBJ.map(s=>{const k=myKpi(s.id,0);return{v:<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:24,height:24,borderRadius:6,background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:9,fontWeight:700}}>{s.avatar}</div><span style={{fontWeight:500,fontSize:13}}>{s.name}</span></div>,c:k.contactados||0,ce:k.contactados_efectivos||0,pct:<Badge color={(k.contactados_efectivos||0)>0?"green":"gray"}>{pct(k.contactados_efectivos||0,k.contactados||0)}%</Badge>,ra:k.reuniones_agendadas||0,re:k.reuniones_efectivas||0,con:`${k.concrecion||0}%`,tk:fmt(k.ticket_promedio||0),pc:<span style={{color:C.green,fontWeight:600}}>{fmt(k.posible_concrecion||0)}</span>};})}
        />
      </div>
    );
  };

  const Ventas = () => {
    const list = (user.role==="gerente"
      ? (filterVendedor==="todos" ? sales : sales.filter(s=>s.ejecutivo===filterVendedor))
      : mySales);
    const active=list.filter(s=>s.estado!=="cancelada");
    return (
      <div style={{padding:"1.5rem",maxWidth:960}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div style={{fontSize:20,fontWeight:700,color:C.gray900}}>Ventas {user.role==="gerente"?"— Equipo":"— Mis Ventas"}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {user.role==="gerente"&&(
              <select value={filterVendedor} onChange={e=>setFilterVendedor(e.target.value)} style={{...inp,width:"auto",padding:"7px 12px",fontSize:12}}>
                <option value="todos">Todos los vendedores</option>
                {SELLERS_OBJ.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {user.role==="vendedor"&&<Btn variant="primary" onClick={()=>setShowSaleForm(true)}>+ Nueva Venta</Btn>}
          </div>
        </div>
        {user.role==="gerente"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
            <Stat label="Ventas activas" value={active.length} color={C.red}/>
            <Stat label="Facturación" value={fmt(active.reduce((a,s)=>a+(s.total||0),0))}/>
            <Stat label="Ticket promedio" value={active.length?fmt(Math.round(active.reduce((a,s)=>a+(s.total||0),0)/active.length)):"-"}/>
            <Stat label="Vendedores" value={[...new Set(active.map(s=>s.ejecutivo))].length}/>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {list.map(s=>(
            <SaleCard key={s.id} sale={s} onClick={setDetailSale}
              showActions={user.role==="vendedor"}
              onRequestEdit={id=>handleUpdateSale(id,{solicitud_modificacion:true})}/>
          ))}
          {!list.length&&<EmptyState icon="📋" title="Sin ventas" desc="Aquí aparecerán las ventas registradas"/>}
        </div>
      </div>
    );
  };

  const KPIs = () => {
    const week=getWeekDates(kpiWeekOffset);
    const Nav=()=>(
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <Btn size="sm" onClick={()=>setKpiWeekOffset(w=>w-1)}>←</Btn>
        <span style={{fontSize:12,color:C.gray500,minWidth:130,textAlign:"center",fontWeight:500}}>{week.label}</span>
        <Btn size="sm" onClick={()=>setKpiWeekOffset(w=>Math.min(w+1,0))}>→</Btn>
      </div>
    );
    if(user.role==="gerente") return (
      <div style={{padding:"1.5rem",maxWidth:960}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontSize:20,fontWeight:700}}>KPIs del Equipo</div><Nav/></div>
        {SELLERS_OBJ.map(s=>{const k=myKpi(s.id,kpiWeekOffset);return(
          <Card key={s.id} style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:34,height:34,borderRadius:9,background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:11,fontWeight:700}}>{s.avatar}</div>
              <div style={{fontWeight:600,fontSize:14,color:C.gray900}}>{s.name}</div>
              {k.fecha_inicio&&<span style={{fontSize:11,color:C.gray400,marginLeft:"auto"}}>Sem. {k.fecha_inicio}</span>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {[["Contactados",k.contactados||0],["C. efectivos",k.contactados_efectivos||0],["R. agendadas",k.reuniones_agendadas||0],["R. efectivas",k.reuniones_efectivas||0],["Concreción",`${k.concrecion||0}%`],["Ticket prom.",fmt(k.ticket_promedio||0)],["Pos. concreción",fmt(k.posible_concrecion||0)],["Control calidad",k.control_calidad||"—"]].map(([lbl,v])=>(
                <div key={lbl} style={{background:C.gray50,borderRadius:8,padding:"10px 12px",border:`1px solid ${C.gray100}`}}>
                  <div style={{fontSize:9,color:C.gray400,marginBottom:3,textTransform:"uppercase",letterSpacing:0.3,fontWeight:500}}>{lbl}</div>
                  <div style={{fontWeight:600,fontSize:13,color:C.gray900}}>{v}</div>
                </div>
              ))}
            </div>
          </Card>
        );})}
      </div>
    );
    const cur=myKpi(user.id,kpiWeekOffset);
    const fields=[["contactados","Contactados"],["contactados_efectivos","Contactados efectivos"],["reuniones_agendadas","Reuniones agendadas"],["reuniones_efectivas","Reuniones efectivas"],["concrecion","Concreción (%)"],["ticket_promedio","Ticket promedio"],["posible_concrecion","Posible concreción"],["control_calidad","Control calidad"]];
    return (
      <div style={{padding:"1.5rem",maxWidth:700}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{fontSize:20,fontWeight:700}}>Mis KPIs</div><Nav/></div>
        <Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px",marginBottom:14}}>
            {fields.map(([f,lbl])=>(
              <Field key={f} label={lbl}>
                <input type={f==="control_calidad"?"text":"number"} value={kpiForm[f]!==undefined?kpiForm[f]:cur[f]||""} onChange={e=>setKpiForm(p=>({...p,[f]:e.target.value}))} style={inp} placeholder="0"/>
              </Field>
            ))}
          </div>
          <div style={{padding:"10px 14px",background:C.gray50,borderRadius:8,fontSize:13,marginBottom:14,border:`1px solid ${C.gray100}`}}>
            <span style={{color:C.gray400}}>% Contactos efectivos: </span>
            <strong style={{color:C.gray900}}>{pct(parseInt(kpiForm.contactados_efectivos||cur.contactados_efectivos)||0,parseInt(kpiForm.contactados||cur.contactados)||0)}%</strong>
          </div>
          <Btn variant="primary" onClick={saveKPI} style={{width:"100%",justifyContent:"center"}}>
            Guardar KPIs — {week.label}
          </Btn>
        </Card>
      </div>
    );
  };

  const Disponibilidad = () => (
    <div style={{padding:"1.5rem",maxWidth:800}}>
      <div style={{fontSize:20,fontWeight:700,color:C.gray900,marginBottom:20}}>Disponibilidad de Productos</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {availability.map(a=>{
          const p=Math.round((a.used/a.total)*100);
          const color=p>=90?C.red:p>=60?C.amber:C.green;
          return (
            <Card key={a.producto}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontWeight:600,fontSize:13,color:C.gray800}}>{a.producto}</span>
                <span style={{fontSize:12,color:C.gray400,fontWeight:500}}>{a.used}/{a.total}</span>
              </div>
              <div style={{height:6,background:C.gray100,borderRadius:3,overflow:"hidden",marginBottom:6}}>
                <div style={{height:"100%",width:`${p}%`,background:color,borderRadius:3,transition:"width 0.4s"}}/>
              </div>
              <div style={{fontSize:11,color,fontWeight:600}}>{p}% ocupado</div>
              {user.role==="gerente"&&editAvail===a.id?(
                <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                  <input type="number" defaultValue={a.total} id={`t-${a.id}`} style={{...inp,width:60,padding:"4px 6px",fontSize:12}}/>
                  <input type="number" defaultValue={a.used} id={`u-${a.id}`} style={{...inp,width:60,padding:"4px 6px",fontSize:12}}/>
                  <Btn size="sm" variant="primary" onClick={async()=>{const t=parseInt(document.getElementById(`t-${a.id}`).value)||a.total;const u=parseInt(document.getElementById(`u-${a.id}`).value)||a.used;await upsertItem("disponibilidad",a.id,{...a,total:t,used:u});setAvailability(prev=>prev.map(x=>x.id===a.id?{...x,total:t,used:u}:x));setEditAvail(null);}}>OK</Btn>
                  <Btn size="sm" onClick={()=>setEditAvail(null)}>×</Btn>
                </div>
              ):user.role==="gerente"&&<button onClick={()=>setEditAvail(a.id)} style={{marginTop:6,fontSize:11,color:C.red,background:"none",border:"none",cursor:"pointer",padding:0,fontWeight:500}}>Editar</button>}
            </Card>
          );
        })}
      </div>
    </div>
  );

  const Modificaciones = () => {
    const pending=sales.filter(s=>s.solicitud_modificacion&&!s.modificacion_aprobada);
    const approved=sales.filter(s=>s.modificacion_aprobada);
    return (
      <div style={{padding:"1.5rem",maxWidth:800}}>
        <div style={{fontSize:20,fontWeight:700,marginBottom:20}}>Solicitudes de modificación</div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:600,color:C.amber,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <Badge color="amber">Pendientes</Badge> {pending.length}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {pending.map(s=>(
              <Card key={s.id} style={{border:`1.5px solid ${C.amber}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13}}>{s.inmobiliaria}</div>
                    <div style={{fontSize:11,color:C.gray400,marginTop:2}}>{getUser(s.ejecutivo)?.name} · {fmt(s.total)}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <Btn size="sm" variant="success" onClick={()=>handleApproveMod(s.id)}>Aprobar</Btn>
                    <Btn size="sm" variant="danger" onClick={()=>handleRejectMod(s.id)}>Rechazar</Btn>
                  </div>
                </div>
              </Card>
            ))}
            {!pending.length&&<div style={{color:C.gray400,fontSize:13,padding:"1rem",textAlign:"center"}}>No hay solicitudes pendientes</div>}
          </div>
        </div>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:C.green,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <Badge color="green">Aprobadas</Badge> {approved.length}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {approved.map(s=>(
              <Card key={s.id} style={{border:`1.5px solid ${C.green}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontWeight:600,fontSize:13}}>{s.inmobiliaria}</div><div style={{fontSize:11,color:C.gray400,marginTop:2}}>{getUser(s.ejecutivo)?.name} · {fmt(s.total)}</div></div>
                  <Badge color="green">Editando</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const Alertas = () => {
    const vencidas=activeSales.filter(s=>{const d=daysUntil(s.fecha_fin);return d!==null&&d<0;});
    return (
      <div style={{padding:"1.5rem",maxWidth:800}}>
        <div style={{fontSize:20,fontWeight:700,marginBottom:20}}>Alertas de Contratos</div>
        {vencidas.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:600,color:C.gray500,marginBottom:10}}>Vencidos ({vencidas.length})</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {vencidas.map(s=>(
                <Card key={s.id} style={{opacity:0.7}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><div style={{fontWeight:600,fontSize:13}}>{s.inmobiliaria}</div><div style={{fontSize:11,color:C.gray400}}>{getUser(s.ejecutivo)?.name} · Venció: {s.fecha_fin}</div></div>
                    <Badge color="gray">Vencido</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
        <div style={{fontSize:13,fontWeight:600,color:C.red,marginBottom:10}}>Por vencer en 30 días ({alertas.length})</div>
        {!alertas.length&&<EmptyState icon="✅" title="Todo en orden" desc="No hay contratos próximos a vencer"/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {alertas.sort((a,b)=>daysUntil(a.fecha_fin)-daysUntil(b.fecha_fin)).map(s=>{
            const dias=daysUntil(s.fecha_fin);
            return (
              <Card key={s.id} style={{border:`1.5px solid ${dias<=7?C.red:C.amber}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                  <div><div style={{fontWeight:600,fontSize:13}}>{s.inmobiliaria}</div><div style={{fontSize:11,color:C.gray400,marginTop:2}}>{getUser(s.ejecutivo)?.name} · {fmt(s.total)} · Vence: {s.fecha_fin}</div></div>
                  <Badge color={dias<=7?"red":"amber"}>{dias}d restantes</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const Producciones = () => {
    const list=user.role==="vendedor"?productions.filter(p=>p.ejecutivo===user.id):productions;
    return (
      <div style={{padding:"1.5rem",maxWidth:800}}>
        <div style={{fontSize:20,fontWeight:700,marginBottom:20}}>{user.role==="marketing"?"Producciones a confirmar":user.role==="gerente"?"Producciones":"Mis Producciones"}</div>
        {!list.length&&<EmptyState icon="🎬" title="Sin producciones" desc="No hay producciones pendientes"/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {list.map(p=>{const s=getUser(p.ejecutivo);return(
            <Card key={p.id} style={{border:`1.5px solid ${p.confirmado?C.green:C.gray200}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div><div style={{fontWeight:600,fontSize:13}}>{p.cliente}</div><div style={{fontSize:11,color:C.gray400,marginTop:2}}>{s?.name} · ×{p.produccion_q}</div></div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <Badge color={p.confirmado?"green":"amber"}>{p.confirmado?"Confirmado":"Pendiente"}</Badge>
                  {(user.role==="marketing"||user.role==="vendedor")&&<input type="date" value={p.fecha||""} onChange={async e=>{await updateItem("producciones",p.id,{fecha:e.target.value});setProductions(prev=>prev.map(x=>x.id===p.id?{...x,fecha:e.target.value}:x));}} style={{...inp,width:140,fontSize:12,padding:"6px 10px"}}/>}
                  {user.role==="marketing"&&!p.confirmado&&<Btn size="sm" variant="primary" onClick={async()=>{await updateItem("producciones",p.id,{confirmado:true});setProductions(prev=>prev.map(x=>x.id===p.id?{...x,confirmado:true}:x));}}>Confirmar</Btn>}
                </div>
              </div>
            </Card>
          );})}
        </div>
        {user.role==="marketing"&&(
          <div style={{marginTop:24}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>Calendario</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
              {["L","M","M","J","V","S","D"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,color:C.gray400,padding:"4px 0",fontWeight:500}}>{d}</div>)}
              {Array.from({length:30},(_,i)=>{const day=i+1;const has=productions.some(p=>p.confirmado&&p.fecha&&new Date(p.fecha).getDate()===day);return<div key={i} style={{textAlign:"center",padding:"8px 2px",borderRadius:6,background:has?C.red:C.gray100,color:has?C.white:C.gray700,fontSize:12,fontWeight:has?600:400}}>{day}</div>;})}
            </div>
          </div>
        )}
      </div>
    );
  };

  const Social = () => (
    <div style={{padding:"1.5rem",maxWidth:900}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:700}}>Redes Sociales</div>
        <Btn variant="primary" onClick={()=>setShowPostForm(true)}>+ Nuevo Post</Btn>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {posts.map(p=>(
          <Card key={p.id}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{padding:"5px 10px",background:C.gray100,borderRadius:7,fontSize:11,fontWeight:600,minWidth:76,textAlign:"center",color:C.gray700,flexShrink:0}}>{p.fecha}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                  <Badge color="red">{p.platform}</Badge>
                  <Badge color={p.status==="programado"?"green":"gray"}>{p.status}</Badge>
                </div>
                <div style={{fontSize:13,color:C.gray700}}>{p.content}</div>
              </div>
              <button onClick={async()=>{await deleteItem("posts_social",p.id);setPosts(prev=>prev.filter(x=>x.id!==p.id));}} style={{border:"none",background:"none",color:C.gray300,cursor:"pointer",fontSize:18,flexShrink:0,padding:"0 4px"}}>×</button>
            </div>
          </Card>
        ))}
        {!posts.length&&<EmptyState icon="📱" title="Sin posts" desc="Programá el primer post"/>}
      </div>
      {showPostForm&&(
        <Modal onClose={()=>setShowPostForm(false)} maxWidth={460}>
          <ModalHeader title="Nuevo Post" onClose={()=>setShowPostForm(false)}/>
          <ModalBody>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Field label="Fecha"><input type="date" value={postForm.fecha} onChange={e=>setPostForm(f=>({...f,fecha:e.target.value}))} style={inp}/></Field>
              <Field label="Plataforma"><select value={postForm.platform} onChange={e=>setPostForm(f=>({...f,platform:e.target.value}))} style={inp}>{PLATFORMS.map(p=><option key={p}>{p}</option>)}</select></Field>
              <Field label="Contenido"><textarea value={postForm.content} onChange={e=>setPostForm(f=>({...f,content:e.target.value}))} style={{...inp,height:80,resize:"none"}}/></Field>
              <Field label="Estado"><select value={postForm.status} onChange={e=>setPostForm(f=>({...f,status:e.target.value}))} style={inp}><option value="borrador">Borrador</option><option value="programado">Programado</option><option value="publicado">Publicado</option></select></Field>
            </div>
          </ModalBody>
          <ModalFooter>
            <Btn onClick={()=>setShowPostForm(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={async()=>{const d=await addItem("posts_social",postForm);if(d)setPosts(prev=>[...prev,d]);setShowPostForm(false);setPostForm({fecha:"",platform:"Instagram",content:"",status:"borrador"});}}>Agregar</Btn>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );

  const screens = {
    dashboard:<DashboardVendedor/>,
    dashboard_gerente:<DashboardGerente/>,
    ventas:<Ventas/>,
    kpis:<KPIs/>,
    disponibilidad:<Disponibilidad/>,
    producciones:<Producciones/>,
    social:<Social/>,
    modificaciones:<Modificaciones/>,
    alertas:<Alertas/>,
    alertas_admin:<Alertas/>,
    comisiones:<div style={{padding:"1.5rem"}}><div style={{fontSize:20,fontWeight:700,color:C.gray900,marginBottom:8}}>Comisiones</div><div style={{color:C.gray400,fontSize:13,padding:"2rem",background:C.white,borderRadius:12,border:`1px solid ${C.gray200}`,textAlign:"center"}}>🔧 Sección en configuración — próximamente disponible</div></div>,
    facturacion:<Facturacion
      sales={sales}
      invoices={invoices}
      isGerente={user.role==="gerente"}
      onUpdateSale={handleUpdateSale}
      onUpdateInvoice={async(id,ch)=>{await updateItem("facturas",id,ch);setInvoices(prev=>prev.map(x=>x.id===id?{...x,...ch}:x));}}
      onAddInvoice={async(f)=>{const d=await addItem("facturas",f);if(d)setInvoices(prev=>[d,...prev]);}}
    />,
    clientes:<div style={{padding:"1.5rem",maxWidth:900}}><div style={{fontSize:20,fontWeight:700,marginBottom:20}}>Clientes</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{[...new Map(sales.map(s=>[s.inmobiliaria,s])).values()].map(s=><Card key={s.id}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}><div><div style={{fontWeight:600,fontSize:13}}>{s.inmobiliaria}</div><div style={{fontSize:11,color:C.gray400,marginTop:2}}>{s.razon_social} · {s.rut}</div><div style={{fontSize:11,color:C.gray400}}>{s.mail} · {s.telefono}</div></div><div style={{textAlign:"right"}}><div style={{fontWeight:700,color:C.red,fontSize:14}}>{fmt(s.total)}</div><div style={{fontSize:11,color:C.gray400}}>{s.metodo_pago}</div></div></div></Card>)}</div></div>,
    assets:<EmptyState icon="📁" title="Assets" desc="Módulo en desarrollo"/>,
    metricas:<EmptyState icon="📈" title="Métricas" desc="Módulo en desarrollo"/>,
    reportes:<EmptyState icon="📊" title="Reportes" desc="Módulo en desarrollo"/>,
    contratos:<Alertas/>,
  };

  return (
    <div style={{minHeight:"100vh",background:C.gray50,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif"}}>
      <NavBar/>
      <div style={{minHeight:"calc(100vh - 54px)"}}>
        {loading ? <Spinner/> : (screens[tab]||<EmptyState icon="🔍" title="Sección no encontrada"/>)}
      </div>

      {/* Detail Modal */}
      {detailSale&&(
        <SaleDetailModal
          sale={detailSale}
          onClose={()=>setDetailSale(null)}
          canEdit={detailSale.modificacion_aprobada&&user.role==="vendedor"}
          isGerente={user.role==="gerente"}
          isAdmin={user.role==="admin"}
          onEdit={s=>{setEditSale(s);setDetailSale(null);}}
          onDelete={handleCancelSale}
          onApprove={id=>{handleApproveMod(id);setDetailSale(s=>({...s,modificacion_aprobada:true}));}}
          onReject={id=>{handleRejectMod(id);setDetailSale(null);}}
        />
      )}

      {/* Sale Form */}
      {(showSaleForm||editSale)&&(
        <SaleForm
          initialData={editSale}
          currentUser={user}
          onClose={()=>{setShowSaleForm(false);setEditSale(null);}}
          onSave={async form=>{
            if(editSale){ await handleUpdateSale(editSale.id,{...form,modificacion_aprobada:false,solicitud_modificacion:false}); setEditSale(null); }
            else await saveSale(form);
          }}
        />
      )}
    </div>
  );
}
