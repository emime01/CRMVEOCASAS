import { useState } from "react";
import { C, fmt, daysUntil, USERS, calcCuotas } from "../constants";
import { Stat, Card, Btn, Badge, Field, inp, Modal, ModalHeader, ModalBody, ModalFooter, Table, EmptyState } from "../components/UI";

const getUser = id => USERS.find(u=>u.id===id);

export default function Facturacion({ sales, invoices, onUpdateInvoice, onAddInvoice, onUpdateSaleFacturado }) {
  const [tab, setTab] = useState("ventas");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({folio:"",client:"",amount:0,date:"",status:"pendiente",vencimiento:""});
  const [filter, setFilter] = useState("todas");
  const now = new Date();
  const mes = now.getMonth()+1;
  const anio = now.getFullYear();

  // Ventas con estado de facturación
  const ventasConEstado = sales.map(s=>{
    const cuotas = calcCuotas(s);
    const cuotasMes = cuotas.filter(c=>{
      const f=new Date(c.fecha);
      return f.getMonth()+1===mes && f.getFullYear()===anio;
    });
    return {...s, cuotas, cuotasMes};
  });

  const filtradas = ventasConEstado.filter(s=>{
    if(filter==="pendiente") return !s.facturado;
    if(filter==="facturado") return s.facturado;
    if(filter==="cuotas") return (s.num_cuotas||1)>1;
    return true;
  });

  const pendientes = sales.filter(s=>!s.facturado&&s.estado!=="cancelada").length;
  const totalPendiente = sales.filter(s=>!s.facturado&&s.estado!=="cancelada").reduce((a,s)=>a+s.total,0);

  // Cuotas que vencen este mes (para recordatorio)
  const cuotasMes = [];
  sales.forEach(s=>{
    if((s.num_cuotas||1)<=1) return;
    calcCuotas(s).forEach(c=>{
      const f=new Date(c.fecha);
      if(f.getMonth()+1===mes&&f.getFullYear()===anio){
        cuotasMes.push({...c,venta:s,seller:getUser(s.ejecutivo)?.name});
      }
    });
  });

  const exportExcel = async () => {
    try {
      const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");
      const data = filtradas.map(s=>({
        Inmobiliaria:s.inmobiliaria, RUT:s.rut,
        Ejecutivo:getUser(s.ejecutivo)?.name,
        Total:s.total, "Método":s.metodo_pago,
        Cuotas:s.num_cuotas||1,
        Facturado:s.facturado?"Sí":"No",
        "Nº Factura":s.nro_factura||"",
        "Fecha inicio":s.fecha_inicio, "Fecha fin":s.fecha_fin,
      }));
      const ws=XLSX.utils.json_to_sheet(data);
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,"Ventas");
      XLSX.writeFile(wb,"facturacion-veocasas.xlsx");
    } catch(e) { alert("Error al exportar: "+e.message); }
  };

  const exportPDF = async () => {
    try {
      const script1 = document.createElement("script");
      script1.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      document.head.appendChild(script1);
      await new Promise(r=>script1.onload=r);
      const script2 = document.createElement("script");
      script2.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js";
      document.head.appendChild(script2);
      await new Promise(r=>script2.onload=r);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text("Facturación — Veocasas",14,20);
      doc.setFontSize(10); doc.text(`Generado: ${new Date().toLocaleDateString("es-CL")}`,14,28);
      doc.autoTable({
        head:[["Inmobiliaria","Ejecutivo","Total","Cuotas","Facturado","Nº Fact."]],
        body:filtradas.map(s=>[s.inmobiliaria,getUser(s.ejecutivo)?.name||"",fmt(s.total),s.num_cuotas||1,s.facturado?"Sí":"No",s.nro_factura||"-"]),
        startY:34,styles:{fontSize:9},headStyles:{fillColor:[192,0,26]},
      });
      doc.save("facturacion-veocasas.pdf");
    } catch(e) { alert("Error al generar PDF: "+e.message); }
  };

  const tabs = [
    {id:"ventas",label:"Ventas"},
    {id:"cuotas_mes",label:`Cuotas ${mes}/${anio} (${cuotasMes.length})`},
    {id:"facturas",label:"Facturas emitidas"},
  ];

  return (
    <div style={{padding:"1.5rem",maxWidth:1000}}>
      {showForm&&(
        <Modal onClose={()=>setShowForm(false)} maxWidth={480}>
          <ModalHeader title="Nueva Factura" onClose={()=>setShowForm(false)}/>
          <ModalBody>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px"}}>
              <Field label="Folio"><input value={form.folio} onChange={e=>setForm(f=>({...f,folio:e.target.value}))} style={inp} placeholder="F-400"/></Field>
              <Field label="Cliente"><input value={form.client} onChange={e=>setForm(f=>({...f,client:e.target.value}))} style={inp}/></Field>
              <Field label="Monto"><input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:parseFloat(e.target.value)||0}))} style={inp}/></Field>
              <Field label="Estado">
                <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={inp}>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagada">Pagada</option>
                  <option value="vencida">Vencida</option>
                </select>
              </Field>
              <Field label="Fecha emisión"><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inp}/></Field>
              <Field label="Fecha vencimiento"><input type="date" value={form.vencimiento} onChange={e=>setForm(f=>({...f,vencimiento:e.target.value}))} style={inp}/></Field>
            </div>
          </ModalBody>
          <ModalFooter>
            <Btn onClick={()=>setShowForm(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={()=>{onAddInvoice(form);setShowForm(false);setForm({folio:"",client:"",amount:0,date:"",status:"pendiente",vencimiento:""});}}>Guardar</Btn>
          </ModalFooter>
        </Modal>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:C.gray900}}>Facturación</div>
          <div style={{fontSize:13,color:C.gray400,marginTop:2}}>Gestión de ventas y facturas</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn onClick={exportExcel}>📊 Excel</Btn>
          <Btn onClick={exportPDF}>📄 PDF</Btn>
          <Btn variant="primary" onClick={()=>setShowForm(true)}>+ Factura</Btn>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        <Stat label="Ventas totales" value={sales.filter(s=>s.estado!=="cancelada").length} color={C.red}/>
        <Stat label="Pendiente facturar" value={pendientes} color={pendientes>0?C.amber:C.green} alert={pendientes>0}/>
        <Stat label="Monto pendiente" value={fmt(totalPendiente)} color={C.amber}/>
        <Stat label="Cuotas este mes" value={cuotasMes.length} sub={`${mes}/${anio}`}/>
      </div>

      {/* Tabs */}
      <div style={{borderBottom:`1.5px solid ${C.gray200}`,marginBottom:16,display:"flex",gap:4}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 16px",border:"none",background:"none",fontSize:13,fontWeight:tab===t.id?600:400,color:tab===t.id?C.red:C.gray500,borderBottom:`2px solid ${tab===t.id?C.red:"transparent"}`,cursor:"pointer"}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==="ventas"&&(
        <>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            {[{k:"todas",l:"Todas"},{k:"pendiente",l:`Pendientes (${pendientes})`},{k:"facturado",l:"Facturadas"},{k:"cuotas",l:"En cuotas"}].map(f=>(
              <button key={f.k} onClick={()=>setFilter(f.k)} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${filter===f.k?C.red:C.gray200}`,background:filter===f.k?C.redLight:C.white,color:filter===f.k?C.red:C.gray600,fontSize:12,fontWeight:filter===f.k?500:400,cursor:"pointer"}}>
                {f.l}
              </button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filtradas.map(s=>(
              <Card key={s.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontWeight:600,fontSize:13,color:C.gray900}}>{s.inmobiliaria}</span>
                      {s.facturado
                        ? <Badge color="green">Facturado {s.nro_factura?`· F-${s.nro_factura}`:""}</Badge>
                        : <Badge color="amber">Pendiente factura</Badge>}
                      {(s.num_cuotas||1)>1&&<Badge color="blue">{s.num_cuotas} cuotas</Badge>}
                      {s.estado==="cancelada"&&<Badge color="gray">Cancelada</Badge>}
                    </div>
                    <div style={{fontSize:11,color:C.gray400,marginTop:3}}>
                      {getUser(s.ejecutivo)?.name} · {s.metodo_pago} · {s.fecha_inicio} → {s.fecha_fin}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontWeight:700,color:C.gray900,fontSize:14}}>{fmt(s.total)}</span>
                    <select
                      value={s.facturado?"facturado":"pendiente"}
                      onChange={e=>onUpdateSaleFacturado(s.id, e.target.value==="facturado")}
                      onClick={e=>e.stopPropagation()}
                      style={{...inp,width:"auto",padding:"5px 10px",fontSize:12}}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="facturado">Facturado</option>
                    </select>
                  </div>
                </div>
              </Card>
            ))}
            {!filtradas.length&&<EmptyState icon="🧾" title="Sin ventas" desc="No hay ventas con este filtro"/>}
          </div>
        </>
      )}

      {tab==="cuotas_mes"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {cuotasMes.length===0&&<EmptyState icon="📅" title="Sin cuotas" desc={`No hay cuotas programadas para ${mes}/${anio}`}/>}
          {cuotasMes.map((c,i)=>(
            <Card key={i}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13,color:C.gray900}}>{c.venta.inmobiliaria}</div>
                  <div style={{fontSize:11,color:C.gray400,marginTop:2}}>
                    {c.seller} · Cuota {c.numero} de {c.venta.num_cuotas} · Vence: {c.fecha}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontWeight:700,fontSize:14,color:C.red}}>{fmt(c.monto)}</span>
                  <Badge color={c.pagada?"green":"amber"}>{c.pagada?"Pagada":"Pendiente"}</Badge>
                </div>
              </div>
            </Card>
          ))}
          <div style={{padding:"12px 0",borderTop:`1px solid ${C.gray200}`,display:"flex",justifyContent:"flex-end",gap:4,fontSize:13,color:C.gray500}}>
            Total a facturar este mes:
            <strong style={{color:C.gray900,marginLeft:4}}>{fmt(cuotasMes.reduce((a,c)=>a+c.monto,0))}</strong>
          </div>
        </div>
      )}

      {tab==="facturas"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
            <Stat label="Emitidas" value={invoices.length}/>
            <Stat label="Cobradas" value={invoices.filter(i=>i.status==="pagada").length} color={C.green}/>
            <Stat label="Pendientes" value={invoices.filter(i=>i.status==="pendiente").length} color={C.amber}/>
            <Stat label="Total cobrado" value={fmt(invoices.filter(i=>i.status==="pagada").reduce((a,i)=>a+(i.amount||0),0))} color={C.green}/>
          </div>
          <Table
            cols={[
              {key:"folio",label:"Folio"},{key:"client",label:"Cliente"},
              {key:"monto",label:"Monto"},{key:"fecha",label:"Fecha"},
              {key:"venc",label:"Vencimiento"},{key:"estado",label:"Estado"},{key:"accion",label:"Acción"}
            ]}
            rows={invoices.map(inv=>({
              folio:<span style={{fontWeight:600,color:C.red}}>{inv.folio}</span>,
              client:inv.client,
              monto:<span style={{fontWeight:600}}>{fmt(inv.amount)}</span>,
              fecha:inv.date,
              venc:inv.vencimiento?(
                <span style={{color:daysUntil(inv.vencimiento)<=7?C.red:daysUntil(inv.vencimiento)<=30?C.amber:C.gray600}}>
                  {inv.vencimiento}
                </span>
              ):"-",
              estado:<Badge color={inv.status==="pagada"?"green":inv.status==="vencida"?"red":"amber"}>{inv.status}</Badge>,
              accion:(
                <select value={inv.status} onChange={e=>onUpdateInvoice(inv.id,{status:e.target.value})}
                  style={{...inp,width:"auto",padding:"4px 8px",fontSize:11}}>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagada">Pagada</option>
                  <option value="vencida">Vencida</option>
                </select>
              ),
            }))}
            emptyMsg="Sin facturas emitidas"
          />
        </>
      )}
    </div>
  );
}
