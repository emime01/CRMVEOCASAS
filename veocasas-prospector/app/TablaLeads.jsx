'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ETIQUETA } from './estados';

const fecha = iso => iso ? new Date(iso).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' }) : '-';
const FUENTE = { maps: 'Google Maps', google: 'Google, redes y portales', directorios: 'Cámaras y portales' };

function Acciones({ lead, estado }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  async function hacer(accion, extra = {}) {
    setOcupado(true); setError('');
    const r = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accion, ...extra }),
    });
    const j = await r.json().catch(() => ({}));
    setOcupado(false);
    if (!r.ok) return setError(j.error || 'No se pudo guardar el cambio.');
    router.refresh();
  }

  const b = (accion, texto, cls = '') => (
    <button key={accion} className={cls} disabled={ocupado} onClick={() => hacer(accion)}>{texto}</button>
  );

  return (
    <div>
      <div className="acciones">
        {estado === 'sin_email' && (
          <>
            <input type="email" placeholder="correo@inmobiliaria.com.uy" value={email}
                   onChange={e => setEmail(e.target.value)} aria-label={`Correo de ${lead.nombre}`} />
            <button className="primario" disabled={ocupado || !email} onClick={() => hacer('email', { email })}>Guardar correo</button>
          </>
        )}
        {estado === 'sin_respuesta' && b('reactivar', 'Reiniciar secuencia', 'primario')}
        {['sin_respuesta', 'sin_email', 'en_secuencia', 'conversando'].includes(estado) && b('manual', 'Pasar a contacto manual')}
        {['derivado', 'manual', 'conversando'].includes(estado) && b('cliente', 'Marcar como cliente')}
        {!['descartado', 'cliente', 'baja'].includes(estado) && b('descartar', 'Descartar', 'peligro')}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export default function TablaLeads({ leads, estado }) {
  if (!leads.length) return <div className="tabla-wrap"><p className="vacio">No hay inmobiliarias en esta etapa.</p></div>;
  const conIA = ['derivado', 'conversando', 'no_interesado', 'sin_respuesta'].includes(estado);

  return (
    <div className="tabla-wrap">
      <table>
        <thead>
          <tr>
            <th>Inmobiliaria</th><th>Contacto</th><th>Origen</th>
            <th>{estado === 'todas' ? 'Estado' : conIA ? 'Lo que respondieron' : 'Seguimiento'}</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(l => (
            <tr key={l.id}>
              <td>
                <div className="nombre">{l.nombre}</div>
                <div className="sub">{l.departamento || 'Zona sin identificar'}</div>
                {l.web && <a className="sub" href={/^https?:/.test(l.web) ? l.web : `https://${l.web}`} target="_blank" rel="noreferrer">{l.web.replace(/^https?:\/\/(www\.)?/, '')}</a>}
              </td>
              <td>
                <div>{l.email || '-'}</div>
                {l.telefono && <div className="sub">{l.telefono}</div>}
                {l.whatsapp && <a className="sub" href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp +{l.whatsapp}</a>}
                {l.instagram && <a className="sub" href={`https://instagram.com/${l.instagram}`} target="_blank" rel="noreferrer">@{l.instagram}</a>}
              </td>
              <td className="sub">{(l.fuentes || []).map(f => FUENTE[f] || f).join(', ')}</td>
              <td>
                {estado === 'todas' ? (
                  <span className="etiqueta">{ETIQUETA[l.estado] || l.estado}</span>
                ) : conIA ? (
                  <>
                    {l.etapa && <span className={`etiqueta ${l.etapa === 'cierre' ? 'cierre' : ''}`}>{l.etapa.replace('_', ' ')}</span>}{' '}
                    {l.score != null && <span className={`score ${l.score >= 60 ? 'alto' : ''}`}>{l.score}/100</span>}
                    {l.resumenIA && <div className="sub" style={{ marginTop: 4 }}>{l.resumenIA}</div>}
                    {l.ejecutivo && <div className="sub">Ejecutivo: {l.ejecutivo.nombre}</div>}
                    {!l.etapa && <span className="sub">No respondió ({l.paso || 0} correos)</span>}
                  </>
                ) : (
                  <span className="sub">
                    {estado === 'en_secuencia' ? `Correo ${l.paso} de 4. Próximo: ${fecha(l.proximoEnvio)}` : `Actualizado ${fecha(l.actualizado)}`}
                  </span>
                )}
              </td>
              <td><Acciones lead={l} estado={estado === 'todas' ? l.estado : estado} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
