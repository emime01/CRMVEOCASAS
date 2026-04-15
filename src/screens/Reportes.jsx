import { useState } from "react";
import { C, fmt, USERS, pct } from "../constants";
import { Card, Btn, Badge, BarChart, Table } from "../components/UI";
import { inp } from "../components/UI";

const SELLERS_ALL = USERS.filter(u => ["vendedor","inactivo"].includes(u.role));
const getUser = id => USERS.find(u => u.id === id);
const currentQ = Math.ceil((new Date().getMonth()+1)/3);
const currentAnio = new Date().getFullYear();

function qRange(q,anio=currentAnio){
  return [new Date(anio,(q-1)*3,1).toISOString().split("T")[0], new Date(anio,q*3,0).toISOString().split("T")[0]];
}

export default function Reportes({ sales }) {
  const [anio, setAnio] = useState(currentAnio);
  const [lastExport, setLastExport] = useState(null);

  const active = sales.filter(s=>s.estado!=="cancelada");

  // By vendedor
  const byVendedor = SELLERS_ALL.map(s=>{
    const sv=active.filter(v=>v.ejecutivo===s.id);
    return {
      name:s.name, avatar:s.avatar,
      ventas:sv.length,
      total:sv.reduce((a,v)=>a+(v.total||0),0),
      prom:sv.length?Math.round(sv.reduce((a,v)=>a+(v.total||0),0)/sv.length):0,
    };
  }).filter(d=>d.ventas>0).sort((a,b)=>b.total-a.total);

  // By Q
  const byQ = [1,2,3,4].map(q=>{
    const [qs,qe]=qRange(q,anio);
    const sv=active.filter(s=>s.fecha_inicio>=qs&&s.fecha_inicio<=qe);
    return {q,ventas:sv.length,total:sv.reduce((a,s)=>a+(s.total||0),0)};
  });

  // By product
  const byProduct = {};
  active.forEach(s=>{
    (s.productos_seleccionados||[]).forEach(p=>{
      if(!byProduct[p]) byProduct[p]={producto:p,ventas:0,total:0};
      byProduct[p].ventas++;
      byProduct[p].total+=s.total||0;
    });
  });
  const productRows = Object.values(byProduct).sort((a,b)=>b.ventas-a.ventas);

  // By plan
  const byPlan = {};
  active.forEach(s=>{
    const k=s.plan||"Sin plan";
    if(!byPlan[k]) byPlan[k]={plan:k,ventas:0,total:0};
    byPlan[k].ventas++;
    byPlan[k].total+=s.total||0;
  });
  const planRows = Object.values(byPlan).sort((a,b)=>b.ventas-a.ventas);

  const qChartData = byQ.map(d=>({label:`Q${d.q}`,value:d.total,highlight:d.q===currentQ}));

  const exportAll = async () => {
    try {
      const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");
      const wb = XLSX.utils.book_new();
      // Sheet 1: por vendedor
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byVendedor.map(d=>({Vendedor:d.name,Ventas:d.ventas,Total:d.total,TicketProm:d.prom}))), "Por Vendedor");
      // Sheet 2: por Q
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byQ.map(d=>({Q:`Q${d.q}`,Ventas:d.ventas,Total:d.total}))), "Por Q");
      // Sheet 3: por producto
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), "Por Producto");
      // Sheet 4: todas las ventas
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(active.map(s=>({
        Inmobiliaria:s.inmobiliaria, Ejecutivo:getUser(s.ejecutivo)?.name||s.ejecutivo,
        Plan:s.plan, CRM:s.crm, Inicio:s.fecha_inicio, Fin:s.fecha_fin, Total:s.total, MetodoPago:s.metodo_pago
      }))), "Ventas Completas");
      XLSX.writeFile(wb, `reporte-veocasas-${new Date().toISOString().slice(0,10)}.xlsx`);
      setLastExport(new Date().toLocaleString("es-UY"));
    } catch(e){alert("Error: "+e.message);}
  };

  const exportCSV = () => {
    const rows = [
      ["Inmobiliaria","Ejecutivo","Plan","CRM","Inicio","Fin","Total","Estado","MetodoPago"],
      ...active.map(s=>[s.inmobiliaria,getUser(s.ejecutivo)?.name||s.ejecutivo,s.plan,s.crm,s.fecha_inicio,s.fecha_fin,s.total,s.estado||"activa",s.metodo_pago])
    ];
    const csv = rows.map(r=>r.map(v=>`"${v??""}`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
    a.download = `ventas-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    setLastExport(new Date().toLocaleString("es-UY"));
  };

  return (
    <div style={{padding:"1.5rem",maxWidth:1000}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:C.black}}>Reportes</div>
          {lastExport && <div style={{fontSize:11,color:C.gray500,marginTop:2}}>Último export: {lastExport}</div>}
          <div style={{fontSize:12,color:C.gray500,marginTop:4}}>Para sync automático con Drive, configurar Google Apps Script.</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn onClick={exportCSV}>📄 Exportar CSV</Btn>
          <Btn variant="primary" onClick={exportAll}>📊 Exportar Excel completo</Btn>
        </div>
      </div>

      {/* Q chart */}
      <Card style={{marginBottom:20}}>
        <div style={{fontWeight:600,fontSize:13,color:C.gray700,marginBottom:14}}>Facturación por trimestre — {currentAnio}</div>
        <BarChart data={qChartData} height={100}/>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(280px,100%),1fr))",gap:16,marginBottom:20}}>
        {/* By vendedor */}
        <div>
          <div style={{fontWeight:700,fontSize:14,color:C.black,marginBottom:10}}>Por vendedor</div>
          <Table
            cols={[{key:"ven",label:"Vendedor"},{key:"v",label:"Ventas"},{key:"total",label:"Total"}]}
            rows={byVendedor.map(d=>({
              ven:<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:24,height:24,borderRadius:6,background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:9,fontWeight:700}}>{d.avatar}</div><span style={{fontWeight:500,fontSize:13}}>{d.name}</span></div>,
              v:d.ventas,
              total:<span style={{fontWeight:700,color:C.red}}>{fmt(d.total)}</span>,
            }))}
          />
        </div>
        {/* By Q */}
        <div>
          <div style={{fontWeight:700,fontSize:14,color:C.black,marginBottom:10}}>Por trimestre</div>
          <Table
            cols={[{key:"q",label:"Q"},{key:"v",label:"Ventas"},{key:"total",label:"Total"}]}
            rows={byQ.map(d=>({
              q:<span style={{fontWeight:600,color:d.q===currentQ?C.red:C.black}}>Q{d.q}{d.q===currentQ?" ●":""}</span>,
              v:d.ventas,
              total:<span style={{fontWeight:700}}>{fmt(d.total)}</span>,
            }))}
          />
        </div>
      </div>

      {productRows.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,color:C.black,marginBottom:10}}>Por producto</div>
          <Table
            cols={[{key:"p",label:"Producto"},{key:"v",label:"Ventas"},{key:"total",label:"Total acum."}]}
            rows={productRows.map(d=>({p:d.producto,v:d.ventas,total:fmt(d.total)}))}
          />
        </div>
      )}

      {planRows.length>0&&(
        <div>
          <div style={{fontWeight:700,fontSize:14,color:C.black,marginBottom:10}}>Por plan</div>
          <Table
            cols={[{key:"p",label:"Plan"},{key:"v",label:"Ventas"},{key:"total",label:"Total acum."}]}
            rows={planRows.map(d=>({p:d.plan,v:d.ventas,total:fmt(d.total)}))}
          />
        </div>
      )}
    </div>
  );
}
