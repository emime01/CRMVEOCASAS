import { useEffect, useMemo, useState } from "react";
import { C, ESTADOS_PROSPECTO, ASIGNABLES } from "../constants";
import { Card, Btn, Badge, Stat, Spinner, EmptyState, inp } from "../components/UI";
import { asignar, fechaCorta, linkWhatsapp, nombreUsuario } from "../prospectos";

// Vista de la gerente: toda la base que encontró el agente, agrupada por lo que hay que decidir.
// Asignar acá es lo que reparte el trabajo: el agente deja de escribirles y las contacta el vendedor.
const sinAsignar = l => !l.asignadoA;
const conTelefono = l => Boolean(l.telefono || l.whatsapp);
const GRUPOS = [
  { id:"interesadas", label:"Interesadas sin asignar", f:l=>l.estado==="derivado"&&sinAsignar(l), alert:true,
    ayuda:"Respondieron con interés al agente. Asignalas: el agente presenta al vendedor en el mismo hilo de correo." },
  { id:"ex_clientes", label:"Ex clientes", f:l=>l.estado==="ex_cliente"&&sinAsignar(l),
    ayuda:"Tuvieron ventas que vencieron o se cancelaron. El agente no les escribe en frío: conviene que las retome un vendedor (sugerido: el de su última venta)." },
  { id:"sin_respuesta", label:"No respondieron", f:l=>l.estado==="sin_respuesta"&&sinAsignar(l),
    ayuda:"Terminaron la secuencia de correos sin responder. Si no se asignan, el agente les escribe otra vez con otro enfoque a los 90 días. Asignadas, las contacta un vendedor por WhatsApp o teléfono." },
  { id:"no_interesadas", label:"No interesadas", f:l=>l.estado==="no_interesado"&&sinAsignar(l),
    ayuda:"Dijeron que no por correo. El agente lo vuelve a intentar una sola vez a los 180 días. Mirá el resumen: a veces el motivo es una oportunidad (\"ya publicamos en InfoCasas\")." },
  { id:"sin_email", label:"Sin email, con teléfono", f:l=>l.estado==="sin_email"&&conTelefono(l)&&sinAsignar(l),
    ayuda:"El agente no pudo conseguir su email, pero tienen teléfono o WhatsApp. Solo se pueden trabajar a mano." },
  { id:"asignadas", label:"Asignadas", f:l=>Boolean(l.asignadoA)&&!["cliente"].includes(l.estado),
    ayuda:"Ya tienen vendedor. Las trabaja desde \"Mis prospectos\"." },
  { id:"agente", label:"Con el agente", f:l=>["nuevo","listo","en_secuencia","conversando"].includes(l.estado)&&sinAsignar(l),
    ayuda:"Las está contactando el agente por correo (o están en cola). No hace falta hacer nada todavía." },
  { id:"clientes", label:"Clientes", f:l=>l.estado==="cliente",
    ayuda:"Tienen venta vigente en el CRM. El agente nunca les escribe." },
  { id:"todas", label:"Todas", f:()=>true, ayuda:"" },
];
const MAX_FILAS = 200;

export default function Prospectos({ currentUser, prospectos, setProspectos, cargar, cargando }) {
  const [grupo, setGrupo] = useState("interesadas");
  const [depto, setDepto] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState(new Set());
  const [destino, setDestino] = useState(ASIGNABLES[0]);
  const [guardando, setGuardando] = useState(false);

  useEffect(()=>{ if(!prospectos&&!cargando) cargar(); },[]);

  const lista = prospectos||[];
  const conteos = useMemo(()=>Object.fromEntries(GRUPOS.map(g=>[g.id,lista.filter(g.f).length])),[lista]);
  const deptos = useMemo(()=>[...new Set(lista.map(l=>l.departamento).filter(Boolean))].sort(),[lista]);
  const g = GRUPOS.find(x=>x.id===grupo);
  const plano = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
  const filtradas = useMemo(()=>lista.filter(g.f)
    .filter(l=>!depto||(depto==="sin"?!l.departamento:l.departamento===depto))
    .filter(l=>!vendedor||l.asignadoA===vendedor)
    .filter(l=>!busca||[l.nombre,l.email,l.web,l.instagram,l.telefono].some(v=>plano(v).includes(plano(busca))))
    .sort((a,b)=>(b.score||0)-(a.score||0)||String(a.nombre).localeCompare(String(b.nombre),"es")),
  [lista,grupo,depto,vendedor,busca]);
  const visibles = filtradas.slice(0,MAX_FILAS);

  const aplicar = async (items, vendedorId) => {
    setGuardando(true);
    const cambios = new Map();
    for(let i=0;i<items.length;i+=20){
      const lote = items.slice(i,i+20);
      const res = await Promise.all(lote.map(l=>asignar(l,vendedorId,currentUser.id).then(c=>[l.id,c]).catch(()=>null)));
      res.filter(Boolean).forEach(([id,c])=>cambios.set(id,c));
    }
    setProspectos(prev=>prev.map(l=>cambios.has(l.id)?{...l,...cambios.get(l.id)}:l));
    setSel(new Set()); setGuardando(false);
  };
  const toggle = id => setSel(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const todasSel = visibles.length>0 && visibles.every(l=>sel.has(l.id));

  if(cargando||!prospectos) return <Spinner/>;
  if(!lista.length) return <EmptyState icon="🔎" title="Sin prospectos" desc="Cuando el agente de prospección encuentre inmobiliarias, aparecen acá."/>;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12,marginBottom:16}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:C.black}}>Prospectos</div>
          <div style={{fontSize:13,color:C.gray500,marginTop:2}}>{lista.length.toLocaleString("es-UY")} inmobiliarias encontradas por el agente. Asigná las que tiene que contactar un vendedor.</div>
        </div>
        <Btn size="sm" onClick={cargar}>Actualizar</Btn>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10,marginBottom:16}}>
        {GRUPOS.filter(x=>x.id!=="todas").map(x=>(
          <div key={x.id} onClick={()=>{setGrupo(x.id);setSel(new Set());}} style={{cursor:"pointer",outline:grupo===x.id?`2px solid ${C.red}`:"none",borderRadius:12}}>
            <Stat label={x.label} value={conteos[x.id].toLocaleString("es-UY")} alert={x.alert&&conteos[x.id]>0}/>
          </div>
        ))}
      </div>

      <Card style={{marginBottom:12}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}>
          <select value={grupo} onChange={e=>{setGrupo(e.target.value);setSel(new Set());}} style={{...inp,width:"auto",minWidth:190}}>
            {GRUPOS.map(x=><option key={x.id} value={x.id}>{x.label} ({conteos[x.id]})</option>)}
          </select>
          <select value={depto} onChange={e=>setDepto(e.target.value)} style={{...inp,width:"auto",minWidth:150}}>
            <option value="">Todos los departamentos</option>
            {deptos.map(d=><option key={d} value={d}>{d}</option>)}
            <option value="sin">Sin identificar</option>
          </select>
          {grupo==="asignadas"&&(
            <select value={vendedor} onChange={e=>setVendedor(e.target.value)} style={{...inp,width:"auto",minWidth:150}}>
              <option value="">Todos los vendedores</option>
              {ASIGNABLES.map(v=><option key={v} value={v}>{nombreUsuario(v)}</option>)}
            </select>
          )}
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar nombre, email, web…" style={{...inp,width:"auto",flex:1,minWidth:180}}/>
        </div>
        {g.ayuda&&<div style={{fontSize:12,color:C.gray500,marginTop:10}}>{g.ayuda}</div>}
      </Card>

      {sel.size>0&&(
        <Card style={{marginBottom:12,border:`1px solid ${C.red}`,background:C.redLight}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}>
            <span style={{fontSize:13,fontWeight:600}}>{sel.size} seleccionadas</span>
            <select value={destino} onChange={e=>setDestino(e.target.value)} style={{...inp,width:"auto",minWidth:150}}>
              {ASIGNABLES.map(v=><option key={v} value={v}>{nombreUsuario(v)}</option>)}
            </select>
            <Btn variant="primary" size="sm" disabled={guardando} onClick={()=>aplicar(lista.filter(l=>sel.has(l.id)),destino)}>Asignar a {nombreUsuario(destino)}</Btn>
            <Btn size="sm" disabled={guardando} onClick={()=>aplicar(lista.filter(l=>sel.has(l.id)),null)}>Quitar asignación</Btn>
            <Btn variant="ghost" size="sm" onClick={()=>setSel(new Set())}>Cancelar</Btn>
          </div>
        </Card>
      )}

      <div style={{fontSize:12,color:C.gray500,margin:"0 0 8px"}}>
        Mostrando {visibles.length.toLocaleString("es-UY")} de {filtradas.length.toLocaleString("es-UY")}
        {filtradas.length>MAX_FILAS&&" · filtrá por departamento o buscá para ver el resto"}
      </div>

      {!filtradas.length ? <EmptyState icon="✅" title="Nada por acá" desc="No hay inmobiliarias en este grupo con estos filtros."/> : (
        <div style={{overflowX:"auto",background:C.white,border:`1px solid ${C.gray200}`,borderRadius:12}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:860,fontSize:13}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.gray200}`,textAlign:"left",color:C.gray500,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>
                <th style={{padding:"10px 12px",width:30}}><input type="checkbox" checked={todasSel} onChange={()=>setSel(todasSel?new Set():new Set(visibles.map(l=>l.id)))} aria-label="Seleccionar todas las visibles"/></th>
                <th style={{padding:"10px 12px"}}>Inmobiliaria</th>
                <th style={{padding:"10px 12px"}}>Contacto</th>
                <th style={{padding:"10px 12px"}}>Situación</th>
                <th style={{padding:"10px 12px",width:170}}>Vendedor</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(l=>{
                const est = ESTADOS_PROSPECTO[l.estado]||{label:l.estado,color:"gray"};
                const wa = linkWhatsapp(l,currentUser.id);
                const sugerido = l.asignadoSugerido||l.crm?.ejecutivo;
                return (
                  <tr key={l.id} style={{borderBottom:`1px solid ${C.gray100}`,verticalAlign:"top",background:sel.has(l.id)?C.redLight:"transparent"}}>
                    <td style={{padding:"10px 12px"}}><input type="checkbox" checked={sel.has(l.id)} onChange={()=>toggle(l.id)} aria-label={`Seleccionar ${l.nombre}`}/></td>
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontWeight:600,color:C.black}}>{l.nombre}</div>
                      <div style={{fontSize:11,color:C.gray500}}>{l.departamento||"Zona sin identificar"}</div>
                      {l.web&&<a href={/^https?:/.test(l.web)?l.web:`https://${l.web}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:C.blue}}>{String(l.web).replace(/^https?:\/\/(www\.)?/,"").slice(0,40)}</a>}
                    </td>
                    <td style={{padding:"10px 12px",fontSize:12}}>
                      <div>{l.email||<span style={{color:C.gray400}}>sin email</span>}</div>
                      {l.telefono&&<div style={{color:C.gray500}}>{l.telefono}</div>}
                      {wa&&<a href={wa} target="_blank" rel="noreferrer" style={{color:C.green,fontWeight:600}}>WhatsApp</a>}
                      {l.instagram&&<a href={`https://instagram.com/${l.instagram}`} target="_blank" rel="noreferrer" style={{color:C.blue,marginLeft:wa?8:0}}>@{l.instagram}</a>}
                    </td>
                    <td style={{padding:"10px 12px",fontSize:12}}>
                      <Badge color={est.color}>{est.label}</Badge>
                      {l.etapa==="cierre"&&<Badge color="red" style={{marginLeft:4}}>Quiere contratar</Badge>}
                      {l.score!=null&&l.resumenIA&&<span style={{marginLeft:6,fontWeight:700,color:l.score>=60?C.green:C.gray500}}>{l.score}/100</span>}
                      {l.resumenIA&&<div style={{color:C.gray600,marginTop:4,maxWidth:380}}>{l.resumenIA}</div>}
                      {l.ultimaGestion&&<div style={{color:C.gray500,marginTop:4}}>Última gestión: {l.ultimaGestion.canal} · {l.ultimaGestion.resultado} · {fechaCorta(l.ultimaGestion.fecha)}</div>}
                      {l.crm?.cliente&&<div style={{color:C.gray500,marginTop:4}}>En el CRM como “{l.crm.nombreCRM}”{l.crm.ejecutivo?` · vendedor ${nombreUsuario(l.crm.ejecutivo)}`:""}</div>}
                    </td>
                    <td style={{padding:"10px 12px"}}>
                      <select value={l.asignadoA||""} disabled={guardando}
                        onChange={e=>aplicar([l],e.target.value||null)} style={{...inp,minHeight:34,padding:"6px 8px",fontSize:12}}>
                        <option value="">Sin asignar</option>
                        {ASIGNABLES.map(v=><option key={v} value={v}>{nombreUsuario(v)}{!l.asignadoA&&v===sugerido?" (sugerido)":""}</option>)}
                      </select>
                      {l.asignadoA&&l.asignadoEn&&<div style={{fontSize:11,color:C.gray400,marginTop:4}}>desde {fechaCorta(l.asignadoEn)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
