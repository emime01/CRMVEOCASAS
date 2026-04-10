import { useState, useEffect, useRef } from "react";
import { getAll, addItem, updateItem, deleteItem, upsertItem } from "./firebase";

const C = { red:"#C0001A", black:"#111111", white:"#FFFFFF", gray:"#F5F5F5", grayMid:"#E0E0E0", grayDark:"#555555", grayText:"#888888" };

const USERS = [
  { id:"mika",      name:"Mika",           role:"gerente",   avatar:"MI" },
  { id:"sebastian", name:"Sebastian",       role:"vendedor",  avatar:"SE" },
  { id:"juanba",    name:"Juanba",          role:"vendedor",  avatar:"JB" },
  { id:"paty",      name:"Paty",            role:"vendedor",  avatar:"PA" },
  { id:"stefano",   name:"Stefano",         role:"vendedor",  avatar:"ST" },
  { id:"mateo",     name:"Mateo",           role:"marketing", avatar:"MA" },
  { id:"admin",     name:"Administración",  role:"admin",     avatar:"AD" },
];
const SELLERS = USERS.filter(u => u.role === "vendedor");
const CRMS = ["Tera","Nai","Casasweb","Tokko","Xintel","2clics","Otro CRM","SIN CRM"];
const PRODUCTS = ["Propiedades","Destacadas","Superdestacadas","Super destacada Home Venta","Destacada Home Venta","Super destacada Home Alquiler","Destacada Home Alquiler","Índice","Producción","Banner","Desarrollos"];
const PAYMENT_METHODS = ["Transferencia","Tarjeta de crédito","Cheque","Efectivo"];
const PLATFORMS = ["Instagram","Facebook","LinkedIn","TikTok","Twitter/X"];
const CREDENTIALS = [
  { id:"mika", username:"Mika", password:"Veo#Mk9x2" },
  { id:"sebastian", username:"Sebastian", password:"Veo#Sb4k7" },
  { id:"juanba", username:"Juanba", password:"Veo#Jb3m5" },
  { id:"paty", username:"Paty", password:"Veo#Pt8n1" },
  { id:"stefano", username:"Stefano", password:"Veo#St6q4" },
  { id:"mateo", username:"Mateo", password:"Veo#Mt2w8" },
  { id:"admin", username:"Admin", password:"Veo#Ad5r9" },
];

const fmt = n => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);
const pct = (a,b) => b>0 ? Math.round((a/b)*100) : 0;
const inp = { width:"100%", padding:"8px 10px", borderRadius:7, border:`1px solid ${C.grayMid}`, fontSize:13, outline:"none", boxSizing:"border-box", background:C.white };
const Sec = ({title,children}) => <div style={{marginBottom:16}}><div style={{fontWeight:500,fontSize:12,color:C.red,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>{title}</div>{children}</div>;
const Grid2 = ({children}) => <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px"}}>{children}</div>;
const Field = ({label,children}) => <div><div style={{fontSize:11,color:C.grayText,marginBottom:3}}>{label}</div>{children}</div>;
const Stat = ({label,value,sub,color,alert}) => (
  <div style={{background:C.white,border:`1.5px solid ${alert?C.red:C.grayMid}`,borderRadius:10,padding:"14px 16px",position:"relative"}}>
    {alert&&<div style={{position:"absolute",top:8,right:10,width:8,height:8,borderRadius:"50%",background:C.red}}/>}
    <div style={{fontSize:11,color:C.grayText,marginBottom:4}}>{label}</div>
    <div style={{fontSize:20,fontWeight:600,color:color||C.black}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:C.grayText,marginTop:2}}>{sub}</div>}
  </div>
);

const PieChart = ({value,max,label,color=C.red}) => {
  const r=54,cx=60,cy=60;
  const p=max>0?Math.min(value/max,1):0;
  const angle=p*2*Math.PI;
  const x=cx+r*Math.sin(angle),y=cy-r*Math.cos(angle);
  const large=angle>Math.PI?1:0;
  const path=p>=1?`M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx-0.01} ${cy-r} Z`:`M ${cx} ${cy-r} A ${r} ${r} 0 ${large} 1 ${x} ${y} L ${cx} ${cy} Z`;
  return (
    <div style={{textAlign:"center"}}>
      <svg width="120" height="120">
        <circle cx={cx} cy={cy} r={r} fill={C.grayMid}/>
        {p>0&&<path d={path} fill={color}/>}
        <circle cx={cx} cy={cy} r={36} fill={C.white}/>
        <text x={cx} y={cy-6} textAnchor="middle" fontSize="14" fontWeight="600" fill={C.black}>{Math.round(p*100)}%</text>
        <text x={cx} y={cy+12} textAnchor="middle" fontSize="10" fill={C.grayText}>objetivo</text>
      </svg>
      <div style={{fontSize:12,color:C.grayText,marginTop:2}}>{label}</div>
      <div style={{fontSize:13,fontWeight:600,color}}>{fmt(value)}</div>
      <div style={{fontSize:11,color:C.grayText}}>de {fmt(max)}</div>
    </div>
  );
};

const BarChart = ({data,height=120}) => {
  if(!data||!data.length) return null;
  const max=Math.max(...data.map(d=>d.value),1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height:height+40,padding:"0 4px"}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <div style={{fontSize:9,color:C.grayText,fontWeight:500,textAlign:"center"}}>{d.value>0?fmt(d.value):""}</div>
          <div style={{width:"100%",background:d.highlight?C.red:C.grayMid,borderRadius:"4px 4px 0 0",height:Math.max((d.value/max)*height,2),transition:"height 0.3s"}}/>
          <div style={{fontSize:9,color:C.grayText,textAlign:"center",lineHeight:1.2}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
};

const LineSparkline = ({data,color=C.red,height=50}) => {
  if(!data||data.length<2) return null;
  const max=Math.max(...data,1),min=Math.min(...data,0);
  const range=max-min||1;
  const w=200,h=height;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/range)*h}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"/>
    </svg>
  );
};

const getWeekDates = (offset=0) => {
  const now=new Date();
  const day=now.getDay();
  const mon=new Date(now);
  mon.setDate(now.getDate()-(day===0?6:day-1)+offset*7);
  const sun=new Date(mon); sun.setDate(mon.getDate()+6);
  return {
    inicio:mon.toISOString().split("T")[0],
    fin:sun.toISOString().split("T")[0],
    label:`${mon.getDate()}/${mon.getMonth()+1} - ${sun.getDate()}/${sun.getMonth()+1}`
  };
};

const daysUntil = (dateStr) => {
  if(!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff/(1000*60*60*24));
};

const INIT_DISPONIBILIDAD = [
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

// Export to Excel
const exportExcel = async (data, filename) => {
  const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, filename);
};

// Export to PDF
const exportPDF = async (columns, rows, title, filename) => {
  const { default: jsPDF } = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
  const { default: autoTable } = await import("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js");
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-CL")}`, 14, 28);
  autoTable(doc, { head:[columns], body:rows, startY:34, styles:{fontSize:9}, headStyles:{fillColor:[192,0,26]} });
  doc.save(filename);
};

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalSale, setModalSale] = useState(null);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [showObjetivoForm, setShowObjetivoForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [kpiWeekOffset, setKpiWeekOffset] = useState(0);
  const [editAvail, setEditAvail] = useState(null);
  const [kpiForm, setKpiForm] = useState({});
  const [postForm, setPostForm] = useState({fecha:"",platform:"Instagram",content:"",status:"borrador"});
  const [saleForm, setSaleForm] = useState({});
  const [objetivoForm, setObjetivoForm] = useState({ejecutivo:"sebastian",objetivo:0,mes:new Date().getMonth()+1,anio:new Date().getFullYear()});
  const [invoiceForm, setInvoiceForm] = useState({folio:"",client:"",amount:0,date:"",status:"pendiente",vencimiento:""});
  const [filterVendedor, setFilterVendedor] = useState("todos");
  const [filterMes, setFilterMes] = useState("todos");

  const defaultTab = r => ({gerente:"dashboard_gerente",vendedor:"dashboard",marketing:"producciones",admin:"facturacion"}[r]||"dashboard");

  const login = async (u) => {
    setUser(u); setTab(defaultTab(u.role)); setLoading(true);
    const [s,av,k,pr,po,inv,obj] = await Promise.all([
      getAll("ventas","created_at"), getAll("disponibilidad"), getAll("kpis"),
      getAll("producciones","created_at"), getAll("posts_social","fecha"),
      getAll("facturas","created_at"), getAll("objetivos"),
    ]);
    setSales(s); setKpis(k); setProductions(pr); setPosts(po); setInvoices(inv); setObjetivos(obj);
    if(av.length===0){ for(const d of INIT_DISPONIBILIDAD) await upsertItem("disponibilidad",d.id,d); setAvailability(INIT_DISPONIBILIDAD); }
    else setAvailability(av);
    setLoading(false);
  };

  const logout = () => { setUser(null); setSales([]); setAvailability([]); setKpis([]); setProductions([]); setPosts([]); setInvoices([]); setObjetivos([]); };
  const mySales = user ? sales.filter(s=>s.ejecutivo===user.id) : [];

  // Alertas de vencimiento
  const alertas = sales.filter(s => { const d=daysUntil(s.fecha_fin); return d!==null && d>=0 && d<=30; });
  const alertasVencidas = sales.filter(s => { const d=daysUntil(s.fecha_fin); return d!==null && d<0; });

  const initSaleForm = () => setSaleForm({ inmobiliaria:"", razon_social:"", rut:"", mail:"", telefono:"", direccion:"", crm:"SIN CRM", ejecutivo:user?.id||"sebastian", detalle:"", propiedades:0, destacadas_q:0, superdestacadas_q:0, produccion_q:0, indice:0, destacadas_home:0, fecha_inicio:"", fecha_fin:"", valor_mensual:0, subtotal:0, metodo_pago:"Transferencia", productos_seleccionados:[], estado:"activa", solicitud_modificacion:false, modificacion_aprobada:false });

  const saveSale = async (form) => {
    setSaving(true);
    const total=Math.round((parseFloat(form.subtotal)||0)*1.19);
    const data=await addItem("ventas",{...form,total});
    if(data){
      setSales(prev=>[data,...prev]);
      if(parseInt(form.produccion_q)>0){
        const pd=await addItem("producciones",{cliente:form.inmobiliaria,ejecutivo:form.ejecutivo,produccion_q:parseInt(form.produccion_q),fecha:"",confirmado:false,venta_id:data.id});
        if(pd) setProductions(prev=>[pd,...prev]);
      }
    }
    setSaving(false); setShowSaleForm(false);
  };

  const updateSale = async (id,changes) => {
    await updateItem("ventas",id,changes);
    setSales(prev=>prev.map(s=>s.id===id?{...s,...changes}:s));
  };

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

  const saveInvoice = async () => {
    const data=await addItem("facturas",invoiceForm);
    if(data) setInvoices(prev=>[data,...prev]);
    setShowInvoiceForm(false);
    setInvoiceForm({folio:"",client:"",amount:0,date:"",status:"pendiente",vencimiento:""});
  };

  const myKpi=(uid,week)=>kpis.find(k=>k.ejecutivo===uid&&k.semana===week)||{};
  const myObjetivo=(uid)=>{const now=new Date();return objetivos.find(o=>o.ejecutivo===uid&&o.mes===now.getMonth()+1&&o.anio===now.getFullYear())?.objetivo||0;};

  const TABS = {
    vendedor:[{id:"dashboard",label:"Dashboard"},{id:"ventas",label:"Ventas"},{id:"kpis",label:"KPIs"},{id:"producciones",label:"Producciones"},{id:"disponibilidad",label:"Disponibilidad"}],
    gerente:[{id:"dashboard_gerente",label:"Dashboard"},{id:"ventas",label:"Ventas"},{id:"kpis",label:"KPIs"},{id:"disponibilidad",label:"Disponibilidad"},{id:"producciones",label:"Producciones"},{id:"modificaciones",label:"Modificaciones"},{id:"alertas",label:`Alertas${alertas.length>0?` (${alertas.length})`:""}` }],
    marketing:[{id:"producciones",label:"Producciones"},{id:"social",label:"Redes Sociales"},{id:"assets",label:"Assets"},{id:"metricas",label:"Métricas"}],
    admin:[{id:"facturacion",label:"Facturación"},{id:"contratos",label:"Contratos"},{id:"clientes",label:"Clientes"},{id:"reportes",label:"Reportes"},{id:"alertas_admin",label:`Vencimientos${alertas.length>0?` (${alertas.length})`:""}` }],
  };

  if(!user) return (
    <div style={{minHeight:"100vh",background:C.black,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{marginBottom:"1.5rem",textAlign:"center"}}>
        <div style={{fontSize:28,fontWeight:700,color:C.white,letterSpacing:2}}>VEO<span style={{color:C.red}}>CASAS</span></div>
        <div style={{color:C.grayText,fontSize:13,marginTop:4}}>CRM Comercial</div>
      </div>
      <div style={{background:C.white,borderRadius:16,padding:"1.5rem",width:"100%",maxWidth:480}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          <p style={{fontWeight:500,margin:0,fontSize:14}}>Seleccioná tu perfil</p>
          <span style={{fontSize:11,background:"#fff5e0",color:"#E67E22",padding:"2px 8px",borderRadius:10}}>Modo prueba</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {USERS.map(u=>(
            <button key={u.id} onClick={()=>login(u)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:`1.5px solid ${C.grayMid}`,borderRadius:10,background:C.white,cursor:"pointer"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red;e.currentTarget.style.background=C.gray;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.grayMid;e.currentTarget.style.background=C.white;}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontWeight:600,fontSize:11,flexShrink:0}}>{u.avatar}</div>
              <div style={{textAlign:"left"}}>
                <div style={{fontWeight:500,fontSize:13}}>{u.name}</div>
                <div style={{fontSize:10,color:C.grayText,textTransform:"capitalize"}}>{u.role}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{padding:"10px 12px",background:C.gray,borderRadius:8,fontSize:11,color:C.grayText}}>
          <strong style={{color:C.black}}>Credenciales (cuando se active el login):</strong>
          <div style={{marginTop:6,display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
            {CREDENTIALS.map(c=><div key={c.id}><span style={{color:C.black}}>{c.username}:</span> {c.password}</div>)}
          </div>
        </div>
      </div>
    </div>
  );

  const currentTabs = TABS[user.role]||[];

  const NavBar = () => (
    <div style={{background:C.black,padding:"0 1rem",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:16,fontWeight:700,color:C.white,letterSpacing:1,flexShrink:0}}>VEO<span style={{color:C.red}}>CASAS</span></span>
        {/* Desktop tabs */}
        <div style={{display:"flex",gap:2,flexWrap:"wrap"}} className="desktop-tabs">
          {currentTabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:tab===t.id?C.red:"transparent",color:tab===t.id?C.white:C.grayText,fontSize:12,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"}}>{t.label}</button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {saving&&<span style={{fontSize:10,color:C.grayText}}>Guardando...</span>}
        {alertas.length>0&&<div style={{width:8,height:8,borderRadius:"50%",background:C.red}} title={`${alertas.length} contratos por vencer`}/>}
        <div style={{width:28,height:28,borderRadius:"50%",background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:10,fontWeight:600,flexShrink:0}}>{user.avatar}</div>
        <span style={{color:C.white,fontSize:12,display:"none"}} className="desktop-name">{user.name}</span>
        <button onClick={logout} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.grayDark}`,background:"transparent",color:C.grayText,fontSize:11,cursor:"pointer"}}>Salir</button>
        {/* Mobile menu button */}
        <button onClick={()=>setMenuOpen(m=>!m)} style={{display:"none",padding:"4px 8px",borderRadius:6,border:`1px solid ${C.grayDark}`,background:"transparent",color:C.white,fontSize:18,cursor:"pointer",lineHeight:1}} className="mobile-menu-btn">☰</button>
      </div>
      <style>{`
        @media(max-width:700px){
          .desktop-tabs{display:none!important;}
          .mobile-menu-btn{display:flex!important;}
        }
      `}</style>
    </div>
  );

  const MobileMenu = () => menuOpen ? (
    <div style={{background:C.black,borderBottom:`1px solid #222`,padding:"8px 1rem",display:"flex",flexDirection:"column",gap:4}}>
      {currentTabs.map(t=>(
        <button key={t.id} onClick={()=>{setTab(t.id);setMenuOpen(false);}} style={{padding:"10px 14px",borderRadius:8,border:"none",background:tab===t.id?C.red:"transparent",color:tab===t.id?C.white:C.grayText,fontSize:14,fontWeight:500,cursor:"pointer",textAlign:"left"}}>{t.label}</button>
      ))}
    </div>
  ) : null;

  const SaleCard = ({sale,onClick,showActions}) => {
    const pending=sale.solicitud_modificacion&&!sale.modificacion_aprobada;
    const canEdit=sale.modificacion_aprobada;
    const dias=daysUntil(sale.fecha_fin);
    const venciendo=dias!==null&&dias>=0&&dias<=30;
    const vencido=dias!==null&&dias<0;
    return (
      <div style={{background:C.white,border:`1.5px solid ${vencido?"#999":venciendo?C.red:pending?"#E67E22":canEdit?"#27AE60":C.grayMid}`,borderRadius:10,padding:"12px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",cursor:"pointer"}} onClick={()=>onClick&&onClick(sale)}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:500,fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sale.inmobiliaria}</div>
            <div style={{color:C.grayText,fontSize:11,marginTop:2}}>{SELLERS.find(s=>s.id===sale.ejecutivo)?.name} · {sale.crm}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
            <div style={{fontWeight:600,color:C.red,fontSize:13}}>{fmt(sale.total)}</div>
            {venciendo&&<div style={{fontSize:10,background:"#fff0f0",color:C.red,padding:"1px 6px",borderRadius:6,marginTop:2}}>Vence en {dias}d</div>}
            {vencido&&<div style={{fontSize:10,background:C.grayMid,color:C.grayDark,padding:"1px 6px",borderRadius:6,marginTop:2}}>Vencido</div>}
          </div>
        </div>
        {showActions&&(
          <div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap"}}>
            {pending&&<span style={{fontSize:10,background:"#fff5e0",color:"#E67E22",padding:"2px 8px",borderRadius:8}}>Modificación pendiente</span>}
            {canEdit&&<span style={{fontSize:10,background:"#e8f8f0",color:"#27AE60",padding:"2px 8px",borderRadius:8}}>Aprobada — podés editar</span>}
            {!sale.solicitud_modificacion&&!canEdit&&(
              <button onClick={()=>updateSale(sale.id,{solicitud_modificacion:true})} style={{fontSize:10,padding:"3px 8px",borderRadius:7,border:`1px solid ${C.grayMid}`,background:"none",cursor:"pointer"}}>Solicitar modificación</button>
            )}
          </div>
        )}
      </div>
    );
  };

  const SaleModal = ({sale,onClose}) => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"0"}} onClick={onClose}>
      <div style={{background:C.white,borderRadius:"14px 14px 0 0",width:"100%",maxWidth:640,maxHeight:"90vh",overflowY:"auto",padding:"1.5rem"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div><div style={{fontSize:16,fontWeight:600}}>{sale.inmobiliaria}</div><div style={{color:C.grayText,fontSize:12}}>{sale.razon_social} · {sale.rut}</div></div>
          <button onClick={onClose} style={{border:"none",background:"none",fontSize:22,cursor:"pointer",color:C.grayText}}>×</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 12px",fontSize:12}}>
          {[["Mail",sale.mail],["Teléfono",sale.telefono],["Dirección",sale.direccion],["CRM",sale.crm],["Ejecutivo",SELLERS.find(s=>s.id===sale.ejecutivo)?.name],["Pago",sale.metodo_pago],["Val. mensual",fmt(sale.valor_mensual)],["Subtotal",fmt(sale.subtotal)],["Total c/IVA",fmt(sale.total)],["Inicio",sale.fecha_inicio],["Fin",sale.fecha_fin]].map(([k,v])=>(
            <div key={k}><span style={{color:C.grayText}}>{k}: </span><span style={{fontWeight:500}}>{v}</span></div>
          ))}
        </div>
        <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.grayMid}`}}>
          <div style={{fontWeight:500,marginBottom:6,fontSize:12}}>Productos</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {(sale.productos_seleccionados||[]).map(p=><span key={p} style={{background:C.gray,padding:"2px 8px",borderRadius:10,fontSize:11}}>{p}</span>)}
            {sale.destacadas_q>0&&<span style={{background:"#fff0f0",color:C.red,padding:"2px 8px",borderRadius:10,fontSize:11}}>Dest. ×{sale.destacadas_q}</span>}
            {sale.superdestacadas_q>0&&<span style={{background:"#fff0f0",color:C.red,padding:"2px 8px",borderRadius:10,fontSize:11}}>Superdest. ×{sale.superdestacadas_q}</span>}
            {sale.produccion_q>0&&<span style={{background:"#fff0f0",color:C.red,padding:"2px 8px",borderRadius:10,fontSize:11}}>Prod. ×{sale.produccion_q}</span>}
          </div>
        </div>
        {sale.detalle&&<div style={{marginTop:10,padding:10,background:C.gray,borderRadius:8,fontSize:12}}>{sale.detalle}</div>}
      </div>
    </div>
  );

  const SaleFormModal = ({onClose,initialData=null}) => {
    const [form,setForm]=useState(initialData||saleForm);
    const set=(k,v)=>setForm(f=>({...f,[k]:v}));
    const toggle=p=>setForm(f=>({...f,productos_seleccionados:(f.productos_seleccionados||[]).includes(p)?(f.productos_seleccionados||[]).filter(x=>x!==p):[...(f.productos_seleccionados||[]),p]}));
    const total=Math.round((parseFloat(form.subtotal)||0)*1.19);
    const isEdit=!!initialData;
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
        <div style={{background:C.white,borderRadius:"14px 14px 0 0",width:"100%",maxWidth:700,maxHeight:"92vh",overflowY:"auto",padding:"1.5rem"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
            <div style={{fontSize:16,fontWeight:600}}>{isEdit?"Editar Venta":"Nueva Venta"}</div>
            <button onClick={onClose} style={{border:"none",background:"none",fontSize:22,cursor:"pointer",color:C.grayText}}>×</button>
          </div>
          <Sec title="Inmobiliaria">
            <Grid2>
              <Field label="Nombre"><input value={form.inmobiliaria} onChange={e=>set("inmobiliaria",e.target.value)} style={inp}/></Field>
              <Field label="Razón Social"><input value={form.razon_social} onChange={e=>set("razon_social",e.target.value)} style={inp}/></Field>
              <Field label="RUT"><input value={form.rut} onChange={e=>set("rut",e.target.value)} style={inp}/></Field>
              <Field label="Mail"><input value={form.mail} onChange={e=>set("mail",e.target.value)} style={inp}/></Field>
              <Field label="Teléfono"><input value={form.telefono} onChange={e=>set("telefono",e.target.value)} style={inp}/></Field>
              <Field label="Dirección"><input value={form.direccion} onChange={e=>set("direccion",e.target.value)} style={inp}/></Field>
              <Field label="CRM"><select value={form.crm} onChange={e=>set("crm",e.target.value)} style={inp}>{CRMS.map(c=><option key={c}>{c}</option>)}</select></Field>
            </Grid2>
          </Sec>
          <Sec title="Compra">
            <Grid2>
              <Field label="Ejecutivo"><select value={form.ejecutivo} onChange={e=>set("ejecutivo",e.target.value)} style={inp}>{SELLERS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Propiedades"><input type="number" value={form.propiedades} onChange={e=>set("propiedades",e.target.value)} style={inp}/></Field>
            </Grid2>
            <div style={{marginTop:10}}><Field label="Detalle"><textarea value={form.detalle} onChange={e=>set("detalle",e.target.value)} style={{...inp,height:50,resize:"none"}}/></Field></div>
          </Sec>
          <Sec title="Productos">
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
              {PRODUCTS.map(p=>(
                <label key={p} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12}}>
                  <input type="checkbox" checked={(form.productos_seleccionados||[]).includes(p)} onChange={()=>toggle(p)}/>
                  <span>{p}</span>
                  {(form.productos_seleccionados||[]).includes(p)&&["Destacadas","Superdestacadas","Producción"].includes(p)&&(
                    <input type="number" min="0" placeholder="Cant." style={{...inp,width:50,padding:"3px 5px",fontSize:11}}
                      value={p==="Destacadas"?form.destacadas_q:p==="Superdestacadas"?form.superdestacadas_q:form.produccion_q}
                      onChange={e=>set(p==="Destacadas"?"destacadas_q":p==="Superdestacadas"?"superdestacadas_q":"produccion_q",e.target.value)}/>
                  )}
                </label>
              ))}
            </div>
          </Sec>
          <Sec title="Período y Valores">
            <Grid2>
              <Field label="Fecha inicio"><input type="date" value={form.fecha_inicio} onChange={e=>set("fecha_inicio",e.target.value)} style={inp}/></Field>
              <Field label="Fecha fin"><input type="date" value={form.fecha_fin} onChange={e=>set("fecha_fin",e.target.value)} style={inp}/></Field>
              <Field label="Valor mensual"><input type="number" value={form.valor_mensual} onChange={e=>set("valor_mensual",e.target.value)} style={inp}/></Field>
              <Field label="Subtotal sin IVA"><input type="number" value={form.subtotal} onChange={e=>set("subtotal",e.target.value)} style={inp}/></Field>
              <Field label="Total con IVA"><input readOnly value={total} style={{...inp,background:C.gray}}/></Field>
              <Field label="Método de pago"><select value={form.metodo_pago} onChange={e=>set("metodo_pago",e.target.value)} style={inp}>{PAYMENT_METHODS.map(m=><option key={m}>{m}</option>)}</select></Field>
            </Grid2>
          </Sec>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12,paddingBottom:8}}>
            <button onClick={onClose} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${C.grayMid}`,background:"none",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={async()=>{ if(isEdit){await updateSale(form.id,{...form,total,modificacion_aprobada:false,solicitud_modificacion:false});onClose();}else{setSaleForm(form);await saveSale(form);}}} style={{padding:"8px 16px",borderRadius:8,border:"none",background:C.red,color:C.white,fontWeight:500,cursor:"pointer",fontSize:13}}>{isEdit?"Guardar cambios":"Guardar Venta"}</button>
          </div>
        </div>
      </div>
    );
  };

  // ── ALERTAS ─────────────────────────────────────────────
  const AlertasScreen = () => (
    <div style={{padding:"1.5rem",maxWidth:800}}>
      <div style={{fontSize:18,fontWeight:600,marginBottom:20}}>Alertas de Contratos</div>
      {alertasVencidas.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{fontWeight:500,fontSize:14,color:C.grayDark,marginBottom:10}}>Vencidos ({alertasVencidas.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {alertasVencidas.map(s=>(
              <div key={s.id} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div><div style={{fontWeight:500,fontSize:13}}>{s.inmobiliaria}</div><div style={{fontSize:11,color:C.grayText}}>{SELLERS.find(x=>x.id===s.ejecutivo)?.name} · Venció: {s.fecha_fin}</div></div>
                <span style={{fontSize:11,background:C.grayMid,color:C.grayDark,padding:"3px 10px",borderRadius:10}}>Vencido</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{fontWeight:500,fontSize:14,color:C.red,marginBottom:10}}>Por vencer en 30 días ({alertas.length})</div>
      {!alertas.length&&<div style={{color:C.grayText,fontSize:13}}>No hay contratos próximos a vencer</div>}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {alertas.sort((a,b)=>daysUntil(a.fecha_fin)-daysUntil(b.fecha_fin)).map(s=>{
          const dias=daysUntil(s.fecha_fin);
          return (
            <div key={s.id} style={{background:C.white,border:`1.5px solid ${dias<=7?C.red:"#E67E22"}`,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontWeight:500,fontSize:13}}>{s.inmobiliaria}</div>
                <div style={{fontSize:11,color:C.grayText}}>{SELLERS.find(x=>x.id===s.ejecutivo)?.name} · {fmt(s.total)} · Vence: {s.fecha_fin}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:12,background:dias<=7?"#fff0f0":"#fff5e0",color:dias<=7?C.red:"#E67E22",padding:"3px 10px",borderRadius:10,fontWeight:500}}>{dias}d restantes</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── DASHBOARD VENDEDOR ──────────────────────────────────
  const DashboardVendedor = () => {
    const [editSale,setEditSale]=useState(null);
    const lastKpi=myKpi(user.id,0);
    const totalVentas=mySales.reduce((a,s)=>a+(s.total||0),0);
    const objetivo=myObjetivo(user.id);
    const weeklyData=[-3,-2,-1,0].map(w=>{const wd=getWeekDates(w);return{label:wd.label,value:mySales.filter(s=>s.created_at>=wd.inicio).reduce((a,s)=>a+(s.total||0),0),highlight:w===0};});
    const kpiHistory=[-3,-2,-1,0].map(w=>{const wd=getWeekDates(w);const k=kpis.find(k=>k.ejecutivo===user.id&&k.fecha_inicio===wd.inicio)||{};return{label:wd.label,contactados:k.contactados||0,efectivos:k.contactados_efectivos||0};});
    return (
      <div style={{padding:"1rem",maxWidth:960}}>
        {editSale&&<SaleFormModal initialData={editSale} onClose={()=>setEditSale(null)}/>}
        <div style={{marginBottom:16}}><div style={{fontSize:18,fontWeight:600}}>Hola, {user.name} 👋</div><div style={{color:C.grayText,fontSize:12}}>Semana: {getWeekDates(0).label}</div></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
          <Stat label="Ventas totales" value={mySales.length} color={C.red}/>
          <Stat label="Facturación" value={fmt(totalVentas)}/>
          <Stat label="Ticket promedio" value={mySales.length?fmt(Math.round(totalVentas/mySales.length)):"-"}/>
          <Stat label="Concreción" value={`${lastKpi.concrecion||0}%`} sub="Esta semana"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,padding:16}}>
            <div style={{fontWeight:500,marginBottom:12,fontSize:13}}>Objetivo mensual</div>
            <div style={{display:"flex",justifyContent:"center"}}><PieChart value={totalVentas} max={objetivo} label={user.name}/></div>
            {objetivo===0&&<div style={{textAlign:"center",fontSize:11,color:C.grayText,marginTop:6}}>Sin objetivo asignado</div>}
          </div>
          <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,padding:16}}>
            <div style={{fontWeight:500,marginBottom:12,fontSize:13}}>Ventas últimas 4 semanas</div>
            <BarChart data={weeklyData} height={90}/>
          </div>
        </div>
        <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontWeight:500,marginBottom:10,fontSize:13}}>Tendencia de contactos</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:8}}>
            {kpiHistory.map((k,i)=>(
              <div key={i} style={{textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:600,color:i===3?C.red:C.black}}>{k.contactados}</div>
                <div style={{fontSize:9,color:C.grayText}}>{k.label}</div>
              </div>
            ))}
          </div>
          <LineSparkline data={kpiHistory.map(k=>k.contactados)} color={C.red} height={40}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <div style={{fontWeight:500,marginBottom:8,fontSize:13}}>Últimas ventas</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {mySales.slice(0,3).map(s=>(
                <div key={s.id}>
                  <SaleCard sale={s} onClick={setModalSale} showActions/>
                  {s.modificacion_aprobada&&<button onClick={()=>setEditSale(s)} style={{marginTop:3,fontSize:10,padding:"3px 8px",borderRadius:6,border:"none",background:C.red,color:C.white,cursor:"pointer"}}>Editar</button>}
                </div>
              ))}
              {!mySales.length&&<div style={{color:C.grayText,fontSize:12}}>Sin ventas aún</div>}
            </div>
          </div>
          <div>
            <div style={{fontWeight:500,marginBottom:8,fontSize:13}}>KPIs esta semana</div>
            <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:12}}>
              {[["Contactados",lastKpi.contactados||0],["C. efectivos",lastKpi.contactados_efectivos||0],["R. agendadas",lastKpi.reuniones_agendadas||0],["Concreción",`${lastKpi.concrecion||0}%`],["Ticket",fmt(lastKpi.ticket_promedio||0)],["Pos. concreción",fmt(lastKpi.posible_concrecion||0)]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.gray}`,fontSize:12}}>
                  <span style={{color:C.grayText}}>{k}</span><span style={{fontWeight:500}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── DASHBOARD GERENTE ───────────────────────────────────
  const DashboardGerente = () => {
    const now=new Date();const mes=now.getMonth()+1;const anio=now.getFullYear();
    const total=sales.reduce((a,s)=>a+(s.total||0),0);
    const vxv=SELLERS.map(s=>({...s,total:sales.filter(v=>v.ejecutivo===s.id).reduce((a,v)=>a+(v.total||0),0),cantidad:sales.filter(v=>v.ejecutivo===s.id).length,objetivo:objetivos.find(o=>o.ejecutivo===s.id&&o.mes===mes&&o.anio===anio)?.objetivo||0}));
    const weeklyTeam=[-4,-3,-2,-1,0].map(w=>{const wd=getWeekDates(w);return{label:wd.label,value:sales.filter(s=>s.created_at>=wd.inicio).reduce((a,s)=>a+(s.total||0),0),highlight:w===0};});
    const totalObjetivo=vxv.reduce((a,v)=>a+v.objetivo,0);
    return (
      <div style={{padding:"1rem",maxWidth:1000}}>
        {showObjetivoForm&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
            <div style={{background:C.white,borderRadius:14,padding:"1.5rem",width:"100%",maxWidth:380}}>
              <div style={{fontSize:15,fontWeight:600,marginBottom:14}}>Asignar objetivo</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Field label="Vendedor"><select value={objetivoForm.ejecutivo} onChange={e=>setObjetivoForm(f=>({...f,ejecutivo:e.target.value}))} style={inp}>{SELLERS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
                <Field label="Objetivo ($)"><input type="number" value={objetivoForm.objetivo} onChange={e=>setObjetivoForm(f=>({...f,objetivo:parseFloat(e.target.value)||0}))} style={inp}/></Field>
                <Grid2>
                  <Field label="Mes"><select value={objetivoForm.mes} onChange={e=>setObjetivoForm(f=>({...f,mes:parseInt(e.target.value)}))} style={inp}>{[1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m}>{m}</option>)}</select></Field>
                  <Field label="Año"><input type="number" value={objetivoForm.anio} onChange={e=>setObjetivoForm(f=>({...f,anio:parseInt(e.target.value)}))} style={inp}/></Field>
                </Grid2>
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
                <button onClick={()=>setShowObjetivoForm(false)} style={{padding:"7px 14px",border:`1px solid ${C.grayMid}`,borderRadius:7,background:"none",cursor:"pointer",fontSize:13}}>Cancelar</button>
                <button onClick={saveObjetivo} style={{padding:"7px 14px",background:C.red,color:C.white,border:"none",borderRadius:7,cursor:"pointer",fontWeight:500,fontSize:13}}>Guardar</button>
              </div>
            </div>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <div><div style={{fontSize:18,fontWeight:600}}>Dashboard Equipo</div><div style={{color:C.grayText,fontSize:12}}>Semana: {getWeekDates(0).label}</div></div>
          <button onClick={()=>setShowObjetivoForm(true)} style={{padding:"7px 14px",background:C.red,color:C.white,border:"none",borderRadius:8,cursor:"pointer",fontWeight:500,fontSize:13}}>+ Asignar objetivo</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
          <Stat label="Ventas totales" value={sales.length} color={C.red}/>
          <Stat label="Facturación" value={fmt(total)}/>
          <Stat label="Ticket promedio" value={sales.length?fmt(Math.round(total/sales.length)):"-"}/>
          <Stat label="Alertas vencimiento" value={alertas.length} color={alertas.length>0?C.red:C.black} alert={alertas.length>0}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,padding:16}}>
            <div style={{fontWeight:500,marginBottom:12,fontSize:13}}>Facturación — últimas semanas</div>
            <BarChart data={weeklyTeam} height={100}/>
          </div>
          <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,padding:16}}>
            <div style={{fontWeight:500,marginBottom:10,fontSize:13}}>Objetivo equipo {mes}/{anio}</div>
            <div style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                <span style={{color:C.grayText}}>Alcanzado</span>
                <span style={{fontWeight:500}}>{pct(total,totalObjetivo)}%</span>
              </div>
              <div style={{height:10,background:C.grayMid,borderRadius:5,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${Math.min(pct(total,totalObjetivo),100)}%`,background:C.red,borderRadius:5}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.grayText,marginTop:4}}>
                <span>{fmt(total)}</span><span>{fmt(totalObjetivo)}</span>
              </div>
            </div>
            {vxv.map(v=>(
              <div key={v.id} style={{marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}>
                  <span style={{fontWeight:500}}>{v.name}</span>
                  <span style={{color:C.grayText}}>{v.objetivo>0?`${pct(v.total,v.objetivo)}%`:"Sin obj."}</span>
                </div>
                <div style={{height:5,background:C.grayMid,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${v.objetivo>0?Math.min(pct(v.total,v.objetivo),100):0}%`,background:C.red,borderRadius:3}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontWeight:500,marginBottom:10,fontSize:14}}>Objetivos individuales</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
          {vxv.map(v=>(
            <div key={v.id} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,padding:14,display:"flex",gap:12,alignItems:"center"}}>
              <PieChart value={v.total} max={v.objetivo} label={v.name}/>
              <div>
                <div style={{fontWeight:500,fontSize:13}}>{v.name}</div>
                <div style={{fontSize:12,color:C.grayText,marginTop:2}}>{v.cantidad} ventas</div>
                <div style={{fontSize:11,color:C.grayText,marginTop:1}}>Facturado: {fmt(v.total)}</div>
                {v.objetivo>0&&<div style={{fontSize:11,color:C.grayText}}>Objetivo: {fmt(v.objetivo)}</div>}
              </div>
            </div>
          ))}
        </div>
        <div style={{fontWeight:500,marginBottom:10,fontSize:14}}>KPIs detallados — esta semana</div>
        <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:600}}>
            <thead><tr style={{background:C.black,color:C.white}}>{["Vendedor","Contactados","C. efect.","%","R. agend.","R. efect.","Concreción","Ticket","Pos. concreción"].map(h=><th key={h} style={{padding:"9px 10px",textAlign:"left",fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>
              {SELLERS.map(s=>{const k=myKpi(s.id,0);return(
                <tr key={s.id} style={{borderBottom:`1px solid ${C.gray}`}}>
                  <td style={{padding:"9px 10px",fontWeight:500}}>{s.name}</td>
                  <td style={{padding:"9px 10px"}}>{k.contactados||0}</td>
                  <td style={{padding:"9px 10px"}}>{k.contactados_efectivos||0}</td>
                  <td style={{padding:"9px 10px",color:C.red,fontWeight:500}}>{pct(k.contactados_efectivos||0,k.contactados||0)}%</td>
                  <td style={{padding:"9px 10px"}}>{k.reuniones_agendadas||0}</td>
                  <td style={{padding:"9px 10px"}}>{k.reuniones_efectivas||0}</td>
                  <td style={{padding:"9px 10px"}}>{k.concrecion||0}%</td>
                  <td style={{padding:"9px 10px"}}>{fmt(k.ticket_promedio||0)}</td>
                  <td style={{padding:"9px 10px",color:"#27AE60",fontWeight:500}}>{fmt(k.posible_concrecion||0)}</td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── VENTAS ──────────────────────────────────────────────
  const Ventas = () => {
    const list=(user.role==="gerente"?sales:mySales).filter(s=>(filterVendedor==="todos"||s.ejecutivo===filterVendedor)&&(filterMes==="todos"||s.created_at?.slice(5,7)===filterMes));
    const total=list.reduce((a,s)=>a+(s.total||0),0);
    const exportData=list.map(s=>({Inmobiliaria:s.inmobiliaria,RUT:s.rut,Ejecutivo:SELLERS.find(x=>x.id===s.ejecutivo)?.name,CRM:s.crm,"Fecha inicio":s.fecha_inicio,"Fecha fin":s.fecha_fin,"Valor mensual":s.valor_mensual,Subtotal:s.subtotal,Total:s.total,"Método pago":s.metodo_pago}));
    return (
      <div style={{padding:"1rem",maxWidth:900}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:18,fontWeight:600}}>Ventas {user.role==="gerente"?"· Equipo":"· Mis Ventas"}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {user.role==="gerente"&&(
              <>
                <select value={filterVendedor} onChange={e=>setFilterVendedor(e.target.value)} style={{...inp,width:"auto",padding:"6px 10px",fontSize:12}}>
                  <option value="todos">Todos los vendedores</option>
                  {SELLERS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={filterMes} onChange={e=>setFilterMes(e.target.value)} style={{...inp,width:"auto",padding:"6px 10px",fontSize:12}}>
                  <option value="todos">Todos los meses</option>
                  {["01","02","03","04","05","06","07","08","09","10","11","12"].map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </>
            )}
            <button onClick={()=>exportExcel(exportData,"ventas-veocasas.xlsx")} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${C.grayMid}`,background:"none",cursor:"pointer",fontSize:12,fontWeight:500}}>📊 Excel</button>
            <button onClick={()=>exportPDF(["Inmobiliaria","Ejecutivo","Total","Fecha fin"],list.map(s=>[s.inmobiliaria,SELLERS.find(x=>x.id===s.ejecutivo)?.name||"",fmt(s.total),s.fecha_fin||""]),"Reporte de Ventas — Veocasas","ventas-veocasas.pdf")} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${C.grayMid}`,background:"none",cursor:"pointer",fontSize:12,fontWeight:500}}>📄 PDF</button>
            {user.role==="vendedor"&&<button onClick={()=>{initSaleForm();setShowSaleForm(true);}} style={{padding:"7px 14px",background:C.red,color:C.white,border:"none",borderRadius:8,cursor:"pointer",fontWeight:500,fontSize:13}}>+ Nueva</button>}
          </div>
        </div>
        {user.role==="gerente"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
            <Stat label="Total ventas" value={list.length} color={C.red}/>
            <Stat label="Facturación" value={fmt(total)}/>
            <Stat label="Ticket promedio" value={list.length?fmt(Math.round(total/list.length)):"-"}/>
            <Stat label="Vendedores" value={[...new Set(list.map(s=>s.ejecutivo))].length}/>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {list.map(s=><SaleCard key={s.id} sale={s} onClick={setModalSale} showActions={user.role==="vendedor"}/>)}
          {!list.length&&<div style={{color:C.grayText,padding:"2rem",textAlign:"center",fontSize:13}}>Sin ventas registradas</div>}
        </div>
      </div>
    );
  };

  // ── MODIFICACIONES ──────────────────────────────────────
  const Modificaciones = () => {
    const pending=sales.filter(s=>s.solicitud_modificacion&&!s.modificacion_aprobada);
    const approved=sales.filter(s=>s.modificacion_aprobada);
    return (
      <div style={{padding:"1rem",maxWidth:800}}>
        <div style={{fontSize:18,fontWeight:600,marginBottom:16}}>Solicitudes de modificación</div>
        <div style={{marginBottom:16}}>
          <div style={{fontWeight:500,fontSize:13,color:C.red,marginBottom:8}}>Pendientes ({pending.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {pending.map(s=>(
              <div key={s.id} style={{background:C.white,border:`1px solid #E67E22`,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div><div style={{fontWeight:500,fontSize:13}}>{s.inmobiliaria}</div><div style={{fontSize:11,color:C.grayText}}>{SELLERS.find(x=>x.id===s.ejecutivo)?.name} · {fmt(s.total)}</div></div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>updateSale(s.id,{modificacion_aprobada:true})} style={{padding:"5px 12px",background:C.red,color:C.white,border:"none",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:500}}>Aprobar</button>
                  <button onClick={()=>updateSale(s.id,{solicitud_modificacion:false})} style={{padding:"5px 12px",background:"none",border:`1px solid ${C.grayMid}`,borderRadius:7,cursor:"pointer",fontSize:12}}>Rechazar</button>
                </div>
              </div>
            ))}
            {!pending.length&&<div style={{color:C.grayText,fontSize:12}}>No hay solicitudes pendientes</div>}
          </div>
        </div>
        <div style={{fontWeight:500,fontSize:13,color:"#27AE60",marginBottom:8}}>Aprobadas ({approved.length})</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {approved.map(s=>(
            <div key={s.id} style={{background:C.white,border:`1px solid #27AE60`,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:500,fontSize:13}}>{s.inmobiliaria}</div><div style={{fontSize:11,color:C.grayText}}>{SELLERS.find(x=>x.id===s.ejecutivo)?.name} · {fmt(s.total)}</div></div>
              <span style={{fontSize:11,background:"#e8f8f0",color:"#27AE60",padding:"2px 8px",borderRadius:10}}>Editando</span>
            </div>
          ))}
          {!approved.length&&<div style={{color:C.grayText,fontSize:12}}>No hay modificaciones aprobadas</div>}
        </div>
      </div>
    );
  };

  // ── KPIs ────────────────────────────────────────────────
  const KPIs = () => {
    const week=getWeekDates(kpiWeekOffset);
    const Nav=()=>(
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <button onClick={()=>setKpiWeekOffset(w=>w-1)} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${C.grayMid}`,background:"none",cursor:"pointer"}}>←</button>
        <span style={{fontSize:12,color:C.grayText,minWidth:120,textAlign:"center"}}>{week.label}</span>
        <button onClick={()=>setKpiWeekOffset(w=>Math.min(w+1,0))} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${C.grayMid}`,background:"none",cursor:"pointer"}}>→</button>
      </div>
    );
    if(user.role==="gerente") return (
      <div style={{padding:"1rem",maxWidth:960}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:18,fontWeight:600}}>KPIs del Equipo</div><Nav/>
        </div>
        {SELLERS.map(s=>{const k=myKpi(s.id,kpiWeekOffset);return(
          <div key={s.id} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,padding:"12px 16px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:10,fontWeight:600,flexShrink:0}}>{s.avatar}</div>
              <div style={{fontWeight:500,fontSize:13}}>{s.name}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
              {[["Contactados",k.contactados||0],["C. efect.",k.contactados_efectivos||0],["R. agend.",k.reuniones_agendadas||0],["R. efect.",k.reuniones_efectivas||0],["Concreción",`${k.concrecion||0}%`],["Ticket",fmt(k.ticket_promedio||0)],["Pos. concreción",fmt(k.posible_concrecion||0)],["Control",k.control_calidad||"-"]].map(([lbl,v])=>(
                <div key={lbl} style={{background:C.gray,borderRadius:7,padding:"8px 10px"}}>
                  <div style={{fontSize:9,color:C.grayText,marginBottom:2}}>{lbl}</div>
                  <div style={{fontWeight:500,fontSize:12}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        );})}
      </div>
    );
    const cur=myKpi(user.id,kpiWeekOffset);
    const fields=[["contactados","Contactados"],["contactados_efectivos","Contactados efectivos"],["reuniones_agendadas","Reuniones agendadas"],["reuniones_efectivas","Reuniones efectivas"],["concrecion","Concreción (%)"],["ticket_promedio","Ticket promedio"],["posible_concrecion","Posible concreción"],["control_calidad","Control calidad"]];
    return (
      <div style={{padding:"1rem",maxWidth:700}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:18,fontWeight:600}}>Mis KPIs</div><Nav/>
        </div>
        <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,padding:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px",marginBottom:12}}>
            {fields.map(([f,lbl])=>(
              <Field key={f} label={lbl}>
                <input type={f==="control_calidad"?"text":"number"} value={kpiForm[f]!==undefined?kpiForm[f]:cur[f]||""} onChange={e=>setKpiForm(p=>({...p,[f]:e.target.value}))} style={inp} placeholder="0"/>
              </Field>
            ))}
          </div>
          <div style={{padding:"8px 12px",background:C.gray,borderRadius:8,fontSize:12,marginBottom:12}}>
            <span style={{color:C.grayText}}>% Contactos efectivos: </span>
            <strong>{pct(parseInt(kpiForm.contactados_efectivos||cur.contactados_efectivos)||0,parseInt(kpiForm.contactados||cur.contactados)||0)}%</strong>
          </div>
          <button onClick={saveKPI} style={{padding:"9px 18px",background:C.red,color:C.white,border:"none",borderRadius:8,cursor:"pointer",fontWeight:500,fontSize:13,width:"100%"}}>Guardar KPIs — {week.label}</button>
        </div>
      </div>
    );
  };

  // ── DISPONIBILIDAD ───────────────────────────────────────
  const Disponibilidad = () => (
    <div style={{padding:"1rem",maxWidth:800}}>
      <div style={{fontSize:18,fontWeight:600,marginBottom:16}}>Disponibilidad de Productos</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {availability.map(a=>{
          const p=Math.round((a.used/a.total)*100);
          const color=p>=90?C.red:p>=60?"#E67E22":"#27AE60";
          return (
            <div key={a.producto} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontWeight:500,fontSize:12}}>{a.producto}</span>
                <span style={{fontSize:11,color:C.grayText}}>{a.used}/{a.total}</span>
              </div>
              <div style={{height:6,background:C.grayMid,borderRadius:3,overflow:"hidden",marginBottom:4}}>
                <div style={{height:"100%",width:`${p}%`,background:color,borderRadius:3}}/>
              </div>
              <div style={{fontSize:10,color,fontWeight:500}}>{p}% ocupado</div>
              {user.role==="gerente"&&editAvail===a.id?(
                <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                  <input type="number" defaultValue={a.total} id={`t-${a.id}`} style={{...inp,width:55,padding:"3px 6px",fontSize:12}}/>
                  <input type="number" defaultValue={a.used} id={`u-${a.id}`} style={{...inp,width:55,padding:"3px 6px",fontSize:12}}/>
                  <button onClick={async()=>{const t=parseInt(document.getElementById(`t-${a.id}`).value)||a.total;const u=parseInt(document.getElementById(`u-${a.id}`).value)||a.used;await upsertItem("disponibilidad",a.id,{...a,total:t,used:u});setAvailability(prev=>prev.map(x=>x.id===a.id?{...x,total:t,used:u}:x));setEditAvail(null);}} style={{padding:"3px 8px",background:C.red,color:C.white,border:"none",borderRadius:5,cursor:"pointer",fontSize:11}}>OK</button>
                  <button onClick={()=>setEditAvail(null)} style={{padding:"3px 6px",border:`1px solid ${C.grayMid}`,background:"none",borderRadius:5,cursor:"pointer",fontSize:11}}>×</button>
                </div>
              ):user.role==="gerente"&&<button onClick={()=>setEditAvail(a.id)} style={{marginTop:4,fontSize:10,color:C.red,background:"none",border:"none",cursor:"pointer",padding:0}}>Editar</button>}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── PRODUCCIONES ─────────────────────────────────────────
  const Producciones = () => {
    const list=user.role==="vendedor"?productions.filter(p=>p.ejecutivo===user.id):productions;
    return (
      <div style={{padding:"1rem",maxWidth:800}}>
        <div style={{fontSize:18,fontWeight:600,marginBottom:16}}>{user.role==="marketing"?"Producciones a confirmar":user.role==="gerente"?"Producciones":"Mis Producciones"}</div>
        {!list.length&&<div style={{color:C.grayText,fontSize:12}}>No hay producciones pendientes</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {list.map(p=>{const s=SELLERS.find(x=>x.id===p.ejecutivo);return(
            <div key={p.id} style={{background:C.white,border:`1px solid ${p.confirmado?"#27AE60":C.grayMid}`,borderRadius:10,padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div><div style={{fontWeight:500,fontSize:13}}>{p.cliente}</div><div style={{fontSize:11,color:C.grayText}}>{s?.name} · ×{p.produccion_q}</div></div>
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  {p.confirmado?<span style={{background:"#e8f8f0",color:"#27AE60",padding:"3px 8px",borderRadius:10,fontSize:11,fontWeight:500}}>Confirmado</span>:<span style={{background:"#fff5e0",color:"#E67E22",padding:"3px 8px",borderRadius:10,fontSize:11,fontWeight:500}}>Pendiente</span>}
                  {(user.role==="marketing"||user.role==="vendedor")&&<input type="date" value={p.fecha||""} onChange={async e=>{await updateItem("producciones",p.id,{fecha:e.target.value});setProductions(prev=>prev.map(x=>x.id===p.id?{...x,fecha:e.target.value}:x));}} style={{...inp,width:135,fontSize:12,padding:"5px 8px"}}/>}
                  {user.role==="marketing"&&!p.confirmado&&<button onClick={async()=>{await updateItem("producciones",p.id,{confirmado:true});setProductions(prev=>prev.map(x=>x.id===p.id?{...x,confirmado:true}:x));}} style={{padding:"5px 10px",background:C.red,color:C.white,border:"none",borderRadius:7,cursor:"pointer",fontSize:12}}>Confirmar</button>}
                </div>
              </div>
            </div>
          );})}
        </div>
        {user.role==="marketing"&&(
          <div style={{marginTop:20}}>
            <div style={{fontWeight:500,marginBottom:10,fontSize:14}}>Calendario</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
              {["L","M","M","J","V","S","D"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,color:C.grayText,padding:"3px 0"}}>{d}</div>)}
              {Array.from({length:30},(_,i)=>{const day=i+1;const has=productions.some(p=>p.confirmado&&p.fecha&&new Date(p.fecha).getDate()===day);return<div key={i} style={{textAlign:"center",padding:"7px 2px",borderRadius:5,background:has?C.red:C.gray,color:has?C.white:C.black,fontSize:11}}>{day}</div>;})}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── SOCIAL ───────────────────────────────────────────────
  const Social = () => (
    <div style={{padding:"1rem",maxWidth:900}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:18,fontWeight:600}}>Redes Sociales</div>
        <button onClick={()=>setShowPostForm(true)} style={{padding:"7px 14px",background:C.red,color:C.white,border:"none",borderRadius:8,cursor:"pointer",fontWeight:500,fontSize:13}}>+ Post</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {posts.map(p=>(
          <div key={p.id} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{padding:"5px 8px",background:C.gray,borderRadius:7,fontSize:11,fontWeight:500,minWidth:70,textAlign:"center",flexShrink:0}}>{p.fecha}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                <span style={{background:C.red,color:C.white,padding:"1px 7px",borderRadius:9,fontSize:10}}>{p.platform}</span>
                <span style={{background:p.status==="programado"?"#e8f8f0":C.gray,color:p.status==="programado"?"#27AE60":C.grayText,padding:"1px 7px",borderRadius:9,fontSize:10}}>{p.status}</span>
              </div>
              <div style={{fontSize:12}}>{p.content}</div>
            </div>
            <button onClick={async()=>{await deleteItem("posts_social",p.id);setPosts(prev=>prev.filter(x=>x.id!==p.id));}} style={{border:"none",background:"none",color:C.grayText,cursor:"pointer",fontSize:18,flexShrink:0}}>×</button>
          </div>
        ))}
        {!posts.length&&<div style={{color:C.grayText,fontSize:12,textAlign:"center",padding:"2rem"}}>Sin posts programados</div>}
      </div>
      {showPostForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowPostForm(false)}>
          <div style={{background:C.white,borderRadius:"14px 14px 0 0",padding:"1.5rem",width:"100%",maxWidth:460}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:600,marginBottom:14}}>Nuevo Post</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <Field label="Fecha"><input type="date" value={postForm.fecha} onChange={e=>setPostForm(f=>({...f,fecha:e.target.value}))} style={inp}/></Field>
              <Field label="Plataforma"><select value={postForm.platform} onChange={e=>setPostForm(f=>({...f,platform:e.target.value}))} style={inp}>{PLATFORMS.map(p=><option key={p}>{p}</option>)}</select></Field>
              <Field label="Contenido"><textarea value={postForm.content} onChange={e=>setPostForm(f=>({...f,content:e.target.value}))} style={{...inp,height:70,resize:"none"}}/></Field>
              <Field label="Estado"><select value={postForm.status} onChange={e=>setPostForm(f=>({...f,status:e.target.value}))} style={inp}><option value="borrador">Borrador</option><option value="programado">Programado</option><option value="publicado">Publicado</option></select></Field>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
              <button onClick={()=>setShowPostForm(false)} style={{padding:"7px 14px",border:`1px solid ${C.grayMid}`,borderRadius:7,background:"none",cursor:"pointer",fontSize:13}}>Cancelar</button>
              <button onClick={async()=>{const d=await addItem("posts_social",postForm);if(d)setPosts(prev=>[...prev,d]);setShowPostForm(false);setPostForm({fecha:"",platform:"Instagram",content:"",status:"borrador"});}} style={{padding:"7px 14px",background:C.red,color:C.white,border:"none",borderRadius:7,cursor:"pointer",fontWeight:500,fontSize:13}}>Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── FACTURACIÓN ADMIN ────────────────────────────────────
  const Facturacion = () => (
    <div style={{padding:"1rem",maxWidth:900}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:18,fontWeight:600}}>Facturación</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>exportExcel(invoices.map(i=>({Folio:i.folio,Cliente:i.client,Monto:i.amount,Fecha:i.date,Estado:i.status,Vencimiento:i.vencimiento||""})),"facturas-veocasas.xlsx")} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${C.grayMid}`,background:"none",cursor:"pointer",fontSize:12}}>📊 Excel</button>
          <button onClick={()=>exportPDF(["Folio","Cliente","Monto","Fecha","Vencimiento","Estado"],invoices.map(i=>[i.folio,i.client,fmt(i.amount),i.date,i.vencimiento||"-",i.status]),"Facturación — Veocasas","facturas-veocasas.pdf")} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${C.grayMid}`,background:"none",cursor:"pointer",fontSize:12}}>📄 PDF</button>
          <button onClick={()=>setShowInvoiceForm(true)} style={{padding:"7px 14px",background:C.red,color:C.white,border:"none",borderRadius:8,cursor:"pointer",fontWeight:500,fontSize:13}}>+ Factura</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
        <Stat label="Facturado total" value={fmt(invoices.reduce((a,i)=>a+(i.amount||0),0))} color={C.red}/>
        <Stat label="Pendiente cobro" value={fmt(invoices.filter(i=>i.status==="pendiente").reduce((a,i)=>a+(i.amount||0),0))} color="#E67E22"/>
        <Stat label="Facturas emitidas" value={invoices.length}/>
        <Stat label="Cobradas" value={invoices.filter(i=>i.status==="pagada").length}/>
      </div>
      <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:560}}>
          <thead><tr style={{background:C.black,color:C.white}}>{["Folio","Cliente","Monto","Fecha","Vencimiento","Estado","Acción"].map(h=><th key={h} style={{padding:"9px 12px",textAlign:"left",fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>
            {invoices.map(inv=>(
              <tr key={inv.id} style={{borderBottom:`1px solid ${C.gray}`}}>
                <td style={{padding:"9px 12px",fontWeight:500,color:C.red}}>{inv.folio}</td>
                <td style={{padding:"9px 12px"}}>{inv.client}</td>
                <td style={{padding:"9px 12px",fontWeight:500}}>{fmt(inv.amount)}</td>
                <td style={{padding:"9px 12px",color:C.grayText,whiteSpace:"nowrap"}}>{inv.date}</td>
                <td style={{padding:"9px 12px",whiteSpace:"nowrap"}}>
                  {inv.vencimiento?(
                    <span style={{color:daysUntil(inv.vencimiento)<=7?C.red:daysUntil(inv.vencimiento)<=30?"#E67E22":C.grayText}}>{inv.vencimiento}{daysUntil(inv.vencimiento)<=30&&` (${daysUntil(inv.vencimiento)}d)`}</span>
                  ):"-"}
                </td>
                <td style={{padding:"9px 12px"}}>
                  <span style={{background:inv.status==="pagada"?"#e8f8f0":inv.status==="vencida"?"#fff0f0":"#fff5e0",color:inv.status==="pagada"?"#27AE60":inv.status==="vencida"?C.red:"#E67E22",padding:"2px 8px",borderRadius:8,fontSize:11,fontWeight:500}}>{inv.status}</span>
                </td>
                <td style={{padding:"9px 12px"}}>
                  <select value={inv.status} onChange={async e=>{await updateItem("facturas",inv.id,{status:e.target.value});setInvoices(prev=>prev.map(x=>x.id===inv.id?{...x,status:e.target.value}:x));}} style={{...inp,width:"auto",padding:"3px 6px",fontSize:11}}>
                    <option value="pendiente">Pendiente</option>
                    <option value="pagada">Pagada</option>
                    <option value="vencida">Vencida</option>
                  </select>
                </td>
              </tr>
            ))}
            {!invoices.length&&<tr><td colSpan={7} style={{padding:"2rem",textAlign:"center",color:C.grayText}}>Sin facturas</td></tr>}
          </tbody>
        </table>
      </div>
      {showInvoiceForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowInvoiceForm(false)}>
          <div style={{background:C.white,borderRadius:"14px 14px 0 0",padding:"1.5rem",width:"100%",maxWidth:480}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:600,marginBottom:14}}>Nueva Factura</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <Grid2>
                <Field label="Folio"><input value={invoiceForm.folio} onChange={e=>setInvoiceForm(f=>({...f,folio:e.target.value}))} style={inp} placeholder="F-003"/></Field>
                <Field label="Cliente"><input value={invoiceForm.client} onChange={e=>setInvoiceForm(f=>({...f,client:e.target.value}))} style={inp}/></Field>
                <Field label="Monto"><input type="number" value={invoiceForm.amount} onChange={e=>setInvoiceForm(f=>({...f,amount:parseFloat(e.target.value)||0}))} style={inp}/></Field>
                <Field label="Estado"><select value={invoiceForm.status} onChange={e=>setInvoiceForm(f=>({...f,status:e.target.value}))} style={inp}><option value="pendiente">Pendiente</option><option value="pagada">Pagada</option><option value="vencida">Vencida</option></select></Field>
                <Field label="Fecha emisión"><input type="date" value={invoiceForm.date} onChange={e=>setInvoiceForm(f=>({...f,date:e.target.value}))} style={inp}/></Field>
                <Field label="Fecha vencimiento"><input type="date" value={invoiceForm.vencimiento} onChange={e=>setInvoiceForm(f=>({...f,vencimiento:e.target.value}))} style={inp}/></Field>
              </Grid2>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
              <button onClick={()=>setShowInvoiceForm(false)} style={{padding:"7px 14px",border:`1px solid ${C.grayMid}`,borderRadius:7,background:"none",cursor:"pointer",fontSize:13}}>Cancelar</button>
              <button onClick={saveInvoice} style={{padding:"7px 14px",background:C.red,color:C.white,border:"none",borderRadius:7,cursor:"pointer",fontWeight:500,fontSize:13}}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── CONTRATOS (Admin) ────────────────────────────────────
  const Contratos = () => {
    const exportData=sales.map(s=>({Inmobiliaria:s.inmobiliaria,RUT:s.rut,Ejecutivo:SELLERS.find(x=>x.id===s.ejecutivo)?.name,"Fecha inicio":s.fecha_inicio,"Fecha fin":s.fecha_fin,Total:s.total,"Método pago":s.metodo_pago,Estado:daysUntil(s.fecha_fin)<0?"Vencido":daysUntil(s.fecha_fin)<=30?"Por vencer":"Vigente"}));
    return (
      <div style={{padding:"1rem",maxWidth:900}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:18,fontWeight:600}}>Contratos</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>exportExcel(exportData,"contratos-veocasas.xlsx")} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${C.grayMid}`,background:"none",cursor:"pointer",fontSize:12}}>📊 Excel</button>
            <button onClick={()=>exportPDF(["Inmobiliaria","Ejecutivo","Inicio","Fin","Total","Estado"],sales.map(s=>[s.inmobiliaria,SELLERS.find(x=>x.id===s.ejecutivo)?.name||"",s.fecha_inicio||"",s.fecha_fin||"",fmt(s.total),daysUntil(s.fecha_fin)<0?"Vencido":daysUntil(s.fecha_fin)<=30?"Por vencer":"Vigente"]),"Contratos — Veocasas","contratos-veocasas.pdf")} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${C.grayMid}`,background:"none",cursor:"pointer",fontSize:12}}>📄 PDF</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
          <Stat label="Contratos activos" value={sales.filter(s=>daysUntil(s.fecha_fin)>=0).length} color={C.red}/>
          <Stat label="Vencen en 30 días" value={alertas.length} color={alertas.length>0?C.red:C.black} alert={alertas.length>0}/>
          <Stat label="Vencidos" value={alertasVencidas.length} color={alertasVencidas.length>0?C.grayDark:C.black}/>
          <Stat label="Valor total contratos" value={fmt(sales.reduce((a,s)=>a+(s.total||0),0))}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {sales.map(s=>{
            const dias=daysUntil(s.fecha_fin);
            const estado=dias===null?"":dias<0?"Vencido":dias<=30?"Por vencer":"Vigente";
            const color=dias<0?C.grayMid:dias<=30?C.red:C.grayMid;
            return (
              <div key={s.id} style={{background:C.white,border:`1.5px solid ${color}`,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontWeight:500,fontSize:13}}>{s.inmobiliaria}</div>
                  <div style={{fontSize:11,color:C.grayText}}>{SELLERS.find(x=>x.id===s.ejecutivo)?.name} · {s.fecha_inicio} → {s.fecha_fin}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:600,color:C.red,fontSize:13}}>{fmt(s.total)}</div>
                    <div style={{fontSize:11,color:dias<0?C.grayDark:dias<=30?C.red:"#27AE60",fontWeight:500}}>{estado}{dias>=0&&dias<=30?` (${dias}d)`:""}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const Clientes = () => (
    <div style={{padding:"1rem",maxWidth:900}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:18,fontWeight:600}}>Clientes</div>
        <button onClick={()=>exportExcel([...new Map(sales.map(s=>[s.inmobiliaria,s])).values()].map(s=>({Inmobiliaria:s.inmobiliaria,"Razón Social":s.razon_social,RUT:s.rut,Mail:s.mail,Teléfono:s.telefono,Dirección:s.direccion,CRM:s.crm})),"clientes-veocasas.xlsx")} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${C.grayMid}`,background:"none",cursor:"pointer",fontSize:12}}>📊 Excel</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[...new Map(sales.map(s=>[s.inmobiliaria,s])).values()].map(s=>(
          <div key={s.id} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontWeight:500,fontSize:13}}>{s.inmobiliaria}</div>
              <div style={{fontSize:11,color:C.grayText,marginTop:2}}>{s.razon_social} · {s.rut}</div>
              <div style={{fontSize:11,color:C.grayText}}>{s.mail} · {s.telefono}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:500,color:C.red,fontSize:13}}>{fmt(s.total)}</div>
              <div style={{fontSize:10,color:C.grayText}}>{s.metodo_pago}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const Reportes = () => (
    <div style={{padding:"1rem",maxWidth:900}}>
      <div style={{fontSize:18,fontWeight:600,marginBottom:16}}>Reportes</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[
          {label:"Ventas por vendedor",onClick:()=>exportExcel(SELLERS.map(s=>({Vendedor:s.name,Ventas:sales.filter(v=>v.ejecutivo===s.id).length,Total:sales.filter(v=>v.ejecutivo===s.id).reduce((a,v)=>a+(v.total||0),0)})),"ventas-por-vendedor.xlsx")},
          {label:"Contratos por vencer",onClick:()=>exportExcel(alertas.map(s=>({Inmobiliaria:s.inmobiliaria,Vence:s.fecha_fin,DíasRestantes:daysUntil(s.fecha_fin),Total:s.total})),"contratos-por-vencer.xlsx")},
          {label:"Facturación total",onClick:()=>exportPDF(["Folio","Cliente","Monto","Estado"],invoices.map(i=>[i.folio,i.client,fmt(i.amount),i.status]),"Facturación Total","facturacion-total.pdf")},
          {label:"KPIs del equipo",onClick:()=>exportExcel(SELLERS.flatMap(s=>[0,-1,-2,-3].map(w=>{const k=myKpi(s.id,w);const wd=getWeekDates(w);return{Vendedor:s.name,Semana:wd.label,Contactados:k.contactados||0,"C.Efectivos":k.contactados_efectivos||0,Concreción:`${k.concrecion||0}%`};})),"kpis-equipo.xlsx")},
          {label:"Resumen mensual",onClick:()=>exportExcel([1,2,3,4,5,6,7,8,9,10,11,12].map(m=>({Mes:m,Ventas:sales.filter(s=>new Date(s.created_at).getMonth()+1===m).length,Total:sales.filter(s=>new Date(s.created_at).getMonth()+1===m).reduce((a,s)=>a+(s.total||0),0)})),"resumen-mensual.xlsx")},
          {label:"Clientes activos",onClick:()=>exportExcel([...new Map(sales.map(s=>[s.inmobiliaria,s])).values()].map(s=>({Inmobiliaria:s.inmobiliaria,RUT:s.rut,Mail:s.mail,CRM:s.crm})),"clientes-activos.xlsx")},
        ].map(r=>(
          <button key={r.label} onClick={r.onClick} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:"14px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.red}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.grayMid}>
            <span style={{fontSize:13,fontWeight:500}}>{r.label}</span>
            <span style={{fontSize:12,color:C.red}}>📊 Exportar</span>
          </button>
        ))}
      </div>
    </div>
  );

  const screens = {
    dashboard:<DashboardVendedor/>, dashboard_gerente:<DashboardGerente/>,
    ventas:<Ventas/>, kpis:<KPIs/>, disponibilidad:<Disponibilidad/>,
    producciones:<Producciones/>, social:<Social/>, modificaciones:<Modificaciones/>,
    alertas:<AlertasScreen/>, alertas_admin:<AlertasScreen/>,
    assets:<div style={{padding:"1rem"}}><div style={{fontSize:18,fontWeight:600,marginBottom:12}}>Assets</div><div style={{color:C.grayText,fontSize:13}}>En desarrollo</div></div>,
    metricas:<div style={{padding:"1rem"}}><div style={{fontSize:18,fontWeight:600,marginBottom:12}}>Métricas</div><div style={{color:C.grayText,fontSize:13}}>En desarrollo</div></div>,
    facturacion:<Facturacion/>, contratos:<Contratos/>, clientes:<Clientes/>, reportes:<Reportes/>,
  };

  return (
    <div style={{minHeight:"100vh",background:C.gray,fontFamily:"system-ui,sans-serif"}}>
      <NavBar/>
      <MobileMenu/>
      <div style={{minHeight:"calc(100vh - 52px)"}}>
        {loading?<div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"4rem",color:C.grayText,fontSize:14}}>Cargando datos...</div>:screens[tab]||null}
      </div>
      {modalSale&&<SaleModal sale={modalSale} onClose={()=>setModalSale(null)}/>}
      {showSaleForm&&<SaleFormModal onClose={()=>setShowSaleForm(false)}/>}
    </div>
  );
}
