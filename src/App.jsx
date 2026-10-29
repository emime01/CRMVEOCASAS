import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getAll, addItem, updateItem, deleteItem, upsertItem, auth, emailDeUsuario, getPerfil } from "./firebase";
import { C, fmt, USERS, TABS, daysUntil, getWeekDates } from "./constants";
import CambiarClave from "./components/CambiarClave";
import { cuotasDelMes, mesActual } from "./cuotas";
import Clientes from "./screens/Clientes";
import { asegurarCliente } from "./clientes";
import { Stat, Card, Btn, Badge, Field, Grid2, Modal, ModalHeader, ModalBody, ModalFooter, PieChart, BarChart, ProgressBar, Table, Spinner, EmptyState, inp } from "./components/UI";
import { SaleCard, SaleDetailModal } from "./components/SaleCard";
import SaleForm from "./components/SaleForm";
import Facturacion from "./screens/Facturacion";
import Comisiones from "./screens/Comisiones";
import Tickets from "./screens/Tickets";
import Tareas from "./screens/Tareas";
import Documentos from "./screens/Documentos";
import Presentaciones from "./screens/Presentaciones";
import DashboardGeneral from "./screens/DashboardGeneral";
import VentasGeneral from "./screens/VentasGeneral";
import Reportes from "./screens/Reportes";
import Competencias from "./screens/Competencias";
import Metricas from "./screens/Metricas";
import Cobros from "./screens/Cobros";
import KPIs from "./screens/KPIs";
import Producciones from "./screens/Producciones";
import CorreccionFechas from "./screens/CorreccionFechas";
import Prospectos from "./screens/Prospectos";
import MisProspectos from "./screens/MisProspectos";
import { COL_PROSPECTOS, marcarCliente } from "./prospectos";

const SELLERS_OBJ = USERS.filter(u => ["vendedor","inactivo"].includes(u.role));
const getUser = id => USERS.find(u => u.id === id);
const PLATFORMS = ["Instagram","Facebook","LinkedIn","TikTok","Twitter/X"];

const fmtDate = iso => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const siNo = v => v ? "Sí" : "No";
const hasProduct = (sale, name) => (sale.productos_seleccionados || []).includes(name);

const exportVentasExcel = async (sales) => {
  const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");
  const rows = sales.filter(s => s.estado !== "cancelada").map(s => ({
    "Inmobiliaria": s.inmobiliaria || "",
    "CRM": s.crm || "",
    "Fecha venta": fmtDate(s.created_at?.slice(0, 10)),
    "Inicio": fmtDate(s.fecha_inicio),
    "Fin": fmtDate(s.fecha_fin),
    "Plan": s.plan || "",
    "Prop.": s.propiedades || 0,
    "Destacadas": s.destacadas_q || 0,
    "Superdestacadas": s.superdestacadas_q || 0,
    "Producción": s.produccion_q || 0,
    "Índice": siNo(s.indice || hasProduct(s, "Índice")),
    "Dest. Home Venta": siNo(s.destacadas_home || hasProduct(s, "Destacada Home Venta")),
    "SD Home Venta": siNo(hasProduct(s, "Super destacada Home Venta")),
    "Dest. Home Alquiler": siNo(hasProduct(s, "Destacada Home Alquiler")),
    "SD Home Alquiler": siNo(hasProduct(s, "Super destacada Home Alquiler")),
    "Banner": siNo(hasProduct(s, "Banner")),
    "Desarrollos": siNo(hasProduct(s, "Desarrollos")),
    "Subtotal": s.subtotal || 0,
    "Total (IVA inc.)": s.total || 0,
    "Método de pago": s.metodo_pago || s.subtipo_contado || "",
    "N° Cuotas": s.num_cuotas || 1,
    "Ejecutivo": getUser(s.ejecutivo)?.name || s.ejecutivo || "",
    "Facturado": siNo(s.facturado),
    "N° Factura": s.nro_factura || "",
    "Estado": s.estado || "activa",
    "Razón Social": s.razon_social || "",
    "RUT": s.rut || "",
    "Mail": s.mail || "",
    "Teléfono": s.telefono || "",
    "Detalle": s.detalle || "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    {wch:22},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:6},{wch:11},{wch:14},{wch:11},
    {wch:7},{wch:14},{wch:14},{wch:16},{wch:16},{wch:7},{wch:11},{wch:11},{wch:14},{wch:18},
    {wch:8},{wch:14},{wch:10},{wch:10},{wch:10},{wch:18},{wch:14},{wch:22},{wch:13},{wch:22},
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ventas");
  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `ventas-veocasas-${fecha}.xlsx`);
};

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
  // ── STATE ─────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  // sesión de Firebase Auth: mientras se revisa si hay una abierta no se muestra el login
  const [authListo, setAuthListo] = useState(false);
  const [loginForm, setLoginForm] = useState({usuario:"",clave:""});
  const [loginError, setLoginError] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [tab, setTab] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sales, setSales] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [productions, setProductions] = useState([]);
  const [posts, setPosts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [objetivos, setObjetivos] = useState([]);
  const [runs, setRuns] = useState([]);
  const [comisiones, setComisiones] = useState({vendedores:{},gerente:0,crm:0});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailSale, setDetailSale] = useState(null);
  const [editSale, setEditSale] = useState(null);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [showObjetivoForm, setShowObjetivoForm] = useState(false);
  const [showRunForm, setShowRunForm] = useState(false);
  const [editRun, setEditRun] = useState(null);
  const [kpiWeekOffset, setKpiWeekOffset] = useState(0);
  const [editAvail, setEditAvail] = useState(null);
  const [kpiForm, setKpiForm] = useState({});
  const [postForm, setPostForm] = useState({fecha:"",platform:"Instagram",content:"",status:"borrador"});
  const [objetivoForm, setObjetivoForm] = useState({ejecutivo:"sebastian",objetivo:0,q:Math.ceil((new Date().getMonth()+1)/3),anio:new Date().getFullYear()});
  const [filterVendedor, setFilterVendedor] = useState("todos");
  const [tickets, setTickets] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [presentaciones, setPresentaciones] = useState([]);
  const [competencias, setCompetencias] = useState([]);
  const [metricas, setMetricas] = useState([]);
  const [dispModal, setDispModal] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [editingProd, setEditingProd] = useState(new Set());
  // prospectos del agente: se cargan al abrir Prospectos / Mis prospectos (son miles; no frenan el login)
  const [prospectos, setProspectos] = useState(null);
  const [cargandoProspectos, setCargandoProspectos] = useState(false);
  const [saleDraft, setSaleDraft] = useState(null); // venta nueva precargada desde un prospecto
  const cargarProspectos = async () => {
    setCargandoProspectos(true);
    const p = await getAll(COL_PROSPECTOS);
    setProspectos(p.filter(l=>!["descartado","duplicado"].includes(l.estado)));
    setCargandoProspectos(false);
  };
  const crearVentaDesde = l => setSaleDraft({
    inmobiliaria:l.nombre||"", mail:l.email||"", telefono:l.telefono||(l.whatsapp?`+${l.whatsapp}`:""),
    ejecutivo:user.id, lead_id:l.id,
  });

  // ── CONSTANTS ─────────────────────────────────────────────
  const currentQ = Math.ceil((new Date().getMonth()+1)/3);
  const currentAnio = new Date().getFullYear();
  const defaultTab = r => ({gerente:"dashboard_gerente",vendedor:"dashboard",marketing:"producciones",admin:"facturacion",gerente_general:"dashboard_ggeneral"}[r]||"dashboard");

  // ── LOGIN / LOGOUT ────────────────────────────────────────
  const login = async (u) => {
    setUser(u); setTab(defaultTab(u.role)); setLoading(true);
    const [s,av,k,pr,po,inv,obj,com,rn,tk,tar,doc,pres,comp,met,cli] = await Promise.all([
      getAll("ventas","created_at"), getAll("disponibilidad"), getAll("kpis"),
      getAll("producciones","created_at"), getAll("posts_social","fecha"),
      getAll("facturas","created_at"), getAll("objetivos"), getAll("comisiones"), getAll("runs"),
      getAll("tickets","created_at"), getAll("tareas","created_at"), getAll("documentos","created_at"),
      getAll("presentaciones","created_at"), getAll("competencias","fecha"), getAll("metricas_ads","created_at"),
      getAll("clientes"),
    ]);
    setClientes(cli||[]);
    setSales(s); setKpis(k); setProductions(pr); setPosts(po); setInvoices(inv);
    setObjetivos(obj); setRuns(rn||[]); setTickets(tk||[]); setTareas(tar||[]);
    setDocumentos(doc||[]); setPresentaciones(pres||[]); setCompetencias(comp||[]); setMetricas(met||[]);
    if(com.length>0){const c=com[0];setComisiones({vendedores:c.vendedores||{},gerente:c.gerente||0,crm:c.crm||0});}
    if(av.length===0){for(const d of INIT_DISP) await upsertItem("disponibilidad",d.id,d);setAvailability(INIT_DISP);}
    else setAvailability(av);
    setLoading(false);
  };

  // El perfil (id y rol) sale de usuarios/{uid}, el mismo documento que usan las reglas de Firestore
  useEffect(()=>onAuthStateChanged(auth, async fb=>{
    if(!fb){ setUser(null); setAuthListo(true); return; }
    const perfil = await getPerfil(fb.uid).catch(()=>null);
    const u = USERS.find(x=>x.id===perfil?.id);
    if(!u||u.role==="inactivo"){
      setLoginError("Tu usuario no tiene acceso al CRM. Pedíselo a la gerencia.");
      await signOut(auth); setAuthListo(true); return;
    }
    setAuthListo(true);
    login(u);
  }),[]);

  const entrar = async e => {
    e.preventDefault();
    setLoginError("");
    const norm = s => String(s).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    const u = USERS.find(x=>norm(x.name)===norm(loginForm.usuario)||x.id===norm(loginForm.usuario));
    if(!u||u.role==="inactivo") return setLoginError("Usuario o contraseña incorrectos.");
    setEntrando(true);
    try { await signInWithEmailAndPassword(auth, emailDeUsuario(u.id), loginForm.clave); setLoginForm({usuario:"",clave:""}); }
    catch(err){
      setLoginError(err.code==="auth/too-many-requests" ? "Demasiados intentos. Esperá unos minutos."
        : err.code==="auth/network-request-failed" ? "Sin conexión. Revisá internet y probá de nuevo."
        : "Usuario o contraseña incorrectos.");
    }
    setEntrando(false);
  };

  const logout = () => {
    signOut(auth);
    setUser(null); setSales([]); setAvailability([]); setKpis([]);
    setProductions([]); setPosts([]); setInvoices([]); setObjetivos([]); setRuns([]);
    setTickets([]); setTareas([]); setDocumentos([]); setPresentaciones([]);
    setCompetencias([]); setMetricas([]); setProspectos(null); setSaleDraft(null); setClientes([]);
  };

  // ── HELPERS ───────────────────────────────────────────────
  const mySales = user ? sales.filter(s=>s.ejecutivo===user.id) : [];
  const activeSales = sales.filter(s=>s.estado!=="cancelada");
  const alertas = activeSales.filter(s=>{const d=daysUntil(s.fecha_fin);return d!==null&&d>=0&&d<=30;});
  const pct = (a,b) => b>0?Math.round((a/b)*100):0;

  // Q helpers
  const ventasDeQ = (uid, q, anio=currentAnio) => {
    const qStart=new Date(anio,(q-1)*3,1).toISOString().split("T")[0];
    const qEnd=new Date(anio,q*3,0).toISOString().split("T")[0];
    return sales.filter(s=>s.ejecutivo===uid&&s.estado!=="cancelada"&&s.fecha_inicio>=qStart&&s.fecha_inicio<=qEnd);
  };
  const totalDeQ = (uid,q,anio=currentAnio) => ventasDeQ(uid,q,anio).reduce((a,s)=>a+(s.total||0),0);
  const totalVentasQ = (uid) => totalDeQ(uid,currentQ);
  const getObjetivosVendedor = (uid) => objetivos.filter(o=>o.ejecutivo===uid&&o.anio===currentAnio).sort((a,b)=>a.q-b.q);
  const myObjetivo = (uid) => objetivos.find(o=>o.ejecutivo===uid&&o.q===currentQ&&o.anio===currentAnio)?.objetivo||0;
  const myKpi = (uid,week) => kpis.find(k=>k.ejecutivo===uid&&k.semana===week)||{};

  // Run helpers
  const ventasEnPeriodo = (uid,fi,ff) => sales.filter(s=>s.ejecutivo===uid&&s.estado!=="cancelada"&&s.fecha_inicio>=fi&&s.fecha_inicio<=ff);
  const totalEnPeriodo = (uid,fi,ff) => ventasEnPeriodo(uid,fi,ff).reduce((a,s)=>a+(s.total||0),0);
  const myRuns = (uid) => runs.filter(r=>r.activo&&r.participantes?.some(p=>p.ejecutivo===uid));
  const isRunActivo = (r) => { const h=new Date().toISOString().split("T")[0]; return r.activo&&r.fecha_inicio<=h&&r.fecha_fin>=h; };
  const isRunVencido = (r) => new Date().toISOString().split("T")[0] > r.fecha_fin;

  // ── CRUD VENTAS ───────────────────────────────────────────
  const vincularCliente = async (form) => {
    const r = await asegurarCliente(clientes, form).catch(()=>({id:null}));
    if(r.nueva) setClientes(prev=>[...prev, r.cliente]);
    else if(r.id) setClientes(prev=>prev.map(c=>c.id===r.id?{...c,...r.cliente}:c));
    return r.id ? {...form, cliente_id:r.id} : form;
  };
  const saveSale = async (form) => {
    setSaving(true);
    form = await vincularCliente(form);
    const data=await addItem("ventas",form);
    if(data){
      setSales(prev=>[data,...prev]);
      if(parseInt(form.produccion_q)>0){
        const pd=await addItem("producciones",{cliente:form.inmobiliaria,ejecutivo:form.ejecutivo,produccion_q:parseInt(form.produccion_q),fecha:"",confirmado:false,venta_id:data.id});
        if(pd) setProductions(prev=>[pd,...prev]);
      }
    }
    setSaving(false); setShowSaleForm(false);
  };
  const handleUpdateSale = async (id,changes) => { await updateItem("ventas",id,changes); setSales(prev=>prev.map(s=>s.id===id?{...s,...changes}:s)); };
  const handleCancelSale = async (sale) => {
    if(!window.confirm(`¿Cancelar la venta de ${sale.inmobiliaria}?`)) return;
    await handleUpdateSale(sale.id,{estado:"cancelada",modificacion_aprobada:false,solicitud_modificacion:false});
    setDetailSale(null);
  };
  const handleApproveMod = (id) => handleUpdateSale(id,{modificacion_aprobada:true});
  const handleRejectMod  = (id) => handleUpdateSale(id,{solicitud_modificacion:false,modificacion_aprobada:false});

  // ── CRUD KPIs ─────────────────────────────────────────────
  const saveKPI = async () => {
    setSaving(true);
    const week=getWeekDates(kpiWeekOffset);
    const kpiId=`${user.id}_${week.inicio}`;
    const payload={ejecutivo:user.id,semana:kpiWeekOffset,fecha_inicio:week.inicio,fecha_fin:week.fin,...kpiForm};
    await upsertItem("kpis",kpiId,payload);
    setKpis(prev=>[...prev.filter(k=>k.id!==kpiId),{...payload,id:kpiId}]);
    setKpiForm({}); setSaving(false);
  };

  // ── CRUD OBJETIVOS Q ──────────────────────────────────────
  const saveObjetivo = async () => {
    const objId=`${objetivoForm.ejecutivo}_Q${objetivoForm.q}_${objetivoForm.anio}`;
    await upsertItem("objetivos",objId,objetivoForm);
    setObjetivos(prev=>[...prev.filter(o=>o.id!==objId),{...objetivoForm,id:objId}]);
    setShowObjetivoForm(false);
  };

  const deleteObjetivoQ = async (uid,q) => {
    if(!window.confirm(`¿Eliminar el objetivo de Q${q} para ${getUser(uid)?.name}?`)) return;
    const obj=objetivos.find(o=>o.ejecutivo===uid&&o.q===q&&o.anio===currentAnio);
    if(obj?.id) await deleteItem("objetivos",obj.id);
    setObjetivos(prev=>prev.filter(o=>!(o.ejecutivo===uid&&o.q===q&&o.anio===currentAnio)));
  };

  const deleteObjetivoQTodos = async (q) => {
    if(!window.confirm(`¿Eliminar los objetivos de Q${q} para TODOS los vendedores?`)) return;
    const toDelete=objetivos.filter(o=>o.q===q&&o.anio===currentAnio);
    for(const o of toDelete) if(o.id) await deleteItem("objetivos",o.id);
    setObjetivos(prev=>prev.filter(o=>!(o.q===q&&o.anio===currentAnio)));
  };

  // ── CRUD RUNS ─────────────────────────────────────────────
  const saveRun = async (form) => {
    if(form.id){ await updateItem("runs",form.id,form); setRuns(prev=>prev.map(r=>r.id===form.id?{...r,...form}:r)); }
    else { const data=await addItem("runs",form); if(data) setRuns(prev=>[...prev,data]); }
    setEditRun(null); setShowRunForm(false);
  };
  const toggleRunActivo = async (id,activo) => { await updateItem("runs",id,{activo}); setRuns(prev=>prev.map(r=>r.id===id?{...r,activo}:r)); };
  const deleteRun = async (id) => {
    if(!window.confirm("¿Eliminar este run?")) return;
    await deleteItem("runs",id); setRuns(prev=>prev.filter(r=>r.id!==id));
  };

  // ── COMISIONES ────────────────────────────────────────────
  const updateComision = async (key,value) => {
    let newCom;
    if(key.startsWith("vendedor_")){const uid=key.replace("vendedor_","");newCom={...comisiones,vendedores:{...comisiones.vendedores,[uid]:value}};}
    else if(key.startsWith("crm_")){const crmName=key.slice(4);newCom={...comisiones,por_crm:{...(comisiones.por_crm||{}),[crmName]:value}};}
    else{newCom={...comisiones,[key]:value};}
    setComisiones(newCom); await upsertItem("comisiones","config",newCom);
  };

  // ── LOGIN SCREEN ──────────────────────────────────────────
  if(!authListo) return <Spinner/>;
  if(!user) return (
    <div style={{minHeight:"100vh",background:C.white,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{marginBottom:"2rem",textAlign:"center"}}>
        <div style={{fontSize:36,fontWeight:800,color:C.red,letterSpacing:"-0.5px",marginBottom:4}}>veocasas</div>
        <div style={{color:C.gray500,fontSize:14,fontWeight:400}}>CRM Comercial</div>
      </div>
      <form onSubmit={entrar} style={{background:C.white,borderRadius:16,padding:"2rem",width:"100%",maxWidth:380,border:`1px solid ${C.gray200}`,display:"flex",flexDirection:"column",gap:14}}>
        <div style={{fontSize:16,fontWeight:700,color:C.black}}>Ingresar</div>
        <Field label="Usuario"><input value={loginForm.usuario} onChange={e=>setLoginForm(f=>({...f,usuario:e.target.value}))} style={inp} autoComplete="username" autoCapitalize="none" placeholder="Ej: Mika" autoFocus/></Field>
        <Field label="Contraseña"><input type="password" value={loginForm.clave} onChange={e=>setLoginForm(f=>({...f,clave:e.target.value}))} style={inp} autoComplete="current-password"/></Field>
        {loginError&&<div style={{fontSize:12,color:C.red}}>{loginError}</div>}
        <Btn variant="primary" disabled={entrando||!loginForm.usuario||!loginForm.clave} style={{width:"100%",justifyContent:"center"}}>{entrando?"Ingresando…":"Ingresar"}</Btn>
        <div style={{fontSize:11,color:C.gray500}}>¿Olvidaste la contraseña? Avisale al administrador del CRM.</div>
      </form>
    </div>
  );

  const pendingTickets = tickets.filter(t=>t.para===user.id&&t.estado==="pendiente").length;
  const currentTabs = (TABS[user.role]||[]).map(t=>{
    if(t.id==="alertas"||t.id==="alertas_admin") return {...t,label:`Alertas${alertas.length>0?` (${alertas.length})`:""}`};
    if(t.id==="tickets"&&pendingTickets>0) return {...t,label:`Tickets (${pendingTickets})`};
    return t;
  });

  // ── NAVBAR ────────────────────────────────────────────────
  const NavBar = () => (
    <>
      <div style={{background:"#212121",padding:"0 1rem",display:"flex",alignItems:"center",justifyContent:"space-between",height:54,position:"sticky",top:0,zIndex:100,gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0,flex:1,overflow:"hidden"}}>
          <span style={{fontSize:15,fontWeight:800,color:C.red,letterSpacing:"-0.5px",flexShrink:0}}>veocasas</span>
          <div id="desktop-nav" style={{display:"flex",gap:1,overflowX:"auto",scrollbarWidth:"none",msOverflowStyle:"none",WebkitOverflowScrolling:"touch"}}>
            <style>{`#desktop-nav::-webkit-scrollbar{display:none}`}</style>
            {currentTabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{padding:"4px 10px",borderRadius:6,border:"none",background:tab===t.id?"rgba(242,0,0,0.18)":"transparent",color:tab===t.id?C.red:"rgba(255,255,255,0.65)",fontSize:13,fontWeight:500,cursor:"pointer",transition:"all 0.15s",whiteSpace:"nowrap",fontFamily:"'Montserrat', sans-serif",flexShrink:0}}
                onMouseEnter={e=>{if(tab!==t.id)e.currentTarget.style.color="rgba(255,255,255,0.9)";}}
                onMouseLeave={e=>{if(tab!==t.id)e.currentTarget.style.color="rgba(255,255,255,0.65)";}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          {saving&&<span style={{fontSize:11,color:"rgba(255,255,255,0.5)",display:"none"}} id="saving-txt">Guardando...</span>}
          {alertas.length>0&&<div style={{width:7,height:7,borderRadius:"50%",background:C.red,flexShrink:0}}/>}
          <div style={{width:30,height:30,borderRadius:8,background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:11,fontWeight:700,flexShrink:0}}>{user.avatar}</div>
          <span id="user-name" style={{color:"rgba(255,255,255,0.8)",fontSize:12,fontWeight:500,whiteSpace:"nowrap"}}>{user.name}</span>
          <button onClick={()=>setCambiandoClave(true)} title="Cambiar contraseña"
            style={{padding:"5px 8px",borderRadius:7,border:"1px solid rgba(255,255,255,0.2)",background:"transparent",color:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"'Montserrat', sans-serif",whiteSpace:"nowrap"}}>
            Contraseña
          </button>
          <button onClick={logout}
            style={{padding:"5px 8px",borderRadius:7,border:"1px solid rgba(255,255,255,0.2)",background:"transparent",color:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:500,cursor:"pointer",transition:"all 0.15s",fontFamily:"'Montserrat', sans-serif",whiteSpace:"nowrap"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,1)";e.currentTarget.style.color="rgba(255,255,255,1)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.2)";e.currentTarget.style.color="rgba(255,255,255,0.6)";}}>
            Salir
          </button>
        </div>
      </div>
      <style>{`@media(max-width:480px){#user-name{display:none!important;}}`}</style>
    </>
  );

  // ── MODALES ───────────────────────────────────────────────
  const ObjetivoModal = () => (
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
            <input type="text" inputMode="numeric" value={objetivoForm.objetivo===0?"":objetivoForm.objetivo}
              onChange={e=>{const v=e.target.value.replace(/\D/g,"");setObjetivoForm(f=>({...f,objetivo:v===""?0:parseInt(v)}));}}
              style={inp} placeholder="Ej: 500000"/>
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
              <input type="text" inputMode="numeric" value={objetivoForm.anio}
                onChange={e=>{const v=e.target.value.replace(/\D/g,"");setObjetivoForm(f=>({...f,anio:v===""?currentAnio:parseInt(v)}));}}
                style={inp}/>
            </Field>
          </Grid2>
          <div style={{padding:"10px 14px",background:C.gray50,borderRadius:8,fontSize:12,color:C.gray500,border:`1px solid ${C.gray200}`}}>
            <strong>{SELLERS_OBJ.find(s=>s.id===objetivoForm.ejecutivo)?.name}</strong> · Q{objetivoForm.q} {objetivoForm.anio}: <strong style={{color:C.red}}>{fmt(objetivoForm.objetivo)}</strong>
          </div>
        </div>
      </ModalBody>
      <ModalFooter><Btn onClick={()=>setShowObjetivoForm(false)}>Cancelar</Btn><Btn variant="primary" onClick={saveObjetivo}>Guardar</Btn></ModalFooter>
    </Modal>
  );

  const RunModal = ({onClose}) => {
    const blank = {nombre:"",fecha_inicio:"",fecha_fin:"",activo:true,participantes:[]};
    const [form,setForm] = useState(editRun||blank);
    const set = (k,v) => setForm(f=>({...f,[k]:v}));
    const togglePart = (uid) => {
      const ya=form.participantes.find(p=>p.ejecutivo===uid);
      if(ya) setForm(f=>({...f,participantes:f.participantes.filter(p=>p.ejecutivo!==uid)}));
      else setForm(f=>({...f,participantes:[...f.participantes,{ejecutivo:uid,objetivo:0}]}));
    };
    const setObj = (uid,val) => setForm(f=>({...f,participantes:f.participantes.map(p=>p.ejecutivo===uid?{...p,objetivo:val}:p)}));
    return (
      <Modal onClose={onClose} maxWidth={520}>
        <ModalHeader title={editRun?"Editar Run / Bono":"Nuevo Run / Bono"} subtitle="Meta especial con período específico" onClose={onClose}/>
        <ModalBody>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Field label="Nombre del run">
              <input value={form.nombre} onChange={e=>set("nombre",e.target.value)} style={inp} placeholder="Ej: Bono Mayo, Sprint Q2..."/>
            </Field>
            <Grid2>
              <Field label="Fecha inicio"><input type="date" value={form.fecha_inicio} onChange={e=>set("fecha_inicio",e.target.value)} style={inp}/></Field>
              <Field label="Fecha fin"><input type="date" value={form.fecha_fin} onChange={e=>set("fecha_fin",e.target.value)} style={inp}/></Field>
            </Grid2>
            <Field label="Vendedores participantes">
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
                {SELLERS_OBJ.map(s=>{
                  const part=form.participantes.find(p=>p.ejecutivo===s.id);
                  const sel=!!part;
                  return (
                    <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:`1px solid ${sel?C.red:C.gray200}`,background:sel?C.redLight:C.white,transition:"all 0.15s"}}>
                      <input type="checkbox" checked={sel} onChange={()=>togglePart(s.id)} style={{accentColor:C.red,width:15,height:15,cursor:"pointer"}}/>
                      <div style={{width:28,height:28,borderRadius:7,background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:10,fontWeight:700,flexShrink:0}}>{s.avatar}</div>
                      <span style={{fontWeight:500,fontSize:13,flex:1,color:C.gray900}}>{s.name}</span>
                      {sel&&(
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:11,color:C.gray500}}>Meta:</span>
                          <input type="text" inputMode="numeric" value={part.objetivo===0?"":part.objetivo}
                            onChange={e=>{const v=e.target.value.replace(/\D/g,"");setObj(s.id,v===""?0:parseInt(v));}}
                            style={{...inp,width:110,padding:"4px 8px",fontSize:12}} placeholder="0"/>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Field>
            {form.participantes.length>0&&form.fecha_inicio&&form.fecha_fin&&(
              <div style={{padding:"10px 14px",background:C.gray50,borderRadius:8,fontSize:12,color:C.gray500,border:`1px solid ${C.gray200}`}}>
                <strong>{form.participantes.length} vendedor{form.participantes.length!==1?"es":""}</strong> · {form.fecha_inicio} → {form.fecha_fin}
                {form.participantes.map(p=>(
                  <div key={p.ejecutivo} style={{marginTop:3}}>{getUser(p.ejecutivo)?.name}: <strong style={{color:C.red}}>{fmt(p.objetivo)}</strong></div>
                ))}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={()=>saveRun(form)} disabled={!form.nombre||!form.fecha_inicio||!form.fecha_fin||form.participantes.length===0}>
            {editRun?"Guardar cambios":"Crear Run"}
          </Btn>
        </ModalFooter>
      </Modal>
    );
  };

  // ── SCREENS ───────────────────────────────────────────────
  const DashboardVendedor = () => {
    const lastKpi=myKpi(user.id,0);
    const totalVentas=mySales.filter(s=>s.estado!=="cancelada").reduce((a,s)=>a+(s.total||0),0);
    const qAsignados=getObjetivosVendedor(user.id).filter(o=>o.q<=currentQ);
    const runsDelVendedor=myRuns(user.id);
    const weeklyData=[-3,-2,-1,0].map(w=>{const wd=getWeekDates(w);return{label:wd.label,value:mySales.filter(s=>s.estado!=="cancelada"&&s.created_at>=wd.inicio).reduce((a,s)=>a+(s.total||0),0),highlight:w===0};});
    return (
      <div style={{padding:"1.5rem",maxWidth:960}}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:28,fontWeight:800,color:C.black}}>Hola, {user.name} 👋</div>
          <div style={{fontSize:14,color:C.gray500,marginTop:4}}>Semana: {getWeekDates(0).label} · Q{currentQ} {currentAnio}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(160px,100%),1fr))",gap:12,marginBottom:20}}>
          <Stat label="Ventas activas" value={mySales.filter(s=>s.estado!=="cancelada").length} color={C.red}/>
          <Stat label="Facturación total" value={fmt(totalVentas)}/>
          <Stat label="Concreción" value={`${lastKpi.concrecion||0}%`} sub="Esta semana"/>
        </div>

        {/* Objetivos Q */}
        {qAsignados.length>0?(
          <div style={{marginBottom:20}}>
            <div style={{fontWeight:600,fontSize:14,color:C.gray700,marginBottom:12}}>Objetivos por trimestre</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(200px,100%),1fr))",gap:12}}>
              {qAsignados.map(obj=>{
                const tq=totalDeQ(user.id,obj.q);
                const isActual=obj.q===currentQ;
                const done=obj.objetivo>0&&tq>=obj.objetivo;
                return (
                  <Card key={obj.q} style={{border:`1px solid ${done?C.green:isActual?C.red:C.gray200}`,position:"relative",textAlign:"center"}}>
                    {isActual&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:done?C.green:C.red,borderRadius:"12px 12px 0 0"}}/>}
                    <div style={{fontSize:11,fontWeight:600,color:done?C.green:isActual?C.red:C.gray500,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Q{obj.q} {isActual?"· Actual":"· Cerrado"}</div>
                    <PieChart value={tq} max={obj.objetivo} label={`Q${obj.q}`} color={done?C.green:isActual?C.red:C.gray400} size={100}/>
                    <div style={{marginTop:8,fontSize:11,color:C.gray400}}>{ventasDeQ(user.id,obj.q).length} ventas</div>
                    <div style={{marginTop:4,fontSize:11}}><span style={{color:C.gray500}}>Obj: </span><span style={{fontWeight:600,color:C.gray800}}>{fmt(obj.objetivo)}</span></div>
                    {done&&<div style={{fontSize:12,color:C.green,fontWeight:700,marginTop:6}}>🎉 ¡Felicitaciones!</div>}
                  </Card>
                );
              })}
            </div>
          </div>
        ):(
          <Card style={{marginBottom:20,textAlign:"center",padding:"2rem"}}>
            <div style={{fontSize:13,color:C.gray400}}>No tenés objetivos asignados aún. Consultá con Mika.</div>
          </Card>
        )}

        {/* Runs / Bonos */}
        {runsDelVendedor.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontWeight:600,fontSize:14,color:C.gray700,marginBottom:12}}>🔥 Bonos activos</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(200px,100%),1fr))",gap:12}}>
              {runsDelVendedor.map(run=>{
                const part=run.participantes.find(p=>p.ejecutivo===user.id);
                const total=totalEnPeriodo(user.id,run.fecha_inicio,run.fecha_fin);
                const activo=isRunActivo(run);
                const vencido=isRunVencido(run);
                const done=(part?.objetivo||0)>0&&total>=(part?.objetivo||0);
                return (
                  <Card key={run.id} style={{border:`1px solid ${done?C.green:activo?C.red:C.gray200}`,position:"relative",textAlign:"center"}}>
                    {activo&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:done?C.green:C.red,borderRadius:"12px 12px 0 0"}}/>}
                    <div style={{fontSize:11,fontWeight:600,color:done?C.green:activo?C.red:C.gray400,marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>{done?"✅ Meta cumplida":activo?"🔥 Activo":vencido?"Finalizado":"Próximo"}</div>
                    <div style={{fontWeight:700,fontSize:13,color:C.gray900,marginBottom:2}}>{run.nombre}</div>
                    <div style={{fontSize:10,color:C.gray400,marginBottom:8}}>{run.fecha_inicio} → {run.fecha_fin}</div>
                    <PieChart value={total} max={part?.objetivo||0} label={run.nombre} color={done?C.green:activo?C.red:C.gray400} size={90}/>
                    <div style={{marginTop:6,fontSize:11,color:C.gray400}}>{ventasEnPeriodo(user.id,run.fecha_inicio,run.fecha_fin).length} ventas</div>
                    <div style={{marginTop:3,fontSize:11}}><span style={{color:C.gray500}}>Meta: </span><span style={{fontWeight:600,color:C.gray800}}>{fmt(part?.objetivo||0)}</span></div>
                    {done&&<div style={{fontSize:12,color:C.green,fontWeight:700,marginTop:6}}>🎉 ¡Felicitaciones!</div>}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {(()=>{
          const cobros=mySales.filter(s=>s.estado!=="cancelada")
            .flatMap(s=>cuotasDelMes(s,mesActual()).filter(c=>!c.pagada).map(c=>({s,c})));
          if(!cobros.length) return null;
          return (
            <div style={{marginBottom:20}}>
              <div style={{fontWeight:600,fontSize:14,color:C.amber,marginBottom:10}}>⚠️ Cobros pendientes este mes ({cobros.length})</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {cobros.map(({s,c})=>{
                  return (
                    <Card key={`${s.id}_${c.numero}`} style={{border:`1px solid ${C.amber}`,background:C.amberLight}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                        <div>
                          <div style={{fontWeight:600,fontSize:13,color:C.black}}>{s.inmobiliaria}</div>
                          <div style={{fontSize:11,color:C.gray500,marginTop:2}}>Cuota {c.numero}/{s.num_cuotas} · {c.fecha} · {fmt(c.monto)}</div>
                        </div>
                        <Badge color="amber">Cobrar</Badge>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(280px,100%),1fr))",gap:16,marginBottom:20}}>
          <Card><div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:14}}>Ventas — últimas 4 semanas</div><BarChart data={weeklyData} height={90}/></Card>
          <Card>
            <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:12}}>KPIs esta semana</div>
            {[["Contactados",lastKpi.contactados||0],["C. efectivos",lastKpi.contactados_efectivos||0],["R. agendadas",lastKpi.reuniones_agendadas||0],["R. efectivas",lastKpi.reuniones_efectivas||0],["Ticket promedio",fmt(lastKpi.ticket_promedio||0)],["Posible concreción",fmt(lastKpi.posible_concrecion||0)]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.gray100}`,fontSize:13}}>
                <span style={{color:C.gray400}}>{k}</span><span style={{fontWeight:600,color:C.gray900}}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
        <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:10}}>Últimas ventas</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {mySales.slice(0,3).map(s=>(
            <SaleCard key={s.id} sale={s} onClick={setDetailSale} showActions
              onRequestEdit={id=>handleUpdateSale(id,{solicitud_modificacion:true})}/>
          ))}
          {!mySales.length&&<EmptyState icon="📊" title="Sin ventas" desc="Registrá tu primera venta"/>}
        </div>
      </div>
    );
  };

  const DashboardGerente = () => {
    const total=activeSales.reduce((a,s)=>a+(s.total||0),0);
    const weeklyTeam=[-4,-3,-2,-1,0].map(w=>{const wd=getWeekDates(w);return{label:wd.label,value:activeSales.filter(s=>s.created_at>=wd.inicio).reduce((a,s)=>a+(s.total||0),0),highlight:w===0};});
    const pending=sales.filter(s=>s.solicitud_modificacion&&!s.modificacion_aprobada);
    const qsConObjetivo=[...new Set(objetivos.filter(o=>o.anio===currentAnio).map(o=>o.q))].sort((a,b)=>a-b);
    const qsAMostrar=qsConObjetivo.length>0?qsConObjetivo:[currentQ];
    return (
      <div style={{padding:"1.5rem",maxWidth:1100}}>
        {showObjetivoForm&&<ObjetivoModal/>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
          <div><div style={{fontSize:28,fontWeight:800,color:C.black}}>Dashboard Equipo</div><div style={{fontSize:14,color:C.gray500}}>Semana: {getWeekDates(0).label} · Q{currentQ} {currentAnio}</div></div>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={()=>{setEditRun(null);setShowRunForm(true);}}>+ Nuevo Run</Btn>
            <Btn variant="primary" onClick={()=>setShowObjetivoForm(true)}>+ Asignar objetivo</Btn>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(150px,100%),1fr))",gap:12,marginBottom:20}}>
          <Stat label="Ventas activas" value={activeSales.length} color={C.red}/>
          <Stat label="Facturación total" value={fmt(total)}/>
          <Stat label="Modificaciones pendientes" value={pending.length} color={pending.length>0?C.amber:C.green} alert={pending.length>0}/>
          <Stat label="Alertas vencimiento" value={alertas.length} color={alertas.length>0?C.red:C.green} alert={alertas.length>0}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(300px,100%),1fr))",gap:16,marginBottom:24}}>
          <Card><div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:14}}>Facturación por semana</div><BarChart data={weeklyTeam} height={110}/></Card>
          <Card>
            <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:12}}>KPIs esta semana</div>
            {SELLERS_OBJ.filter(s=>s.id!=="lucas").map(s=>{const k=myKpi(s.id,0);return(
              <div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.gray100}`,fontSize:13}}>
                <span style={{fontWeight:500}}>{s.name}</span>
                <span style={{color:C.gray400}}>{k.contactados||0} · {k.concrecion||0}%</span>
              </div>
            );})}
          </Card>
        </div>

        {/* Objetivos por Q */}
        {qsAMostrar.map(q=>{
          const isActual=q===currentQ;
          const totalQ=SELLERS_OBJ.reduce((a,s)=>a+totalDeQ(s.id,q),0);
          const totalObj=SELLERS_OBJ.reduce((a,s)=>a+(objetivos.find(o=>o.ejecutivo===s.id&&o.q===q&&o.anio===currentAnio)?.objetivo||0),0);
          return (
            <div key={q} style={{marginBottom:24}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                <div style={{fontWeight:700,fontSize:15,color:isActual?C.red:C.gray700}}>Q{q} {currentAnio} {isActual?"· Actual":"· Cerrado"}</div>
                {totalObj>0&&<div style={{fontSize:12,color:C.gray400}}>Equipo: <strong style={{color:isActual?C.red:C.gray600}}>{fmt(totalQ)}</strong> de <strong>{fmt(totalObj)}</strong> ({pct(totalQ,totalObj)}%)</div>}
                <button onClick={()=>deleteObjetivoQTodos(q)} style={{marginLeft:"auto",fontSize:11,color:C.gray400,background:"none",border:`1px solid ${C.gray200}`,borderRadius:6,padding:"3px 10px",cursor:"pointer"}}>🗑 Borrar Q{q}</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
                {SELLERS_OBJ.filter(s=>s.id!=="lucas").map(s=>{
                  const obj=objetivos.find(o=>o.ejecutivo===s.id&&o.q===q&&o.anio===currentAnio);
                  const tq=totalDeQ(s.id,q);
                  const done=obj?.objetivo>0&&tq>=obj.objetivo;
                  return (
                    <Card key={s.id} style={{textAlign:"center",border:`1px solid ${done?C.green:isActual?C.gray200:C.gray100}`,opacity:obj?1:0.55}}>
                      <div style={{width:32,height:32,borderRadius:8,background:done?C.green:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:10,fontWeight:700,margin:"0 auto 6px"}}>{s.avatar}</div>
                      <div style={{fontWeight:600,fontSize:12,color:C.black,marginBottom:6}}>{s.name}</div>
                      <PieChart value={tq} max={obj?.objetivo||0} label="" color={done?C.green:isActual?C.red:C.gray400} size={80}/>
                      <div style={{fontSize:12,fontWeight:700,color:done?C.green:C.red,marginTop:4}}>{fmt(tq)}</div>
                      <div style={{fontSize:11,color:C.gray400,marginTop:2}}>{ventasDeQ(s.id,q).length} ventas</div>
                      {obj?(
                        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,marginTop:4}}>
                          <span style={{fontSize:11,color:C.gray500}}>{fmt(obj.objetivo)}</span>
                          <button onClick={()=>{setObjetivoForm({ejecutivo:s.id,objetivo:obj.objetivo,q,anio:currentAnio});setShowObjetivoForm(true);}} style={{fontSize:11,color:C.blue,background:"none",border:"none",cursor:"pointer",padding:0}} title="Editar objetivo">✏️</button>
                          <button onClick={()=>deleteObjetivoQ(s.id,q)} style={{fontSize:11,color:C.gray300,background:"none",border:"none",cursor:"pointer",padding:0}} title="Quitar objetivo">🗑</button>
                        </div>
                      ):(
                        <div style={{marginTop:4}}>
                          <div style={{fontSize:10,color:C.gray300,marginBottom:3}}>Sin objetivo</div>
                          <button onClick={()=>{setObjetivoForm({ejecutivo:s.id,objetivo:0,q,anio:currentAnio});setShowObjetivoForm(true);}} style={{fontSize:10,color:C.blue,background:"none",border:`1px solid ${C.blue}`,borderRadius:4,cursor:"pointer",padding:"2px 6px",fontFamily:"'Montserrat',sans-serif"}}>+ Asignar</button>
                        </div>
                      )}
                      {done&&<div style={{fontSize:11,color:C.green,fontWeight:600,marginTop:4}}>🎉 ¡Felicitaciones!</div>}
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Runs / Bonos */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,marginTop:8}}>
          <div style={{fontWeight:700,fontSize:15,color:C.gray800}}>Runs / Bonos</div>
        </div>
        {runs.length===0&&<div style={{color:C.gray400,fontSize:13,marginBottom:20,padding:"1.5rem",background:C.white,borderRadius:10,border:`1px solid ${C.gray200}`,textAlign:"center"}}>No hay runs creados aún. Hacé click en "+ Nuevo Run" para crear uno.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:24}}>
          {runs.map(run=>{
            const activo=isRunActivo(run);
            const vencido=isRunVencido(run);
            return (
              <Card key={run.id} style={{border:`1px solid ${activo?C.red:vencido?C.gray100:C.gray200}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:12}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:14,color:C.gray900}}>{run.nombre}</span>
                      <Badge color={activo?"red":vencido?"gray":"blue"}>{activo?"🔥 Activo":vencido?"Finalizado":"Próximo"}</Badge>
                      {!run.activo&&<Badge color="gray">Desactivado</Badge>}
                    </div>
                    <div style={{fontSize:12,color:C.gray400,marginTop:4}}>{run.fecha_inicio} → {run.fecha_fin} · {run.participantes?.length||0} vendedores</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <Btn size="sm" onClick={()=>{setEditRun(run);setShowRunForm(true);}}>Editar</Btn>
                    <Btn size="sm" variant={run.activo?"danger":"success"} onClick={()=>toggleRunActivo(run.id,!run.activo)}>{run.activo?"Desactivar":"Activar"}</Btn>
                    <Btn size="sm" variant="danger" onClick={()=>deleteRun(run.id)}>Eliminar</Btn>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(130px,100%),1fr))",gap:10}}>
                  {(run.participantes||[]).map(p=>{
                    const s=getUser(p.ejecutivo);
                    const total=totalEnPeriodo(p.ejecutivo,run.fecha_inicio,run.fecha_fin);
                    const partDone=(p.objetivo||0)>0&&total>=(p.objetivo||0);
                    return (
                      <div key={p.ejecutivo} style={{textAlign:"center",padding:"10px 8px",background:partDone?C.greenLight:C.gray50,borderRadius:8,border:`1px solid ${partDone?C.green:C.gray100}`}}>
                        <div style={{fontWeight:500,fontSize:12,color:partDone?C.green:C.gray700,marginBottom:6}}>{s?.name}</div>
                        <PieChart value={total} max={p.objetivo||0} label="" color={partDone?C.green:activo?C.red:C.gray400} size={80}/>
                        <div style={{fontSize:11,color:C.gray500,marginTop:4}}>{fmt(total)} / {fmt(p.objetivo)}</div>
                        <div style={{fontSize:10,color:C.gray400,marginTop:2}}>{ventasEnPeriodo(p.ejecutivo,run.fecha_inicio,run.fecha_fin).length} ventas</div>
                        {partDone&&<div style={{fontSize:11,color:C.green,fontWeight:600,marginTop:4}}>🎉 ¡Felicitaciones!</div>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>

        <div style={{fontWeight:600,fontSize:14,color:C.gray800,marginBottom:12}}>KPIs detallados — esta semana</div>
        <Table
          cols={[{key:"v",label:"Vendedor"},{key:"c",label:"Contactados"},{key:"ce",label:"C. efectivos"},{key:"pp",label:"%"},{key:"ra",label:"R. agendadas"},{key:"re",label:"R. efectivas"},{key:"con",label:"Concreción"},{key:"tk",label:"Ticket"},{key:"pc",label:"Pos. concreción"}]}
          rows={SELLERS_OBJ.filter(s=>s.id!=="lucas").map(s=>{const k=myKpi(s.id,0);return{
            v:<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:24,height:24,borderRadius:6,background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:9,fontWeight:700}}>{s.avatar}</div><span style={{fontWeight:500,fontSize:13}}>{s.name}</span></div>,
            c:k.contactados||0,ce:k.contactados_efectivos||0,
            pp:<Badge color={(k.contactados_efectivos||0)>0?"green":"gray"}>{pct(k.contactados_efectivos||0,k.contactados||0)}%</Badge>,
            ra:k.reuniones_agendadas||0,re:k.reuniones_efectivas||0,con:`${k.concrecion||0}%`,
            tk:fmt(k.ticket_promedio||0),pc:<span style={{color:C.green,fontWeight:600}}>{fmt(k.posible_concrecion||0)}</span>
          };})}
        />
      </div>
    );
  };

  const Ventas = () => {
    const list=(user.role==="gerente"?(filterVendedor==="todos"?sales:sales.filter(s=>s.ejecutivo===filterVendedor)):mySales);
    const active=list.filter(s=>s.estado!=="cancelada");
    return (
      <div style={{padding:"1.5rem",maxWidth:960}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div style={{fontSize:20,fontWeight:800,color:C.black}}>Ventas {user.role==="gerente"?"— Equipo":"— Mis Ventas"}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {user.role==="gerente"&&(
              <select value={filterVendedor} onChange={e=>setFilterVendedor(e.target.value)} style={{...inp,width:"auto",padding:"7px 12px",fontSize:12}}>
                <option value="todos">Todos los vendedores</option>
                {SELLERS_OBJ.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {user.role==="gerente"&&<Btn onClick={()=>exportVentasExcel(list)}>📊 Exportar Excel</Btn>}
            {user.role==="vendedor"&&<Btn variant="primary" onClick={()=>setShowSaleForm(true)}>+ Nueva Venta</Btn>}
          </div>
        </div>
        {user.role==="gerente"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(150px,100%),1fr))",gap:12,marginBottom:16}}>
            <Stat label="Ventas activas" value={active.length} color={C.red}/>
            <Stat label="Facturación" value={fmt(active.reduce((a,s)=>a+(s.total||0),0))}/>
            <Stat label="Ticket promedio" value={active.length?fmt(Math.round(active.reduce((a,s)=>a+(s.total||0),0)/active.length)):"-"}/>
            <Stat label="Vendedores" value={[...new Set(active.map(s=>s.ejecutivo))].length}/>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {list.map(s=><SaleCard key={s.id} sale={s} onClick={setDetailSale} showActions={user.role==="vendedor"} onRequestEdit={id=>handleUpdateSale(id,{solicitud_modificacion:true})}/>)}
          {!list.length&&<EmptyState icon="📋" title="Sin ventas" desc="Aquí aparecerán las ventas registradas"/>}
        </div>
      </div>
    );
  };

  const Disponibilidad = () => {
    const clientsForProduct = (producto) => {
      return activeSales.filter(s=>(s.productos_seleccionados||[]).includes(producto));
    };
    return (
      <div style={{padding:"1.5rem",maxWidth:800}}>
        {dispModal&&(
          <Modal onClose={()=>setDispModal(null)} maxWidth={520}>
            <ModalHeader title={dispModal.producto} subtitle="Clientes con este producto activo" onClose={()=>setDispModal(null)}/>
            <ModalBody>
              {(()=>{
                const cls=clientsForProduct(dispModal.producto);
                if(!cls.length) return <div style={{color:C.gray400,fontSize:13,padding:"1rem",textAlign:"center"}}>No hay clientes con este producto actualmente</div>;
                return (
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {cls.map(s=>(
                      <div key={s.id} style={{padding:"10px 14px",borderRadius:8,background:C.gray50,border:`1px solid ${C.gray200}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                          <div>
                            <div style={{fontWeight:600,fontSize:13,color:C.black}}>{s.inmobiliaria}</div>
                            <div style={{fontSize:11,color:C.gray500,marginTop:2}}>{getUser(s.ejecutivo)?.name} · Vence: {s.fecha_fin}</div>
                          </div>
                          <span style={{fontWeight:700,color:C.red,fontSize:13}}>{fmt(s.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </ModalBody>
          </Modal>
        )}
        <div style={{fontSize:20,fontWeight:800,color:C.black,marginBottom:20}}>Disponibilidad de Productos</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(260px,100%),1fr))",gap:12}}>
          {availability.map(a=>{
            const p=Math.round((a.used/a.total)*100);
            const color=p>=90?C.red:p>=60?C.amber:C.green;
            const clientCount=clientsForProduct(a.producto).length;
            return (
              <Card key={a.producto} style={{cursor:"pointer"}} onClick={()=>{ if(editAvail!==a.id) setDispModal(a); }}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontWeight:600,fontSize:13}}>{a.producto}</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {clientCount>0&&<span style={{fontSize:11,background:C.redLight,color:C.red,borderRadius:4,padding:"1px 6px",fontWeight:600}}>{clientCount} cliente{clientCount!==1?"s":""}</span>}
                    <span style={{fontSize:12,color:C.gray400}}>{a.used}/{a.total}</span>
                  </div>
                </div>
                <div style={{height:6,background:C.gray100,borderRadius:3,overflow:"hidden",marginBottom:6}}>
                  <div style={{height:"100%",width:`${p}%`,background:color,borderRadius:3,transition:"width 0.4s"}}/>
                </div>
                <div style={{fontSize:11,color,fontWeight:600}}>{p}% ocupado</div>
                {user.role==="gerente"&&editAvail===a.id?(
                  <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}} onClick={e=>e.stopPropagation()}>
                    <input type="text" inputMode="numeric" defaultValue={a.total} id={`t-${a.id}`} style={{...inp,width:60,padding:"4px 6px",fontSize:12}}/>
                    <input type="text" inputMode="numeric" defaultValue={a.used} id={`u-${a.id}`} style={{...inp,width:60,padding:"4px 6px",fontSize:12}}/>
                    <Btn size="sm" variant="primary" onClick={async()=>{const t=parseInt(document.getElementById(`t-${a.id}`).value)||a.total;const u=parseInt(document.getElementById(`u-${a.id}`).value)||a.used;await upsertItem("disponibilidad",a.id,{...a,total:t,used:u});setAvailability(prev=>prev.map(x=>x.id===a.id?{...x,total:t,used:u}:x));setEditAvail(null);}}>OK</Btn>
                    <Btn size="sm" onClick={()=>setEditAvail(null)}>×</Btn>
                  </div>
                ):user.role==="gerente"&&(
                  <button onClick={e=>{e.stopPropagation();setEditAvail(a.id);}} style={{marginTop:6,fontSize:11,color:C.red,background:"none",border:"none",cursor:"pointer",padding:0,fontWeight:500}}>Editar</button>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const Modificaciones = () => {
    const pending=sales.filter(s=>s.solicitud_modificacion&&!s.modificacion_aprobada);
    const approved=sales.filter(s=>s.modificacion_aprobada);
    return (
      <div style={{padding:"1.5rem",maxWidth:800}}>
        <div style={{fontSize:20,fontWeight:800,color:C.black,marginBottom:20}}>Solicitudes de modificación</div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:600,color:C.amber,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><Badge color="amber">Pendientes</Badge>{pending.length}</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {pending.map(s=>(
              <Card key={s.id} style={{border:`1px solid ${C.amber}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                  <div><div style={{fontWeight:600,fontSize:13}}>{s.inmobiliaria}</div><div style={{fontSize:11,color:C.gray400,marginTop:2}}>{getUser(s.ejecutivo)?.name} · {fmt(s.total)}</div></div>
                  <div style={{display:"flex",gap:8}}><Btn size="sm" variant="success" onClick={()=>handleApproveMod(s.id)}>Aprobar</Btn><Btn size="sm" variant="danger" onClick={()=>handleRejectMod(s.id)}>Rechazar</Btn></div>
                </div>
              </Card>
            ))}
            {!pending.length&&<div style={{color:C.gray400,fontSize:13,padding:"1rem",textAlign:"center"}}>No hay solicitudes pendientes</div>}
          </div>
        </div>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:C.green,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><Badge color="green">Aprobadas</Badge>{approved.length}</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {approved.map(s=>(
              <Card key={s.id} style={{border:`1px solid ${C.green}`}}>
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
        <div style={{fontSize:20,fontWeight:800,color:C.black,marginBottom:20}}>Alertas de Contratos</div>
        {vencidas.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:600,color:C.gray500,marginBottom:10}}>Vencidos ({vencidas.length})</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {vencidas.map(s=><Card key={s.id} style={{opacity:0.7}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:600,fontSize:13}}>{s.inmobiliaria}</div><div style={{fontSize:11,color:C.gray400}}>{getUser(s.ejecutivo)?.name} · Venció: {s.fecha_fin}</div></div><Badge color="gray">Vencido</Badge></div></Card>)}
            </div>
          </div>
        )}
        <div style={{fontSize:13,fontWeight:600,color:C.red,marginBottom:10}}>Por vencer en 30 días ({alertas.length})</div>
        {!alertas.length&&<EmptyState icon="✅" title="Todo en orden" desc="No hay contratos próximos a vencer"/>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {alertas.sort((a,b)=>daysUntil(a.fecha_fin)-daysUntil(b.fecha_fin)).map(s=>{const dias=daysUntil(s.fecha_fin);return(
            <Card key={s.id} style={{border:`1px solid ${dias<=7?C.red:C.amber}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div><div style={{fontWeight:600,fontSize:13}}>{s.inmobiliaria}</div><div style={{fontSize:11,color:C.gray400,marginTop:2}}>{getUser(s.ejecutivo)?.name} · {fmt(s.total)} · Vence: {s.fecha_fin}</div></div>
                <Badge color={dias<=7?"red":"amber"}>{dias}d restantes</Badge>
              </div>
            </Card>
          );})}
        </div>
      </div>
    );
  };

  const Social = () => (
    <div style={{padding:"1.5rem",maxWidth:900}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:800,color:C.black}}>Redes Sociales</div>
        <Btn variant="primary" onClick={()=>setShowPostForm(true)}>+ Nuevo Post</Btn>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {posts.map(p=>(
          <Card key={p.id}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{padding:"5px 10px",background:C.gray100,borderRadius:7,fontSize:11,fontWeight:600,minWidth:76,textAlign:"center",color:C.gray700,flexShrink:0}}>{p.fecha}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}><Badge color="red">{p.platform}</Badge><Badge color={p.status==="programado"?"green":"gray"}>{p.status}</Badge></div>
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

  // ── SCREENS MAP ───────────────────────────────────────────
  const screens = {
    dashboard:<DashboardVendedor/>,
    dashboard_gerente:<DashboardGerente/>,
    dashboard_ggeneral:<DashboardGeneral sales={sales} invoices={invoices} objetivos={objetivos} onNavigate={setTab}/>,
    ventas:<Ventas/>, kpis:<KPIs currentUser={user} kpis={kpis} kpiForm={kpiForm} setKpiForm={setKpiForm} kpiWeekOffset={kpiWeekOffset} setKpiWeekOffset={setKpiWeekOffset} onSave={saveKPI}/>, disponibilidad:<Disponibilidad/>,
    ventas_ggeneral:<VentasGeneral sales={sales} setSales={setSales} invoices={invoices}/>,
    cobros:<Cobros sales={sales} setSales={setSales} setTickets={setTickets} currentUser={user}/>,
    producciones:<Producciones currentUser={user} productions={productions} setProductions={setProductions} editingProd={editingProd} setEditingProd={setEditingProd}/>, social:<Social/>,
    modificaciones:<Modificaciones/>, alertas:<Alertas/>, alertas_admin:<Alertas/>, contratos:<Alertas/>,
    comisiones:<Comisiones sales={sales} comisiones={comisiones} onUpdateComision={updateComision} currentUser={user}/>,
    facturacion:<Facturacion sales={sales} invoices={invoices} isGerente={user.role==="gerente"} onUpdateSale={handleUpdateSale}
      onUpdateInvoice={async(id,ch)=>{await updateItem("facturas",id,ch);setInvoices(prev=>prev.map(x=>x.id===id?{...x,...ch}:x));}}
      onAddInvoice={async(f)=>{const d=await addItem("facturas",f);if(d)setInvoices(prev=>[d,...prev]);}}/>,
    clientes:<Clientes clientes={clientes} setClientes={setClientes} sales={sales} setSales={setSales} currentUser={user}/>,
    assets:<EmptyState icon="📁" title="Assets" desc="En desarrollo"/>,
    metricas:<Metricas metricas={metricas} setMetricas={setMetricas} currentUser={user}/>,
    correccion_fechas:<CorreccionFechas sales={sales} setSales={setSales}/>,
    reportes:<Reportes sales={sales}/>,
    reportes_ggeneral:<Reportes sales={sales}/>,
    competencias:<Competencias competencias={competencias} setCompetencias={setCompetencias} currentUser={user}/>,
    tickets:<Tickets tickets={tickets} setTickets={setTickets} currentUser={user}/>,
    tareas:<Tareas tareas={tareas} setTareas={setTareas} currentUser={user}/>,
    prospectos:<Prospectos currentUser={user} prospectos={prospectos} setProspectos={setProspectos} cargar={cargarProspectos} cargando={cargandoProspectos}/>,
    mis_prospectos:<MisProspectos currentUser={user} prospectos={prospectos} setProspectos={setProspectos} cargar={cargarProspectos} cargando={cargandoProspectos} onCrearVenta={crearVentaDesde}/>,
    documentos:<Documentos documentos={documentos} setDocumentos={setDocumentos} currentUser={user}/>,
    presentaciones:<Presentaciones presentaciones={presentaciones} setPresentaciones={setPresentaciones} currentUser={user}/>,
  };

  return (
    <div style={{minHeight:"100vh",background:C.gray50,fontFamily:"'Montserrat', sans-serif"}}>
      <NavBar/>
      <div style={{minHeight:"calc(100vh - 54px)"}}>
        {loading?<Spinner/>:(screens[tab]||<EmptyState icon="🔍" title="Sección no encontrada"/>)}
      </div>
      {detailSale&&(
        <SaleDetailModal sale={detailSale} onClose={()=>setDetailSale(null)}
          canEdit={detailSale.modificacion_aprobada&&user.role==="vendedor"}
          isGerente={user.role==="gerente"} isAdmin={user.role==="admin"}
          onEdit={s=>{setEditSale(s);setDetailSale(null);}}
          onDelete={handleCancelSale}
          onApprove={id=>{handleApproveMod(id);setDetailSale(s=>({...s,modificacion_aprobada:true}));}}
          onReject={id=>{handleRejectMod(id);setDetailSale(null);}}/>
      )}
      {(showSaleForm||editSale||saleDraft)&&(
        <SaleForm initialData={editSale||saleDraft} currentUser={user} clientes={clientes}
          onClose={()=>{setShowSaleForm(false);setEditSale(null);setSaleDraft(null);}}
          onSave={async form=>{
            if(editSale){const f=await vincularCliente(form);await handleUpdateSale(editSale.id,{...f,modificacion_aprobada:false,solicitud_modificacion:false});setEditSale(null);}
            else {
              await saveSale(form);
              // venta creada desde un prospecto: la inmobiliaria pasa a cliente y el agente no le escribe más
              if(form.lead_id){
                const cambios = await marcarCliente(form.lead_id,form).catch(()=>null);
                if(cambios) setProspectos(prev=>prev&&prev.map(l=>l.id===form.lead_id?{...l,...cambios}:l));
              }
              setSaleDraft(null);
            }
          }}/>
      )}
      {showRunForm&&<RunModal onClose={()=>{setShowRunForm(false);setEditRun(null);}}/>}
      {cambiandoClave&&<CambiarClave onClose={()=>setCambiandoClave(false)}/>}
    </div>
  );
}
