import { useState } from "react";
import { C, fmt, daysUntil, USERS, calcCuotas } from "../constants";
import { Badge, Btn, Modal, ModalHeader, ModalBody, ModalFooter, Card } from "./UI";

const getUser = id => USERS.find(u=>u.id===id);

export function SaleCard({ sale, onClick, showActions, onRequestEdit, onDelete }) {
  const pending = sale.solicitud_modificacion && !sale.modificacion_aprobada;
  const canEdit = sale.modificacion_aprobada;
  const dias = daysUntil(sale.fecha_fin);
  const venciendo = dias!==null && dias>=0 && dias<=30;
  const vencido = dias!==null && dias<0;
  const cancelada = sale.estado==="cancelada";

  let borderColor = C.gray200;
  if (cancelada) borderColor = C.gray300;
  else if (canEdit) borderColor = C.green;
  else if (pending) borderColor = C.amber;
  else if (venciendo) borderColor = C.red;

  return (
    <Card style={{border:`1px solid ${borderColor}`,opacity:cancelada?0.6:1,cursor:"pointer"}} onClick={()=>onClick&&onClick(sale)}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontWeight:600,fontSize:14,color:C.gray900,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sale.inmobiliaria}</span>
            {cancelada&&<Badge color="gray">Cancelada</Badge>}
            {canEdit&&<Badge color="green">Edición aprobada</Badge>}
            {pending&&<Badge color="amber">Modificación pendiente</Badge>}
          </div>
          <div style={{fontSize:12,color:C.gray400,display:"flex",gap:8,flexWrap:"wrap"}}>
            <span>{getUser(sale.ejecutivo)?.name||sale.ejecutivo}</span>
            <span>·</span>
            <span>{sale.crm}</span>
            {sale.plan&&<><span>·</span><span>Plan {sale.plan}</span></>}
            {sale.tipo_pago==="cuotas"&&sale.num_cuotas>1&&<><span>·</span><span>{sale.num_cuotas} cuotas</span></>}
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontWeight:700,color:cancelada?C.gray400:C.red,fontSize:14}}>{fmt(sale.total)}</div>
          <div style={{fontSize:11,color:C.gray400,marginTop:2}}>{sale.fecha_inicio} → {sale.fecha_fin}</div>
          {venciendo&&!cancelada&&<div style={{fontSize:10,background:C.redLight,color:C.red,padding:"2px 7px",borderRadius:5,marginTop:3,fontWeight:500}}>Vence en {dias}d</div>}
          {vencido&&!cancelada&&<div style={{fontSize:10,background:C.gray100,color:C.gray500,padding:"2px 7px",borderRadius:5,marginTop:3}}>Vencido</div>}
        </div>
      </div>
      {showActions&&!cancelada&&(
        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.gray100}`,display:"flex",gap:6,flexWrap:"wrap"}}>
          {!sale.solicitud_modificacion&&!canEdit&&(
            <Btn size="sm" onClick={e=>{e.stopPropagation();onRequestEdit&&onRequestEdit(sale.id);}}>Solicitar modificación</Btn>
          )}
          {canEdit&&(
            <Btn size="sm" variant="success" onClick={e=>{e.stopPropagation();onDelete&&onDelete(sale,"edit");}}>Editar venta</Btn>
          )}
        </div>
      )}
    </Card>
  );
}

export function SaleDetailModal({ sale, onClose, canEdit, canDelete, onEdit, onDelete, onApprove, onReject, isGerente, isAdmin }) {
  const [tab, setTab] = useState("info");
  const cuotas = calcCuotas(sale);
  const seller = getUser(sale.ejecutivo);

  const tabs = [
    {id:"info",label:"Información"},
    {id:"productos",label:"Productos"},
    ...(cuotas.length>1?[{id:"cuotas",label:`Cuotas (${cuotas.length})`}]:[]),
    ...(sale.notas?[{id:"notas",label:"Notas"}]:[]),
  ];

  return (
    <Modal onClose={onClose} maxWidth={600}>
      <ModalHeader
        title={sale.inmobiliaria}
        subtitle={`${sale.razon_social||""} ${sale.rut?`· ${sale.rut}`:""}`}
        onClose={onClose}
      />
      <div style={{borderBottom:`1px solid ${C.gray100}`,padding:"0 24px",display:"flex",gap:4}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 14px",border:"none",background:"none",fontSize:13,fontWeight:tab===t.id?600:400,color:tab===t.id?C.red:C.gray500,borderBottom:`2px solid ${tab===t.id?C.red:"transparent"}`,cursor:"pointer",transition:"all 0.15s"}}>
            {t.label}
          </button>
        ))}
      </div>
      <ModalBody>
        {tab==="info"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px",fontSize:13}}>
            {[
              ["Ejecutivo",seller?.name||sale.ejecutivo],
              ["CRM",sale.crm],
              ["Plan",sale.plan],
              ["Mail",sale.mail],
              ["Teléfono",sale.telefono],
              ["Dirección",sale.direccion],
              ["Método de pago",sale.metodo_pago],
              ["Cuotas",sale.num_cuotas>1?`${sale.num_cuotas} pagos`:"Contado"],
              ["Valor mensual",fmt(sale.valor_mensual)],
              ["Subtotal s/IVA",fmt(sale.subtotal)],
              ["Total c/IVA",fmt(sale.total)],
              ["Fecha inicio",sale.fecha_inicio],
              ["Fecha fin",sale.fecha_fin],
              ["Estado",sale.estado||"activa"],
            ].filter(([,v])=>v).map(([k,v])=>(
              <div key={k}>
                <div style={{fontSize:10,fontWeight:500,color:C.gray400,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>{k}</div>
                <div style={{fontWeight:500,color:C.gray800}}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {tab==="productos"&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {(sale.productos_seleccionados||[]).map(p=>(
              <span key={p} style={{padding:"5px 12px",borderRadius:20,fontSize:12,background:C.gray100,color:C.gray700,fontWeight:500}}>{p}</span>
            ))}
            {sale.destacadas_q>0&&<span style={{padding:"5px 12px",borderRadius:20,fontSize:12,background:C.redLight,color:C.red,fontWeight:500}}>Destacadas ×{sale.destacadas_q}</span>}
            {sale.superdestacadas_q>0&&<span style={{padding:"5px 12px",borderRadius:20,fontSize:12,background:C.redLight,color:C.red,fontWeight:500}}>Superdest. ×{sale.superdestacadas_q}</span>}
            {sale.produccion_q>0&&<span style={{padding:"5px 12px",borderRadius:20,fontSize:12,background:C.redLight,color:C.red,fontWeight:500}}>Producción ×{sale.produccion_q}</span>}
            {!(sale.productos_seleccionados?.length||sale.destacadas_q||sale.superdestacadas_q||sale.produccion_q)&&(
              <div style={{color:C.gray400,fontSize:13}}>Sin productos detallados</div>
            )}
          </div>
        )}
        {tab==="cuotas"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {cuotas.map(c=>(
              <div key={c.numero} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:8,background:c.pagada?C.greenLight:C.gray50,border:`1px solid ${c.pagada?C.green:C.gray200}`}}>
                <div style={{fontSize:13,fontWeight:500,color:C.gray700}}>Cuota {c.numero} — {c.fecha}</div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontWeight:600,color:C.gray900}}>{fmt(c.monto)}</span>
                  <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:c.pagada?C.green:C.gray200,color:c.pagada?C.white:C.gray500,fontWeight:500}}>{c.pagada?"Pagada":"Pendiente"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab==="notas"&&(
          <div style={{fontSize:13,color:C.gray700,background:C.gray50,padding:14,borderRadius:8,lineHeight:1.6}}>{sale.notas}</div>
        )}
      </ModalBody>
      <ModalFooter>
        {isGerente&&sale.solicitud_modificacion&&!sale.modificacion_aprobada&&(
          <>
            <Btn variant="success" size="sm" onClick={()=>onApprove(sale.id)}>Aprobar edición</Btn>
            <Btn variant="danger" size="sm" onClick={()=>onReject(sale.id)}>Rechazar</Btn>
          </>
        )}
        {(canEdit||isGerente||isAdmin)&&sale.estado!=="cancelada"&&(
          <Btn variant="danger" size="sm" onClick={()=>onDelete(sale)}>Cancelar venta</Btn>
        )}
        {canEdit&&<Btn variant="primary" size="sm" onClick={()=>onEdit(sale)}>Editar</Btn>}
        <Btn onClick={onClose}>Cerrar</Btn>
      </ModalFooter>
    </Modal>
  );
}
