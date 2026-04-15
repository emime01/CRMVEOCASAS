import { useState } from "react";
import { C, fmt, USERS, CRMS, calcComisionMensual } from "../constants";
import { Stat, Card, Btn, Badge, Table, Field, inp, Modal, ModalHeader, ModalBody, ModalFooter } from "../components/UI";

const SELLERS_ALL = USERS.filter(u=>["vendedor","inactivo"].includes(u.role));

export default function Comisiones({ sales, comisiones, onUpdateComision, currentUser }) {
  const [editando, setEditando] = useState(null);
  const [tempPct, setTempPct] = useState("");
  const isGerente = currentUser.role==="gerente";
  const isAdmin = currentUser.role==="admin";
  const now = new Date();
  const mesActual = now.getMonth()+1;
  const anioActual = now.getFullYear();

  // Ventas activas del mes actual (por fecha_venta)
  const ventasActivas = sales.filter(s=>s.estado!=="cancelada");

  // Calcular comisión de un vendedor en el mes actual
  const calcComisionVendedor = (uid) => {
    const pct = comisiones?.vendedores?.[uid] || 0;
    // Ventas donde este vendedor tiene cuotas este mes
    return ventasActivas
      .filter(s=>s.ejecutivo===uid)
      .reduce((acc, venta) => {
        const cuotasMes = getCuotasDelMes(venta, mesActual, anioActual);
        return acc + cuotasMes * (pct/100);
      }, 0);
  };

  const getCuotasDelMes = (venta, mes, anio) => {
    if(!venta.fecha_inicio) return venta.total;
    const nc = venta.num_cuotas||1;
    const montoCuota = venta.total/nc;
    // Verificar si hay cuota en este mes
    for(let i=0;i<nc;i++){
      const f=new Date(venta.fecha_inicio);
      f.setMonth(f.getMonth()+i);
      if(f.getMonth()+1===mes && f.getFullYear()===anio) return montoCuota;
    }
    return 0;
  };

  // Comisión gerente = % sobre total facturado mes
  const totalFacMes = ventasActivas.reduce((a,s)=>{
    return a + getCuotasDelMes(s, mesActual, anioActual);
  }, 0);
  const comisionGerente = Math.round(totalFacMes * ((comisiones?.gerente||0)/100));

  // Comisión CRM global (legado)
  const totalFacturado = ventasActivas.reduce((a,s)=>a+s.total,0);
  const comisionCRM = Math.round(totalFacturado * ((comisiones?.crm||0)/100));

  // Comisiones por CRM (por_crm object)
  const porCrm = comisiones?.por_crm || {};
  const crmComisiones = CRMS.map(crm => {
    const pct = porCrm[crm] || 0;
    const ventasCrm = ventasActivas.filter(s => s.crm === crm);
    const totalCrm = ventasCrm.reduce((a,s)=>a+s.total,0);
    const comision = Math.round(totalCrm * (pct/100));
    return { crm, pct, totalCrm, comision, ventas: ventasCrm.length };
  });
  const totalComisionesCrm = crmComisiones.reduce((a,x)=>a+x.comision,0);

  const handleSave = () => {
    const pct = parseFloat(tempPct)||0;
    onUpdateComision(editando.key, pct);
    setEditando(null);
  };

  const EditModal = () => editando ? (
    <Modal onClose={()=>setEditando(null)} maxWidth={360}>
      <ModalHeader title={`Ajustar comisión — ${editando.label}`} onClose={()=>setEditando(null)}/>
      <ModalBody>
        <Field label="Porcentaje (%)">
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <input type="text" inputMode="decimal" value={tempPct} onChange={e=>setTempPct(e.target.value.replace(/[^\d.]/g,""))} style={{...inp,width:100}} placeholder="0.0"/>
            <span style={{fontSize:14,color:C.gray500}}>%</span>
          </div>
        </Field>
        <div style={{marginTop:12,padding:12,background:C.gray50,borderRadius:8,fontSize:12,color:C.gray600}}>
          Con este porcentaje, la comisión del mes sería:
          <div style={{fontSize:16,fontWeight:700,color:C.red,marginTop:4}}>
            {fmt(Math.round(editando.base * ((parseFloat(tempPct)||0)/100)))}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Btn onClick={()=>setEditando(null)}>Cancelar</Btn>
        <Btn variant="primary" onClick={handleSave}>Guardar</Btn>
      </ModalFooter>
    </Modal>
  ) : null;

  // Vista vendedor
  if(currentUser.role==="vendedor"){
    const uid = currentUser.id;
    const pct = comisiones?.vendedores?.[uid]||0;
    const ventasPropias = ventasActivas.filter(s=>s.ejecutivo===uid);

    const detalleComisiones = ventasPropias.map(v=>{
      const cuota = getCuotasDelMes(v, mesActual, anioActual);
      const com = Math.round(cuota*(pct/100));
      return { venta:v, cuota, comision:com };
    }).filter(x=>x.cuota>0);

    const totalCom = detalleComisiones.reduce((a,x)=>a+x.comision,0);
    const totalAcum = ventasPropias.reduce((a,v)=>a+Math.round((v.total/((v.num_cuotas||1)))*(pct/100)),0);

    return (
      <div style={{padding:"1.5rem",maxWidth:800}}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:20,fontWeight:800,color:C.black}}>Mis Comisiones</div>
          <div style={{fontSize:13,color:C.gray400,marginTop:4}}>{mesActual}/{anioActual} · {pct}% por venta</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(160px,100%),1fr))",gap:12,marginBottom:24}}>
          <Stat label="Comisión este mes" value={fmt(totalCom)} color={C.red}/>
          <Stat label="Ventas activas" value={ventasPropias.length}/>
          <Stat label="% asignado" value={`${pct}%`} sub="sobre ventas mensualiz."/>
        </div>
        {pct===0&&(
          <div style={{padding:16,background:C.amberLight,borderRadius:10,fontSize:13,color:C.amber,marginBottom:16}}>
            Tu porcentaje de comisión aún no fue configurado. Consultá con Mika.
          </div>
        )}
        <div style={{fontWeight:600,fontSize:14,color:C.gray700,marginBottom:12}}>Detalle del mes</div>
        {detalleComisiones.length===0?(
          <div style={{color:C.gray400,fontSize:13,padding:"2rem",textAlign:"center"}}>Sin comisiones este mes</div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {detalleComisiones.map(({venta,cuota,comision})=>(
              <Card key={venta.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:C.gray900}}>{venta.inmobiliaria}</div>
                    <div style={{fontSize:11,color:C.gray400,marginTop:2}}>Cuota del mes: {fmt(cuota)} · {venta.num_cuotas>1?`${venta.num_cuotas} cuotas`:"Contado"}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:700,color:C.green,fontSize:15}}>{fmt(comision)}</div>
                    <div style={{fontSize:10,color:C.gray400}}>{pct}% de {fmt(cuota)}</div>
                  </div>
                </div>
              </Card>
            ))}
            <div style={{display:"flex",justifyContent:"flex-end",padding:"12px 0",borderTop:`2px solid ${C.gray200}`,marginTop:4}}>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,color:C.gray400}}>Total comisión este mes</div>
                <div style={{fontSize:20,fontWeight:700,color:C.green}}>{fmt(totalCom)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Vista gerente/admin
  const vendedoresRows = SELLERS_ALL.map(s=>{
    const pct = comisiones?.vendedores?.[s.id]||0;
    const com = calcComisionVendedor(s.id);
    const totalAnual = ventasActivas.filter(v=>v.ejecutivo===s.id).reduce((a,v)=>a+v.total,0);
    return {
      vendedor:<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:28,borderRadius:"50%",background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:10,fontWeight:600}}>{s.avatar}</div><span style={{fontWeight:500}}>{s.name}</span></div>,
      porcentaje:<div style={{display:"flex",alignItems:"center",gap:8}}><Badge color={pct>0?"green":"gray"}>{pct}%</Badge>{isGerente&&<Btn size="sm" variant="ghost" onClick={()=>{setEditando({key:`vendedor_${s.id}`,label:s.name,base:totalFacMes});setTempPct(String(pct));}}>Ajustar</Btn>}</div>,
      comision_mes:<span style={{fontWeight:600,color:C.green}}>{fmt(com)}</span>,
      total_ventas:fmt(totalAnual),
      ventas:ventasActivas.filter(v=>v.ejecutivo===s.id).length,
    };
  });

  const totalComisiones = SELLERS_ALL.reduce((a,s)=>a+calcComisionVendedor(s.id),0) + comisionGerente;

  return (
    <div style={{padding:"1.5rem",maxWidth:960}}>
      <EditModal/>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:800,color:C.black}}>Comisiones</div>
        <div style={{fontSize:13,color:C.gray400,marginTop:4}}>Mes {mesActual}/{anioActual}</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(150px,100%),1fr))",gap:12,marginBottom:24}}>
        <Stat label="Total comisiones mes" value={fmt(totalComisiones+totalComisionesCrm)} color={C.red}/>
        <Stat label="Comisión gerente" value={fmt(comisionGerente)} sub={`${comisiones?.gerente||0}% ventas totales`}/>
        <Stat label="Comisiones CRM" value={fmt(totalComisionesCrm)} sub="Por tasa individual por CRM"/>
        <Stat label="Base de cálculo" value={fmt(totalFacMes)} sub="Facturado este mes"/>
      </div>

      {/* Comisiones especiales */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(280px,100%),1fr))",gap:12,marginBottom:16}}>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:500,color:C.gray400,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>Comisión Gerente Comercial</div>
              <div style={{fontSize:20,fontWeight:700,color:C.green}}>{fmt(comisionGerente)}</div>
              <div style={{fontSize:11,color:C.gray400,marginTop:2}}>{comisiones?.gerente||0}% sobre {fmt(totalFacMes)} facturado</div>
            </div>
            {isGerente&&<Btn size="sm" onClick={()=>{setEditando({key:"gerente",label:"Comisión Gerente",base:totalFacMes});setTempPct(String(comisiones?.gerente||0));}}>Ajustar %</Btn>}
          </div>
        </Card>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:500,color:C.gray400,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>Total comisiones CRM</div>
              <div style={{fontSize:20,fontWeight:700,color:C.blue}}>{fmt(totalComisionesCrm)}</div>
              <div style={{fontSize:11,color:C.gray400,marginTop:2}}>Suma de todos los CRM por tasa individual</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Per-CRM commission table */}
      <Card style={{marginBottom:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:700,color:C.black}}>Comisiones por CRM</div>
          <div style={{fontSize:11,color:C.gray400}}>Total: {fmt(totalComisionesCrm)}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {crmComisiones.map(({crm,pct,totalCrm,comision,ventas})=>(
            <div key={crm} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderRadius:8,background:pct>0?C.blueLight:C.gray50,border:`1px solid ${pct>0?C.blue:C.gray200}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontWeight:600,fontSize:13,color:C.black,minWidth:100}}>{crm}</span>
                <Badge color={pct>0?"blue":"gray"}>{pct}%</Badge>
                <span style={{fontSize:11,color:C.gray400}}>{ventas} venta{ventas!==1?"s":""} · {fmt(totalCrm)}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontWeight:700,fontSize:13,color:pct>0?C.blue:C.gray400}}>{fmt(comision)}</span>
                {isGerente&&<Btn size="sm" variant="ghost" onClick={()=>{setEditando({key:`crm_${crm}`,label:`Comisión CRM — ${crm}`,base:totalCrm});setTempPct(String(pct));}}>Ajustar</Btn>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{fontWeight:600,fontSize:15,color:C.gray800,marginBottom:12}}>Comisiones por vendedor — {mesActual}/{anioActual}</div>
      <Table
        cols={[
          {key:"vendedor",label:"Vendedor"},
          {key:"porcentaje",label:"% Comisión"},
          {key:"comision_mes",label:"Comisión del mes"},
          {key:"total_ventas",label:"Total ventas"},
          {key:"ventas",label:"# Ventas"},
        ]}
        rows={vendedoresRows}
      />

      {/* Detalle por venta */}
      <div style={{marginTop:24}}>
        <div style={{fontWeight:600,fontSize:15,color:C.gray800,marginBottom:12}}>Calendario de cobros — cuotas este mes</div>
        {SELLERS_ALL.map(s=>{
          const pct = comisiones?.vendedores?.[s.id]||0;
          const ventasCuotas = ventasActivas.filter(v=>v.ejecutivo===s.id&&(v.num_cuotas||1)>1);
          const cuotasMes = ventasCuotas.map(v=>{
            const c=getCuotasDelMes(v,mesActual,anioActual);
            return c>0?{venta:v,cuota:c,com:Math.round(c*(pct/100))}:null;
          }).filter(Boolean);
          if(!cuotasMes.length) return null;
          return (
            <div key={s.id} style={{marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:500,color:C.gray600,marginBottom:6,display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:C.red,display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:9,fontWeight:600}}>{s.avatar}</div>
                {s.name}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {cuotasMes.map(({venta,cuota,com},i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 14px",background:C.gray50,borderRadius:7,fontSize:12}}>
                    <span style={{color:C.gray700}}>{venta.inmobiliaria}</span>
                    <div style={{display:"flex",gap:16}}>
                      <span style={{color:C.gray500}}>Cuota: {fmt(cuota)}</span>
                      <span style={{fontWeight:600,color:C.green}}>Com: {fmt(com)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
