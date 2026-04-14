import { useState } from "react";
import { C, fmt, USERS, CRMS, PLANES } from "../constants";
import { Card, Btn, Badge, Field, Table, EmptyState, inp } from "../components/UI";
import { SaleDetailModal } from "../components/SaleCard";
import { updateItem, deleteItem } from "../firebase";

const SELLERS_ALL = USERS.filter(u => ["vendedor","inactivo"].includes(u.role));
const getUser = id => USERS.find(u => u.id === id);
const currentQ = Math.ceil((new Date().getMonth()+1)/3);
const currentAnio = new Date().getFullYear();

function qRange(q,anio=currentAnio){const s=new Date(anio,(q-1)*3,1).toISOString().split("T")[0];const e=new Date(anio,q*3,0).toISOString().split("T")[0];return[s,e];}

export default function VentasGeneral({ sales, setSales, invoices, initialFilters={} }) {
  const [filterVendedor, setFilterVendedor] = useState(initialFilters.vendedor||"todos");
  const [filterEstado, setFilterEstado] = useState("activas");
  const [filterQ, setFilterQ] = useState(initialFilters.q||"todos");
  const [filterPlan, setFilterPlan] = useState("todos");
  const [filterCrm, setFilterCrm] = useState("todos");
  const [filterFechaI, setFilterFechaI] = useState("");
  const [filterFechaF, setFilterFechaF] = useState("");
  const [detailSale, setDetailSale] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE = 20;

  const base = sales.filter(s => {
    if (filterEstado==="activas"&&s.estado==="cancelada") return false;
    if (filterEstado==="canceladas"&&s.estado!=="cancelada") return false;
    if (filterVendedor!=="todos"&&s.ejecutivo!==filterVendedor) return false;
    if (filterPlan!=="todos"&&s.plan!==filterPlan) return false;
    if (filterCrm!=="todos"&&s.crm!==filterCrm) return false;
    if (filterQ!=="todos"){const[qs,qe]=qRange(parseInt(filterQ));if(!s.fecha_inicio||s.fecha_inicio<qs||s.fecha_inicio>qe)return false;}
    if (filterFechaI&&s.fecha_inicio<filterFechaI) return false;
    if (filterFechaF&&s.fecha_inicio>filterFechaF) return false;
    return true;
  });

  const totalFac = base.reduce((a,s)=>a+(s.total||0),0);
  const paginated = base.slice(page*PAGE,(page+1)*PAGE);
  const pages = Math.ceil(base.length/PAGE);

  const exportExcel = async () => {
    try {
      const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");
      const rows = base.map(s=>({
        Inmobiliaria:s.inmobiliaria, "Razón Social":s.razon_social, RUT:s.rut,
        Ejecutivo:getUser(s.ejecutivo)?.name||s.ejecutivo,
        Plan:s.plan, CRM:s.crm, "Fecha inicio":s.fecha_inicio, "Fecha fin":s.fecha_fin,
        "Subtotal s/IVA":s.subtotal, "Total c/IVA":s.total, Estado:s.estado,
        "Método de pago":s.metodo_pago, Cuotas:s.num_cuotas,
        "Cuotas pagadas":s.cuotas_pagadas||0,
      }));
      const ws=XLSX.utils.json_to_sheet(rows);
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,"Ventas",ws);
      XLSX.writeFile(wb,`ventas-${new Date().toISOString().slice(0,10)}.xlsx`);
    }catch(e){alert("Error exportando: "+e.message);}
  };

  const handleCancel = async (sale) => {
    if (!window.confirm(`¿Cancelar la venta de ${sale.inmobiliaria}?`)) return;
    await updateItem("ventas",sale.id,{estado:"cancelada"});
    setSales(prev=>prev.map(s=>s.id===sale.id?{...s,estado:"cancelada"}:s));
    setDetailSale(null);
  };

  return (
    <div style={{padding:"1.5rem",maxWidth:1200}}>
      {detailSale && (
        <SaleDetailModal sale={detailSale} onClose={()=>setDetailSale(null)}
          isGerente={true} isAdmin={false}
          canEdit={false}
          onEdit={()=>{}}
          onDelete={handleCancel}
          onApprove={()=>{}}
          onReject={()=>{}}/>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div style={{fontSize:20,fontWeight:800,color:C.black}}>
          Ventas — <span style={{color:C.gray500,fontWeight:500,fontSize:15}}>{base.length} resultados · {fmt(totalFac)}</span>
        </div>
        <Btn onClick={exportExcel}>📊 Exportar Excel</Btn>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        <select value={filterVendedor} onChange={e=>{setFilterVendedor(e.target.value);setPage(0);}} style={{...inp,width:"auto",padding:"7px 10px",fontSize:12}}>
          <option value="todos">Todos los vendedores</option>
          {SELLERS_ALL.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterEstado} onChange={e=>{setFilterEstado(e.target.value);setPage(0);}} style={{...inp,width:"auto",padding:"7px 10px",fontSize:12}}>
          <option value="todas">Todas</option>
          <option value="activas">Activas</option>
          <option value="canceladas">Canceladas</option>
        </select>
        <select value={filterQ} onChange={e=>{setFilterQ(e.target.value);setPage(0);}} style={{...inp,width:"auto",padding:"7px 10px",fontSize:12}}>
          <option value="todos">Todos los Q</option>
          {[1,2,3,4].map(q=><option key={q} value={q}>Q{q}</option>)}
        </select>
        <select value={filterPlan} onChange={e=>{setFilterPlan(e.target.value);setPage(0);}} style={{...inp,width:"auto",padding:"7px 10px",fontSize:12}}>
          <option value="todos">Todos los planes</option>
          {PLANES.map(p=><option key={p}>{p}</option>)}
        </select>
        <select value={filterCrm} onChange={e=>{setFilterCrm(e.target.value);setPage(0);}} style={{...inp,width:"auto",padding:"7px 10px",fontSize:12}}>
          <option value="todos">Todos los CRM</option>
          {CRMS.map(c=><option key={c}>{c}</option>)}
        </select>
        <input type="date" value={filterFechaI} onChange={e=>{setFilterFechaI(e.target.value);setPage(0);}} style={{...inp,width:130,padding:"7px 8px",fontSize:12}}/>
        <input type="date" value={filterFechaF} onChange={e=>{setFilterFechaF(e.target.value);setPage(0);}} style={{...inp,width:130,padding:"7px 8px",fontSize:12}}/>
      </div>

      {base.length===0
        ? <EmptyState icon="📋" title="Sin ventas" desc="No hay resultados con los filtros actuales"/>
        : (
          <>
            <Table
              cols={[{key:"inm",label:"Inmobiliaria"},{key:"ven",label:"Vendedor"},{key:"plan",label:"Plan"},{key:"crm",label:"CRM"},{key:"total",label:"Total"},{key:"fi",label:"Inicio"},{key:"ff",label:"Fin"},{key:"pago",label:"Pago"},{key:"est",label:"Estado"}]}
              rows={paginated.map(s=>({
                inm:<span style={{fontWeight:600,cursor:"pointer",color:C.black}} onClick={()=>setDetailSale(s)}>{s.inmobiliaria}</span>,
                ven:getUser(s.ejecutivo)?.name||s.ejecutivo,
                plan:s.plan, crm:s.crm,
                total:<span style={{fontWeight:700,color:C.red}}>{fmt(s.total)}</span>,
                fi:s.fecha_inicio, ff:s.fecha_fin,
                pago:s.metodo_pago,
                est:<Badge color={s.estado==="activa"||!s.estado?"green":"gray"}>{s.estado||"activa"}</Badge>,
              }))}
            />
            {pages>1&&(
              <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:16}}>
                <Btn size="sm" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>←</Btn>
                <span style={{fontSize:13,color:C.gray500,alignSelf:"center"}}>{page+1} / {pages}</span>
                <Btn size="sm" onClick={()=>setPage(p=>Math.min(pages-1,p+1))} disabled={page>=pages-1}>→</Btn>
              </div>
            )}
          </>
        )
      }
    </div>
  );
}
