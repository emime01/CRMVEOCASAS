import { useEffect, useMemo, useState } from "react";
import { C, ESTADOS_PROSPECTO, RESULTADOS_GESTION, CANALES_GESTION } from "../constants";
import { Card, Btn, Badge, Field, Grid2, Modal, ModalHeader, ModalBody, ModalFooter, Spinner, EmptyState, inp } from "../components/UI";
import { fechaCorta, hoyISO, linkWhatsapp, registrarGestion } from "../prospectos";

// Vista del vendedor: los prospectos que le asignó la gerente. Contacta por WhatsApp o teléfono,
// registra qué pasó y, si se cierra, crea la venta desde acá (la inmobiliaria pasa a cliente).
const proximo = l => l.ultimaGestion?.proximoContacto || "";
const SECCIONES = [
  { id:"interesadas", label:"Interesadas", f:l=>l.estado==="derivado",
    ayuda:"Respondieron con interés. Si vinieron del agente, ya las presentó por correo con vos en copia: seguí por ese hilo o por WhatsApp." },
  { id:"contactar", label:"Para contactar", f:l=>["manual","ex_cliente","sin_respuesta","sin_email"].includes(l.estado)&&!l.ultimaGestion,
    ayuda:"Todavía sin gestión. Empezá por WhatsApp: el mensaje se abre ya escrito." },
  { id:"seguimiento", label:"En seguimiento", f:l=>!["derivado","no_interesado","cliente"].includes(l.estado)&&Boolean(l.ultimaGestion),
    ayuda:"Ya las contactaste. Primero las que tienen fecha de próximo contacto vencida." },
  { id:"cerradas", label:"No interesadas", f:l=>l.estado==="no_interesado", ayuda:"" },
  { id:"clientes", label:"Mis clientes", f:l=>l.estado==="cliente", ayuda:"Clientes de tu cartera según el CRM." },
];

export default function MisProspectos({ currentUser, prospectos, setProspectos, cargar, cargando, onCrearVenta }) {
  const [seccion, setSeccion] = useState("interesadas");
  const [gestionando, setGestionando] = useState(null);
  const [form, setForm] = useState({ canal:"WhatsApp", resultado:"contactado", nota:"", proximoContacto:"" });
  const [guardando, setGuardando] = useState(false);

  useEffect(()=>{ if(!prospectos&&!cargando) cargar(); },[]);

  const mios = useMemo(()=>(prospectos||[]).filter(l=>l.asignadoA===currentUser.id),[prospectos,currentUser.id]);
  const conteos = useMemo(()=>Object.fromEntries(SECCIONES.map(s=>[s.id,mios.filter(s.f).length])),[mios]);
  const s = SECCIONES.find(x=>x.id===seccion);
  const hoy = hoyISO();
  const lista = useMemo(()=>mios.filter(s.f).sort((a,b)=>{
    if(seccion==="seguimiento") return (proximo(a)||"9999").localeCompare(proximo(b)||"9999");
    return (b.score||0)-(a.score||0)||String(a.nombre).localeCompare(String(b.nombre),"es");
  }),[mios,seccion]);

  const abrirGestion = l => { setGestionando(l); setForm({ canal:"WhatsApp", resultado:"contactado", nota:"", proximoContacto:"" }); };
  const guardar = async () => {
    setGuardando(true);
    const cambios = await registrarGestion(gestionando,{ ...form, por:currentUser.id });
    setProspectos(prev=>prev.map(l=>l.id===gestionando.id?{...l,...cambios}:l));
    setGuardando(false); setGestionando(null);
  };

  if(cargando||!prospectos) return <Spinner/>;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12,marginBottom:16}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:C.black}}>Mis prospectos</div>
          <div style={{fontSize:13,color:C.gray500,marginTop:2}}>Inmobiliarias que te asignó la gerencia para contactar.</div>
        </div>
        <Btn size="sm" onClick={cargar}>Actualizar</Btn>
      </div>

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {SECCIONES.map(x=>(
          <Btn key={x.id} size="sm" variant={seccion===x.id?"primary":"outline"} onClick={()=>setSeccion(x.id)}>
            {x.label} ({conteos[x.id]})
          </Btn>
        ))}
      </div>
      {s.ayuda&&<div style={{fontSize:12,color:C.gray500,marginBottom:12}}>{s.ayuda}</div>}

      {!mios.length ? <EmptyState icon="📋" title="Todavía no tenés prospectos asignados" desc="La gerencia los asigna desde Prospectos."/>
      : !lista.length ? <EmptyState icon="✅" title="Nada en esta sección"/>
      : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(340px,100%),1fr))",gap:12}}>
          {lista.map(l=>{
            const est = ESTADOS_PROSPECTO[l.estado]||{label:l.estado,color:"gray"};
            const wa = linkWhatsapp(l,currentUser.id);
            const vencido = proximo(l) && proximo(l)<=hoy;
            return (
              <Card key={l.id} style={vencido?{border:`1px solid ${C.red}`}:{}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:C.black}}>{l.nombre}</div>
                    <div style={{fontSize:11,color:C.gray500}}>{l.departamento||"Zona sin identificar"}</div>
                  </div>
                  <Badge color={est.color}>{est.label}</Badge>
                </div>
                {l.resumenIA&&<div style={{fontSize:12,color:C.gray600,marginTop:8}}>{l.resumenIA}</div>}
                <div style={{fontSize:12,color:C.gray600,marginTop:8,lineHeight:1.6}}>
                  {l.email&&<div>{l.email}</div>}
                  {l.telefono&&<div>{l.telefono}</div>}
                  {l.web&&<a href={/^https?:/.test(l.web)?l.web:`https://${l.web}`} target="_blank" rel="noreferrer" style={{color:C.blue}}>{String(l.web).replace(/^https?:\/\/(www\.)?/,"").slice(0,40)}</a>}
                </div>
                {l.ultimaGestion&&(
                  <div style={{fontSize:11,color:vencido?C.red:C.gray500,marginTop:8}}>
                    Última: {l.ultimaGestion.canal} · {RESULTADOS_GESTION.find(r=>r.id===l.ultimaGestion.resultado)?.label} · {fechaCorta(l.ultimaGestion.fecha)}
                    {proximo(l)&&` · volver el ${fechaCorta(proximo(l))}`}
                    {l.ultimaGestion.nota&&<div style={{color:C.gray600,marginTop:2}}>“{l.ultimaGestion.nota}”</div>}
                  </div>
                )}
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}}>
                  {wa&&<a href={wa} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn size="sm" variant="success">WhatsApp</Btn></a>}
                  {l.telefono&&<a href={`tel:${String(l.telefono).replace(/[^\d+]/g,"")}`} style={{textDecoration:"none"}}><Btn size="sm">Llamar</Btn></a>}
                  {l.email&&<a href={`mailto:${l.email}`} style={{textDecoration:"none"}}><Btn size="sm">Email</Btn></a>}
                  {l.estado!=="cliente"&&<Btn size="sm" onClick={()=>abrirGestion(l)}>Registrar gestión</Btn>}
                  {l.estado!=="cliente"&&<Btn size="sm" variant="primary" onClick={()=>onCrearVenta(l)}>Crear venta</Btn>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {gestionando&&(
        <Modal onClose={()=>setGestionando(null)} maxWidth={520}>
          <ModalHeader title="Registrar gestión" subtitle={gestionando.nombre} onClose={()=>setGestionando(null)}/>
          <ModalBody>
            <Grid2>
              <Field label="Canal">
                <select value={form.canal} onChange={e=>setForm(f=>({...f,canal:e.target.value}))} style={inp}>
                  {CANALES_GESTION.map(c=><option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Resultado">
                <select value={form.resultado} onChange={e=>setForm(f=>({...f,resultado:e.target.value}))} style={inp}>
                  {RESULTADOS_GESTION.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </Field>
            </Grid2>
            <div style={{marginTop:12}}>
              <Field label="Nota">
                <textarea value={form.nota} onChange={e=>setForm(f=>({...f,nota:e.target.value}))} rows={3} style={{...inp,minHeight:70,resize:"vertical"}} placeholder="Qué te dijeron, con quién hablaste…"/>
              </Field>
            </div>
            {["sin_respuesta","contactado","volver"].includes(form.resultado)&&(
              <div style={{marginTop:12}}>
                <Field label="Próximo contacto" hint="Aparece primero en “En seguimiento” cuando llega la fecha.">
                  <input type="date" value={form.proximoContacto} min={hoyISO()} onChange={e=>setForm(f=>({...f,proximoContacto:e.target.value}))} style={inp}/>
                </Field>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Btn onClick={()=>setGestionando(null)}>Cancelar</Btn>
            <Btn variant="primary" disabled={guardando} onClick={guardar}>Guardar</Btn>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
