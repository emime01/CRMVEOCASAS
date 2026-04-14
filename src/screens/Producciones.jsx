import { useState } from "react";
import { updateItem } from "../firebase";
import { C, USERS, CIUDADES } from "../constants";
import { Card, Btn, Badge, EmptyState, inp, Modal, ModalHeader, ModalBody } from "../components/UI";

const getUser = id => USERS.find(u => u.id === id);

export default function Producciones({ currentUser, productions, setProductions, editingProd, setEditingProd }) {
  const [calendarModal, setCalendarModal] = useState(null);

  const list = currentUser.role === "vendedor"
    ? productions.filter(p => p.ejecutivo === currentUser.id)
    : productions;

  const toggleEditing = (id) => setEditingProd(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  return (
    <div style={{padding:"1.5rem",maxWidth:800}}>
      {calendarModal&&(
        <Modal onClose={()=>setCalendarModal(null)} maxWidth={460}>
          <ModalHeader title={calendarModal.cliente} subtitle="Detalle de producción" onClose={()=>setCalendarModal(null)}/>
          <ModalBody>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[["Ejecutivo",getUser(calendarModal.ejecutivo)?.name],["Cantidad",`×${calendarModal.produccion_q}`],["Fecha",calendarModal.fecha],["Ciudad",calendarModal.ciudad||"—"],["Comentario",calendarModal.comentario||"—"],["Estado",calendarModal.confirmado?"Confirmado":"Pendiente"]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.gray100}`,fontSize:13}}>
                  <span style={{color:C.gray500}}>{k}</span>
                  <span style={{fontWeight:600,color:C.black}}>{v}</span>
                </div>
              ))}
            </div>
          </ModalBody>
        </Modal>
      )}

      <div style={{fontSize:20,fontWeight:800,color:C.black,marginBottom:20}}>
        {currentUser.role==="marketing"?"Producciones a confirmar":currentUser.role==="gerente"?"Producciones":"Mis Producciones"}
      </div>

      {!list.length&&<EmptyState icon="🎬" title="Sin producciones" desc="No hay producciones pendientes"/>}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {list.map(p=>{
          const s = getUser(p.ejecutivo);
          const canEditProd = currentUser.role==="marketing" || currentUser.role==="vendedor";
          const isComplete = !!(p.fecha && p.ciudad && p.comentario);
          const isEditing = editingProd.has(p.id);
          const showFields = canEditProd && (!isComplete || isEditing);
          return (
            <Card key={p.id} style={{border:`1px solid ${isComplete&&!isEditing?C.green:p.confirmado?C.green:C.gray200}`,background:isComplete&&!isEditing?C.greenLight:C.white}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:showFields?8:0}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13,color:C.black}}>{p.cliente}</div>
                  <div style={{fontSize:11,color:C.gray400,marginTop:2}}>{s?.name} · ×{p.produccion_q}{p.ciudad?` · 📍 ${p.ciudad}`:""}</div>
                  {isComplete&&!isEditing&&<div style={{fontSize:11,color:C.green,marginTop:2,fontWeight:500}}>{p.fecha} · {p.comentario}</div>}
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <Badge color={p.confirmado?"green":"amber"}>{p.confirmado?"Confirmado":"Pendiente"}</Badge>
                  {isComplete&&canEditProd&&(
                    <button onClick={()=>toggleEditing(p.id)} style={{fontSize:11,color:C.blue,background:"none",border:`1px solid ${C.blue}`,borderRadius:6,cursor:"pointer",padding:"3px 8px",fontFamily:"'Montserrat',sans-serif"}}>{isEditing?"Cerrar":"Editar"}</button>
                  )}
                  {!isComplete&&canEditProd&&(
                    <input type="date" value={p.fecha||""} onChange={async e=>{await updateItem("producciones",p.id,{fecha:e.target.value});setProductions(prev=>prev.map(x=>x.id===p.id?{...x,fecha:e.target.value}:x));}} style={{...inp,width:140,fontSize:12,padding:"6px 10px"}}/>
                  )}
                  {isEditing&&(
                    <input type="date" value={p.fecha||""} onChange={async e=>{await updateItem("producciones",p.id,{fecha:e.target.value});setProductions(prev=>prev.map(x=>x.id===p.id?{...x,fecha:e.target.value}:x));}} style={{...inp,width:140,fontSize:12,padding:"6px 10px"}}/>
                  )}
                  {currentUser.role==="marketing"&&!p.confirmado&&(
                    <Btn size="sm" variant="primary" onClick={async()=>{await updateItem("producciones",p.id,{confirmado:true});setProductions(prev=>prev.map(x=>x.id===p.id?{...x,confirmado:true}:x));}}>Confirmar</Btn>
                  )}
                </div>
              </div>
              {showFields&&(
                <div style={{display:"flex",gap:8,flexWrap:"wrap",borderTop:`1px solid ${C.gray100}`,paddingTop:8}}>
                  <select value={p.ciudad||""} onChange={async e=>{await updateItem("producciones",p.id,{ciudad:e.target.value});setProductions(prev=>prev.map(x=>x.id===p.id?{...x,ciudad:e.target.value}:x));}} style={{...inp,width:"auto",padding:"4px 8px",fontSize:11}}>
                    <option value="">Ciudad...</option>
                    {CIUDADES.map(c=><option key={c}>{c}</option>)}
                  </select>
                  <input
                    value={p.comentario||""}
                    onChange={e=>{const v=e.target.value;setProductions(prev=>prev.map(x=>x.id===p.id?{...x,comentario:v}:x));}}
                    onBlur={async e=>{await updateItem("producciones",p.id,{comentario:e.target.value});}}
                    style={{...inp,flex:1,minWidth:120,padding:"4px 8px",fontSize:11}}
                    placeholder="Comentario..."
                  />
                </div>
              )}
              {currentUser.role==="gerente"&&(p.ciudad||p.comentario)&&(
                <div style={{fontSize:11,color:C.gray500,marginTop:6}}>
                  {p.ciudad&&<span style={{marginRight:8}}>📍 {p.ciudad}</span>}
                  {p.comentario&&<span>{p.comentario}</span>}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {currentUser.role==="marketing"&&(
        <div style={{marginTop:24}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>Calendario</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {["L","M","M","J","V","S","D"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,color:C.gray400,padding:"4px 0",fontWeight:500}}>{d}</div>)}
            {Array.from({length:30},(_,i)=>{
              const day=i+1;
              const dayProds=productions.filter(p=>p.confirmado&&p.fecha&&new Date(p.fecha).getDate()===day);
              const has=dayProds.length>0;
              return(
                <div key={i} onClick={()=>has&&setCalendarModal(dayProds[0])}
                  style={{textAlign:"center",padding:"6px 2px",borderRadius:6,background:has?C.red:C.gray100,color:has?C.white:C.gray700,fontSize:has?9:12,fontWeight:has?600:400,cursor:has?"pointer":"default",overflow:"hidden",minHeight:36,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
                  <div>{day}</div>
                  {has&&<div style={{fontSize:8,lineHeight:1,opacity:0.9}}>{dayProds[0].cliente.slice(0,7)}{dayProds[0].cliente.length>7?"…":""}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
