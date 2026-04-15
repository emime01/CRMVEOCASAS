import { useState } from "react";
import { C, fmt, USERS, pct } from "../constants";
import { Stat, Card, Btn, Badge, Field, BarChart, PieChart, Table, EmptyState } from "../components/UI";
import { inp } from "../components/UI";

const SELLERS_ALL = USERS.filter(u => ["vendedor","inactivo"].includes(u.role));
const getUser = id => USERS.find(u => u.id === id);

const currentQ = Math.ceil((new Date().getMonth()+1)/3);
const currentAnio = new Date().getFullYear();

function qRange(q, anio=currentAnio) {
  const s = new Date(anio,(q-1)*3,1).toISOString().split("T")[0];
  const e = new Date(anio,q*3,0).toISOString().split("T")[0];
  return [s,e];
}

export default function DashboardGeneral({ sales, invoices, objetivos, onNavigate }) {
  const [filterVendedor, setFilterVendedor] = useState("todos");
  const [filterQ, setFilterQ] = useState("todos");
  const [filterFechaInicio, setFilterFechaInicio] = useState("");
  const [filterFechaFin, setFilterFechaFin] = useState("");

  const active = sales.filter(s => s.estado !== "cancelada");

  // Apply filters
  const filtered = active.filter(s => {
    if (filterVendedor !== "todos" && s.ejecutivo !== filterVendedor) return false;
    if (filterQ !== "todos") {
      const q = parseInt(filterQ);
      const [qs,qe] = qRange(q);
      if (!s.fecha_inicio || s.fecha_inicio < qs || s.fecha_inicio > qe) return false;
    }
    if (filterFechaInicio && s.fecha_inicio < filterFechaInicio) return false;
    if (filterFechaFin && s.fecha_inicio > filterFechaFin) return false;
    return true;
  });

  const totalFac = filtered.reduce((a,s)=>a+(s.total||0),0);
  const now = new Date();
  const mesFac = filtered.filter(s=>{
    if (!s.fecha_inicio) return false;
    const d = new Date(s.fecha_inicio);
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  }).reduce((a,s)=>a+(s.total||0),0);
  const ticketProm = filtered.length ? Math.round(totalFac/filtered.length) : 0;

  // Facturación por Q (all 4 quarters current year)
  const qData = [1,2,3,4].map(q=>{
    const [qs,qe]=qRange(q);
    const v=active.filter(s=>s.fecha_inicio>=qs&&s.fecha_inicio<=qe).reduce((a,s)=>a+(s.total||0),0);
    return {label:`Q${q}`,value:v,highlight:q===currentQ};
  });

  // Ventas por vendedor
  const vendedorData = SELLERS_ALL.map(s=>{
    const sv=filtered.filter(v=>v.ejecutivo===s.id);
    const total=sv.reduce((a,v)=>a+(v.total||0),0);
    const obj=objetivos.find(o=>o.ejecutivo===s.id&&o.q===currentQ&&o.anio===currentAnio)?.objetivo||0;
    return {s,sv,total,obj};
  }).filter(d=>d.sv.length>0);

  const exportExcel = async () => {
    try {
      const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");
      const rows = filtered.map(s=>({
        Inmobiliaria:s.inmobiliaria, Ejecutivo:getUser(s.ejecutivo)?.name||s.ejecutivo,
        Plan:s.plan, CRM:s.crm, FechaInicio:s.fecha_inicio, FechaFin:s.fecha_fin,
        Total:s.total, Estado:s.estado, MetodoPago:s.metodo_pago,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,"Ventas",ws);
      XLSX.writeFile(wb,`veocasas-ventas-${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch(e){alert("Error al exportar: "+e.message);}
  };

  const clearFilters = () => {
    setFilterVendedor("todos");setFilterQ("todos");
    setFilterFechaInicio("");setFilterFechaFin("");
  };

  return (
    <div style={{padding:"1.5rem",maxWidth:1100}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:28,fontWeight:800,color:C.black}}>Dashboard General</div>
          <div style={{fontSize:14,color:C.gray500}}>Q{currentQ} · {currentAnio} · Vista ejecutiva</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={exportExcel}>📊 Exportar Excel</Btn>
          <Btn variant="primary" onClick={()=>onNavigate("ventas_ggeneral")}>Ver todas las ventas →</Btn>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20,padding:"12px 16px",background:C.white,borderRadius:12,border:`1px solid ${C.gray200}`}}>
        <select value={filterVendedor} onChange={e=>setFilterVendedor(e.target.value)} style={{...inp,width:"auto",padding:"7px 12px",fontSize:12}}>
          <option value="todos">Todos los vendedores</option>
          {SELLERS_ALL.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterQ} onChange={e=>setFilterQ(e.target.value)} style={{...inp,width:"auto",padding:"7px 12px",fontSize:12}}>
          <option value="todos">Todos los Q</option>
          {[1,2,3,4].map(q=><option key={q} value={q}>Q{q}</option>)}
        </select>
        <input type="date" value={filterFechaInicio} onChange={e=>setFilterFechaInicio(e.target.value)} style={{...inp,width:140,padding:"7px 10px",fontSize:12}}/>
        <span style={{alignSelf:"center",color:C.gray500,fontSize:12}}>→</span>
        <input type="date" value={filterFechaFin} onChange={e=>setFilterFechaFin(e.target.value)} style={{...inp,width:140,padding:"7px 10px",fontSize:12}}/>
        {(filterVendedor!=="todos"||filterQ!=="todos"||filterFechaInicio||filterFechaFin) && (
          <Btn size="sm" onClick={clearFilters}>✕ Limpiar</Btn>
        )}
      </div>

      {/* KPI Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(150px,100%),1fr))",gap:12,marginBottom:24}}>
        <Stat label="Ventas activas" value={filtered.length} color={C.red}/>
        <Stat label="Facturación total" value={fmt(totalFac)}/>
        <Stat label="Facturación este mes" value={fmt(mesFac)}/>
        <Stat label="Ticket promedio" value={fmt(ticketProm)}/>
      </div>

      {/* Charts row */}
      <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:16,marginBottom:24}}>
        <Card>
          <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:14}}>Facturación por trimestre — {currentAnio}</div>
          <BarChart data={qData} height={110}/>
        </Card>
        <Card>
          <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:12}}>Resumen</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[
              ["Ventas canceladas",sales.filter(s=>s.estado==="cancelada").length],
              ["Vendedores activos",[...new Set(filtered.map(s=>s.ejecutivo))].length],
              ["Inmobiliarias únicas",[...new Set(filtered.map(s=>s.inmobiliaria))].length],
              ["CRM más usado",(()=>{const c={};filtered.forEach(s=>{c[s.crm]=(c[s.crm]||0)+1;});return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";})()],
              ["Plan más vendido",(()=>{const c={};filtered.forEach(s=>{c[s.plan]=(c[s.plan]||0)+1;});return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";})()],
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.gray200}`,fontSize:13}}>
                <span style={{color:C.gray500}}>{k}</span>
                <span style={{fontWeight:600,color:C.black}}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Ventas por vendedor */}
      <div style={{marginBottom:24}}>
        <div style={{fontWeight:700,fontSize:15,color:C.black,marginBottom:12}}>Progreso por vendedor — Q{currentQ}</div>
        {vendedorData.length===0 && <div style={{color:C.gray500,fontSize:13}}>No hay ventas con los filtros actuales</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
          {vendedorData.map(({s,sv,total,obj})=>{
            const done = obj>0&&total>=obj;
            return (
              <Card key={s.id} style={{textAlign:"center",border:`1px solid ${done?C.green:C.gray200}`}}>
                <div style={{width:36,height:36,borderRadius:9,background:done?C.green:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:11,fontWeight:700,margin:"0 auto 8px"}}>{s.avatar}</div>
                <div style={{fontWeight:600,fontSize:13,color:C.black,marginBottom:6}}>{s.name}</div>
                <PieChart value={total} max={obj||total||1} label="" color={done?C.green:C.red} size={80}/>
                <div style={{fontSize:12,fontWeight:700,color:done?C.green:C.red,marginTop:6}}>{fmt(total)}</div>
                <div style={{fontSize:11,color:C.gray500}}>{sv.length} venta{sv.length!==1?"s":""}</div>
                {done&&<div style={{fontSize:11,color:C.green,fontWeight:600,marginTop:4}}>🎉 Meta cumplida</div>}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent sales table */}
      <div style={{fontWeight:700,fontSize:15,color:C.black,marginBottom:12}}>Últimas 10 ventas</div>
      <Table
        cols={[{key:"inm",label:"Inmobiliaria"},{key:"ven",label:"Vendedor"},{key:"plan",label:"Plan"},{key:"total",label:"Total"},{key:"fecha",label:"Fecha"},{key:"est",label:"Estado"}]}
        rows={filtered.slice(0,10).map(s=>({
          inm:<span style={{fontWeight:500}}>{s.inmobiliaria}</span>,
          ven:getUser(s.ejecutivo)?.name||s.ejecutivo,
          plan:s.plan,
          total:<span style={{fontWeight:700,color:C.red}}>{fmt(s.total)}</span>,
          fecha:s.fecha_inicio,
          est:<Badge color={s.estado==="activa"?"green":"gray"}>{s.estado||"activa"}</Badge>,
        }))}
        emptyMsg="Sin ventas con los filtros actuales"
      />
    </div>
  );
}
