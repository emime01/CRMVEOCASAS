import { useState, useEffect, useRef } from "react";

const JSONBIN_KEY = "$2a$10$BEkST1829rW1MngDe/hVteb2Q9U7HEiuPmmsKms3WHdn7yXBk.vSS";
const JSONBIN_URL = "https://api.jsonbin.io/v3/b";

// Each "table" is a separate bin. We store bin IDs in localStorage.
const getBinId = (table) => localStorage.getItem(`bin_${table}`);
const setBinId = (table, id) => localStorage.setItem(`bin_${table}`, id);

const headers = {
  "Content-Type": "application/json",
  "X-Master-Key": JSONBIN_KEY,
  "X-Bin-Versioning": "false",
};

const TABLES = ["ventas","kpis","producciones","disponibilidad","posts_social","facturas"];

const INIT_DATA = {
  ventas: [],
  kpis: [],
  producciones: [],
  disponibilidad: [
    {producto:"Propiedades",total:10,used:3},{producto:"Destacadas",total:10,used:5},
    {producto:"Superdestacadas",total:10,used:2},{producto:"Super destacada Home Venta",total:10,used:4},
    {producto:"Destacada Home Venta",total:10,used:6},{producto:"Super destacada Home Alquiler",total:10,used:1},
    {producto:"Destacada Home Alquiler",total:10,used:3},{producto:"Índice",total:10,used:7},
    {producto:"Producción",total:10,used:2},{producto:"Banner",total:10,used:4},{producto:"Desarrollos",total:10,used:1},
  ],
  posts_social: [
    {id:1,fecha:"2025-04-10",platform:"Instagram",content:"Nueva propiedad destacada en Recoleta",status:"programado"},
    {id:2,fecha:"2025-04-15",platform:"Facebook",content:"Oferta especial paquetes mayo",status:"borrador"},
  ],
  facturas: [
    {id:1,folio:"F-001",client:"Inmobiliaria Sur",amount:7140000,date:"2025-01-05",status:"pagada"},
    {id:2,folio:"F-002",client:"Norte Propiedades",amount:1428000,date:"2025-02-05",status:"pendiente"},
  ],
};

async function readBin(table) {
  const id = getBinId(table);
  if (!id) return null;
  const r = await fetch(`${JSONBIN_URL}/${id}/latest`, { headers });
  if (!r.ok) return null;
  const j = await r.json();
  return j.record;
}

async function writeBin(table, data) {
  const id = getBinId(table);
  if (!id) {
    // create new bin
    const r = await fetch(JSONBIN_URL, {
      method: "POST",
      headers: { ...headers, "X-Bin-Name": `veocasas_${table}` },
      body: JSON.stringify(data),
    });
    const j = await r.json();
    setBinId(table, j.metadata.id);
    return data;
  }
  await fetch(`${JSONBIN_URL}/${id}`, { method: "PUT", headers, body: JSON.stringify(data) });
  return data;
}

const C = { red:"#C0001A", darkRed:"#8B0013", black:"#111111", white:"#FFFFFF", gray:"#F5F5F5", grayMid:"#E0E0E0", grayDark:"#555555", grayText:"#888888" };

const USERS = [
  { id:"mika", name:"Mika", role:"gerente", avatar:"MI" },
  { id:"sebastian", name:"Sebastian", role:"vendedor", avatar:"SE" },
  { id:"juanba", name:"Juanba", role:"vendedor", avatar:"JB" },
  { id:"paty", name:"Paty", role:"vendedor", avatar:"PA" },
  { id:"stefano", name:"Stefano", role:"vendedor", avatar:"ST" },
  { id:"mateo", name:"Mateo", role:"marketing", avatar:"MA" },
  { id:"gonzalo", name:"Gonzalo", role:"admin", avatar:"GO" },
];
const SELLERS = USERS.filter(u => u.role === "vendedor");
const CRMS = ["Tera","Nai","Casasweb","Tokko","Xintel","2clics","Otro CRM","SIN CRM"];
const PRODUCTS = ["Propiedades","Destacadas","Superdestacadas","Super destacada Home Venta","Destacada Home Venta","Super destacada Home Alquiler","Destacada Home Alquiler","Índice","Producción","Banner","Desarrollos"];
const PAYMENT_METHODS = ["Transferencia","Tarjeta de crédito","Cheque","Efectivo"];
const PLATFORMS = ["Instagram","Facebook","LinkedIn","TikTok","Twitter/X"];

const fmt = n => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);
const pct = (a,b) => b>0 ? Math.round((a/b)*100) : 0;
const inp = { width:"100%", padding:"8px 10px", borderRadius:7, border:`1px solid ${C.grayMid}`, fontSize:13, outline:"none", boxSizing:"border-box", background:C.white };

const Sec = ({title,children}) => <div style={{marginBottom:16}}><div style={{fontWeight:500,fontSize:12,color:C.red,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>{title}</div>{children}</div>;
const Grid2 = ({children}) => <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px"}}>{children}</div>;
const Field = ({label,children}) => <div><div style={{fontSize:11,color:C.grayText,marginBottom:3}}>{label}</div>{children}</div>;
const Stat = ({label,value,sub,color}) => (
  <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:"14px 16px"}}>
    <div style={{fontSize:11,color:C.grayText,marginBottom:4}}>{label}</div>
    <div style={{fontSize:20,fontWeight:600,color:color||C.black}}>{value}</div>
    {sub && <div style={{fontSize:11,color:C.grayText,marginTop:2}}>{sub}</div>}
  </div>
);
const Spinner = () => <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"3rem",color:C.grayText,fontSize:14}}>Cargando...</div>;

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("");
  const [sales, setSales] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [productions, setProductions] = useState([]);
  const [posts, setPosts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalSale, setModalSale] = useState(null);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [kpiWeek, setKpiWeek] = useState(0);
  const [editAvail, setEditAvail] = useState(null);
  const [kpiForm, setKpiForm] = useState({});
  const [postForm, setPostForm] = useState({date:"",platform:"Instagram",content:"",status:"borrador"});
  const [saleForm, setSaleForm] = useState({});

  const defaultTab = (role) => ({ gerente:"ventas", vendedor:"dashboard", marketing:"producciones", admin:"facturacion" }[role] || "dashboard");

  const login = async (u) => { setUser(u); setTab(defaultTab(u.role)); };
  const logout = () => { setUser(null); setSales([]); setAvailability([]); setKpis([]); setProductions([]); setPosts([]); setInvoices([]); };

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setLoading(true);
    const [s, av, k, pr, po, inv] = await Promise.all([
      supabase.from("ventas").select("*").order("created_at", { ascending: false }),
      supabase.from("disponibilidad").select("*"),
      supabase.from("kpis").select("*"),
      supabase.from("producciones").select("*").order("created_at", { ascending: false }),
      supabase.from("posts_social").select("*").order("fecha"),
      supabase.from("facturas").select("*").order("created_at", { ascending: false }),
    ]);
    if (s.data) setSales(s.data);
    if (av.data) setAvailability(av.data);
    if (k.data) setKpis(k.data);
    if (pr.data) setProductions(pr.data);
    if (po.data) setPosts(po.data);
    if (inv.data) setInvoices(inv.data);
    setLoading(false);
  };

  const initSaleForm = () => setSaleForm({ inmobiliaria:"", razon_social:"", rut:"", mail:"", telefono:"", direccion:"", crm:"SIN CRM", ejecutivo: user?.id || "sebastian", detalle:"", propiedades:0, destacadas:0, destacadas_q:0, superdestacadas:0, superdestacadas_q:0, produccion:0, produccion_q:0, indice:0, destacadas_home:0, fecha_inicio:"", fecha_fin:"", valor_mensual:0, subtotal:0, total:0, metodo_pago:"Transferencia", productos_seleccionados:[] });

  const saveSale = async () => {
    const sub = parseFloat(saleForm.subtotal)||0;
    const total = Math.round(sub*1.19);
    const payload = { ...saleForm, subtotal: sub, total };
    const { data, error } = await supabase.from("ventas").insert([payload]).select().single();
    if (!error && data) {
      setSales(prev => [data, ...prev]);
      if (parseInt(saleForm.produccion_q) > 0) {
        const prod = { cliente: saleForm.inmobiliaria, ejecutivo: saleForm.ejecutivo, produccion_q: parseInt(saleForm.produccion_q), venta_id: data.id };
        const { data: pd } = await supabase.from("producciones").insert([prod]).select().single();
        if (pd) setProductions(prev => [pd, ...prev]);
      }
    }
    setShowSaleForm(false);
  };

  const saveKPI = async () => {
    const payload = { ejecutivo: user.id, semana: kpiWeek, ...kpiForm };
    const { data } = await supabase.from("kpis").upsert([payload], { onConflict: "ejecutivo,semana" }).select().single();
    if (data) setKpis(prev => { const f = prev.filter(k => !(k.ejecutivo===data.ejecutivo && k.semana===data.semana)); return [...f, data]; });
    setKpiForm({});
  };

  const saveAvail = async (producto, total, used) => {
    const { data } = await supabase.from("disponibilidad").update({ total, used }).eq("producto", producto).select().single();
    if (data) setAvailability(prev => prev.map(a => a.producto===producto ? data : a));
    setEditAvail(null);
  };

  const savePost = async () => {
    const { data } = await supabase.from("posts_social").insert([postForm]).select().single();
    if (data) setPosts(prev => [...prev, data]);
    setShowPostForm(false);
    setPostForm({ date:"", platform:"Instagram", content:"", status:"borrador" });
  };

  const deletePost = async (id) => {
    await supabase.from("posts_social").delete().eq("id", id);
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const confirmProduction = async (id, fecha) => {
    const { data } = await supabase.from("producciones").update({ confirmado: true, fecha }).eq("id", id).select().single();
    if (data) setProductions(prev => prev.map(p => p.id===id ? data : p));
  };

  const updateProductionDate = async (id, fecha) => {
    const { data } = await supabase.from("producciones").update({ fecha }).eq("id", id).select().single();
    if (data) setProductions(prev => prev.map(p => p.id===id ? data : p));
  };

  const myKpiData = (uid, week) => kpis.find(k => k.ejecutivo===uid && k.semana===week) || {};
  const mySales = user ? sales.filter(s => s.ejecutivo===user.id) : [];

  const TABS = {
    vendedor: [{ id:"dashboard",label:"Dashboard" },{ id:"ventas",label:"Mis Ventas" },{ id:"kpis",label:"KPIs" },{ id:"producciones",label:"Producciones" },{ id:"disponibilidad",label:"Disponibilidad" }],
    gerente:  [{ id:"ventas",label:"Ventas" },{ id:"kpis",label:"KPIs Equipo" },{ id:"disponibilidad",label:"Disponibilidad" },{ id:"producciones",label:"Producciones" }],
    marketing:[{ id:"producciones",label:"Producciones" },{ id:"social",label:"Redes Sociales" },{ id:"assets",label:"Assets" },{ id:"metricas",label:"Métricas" }],
    admin:    [{ id:"facturacion",label:"Facturación" },{ id:"clientes",label:"Clientes" },{ id:"reportes",label:"Reportes" }],
  };

  if (!user) return (
    <div style={{minHeight:"100vh",background:C.black,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem"}}>
      <div style={{marginBottom:"2rem",textAlign:"center"}}>
        <div style={{fontSize:32,fontWeight:700,color:C.white,letterSpacing:2}}>VEO<span style={{color:C.red}}>CASAS</span></div>
        <div style={{color:C.grayText,fontSize:13,marginTop:4}}>CRM Comercial</div>
      </div>
      <div style={{background:C.white,borderRadius:16,padding:"2rem",width:"100%",maxWidth:460}}>
        <p style={{fontWeight:500,marginBottom:16,color:C.black}}>Seleccioná tu perfil</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {USERS.map(u => (
            <button key={u.id} onClick={() => login(u)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",border:`1.5px solid ${C.grayMid}`,borderRadius:10,background:C.white,cursor:"pointer"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red;e.currentTarget.style.background=C.gray;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.grayMid;e.currentTarget.style.background=C.white;}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontWeight:600,fontSize:12}}>{u.avatar}</div>
              <div style={{textAlign:"left"}}>
                <div style={{fontWeight:500,fontSize:14,color:C.black}}>{u.name}</div>
                <div style={{fontSize:11,color:C.grayText,textTransform:"capitalize"}}>{u.role}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const NavBar = () => (
    <div style={{background:C.black,padding:"0 1.5rem",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <span style={{fontSize:18,fontWeight:700,color:C.white,letterSpacing:1}}>VEO<span style={{color:C.red}}>CASAS</span></span>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {(TABS[user.role]||[]).map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"6px 12px",borderRadius:6,border:"none",background:tab===t.id?C.red:"transparent",color:tab===t.id?C.white:C.grayText,fontSize:13,fontWeight:500,cursor:"pointer"}}>{t.label}</button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:30,height:30,borderRadius:"50%",background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:11,fontWeight:600}}>{user.avatar}</div>
        <span style={{color:C.white,fontSize:13}}>{user.name}</span>
        <button onClick={logout} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${C.grayDark}`,background:"transparent",color:C.grayText,fontSize:12,cursor:"pointer"}}>Salir</button>
      </div>
    </div>
  );

  const SaleCard = ({sale,onClick}) => (
    <div onClick={()=>onClick&&onClick(sale)} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:"14px 16px",cursor:"pointer"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=C.red}
      onMouseLeave={e=>e.currentTarget.style.borderColor=C.grayMid}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontWeight:500,color:C.black,fontSize:14}}>{sale.inmobiliaria}</div>
          <div style={{color:C.grayText,fontSize:12,marginTop:2}}>{SELLERS.find(s=>s.id===sale.ejecutivo)?.name} · {sale.crm}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontWeight:600,color:C.red,fontSize:14}}>{fmt(sale.total)}</div>
          <div style={{fontSize:11,color:C.grayText}}>{sale.fecha_inicio} → {sale.fecha_fin}</div>
        </div>
      </div>
    </div>
  );

  const SaleModal = ({sale,onClose}) => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}} onClick={onClose}>
      <div style={{background:C.white,borderRadius:14,width:"100%",maxWidth:620,maxHeight:"85vh",overflowY:"auto",padding:"1.5rem"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div><div style={{fontSize:18,fontWeight:600}}>{sale.inmobiliaria}</div><div style={{color:C.grayText,fontSize:13}}>{sale.razon_social} · {sale.rut}</div></div>
          <button onClick={onClose} style={{border:"none",background:"none",fontSize:22,cursor:"pointer",color:C.grayText}}>×</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 16px",fontSize:13}}>
          {[["Mail",sale.mail],["Teléfono",sale.telefono],["Dirección",sale.direccion],["CRM",sale.crm],["Ejecutivo",SELLERS.find(s=>s.id===sale.ejecutivo)?.name],["Método de pago",sale.metodo_pago],["Valor mensual",fmt(sale.valor_mensual)],["Subtotal s/IVA",fmt(sale.subtotal)],["Total c/IVA",fmt(sale.total)],["Fecha inicio",sale.fecha_inicio],["Fecha fin",sale.fecha_fin],["Propiedades",sale.propiedades]].map(([k,v])=>(
            <div key={k}><span style={{color:C.grayText}}>{k}: </span><span style={{fontWeight:500}}>{v}</span></div>
          ))}
        </div>
        <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.grayMid}`}}>
          <div style={{fontWeight:500,marginBottom:6,fontSize:13}}>Productos contratados</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {(sale.productos_seleccionados||[]).map(p=><span key={p} style={{background:C.gray,padding:"3px 10px",borderRadius:12,fontSize:12}}>{p}</span>)}
            {sale.destacadas_q>0&&<span style={{background:"#fff0f0",color:C.red,padding:"3px 10px",borderRadius:12,fontSize:12}}>Destacadas ×{sale.destacadas_q}</span>}
            {sale.superdestacadas_q>0&&<span style={{background:"#fff0f0",color:C.red,padding:"3px 10px",borderRadius:12,fontSize:12}}>Superdestacadas ×{sale.superdestacadas_q}</span>}
            {sale.produccion_q>0&&<span style={{background:"#fff0f0",color:C.red,padding:"3px 10px",borderRadius:12,fontSize:12}}>Producción ×{sale.produccion_q}</span>}
          </div>
        </div>
        {sale.detalle&&<div style={{marginTop:12,padding:12,background:C.gray,borderRadius:8,fontSize:13}}><span style={{color:C.grayText}}>Detalle: </span>{sale.detalle}</div>}
      </div>
    </div>
  );

  const SaleFormModal = ({onClose}) => {
    const [form, setForm] = useState(saleForm);
    const set = (k,v) => setForm(f=>({...f,[k]:v}));
    const toggleProduct = p => setForm(f=>({...f,productos_seleccionados:f.productos_seleccionados.includes(p)?f.productos_seleccionados.filter(x=>x!==p):[...f.productos_seleccionados,p]}));
    const total = Math.round((parseFloat(form.subtotal)||0)*1.19);
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"1rem",overflowY:"auto"}} onClick={onClose}>
        <div style={{background:C.white,borderRadius:14,width:"100%",maxWidth:680,padding:"1.5rem",margin:"auto"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
            <div style={{fontSize:17,fontWeight:600}}>Nueva Venta</div>
            <button onClick={onClose} style={{border:"none",background:"none",fontSize:22,cursor:"pointer",color:C.grayText}}>×</button>
          </div>
          <Sec title="Datos de la Inmobiliaria">
            <Grid2>
              <Field label="Nombre Inmobiliaria"><input value={form.inmobiliaria} onChange={e=>set("inmobiliaria",e.target.value)} style={inp}/></Field>
              <Field label="Razón Social"><input value={form.razon_social} onChange={e=>set("razon_social",e.target.value)} style={inp}/></Field>
              <Field label="RUT"><input value={form.rut} onChange={e=>set("rut",e.target.value)} style={inp}/></Field>
              <Field label="Mail"><input value={form.mail} onChange={e=>set("mail",e.target.value)} style={inp}/></Field>
              <Field label="Teléfono"><input value={form.telefono} onChange={e=>set("telefono",e.target.value)} style={inp}/></Field>
              <Field label="Dirección"><input value={form.direccion} onChange={e=>set("direccion",e.target.value)} style={inp}/></Field>
              <Field label="CRM">
                <select value={form.crm} onChange={e=>set("crm",e.target.value)} style={inp}>
                  {CRMS.map(c=><option key={c}>{c}</option>)}
                </select>
              </Field>
            </Grid2>
          </Sec>
          <Sec title="Datos de la Compra">
            <Grid2>
              <Field label="Ejecutivo">
                <select value={form.ejecutivo} onChange={e=>set("ejecutivo",e.target.value)} style={inp}>
                  {SELLERS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Propiedades"><input type="number" value={form.propiedades} onChange={e=>set("propiedades",e.target.value)} style={inp}/></Field>
            </Grid2>
            <div style={{marginTop:10}}><Field label="Detalle de la compra"><textarea value={form.detalle} onChange={e=>set("detalle",e.target.value)} style={{...inp,height:60,resize:"none"}}/></Field></div>
          </Sec>
          <Sec title="Productos">
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
              {PRODUCTS.map(p=>(
                <label key={p} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
                  <input type="checkbox" checked={form.productos_seleccionados.includes(p)} onChange={()=>toggleProduct(p)}/>
                  <span>{p}</span>
                  {form.productos_seleccionados.includes(p) && ["Destacadas","Superdestacadas","Producción"].includes(p) && (
                    <input type="number" min="0" placeholder="Cant." style={{...inp,width:60,padding:"4px 6px"}}
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
              <Field label="Método de pago">
                <select value={form.metodo_pago} onChange={e=>set("metodo_pago",e.target.value)} style={inp}>
                  {PAYMENT_METHODS.map(m=><option key={m}>{m}</option>)}
                </select>
              </Field>
            </Grid2>
          </Sec>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
            <button onClick={onClose} style={{padding:"8px 20px",borderRadius:8,border:`1px solid ${C.grayMid}`,background:"none",cursor:"pointer"}}>Cancelar</button>
            <button onClick={()=>{setSaleForm(form);saveSale();}} style={{padding:"8px 20px",borderRadius:8,border:"none",background:C.red,color:C.white,fontWeight:500,cursor:"pointer"}}>Guardar Venta</button>
          </div>
        </div>
      </div>
    );
  };

  // ─── SCREENS ──────────────────────────────────────────────

  const Dashboard = () => {
    const lastKpi = myKpiData(user.id, kpiWeek);
    const total = mySales.reduce((a,s)=>a+(s.total||0),0);
    return (
      <div style={{padding:"1.5rem",maxWidth:900}}>
        <div style={{marginBottom:20}}><div style={{fontSize:20,fontWeight:600}}>Hola, {user.name}</div><div style={{color:C.grayText,fontSize:13}}>Tu resumen de rendimiento</div></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
          <Stat label="Total ventas" value={mySales.length} color={C.red}/>
          <Stat label="Facturación" value={fmt(total)}/>
          <Stat label="Ticket promedio" value={mySales.length?fmt(Math.round(total/mySales.length)):"-"}/>
          <Stat label="Concreción" value={`${lastKpi.concrecion||0}%`} sub="Última semana"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div>
            <div style={{fontWeight:500,marginBottom:10,fontSize:14}}>Últimas ventas</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {mySales.slice(0,3).map(s=><SaleCard key={s.id} sale={s} onClick={setModalSale}/>)}
              {!mySales.length&&<div style={{color:C.grayText,fontSize:13}}>Sin ventas registradas</div>}
            </div>
          </div>
          <div>
            <div style={{fontWeight:500,marginBottom:10,fontSize:14}}>KPIs última semana</div>
            <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:16}}>
              {[["Contactados",lastKpi.contactados||0],["C. efectivos",lastKpi.contactados_efectivos||0],["R. agendadas",lastKpi.reuniones_agendadas||0],["R. efectivas",lastKpi.reuniones_efectivas||0],["Ticket promedio",fmt(lastKpi.ticket_promedio||0)]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.gray}`,fontSize:13}}>
                  <span style={{color:C.grayText}}>{k}</span><span style={{fontWeight:500}}>{v}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13}}>
                <span style={{color:C.grayText}}>Posible concreción</span><span style={{fontWeight:500,color:C.red}}>{fmt(lastKpi.posible_concrecion||0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const Ventas = () => {
    const list = user.role==="gerente" ? sales : mySales;
    const total = list.reduce((a,s)=>a+(s.total||0),0);
    return (
      <div style={{padding:"1.5rem",maxWidth:900}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:600}}>Ventas {user.role==="gerente"?"· Equipo":"· Mis Ventas"}</div>
          {user.role==="vendedor"&&<button onClick={()=>{initSaleForm();setShowSaleForm(true);}} style={{padding:"8px 18px",background:C.red,color:C.white,border:"none",borderRadius:8,cursor:"pointer",fontWeight:500}}>+ Nueva Venta</button>}
        </div>
        {user.role==="gerente"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
            <Stat label="Total ventas" value={list.length} color={C.red}/>
            <Stat label="Facturación total" value={fmt(total)}/>
            <Stat label="Ticket promedio" value={list.length?fmt(Math.round(total/list.length)):"-"}/>
            <Stat label="Vendedores activos" value={[...new Set(list.map(s=>s.ejecutivo))].length}/>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {list.map(s=><SaleCard key={s.id} sale={s} onClick={setModalSale}/>)}
          {!list.length&&<div style={{color:C.grayText,padding:"2rem",textAlign:"center",fontSize:14}}>Sin ventas registradas aún</div>}
        </div>
      </div>
    );
  };

  const KPIs = () => {
    if (user.role==="gerente") return (
      <div style={{padding:"1.5rem",maxWidth:960}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:600}}>KPIs del Equipo</div>
          <select value={kpiWeek} onChange={e=>setKpiWeek(Number(e.target.value))} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${C.grayMid}`,fontSize:13}}>
            {[0,1,2,3].map(w=><option key={w} value={w}>Semana {w+1}</option>)}
          </select>
        </div>
        {SELLERS.map(s=>{
          const k = myKpiData(s.id, kpiWeek);
          return (
            <div key={s.id} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,padding:"14px 20px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:11,fontWeight:600}}>{s.avatar}</div>
                <div style={{fontWeight:500}}>{s.name}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                {[["Contactados",k.contactados||0],["C. efectivos",k.contactados_efectivos||0],["R. agendadas",k.reuniones_agendadas||0],["R. efectivas",k.reuniones_efectivas||0],["Concreción",`${k.concrecion||0}%`],["Ticket promedio",fmt(k.ticket_promedio||0)],["Pos. concreción",fmt(k.posible_concrecion||0)],["Control calidad",k.control_calidad||"-"]].map(([lbl,v])=>(
                  <div key={lbl} style={{background:C.gray,borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:C.grayText,marginBottom:3}}>{lbl}</div>
                    <div style={{fontWeight:500,fontSize:13}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
    const cur = myKpiData(user.id, kpiWeek);
    const fields = [["contactados","Contactados"],["contactados_efectivos","Contactados efectivos"],["reuniones_agendadas","Reuniones agendadas"],["reuniones_efectivas","Reuniones efectivas"],["concrecion","Concreción (%)"],["ticket_promedio","Ticket promedio"],["posible_concrecion","Posible concreción"],["control_calidad","Control calidad"]];
    return (
      <div style={{padding:"1.5rem",maxWidth:700}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:600}}>Mis KPIs</div>
          <select value={kpiWeek} onChange={e=>{setKpiWeek(Number(e.target.value));setKpiForm({});}} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${C.grayMid}`,fontSize:13}}>
            {[0,1,2,3].map(w=><option key={w} value={w}>Semana {w+1}</option>)}
          </select>
        </div>
        <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,padding:20}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px",marginBottom:16}}>
            {fields.map(([f,lbl])=>(
              <Field key={f} label={lbl}>
                <input type={f==="control_calidad"?"text":"number"} value={kpiForm[f]!==undefined?kpiForm[f]:cur[f]||""} onChange={e=>setKpiForm(p=>({...p,[f]:e.target.value}))} style={inp} placeholder="0"/>
              </Field>
            ))}
          </div>
          <div style={{padding:"10px 12px",background:C.gray,borderRadius:8,fontSize:13,marginBottom:14}}>
            <span style={{color:C.grayText}}>% Contactos efectivos: </span>
            <strong>{pct(parseInt(kpiForm.contactados_efectivos||cur.contactados_efectivos)||0, parseInt(kpiForm.contactados||cur.contactados)||0)}%</strong>
          </div>
          <button onClick={saveKPI} style={{padding:"9px 20px",background:C.red,color:C.white,border:"none",borderRadius:8,cursor:"pointer",fontWeight:500}}>Guardar KPIs</button>
        </div>
      </div>
    );
  };

  const Disponibilidad = () => (
    <div style={{padding:"1.5rem",maxWidth:800}}>
      <div style={{fontSize:18,fontWeight:600,marginBottom:20}}>Disponibilidad de Productos</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {availability.map(a=>{
          const pctUsed = Math.round((a.used/a.total)*100);
          const color = pctUsed>=90?C.red:pctUsed>=60?"#E67E22":"#27AE60";
          return (
            <div key={a.producto} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontWeight:500,fontSize:13}}>{a.producto}</span>
                <span style={{fontSize:12,color:C.grayText}}>{a.used}/{a.total}</span>
              </div>
              <div style={{height:6,background:C.grayMid,borderRadius:3,overflow:"hidden",marginBottom:6}}>
                <div style={{height:"100%",width:`${pctUsed}%`,background:color,borderRadius:3}}/>
              </div>
              <div style={{fontSize:11,color,fontWeight:500}}>{pctUsed}% ocupado</div>
              {user.role==="gerente" && editAvail===a.producto ? (
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <input type="number" defaultValue={a.total} id={`t-${a.producto}`} style={{...inp,width:60}} placeholder="Total"/>
                  <input type="number" defaultValue={a.used} id={`u-${a.producto}`} style={{...inp,width:60}} placeholder="Usado"/>
                  <button onClick={()=>saveAvail(a.producto,parseInt(document.getElementById(`t-${a.producto}`).value)||a.total,parseInt(document.getElementById(`u-${a.producto}`).value)||a.used)} style={{padding:"4px 10px",background:C.red,color:C.white,border:"none",borderRadius:6,cursor:"pointer",fontSize:12}}>OK</button>
                  <button onClick={()=>setEditAvail(null)} style={{padding:"4px 8px",border:`1px solid ${C.grayMid}`,background:"none",borderRadius:6,cursor:"pointer",fontSize:12}}>×</button>
                </div>
              ) : user.role==="gerente" && (
                <button onClick={()=>setEditAvail(a.producto)} style={{marginTop:6,fontSize:11,color:C.red,background:"none",border:"none",cursor:"pointer",padding:0}}>Editar</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const Producciones = () => {
    const list = user.role==="vendedor" ? productions.filter(p=>p.ejecutivo===user.id) : productions;
    return (
      <div style={{padding:"1.5rem",maxWidth:800}}>
        <div style={{fontSize:18,fontWeight:600,marginBottom:20}}>{user.role==="marketing"?"Producciones a confirmar":user.role==="gerente"?"Producciones":"Mis Producciones"}</div>
        {!list.length&&<div style={{color:C.grayText,fontSize:13}}>No hay producciones pendientes</div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {list.map(p=>{
            const s = SELLERS.find(x=>x.id===p.ejecutivo);
            return (
              <div key={p.id} style={{background:C.white,border:`1px solid ${p.confirmado?"#27AE60":C.grayMid}`,borderRadius:10,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                  <div>
                    <div style={{fontWeight:500,fontSize:14}}>{p.cliente}</div>
                    <div style={{fontSize:12,color:C.grayText,marginTop:2}}>Ejecutivo: {s?.name} · Producción ×{p.produccion_q}</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    {p.confirmado?<span style={{background:"#e8f8f0",color:"#27AE60",padding:"4px 10px",borderRadius:12,fontSize:12,fontWeight:500}}>Confirmado</span>:<span style={{background:"#fff5e0",color:"#E67E22",padding:"4px 10px",borderRadius:12,fontSize:12,fontWeight:500}}>Pendiente</span>}
                    {(user.role==="marketing"||user.role==="vendedor")&&<input type="date" value={p.fecha||""} onChange={e=>updateProductionDate(p.id,e.target.value)} style={{...inp,width:145}}/>}
                    {user.role==="marketing"&&!p.confirmado&&<button onClick={()=>confirmProduction(p.id,p.fecha)} style={{padding:"6px 12px",background:C.red,color:C.white,border:"none",borderRadius:7,cursor:"pointer",fontSize:12}}>Confirmar</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {user.role==="marketing"&&(
          <div style={{marginTop:24}}>
            <div style={{fontWeight:500,marginBottom:12,fontSize:15}}>Calendario</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
              {["L","M","M","J","V","S","D"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:11,color:C.grayText,padding:"4px 0"}}>{d}</div>)}
              {Array.from({length:30},(_,i)=>{
                const day=i+1;
                const has=productions.some(p=>p.confirmado&&p.fecha&&new Date(p.fecha).getDate()===day);
                return <div key={i} style={{textAlign:"center",padding:"8px 2px",borderRadius:6,background:has?C.red:C.gray,color:has?C.white:C.black,fontSize:12}}>{day}</div>;
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const Social = () => (
    <div style={{padding:"1.5rem",maxWidth:900}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:18,fontWeight:600}}>Calendario de Redes Sociales</div>
        <button onClick={()=>setShowPostForm(true)} style={{padding:"8px 16px",background:C.red,color:C.white,border:"none",borderRadius:8,cursor:"pointer",fontWeight:500,fontSize:13}}>+ Nuevo Post</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {posts.map(p=>(
          <div key={p.id} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:"14px 16px",display:"flex",gap:14,alignItems:"flex-start"}}>
            <div style={{padding:"6px 10px",background:C.gray,borderRadius:8,fontSize:11,fontWeight:500,minWidth:80,textAlign:"center"}}>{p.fecha}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                <span style={{background:C.red,color:C.white,padding:"2px 8px",borderRadius:10,fontSize:11}}>{p.platform}</span>
                <span style={{background:p.status==="programado"?"#e8f8f0":C.gray,color:p.status==="programado"?"#27AE60":C.grayText,padding:"2px 8px",borderRadius:10,fontSize:11}}>{p.status}</span>
              </div>
              <div style={{fontSize:13}}>{p.content}</div>
            </div>
            <button onClick={()=>deletePost(p.id)} style={{border:"none",background:"none",color:C.grayText,cursor:"pointer",fontSize:18}}>×</button>
          </div>
        ))}
        {!posts.length&&<div style={{color:C.grayText,fontSize:13,textAlign:"center",padding:"2rem"}}>Sin posts programados</div>}
      </div>
      {showPostForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}} onClick={()=>setShowPostForm(false)}>
          <div style={{background:C.white,borderRadius:14,padding:"1.5rem",width:"100%",maxWidth:460}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:16}}>Nuevo Post</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Field label="Fecha"><input type="date" value={postForm.date} onChange={e=>setPostForm(f=>({...f,date:e.target.value}))} style={inp}/></Field>
              <Field label="Plataforma"><select value={postForm.platform} onChange={e=>setPostForm(f=>({...f,platform:e.target.value}))} style={inp}>{PLATFORMS.map(p=><option key={p}>{p}</option>)}</select></Field>
              <Field label="Contenido"><textarea value={postForm.content} onChange={e=>setPostForm(f=>({...f,content:e.target.value}))} style={{...inp,height:80,resize:"none"}}/></Field>
              <Field label="Estado"><select value={postForm.status} onChange={e=>setPostForm(f=>({...f,status:e.target.value}))} style={inp}><option value="borrador">Borrador</option><option value="programado">Programado</option><option value="publicado">Publicado</option></select></Field>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
              <button onClick={()=>setShowPostForm(false)} style={{padding:"7px 16px",border:`1px solid ${C.grayMid}`,borderRadius:7,background:"none",cursor:"pointer"}}>Cancelar</button>
              <button onClick={savePost} style={{padding:"7px 16px",background:C.red,color:C.white,border:"none",borderRadius:7,cursor:"pointer",fontWeight:500}}>Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const Facturacion = () => (
    <div style={{padding:"1.5rem",maxWidth:900}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:18,fontWeight:600}}>Facturación</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        <Stat label="Facturado total" value={fmt(invoices.reduce((a,i)=>a+(i.amount||0),0))} color={C.red}/>
        <Stat label="Pendiente cobro" value={fmt(invoices.filter(i=>i.status==="pendiente").reduce((a,i)=>a+(i.amount||0),0))} color="#E67E22"/>
        <Stat label="Facturas emitidas" value={invoices.length}/>
        <Stat label="Cobradas" value={invoices.filter(i=>i.status==="pagada").length}/>
      </div>
      <div style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:C.black,color:C.white}}>{["Folio","Cliente","Monto","Fecha","Estado"].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left",fontWeight:500}}>{h}</th>)}</tr></thead>
          <tbody>
            {invoices.map(inv=>(
              <tr key={inv.id} style={{borderBottom:`1px solid ${C.gray}`}}>
                <td style={{padding:"10px 16px",fontWeight:500,color:C.red}}>{inv.folio}</td>
                <td style={{padding:"10px 16px"}}>{inv.client}</td>
                <td style={{padding:"10px 16px",fontWeight:500}}>{fmt(inv.amount)}</td>
                <td style={{padding:"10px 16px",color:C.grayText}}>{inv.date}</td>
                <td style={{padding:"10px 16px"}}><span style={{background:inv.status==="pagada"?"#e8f8f0":"#fff5e0",color:inv.status==="pagada"?"#27AE60":"#E67E22",padding:"3px 10px",borderRadius:10,fontSize:11,fontWeight:500}}>{inv.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const Clientes = () => (
    <div style={{padding:"1.5rem",maxWidth:900}}>
      <div style={{fontSize:18,fontWeight:600,marginBottom:20}}>Clientes</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[...new Map(sales.map(s=>[s.inmobiliaria,s])).values()].map(s=>(
          <div key={s.id} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:500}}>{s.inmobiliaria}</div>
              <div style={{fontSize:12,color:C.grayText,marginTop:2}}>{s.razon_social} · {s.rut}</div>
              <div style={{fontSize:12,color:C.grayText}}>{s.mail} · {s.telefono}</div>
            </div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:500,color:C.red}}>{fmt(s.total)}</div><div style={{fontSize:11,color:C.grayText}}>{s.metodo_pago}</div></div>
          </div>
        ))}
      </div>
    </div>
  );

  const Reportes = () => (
    <div style={{padding:"1.5rem",maxWidth:900}}>
      <div style={{fontSize:18,fontWeight:600,marginBottom:20}}>Reportes</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        {["Ventas por período","Ventas por vendedor","Productos más vendidos","Clientes activos vs inactivos","Recaudación mensual","KPIs del equipo","Contratos a vencer","Tasa de renovación"].map(r=>(
          <div key={r} style={{background:C.white,border:`1px solid ${C.grayMid}`,borderRadius:10,padding:"16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.red}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.grayMid}>
            <span style={{fontSize:13,fontWeight:500}}>{r}</span>
            <span style={{color:C.red,fontSize:18}}>→</span>
          </div>
        ))}
      </div>
    </div>
  );

  const screenMap = { dashboard:<Dashboard/>, ventas:<Ventas/>, kpis:<KPIs/>, disponibilidad:<Disponibilidad/>, producciones:<Producciones/>, social:<Social/>, assets:<div style={{padding:"1.5rem"}}><div style={{fontSize:18,fontWeight:600,marginBottom:12}}>Assets</div><div style={{color:C.grayText}}>Módulo en desarrollo</div></div>, metricas:<div style={{padding:"1.5rem"}}><div style={{fontSize:18,fontWeight:600,marginBottom:12}}>Métricas</div><div style={{color:C.grayText}}>Módulo en desarrollo</div></div>, facturacion:<Facturacion/>, clientes:<Clientes/>, reportes:<Reportes/> };

  return (
    <div style={{minHeight:"100vh",background:C.gray,fontFamily:"system-ui,sans-serif"}}>
      <NavBar/>
      <div style={{minHeight:"calc(100vh - 52px)"}}>
        {loading ? <Spinner/> : screenMap[tab] || null}
      </div>
      {modalSale&&<SaleModal sale={modalSale} onClose={()=>setModalSale(null)}/>}
      {showSaleForm&&<SaleFormModal onClose={()=>setShowSaleForm(false)}/>}
    </div>
  );
}
