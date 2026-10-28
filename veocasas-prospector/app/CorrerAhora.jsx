'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CorrerAhora() {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function correr(paso, etiqueta) {
    setOcupado(true); setMsg(`${etiqueta}…`);
    const r = await fetch(`/api/admin/run?paso=${paso}`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    setOcupado(false);
    if (!r.ok) return setMsg(`Falló: ${j.error || r.status}`);
    if (paso === 'prospectar') setMsg(`Búsqueda lista: ${j.encontrados?.maps ?? 0} lugares en Maps y ${j.encontrados?.google ?? 0} búsquedas en Google. Se procesan en el próximo ciclo.`);
    else setMsg(`Listo: ${j.enviar?.iniciales ?? 0} correos nuevos, ${j.enviar?.seguimientos ?? 0} seguimientos, ${j.respuestas?.revisados ?? 0} respuestas leídas.`);
    router.refresh();
  }

  return (
    <div className="correr">
      {msg && <span className="estado" role="status">{msg}</span>}
      <button disabled={ocupado} onClick={() => correr('prospectar', 'Buscando (puede tardar unos minutos)')}>Buscar inmobiliarias</button>
      <button className="primario" disabled={ocupado} onClick={() => correr('diario', 'Corriendo el ciclo')}>Correr ciclo de hoy</button>
    </div>
  );
}
