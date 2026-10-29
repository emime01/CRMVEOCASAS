import { useState } from "react";
import { CRMS, PRODUCTS, PLANS, USERS, C } from "../constants";
import { Field, Grid2, Sec, Modal, ModalHeader, ModalBody, ModalFooter, Btn, inp } from "./UI";
import { armarDetalle } from "../cuotas";

const SELLERS_FOR_FORM = USERS.filter(u=>["vendedor","inactivo","gerente"].includes(u.role));

export default function SaleForm({ initialData, onSave, onClose, currentUser, clientes = [] }) {
  const blank = {
    inmobiliaria:"", razon_social:"", rut:"", mail:"", telefono:"",
    direccion:"", crm:"SIN CRM", ejecutivo: currentUser?.id||"sebastian",
    detalle:"", plan:"50", propiedades:0, destacadas_q:0, superdestacadas_q:0,
    produccion_q:0, indice:false, destacadas_home:false,
    fecha_inicio:"", fecha_fin:"",
    tipo_pago:"contado", subtipo_contado:"transferencia",
    subtipo_cuotas:"contrato", num_cuotas:1,
    valor_mensual:0, subtotal:0,
    productos_seleccionados:[], estado:"activa",
    solicitud_modificacion:false, modificacion_aprobada:false,
  };
  // un borrador desde un prospecto trae solo algunos campos: el resto sale de blank
  const [form, setForm] = useState(initialData ? { ...blank, ...initialData } : blank);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  // Al escribir el nombre de un cliente que ya tiene ficha, se completan sus datos y la venta queda vinculada.
  // Si se cambia el nombre por otro, la venta deja de apuntar a esa ficha (al guardar se busca o se crea la que corresponda).
  const setInmobiliaria = nombre => {
    const c = clientes.find(x => (x.nombre||"").trim().toLowerCase() === nombre.trim().toLowerCase());
    setForm(f => c ? {
      ...f, inmobiliaria:nombre, cliente_id:c.id,
      razon_social:c.razon_social||f.razon_social, rut:c.rut||f.rut, mail:c.email||f.mail,
      telefono:c.telefono||f.telefono, direccion:c.direccion||f.direccion, crm:c.crm||f.crm,
    } : { ...f, inmobiliaria:nombre, cliente_id: f.cliente_id && clientes.find(x=>x.id===f.cliente_id)?.nombre===nombre ? f.cliente_id : null });
  };
  const fichaVinculada = form.cliente_id && clientes.find(x=>x.id===form.cliente_id);
  const toggle = p => setForm(f=>({...f,productos_seleccionados:(f.productos_seleccionados||[]).includes(p)?(f.productos_seleccionados||[]).filter(x=>x!==p):[...(f.productos_seleccionados||[]),p]}));

  const subtotal = parseFloat(form.subtotal)||0;
  const total = Math.round(subtotal*1.22);
  const isEdit = !!initialData?.id;

  const handleSave = () => {
    const nc = form.tipo_pago==="contado" ? 1 : parseInt(form.num_cuotas)||1;
    const cuotas_detalle = armarDetalle(form, total, nc);
    onSave({ ...form, total, subtotal, cuotas_detalle,
      metodo_pago: form.tipo_pago==="contado"
        ? form.subtipo_contado
        : `${form.subtipo_cuotas} (${form.num_cuotas} cuotas)`,
      num_cuotas: nc,
    });
  };

  return (
    <Modal onClose={onClose} maxWidth={700}>
      <ModalHeader
        title={isEdit?"Editar Venta":"Nueva Venta"}
        subtitle={isEdit?"Modificando datos de la venta":"Completá todos los campos"}
        onClose={onClose}
      />
      <ModalBody>
        <Sec title="Datos de la Inmobiliaria">
          <Grid2>
            <Field label="Nombre Inmobiliaria" hint={fichaVinculada ? "Cliente con ficha: datos completados" : form.inmobiliaria ? "Cliente nuevo: se crea su ficha al guardar" : ""}>
              <input value={form.inmobiliaria} onChange={e=>setInmobiliaria(e.target.value)} list="clientes-ficha" style={inp} placeholder="Ej: García Propiedades"/>
              <datalist id="clientes-ficha">{clientes.map(c=><option key={c.id} value={c.nombre}/>)}</datalist>
            </Field>
            <Field label="Razón Social"><input value={form.razon_social} onChange={e=>set("razon_social",e.target.value)} style={inp}/></Field>
            <Field label="RUT"><input value={form.rut} onChange={e=>set("rut",e.target.value)} style={inp} placeholder="XX.XXX.XXX-X"/></Field>
            <Field label="Mail"><input value={form.mail} onChange={e=>set("mail",e.target.value)} style={inp} type="email"/></Field>
            <Field label="Teléfono"><input value={form.telefono} onChange={e=>set("telefono",e.target.value)} style={inp}/></Field>
            <Field label="Dirección"><input value={form.direccion} onChange={e=>set("direccion",e.target.value)} style={inp}/></Field>
            <Field label="CRM">
              <select value={form.crm} onChange={e=>set("crm",e.target.value)} style={inp}>
                {CRMS.map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Plan">
              <select value={form.plan} onChange={e=>set("plan",e.target.value)} style={inp}>
                {PLANS.map(p=><option key={p}>{p}</option>)}
              </select>
            </Field>
          </Grid2>
        </Sec>

        <Sec title="Datos de la Compra">
          <Grid2>
            <Field label="Ejecutivo">
              <select value={form.ejecutivo} onChange={e=>set("ejecutivo",e.target.value)} style={inp}>
                {SELLERS_FOR_FORM.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
                          <Field label="Propiedades"><input type="text" inputMode="numeric" value={form.propiedades} onChange={e=>{const v=e.target.value.replace(/\D/g,"");set("propiedades",v===""?0:parseInt(v));}} style={inp}/></Field>
          </Grid2>
          <div style={{marginTop:10}}>
            <Field label="Detalle">
              <textarea value={form.detalle} onChange={e=>set("detalle",e.target.value)} style={{...inp,height:56,resize:"none"}}/>
            </Field>
          </div>
        </Sec>

        <Sec title="Productos">
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
            {PRODUCTS.map(p=>(
              <label key={p} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,padding:"6px 10px",borderRadius:7,background:(form.productos_seleccionados||[]).includes(p)?C.redLight:C.gray50,border:`1px solid ${(form.productos_seleccionados||[]).includes(p)?C.red:C.gray200}`,transition:"all 0.15s"}}>
                <input type="checkbox" checked={(form.productos_seleccionados||[]).includes(p)} onChange={()=>toggle(p)} style={{accentColor:C.red}}/>
                <span style={{flex:1,fontSize:12}}>{p}</span>
                {(form.productos_seleccionados||[]).includes(p)&&["Destacadas","Superdestacadas","Producción"].includes(p)&&(
                  <input type="text" inputMode="numeric" placeholder="Cant." style={{...inp,width:52,padding:"3px 6px",fontSize:11}}
                    value={p==="Destacadas"?form.destacadas_q:p==="Superdestacadas"?form.superdestacadas_q:form.produccion_q}
                    onChange={e=>{const v=e.target.value.replace(/\D/g,"");set(p==="Destacadas"?"destacadas_q":p==="Superdestacadas"?"superdestacadas_q":"produccion_q",v);}}
                    onClick={e=>e.stopPropagation()}/>
                )}
              </label>
            ))}
          </div>
        </Sec>

        <Sec title="Período">
          <Grid2>
            <Field label="Fecha inicio"><input type="date" value={form.fecha_inicio} onChange={e=>set("fecha_inicio",e.target.value)} style={inp}/></Field>
            <Field label="Fecha fin"><input type="date" value={form.fecha_fin} onChange={e=>set("fecha_fin",e.target.value)} style={inp}/></Field>
          </Grid2>
        </Sec>

        <Sec title="Método de Pago">
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            {["contado","cuotas"].map(t=>(
              <button key={t} onClick={()=>set("tipo_pago",t)} style={{flex:1,padding:"10px",borderRadius:8,border:`2px solid ${form.tipo_pago===t?C.red:C.gray200}`,background:form.tipo_pago===t?C.redLight:C.white,color:form.tipo_pago===t?C.red:C.gray600,fontWeight:500,fontSize:13,cursor:"pointer",transition:"all 0.15s",textTransform:"capitalize"}}>
                {t==="contado"?"Pago Contado":"En Cuotas"}
              </button>
            ))}
          </div>
          {form.tipo_pago==="contado" ? (
            <Field label="Forma de pago contado">
              <div style={{display:"flex",gap:8}}>
                {["transferencia","cheque","depósito"].map(m=>(
                  <button key={m} onClick={()=>set("subtipo_contado",m)} style={{flex:1,padding:"8px",borderRadius:7,border:`1px solid ${form.subtipo_contado===m?C.red:C.gray200}`,background:form.subtipo_contado===m?C.redLight:C.white,color:form.subtipo_contado===m?C.red:C.gray600,fontSize:12,cursor:"pointer",textTransform:"capitalize",transition:"all 0.15s"}}>
                    {m}
                  </button>
                ))}
              </div>
            </Field>
          ) : (
            <Grid2>
              <Field label="Tipo de cuotas">
                <div style={{display:"flex",gap:8}}>
                  {["contrato","link handy"].map(m=>(
                    <button key={m} onClick={()=>set("subtipo_cuotas",m)} style={{flex:1,padding:"8px",borderRadius:7,border:`1px solid ${form.subtipo_cuotas===m?C.red:C.gray200}`,background:form.subtipo_cuotas===m?C.redLight:C.white,color:form.subtipo_cuotas===m?C.red:C.gray600,fontSize:12,cursor:"pointer",textTransform:"capitalize",transition:"all 0.15s"}}>
                      {m==="contrato"?"Contrato":"Link Handy"}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Número de cuotas">
                <select value={form.num_cuotas} onChange={e=>set("num_cuotas",parseInt(e.target.value))} style={inp}>
                  {[1,2,3,4,6,12].map(n=><option key={n} value={n}>{n} {n===1?"pago":"cuotas"}</option>)}
                </select>
              </Field>
            </Grid2>
          )}
        </Sec>

        <Sec title="Valores">
          <Grid2>
                          <Field label="Valor mensual (plan)"><input type="text" inputMode="numeric" value={form.valor_mensual||""} onChange={e=>{const v=e.target.value.replace(/[^\d]/g,"");set("valor_mensual",v===""?0:parseInt(v));}} style={inp} placeholder="0"/></Field>
            <Field label="Subtotal sin IVA"><input type="text" inputMode="numeric" value={form.subtotal||""} onChange={e=>{const v=e.target.value.replace(/[^\d]/g,"");set("subtotal",v===""?0:parseInt(v));}} style={inp} placeholder="0"/></Field>
            <Field label="Total con IVA (22%)"><input readOnly value={total} style={{...inp,background:C.gray50,fontWeight:600}}/></Field>
            {form.tipo_pago==="cuotas"&&form.num_cuotas>1&&(
              <Field label={`Por cuota (${form.num_cuotas} pagos)`}><input readOnly value={Math.round(total/form.num_cuotas)} style={{...inp,background:C.gray50}}/></Field>
            )}
          </Grid2>
        </Sec>
      </ModalBody>
      <ModalFooter>
        <Btn onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" onClick={handleSave}>{isEdit?"Guardar cambios":"Registrar Venta"}</Btn>
      </ModalFooter>
    </Modal>
  );
}
