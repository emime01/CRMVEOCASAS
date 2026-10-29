import { db, COL } from '@/lib/firebase';
import { toISO } from '@/lib/util';
import { CONFIG, DEPARTAMENTOS } from '@/lib/config';
import { leerDirectorio, CANALES } from '@/lib/directorio';
import { FLUJO, EVALUAR, OTROS, TODAS, AYUDA } from './estados';
import TablaLeads from './TablaLeads';
import CorrerAhora from './CorrerAhora';

export const dynamic = 'force-dynamic';

const CAMPOS = ['nombre', 'web', 'email', 'telefono', 'instagram', 'departamento', 'fuentes', 'estado', 'paso',
  'etapa', 'score', 'resumenIA', 'contacto', 'ejecutivo', 'proximoEnvio', 'actualizado', 'primerEnvio', 'whatsapp'];

export default async function Panel({ searchParams }) {
  const d = db();
  const todos = [...FLUJO, EVALUAR, ...OTROS];
  // la vista principal es la base completa de inmobiliarias; las etapas del correo son vistas de detalle
  const estado = todos.some(([e]) => e === searchParams?.estado) ? searchParams.estado : 'todas';
  const depto = searchParams?.depto || '';
  const canal = CANALES.some(([c]) => c === searchParams?.canal) ? searchParams.canal : '';

  const [conteos, dir, snap] = await Promise.all([
    Promise.all(todos.map(([e]) => d.collection(COL).where('estado', '==', e).count().get().then(r => [e, r.data().count]))),
    leerDirectorio(estado === 'todas' ? { depto, canal } : {}),
    estado === 'todas' ? null : d.collection(COL).where('estado', '==', estado).orderBy('actualizado', 'desc').limit(200).get(),
  ]);
  const n = Object.fromEntries(conteos);
  const leads = snap ? snap.docs.map(doc => {
    const x = doc.data();
    const out = { id: doc.id };
    for (const k of CAMPOS) out[k] = ['proximoEnvio', 'actualizado', 'primerEnvio'].includes(k) ? toISO(x[k]) : x[k] ?? null;
    return out;
  }) : dir.filtradas.slice(0, 300);
  const titulo = estado === 'todas' ? TODAS[1] : todos.find(([e]) => e === estado)[1];
  const r = dir.resumen;
  const filtros = new URLSearchParams({ ...(depto && { depto }), ...(canal && { canal }) }).toString();

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>Prospección de inmobiliarias</h1>
          <p>El agente encuentra inmobiliarias, les escribe y le pasa las interesadas a un ejecutivo.</p>
        </div>
        <CorrerAhora />
      </header>

      {(CONFIG.modoPrueba || !CONFIG.agenteActivo) && (
        <div className="aviso" role="note">
          {CONFIG.modoPrueba && <p><strong>Modo prueba:</strong> todos los correos van a {CONFIG.modoPrueba}, ninguno a inmobiliarias ni ejecutivos.</p>}
          {!CONFIG.agenteActivo && <p><strong>Agente pausado:</strong> los ciclos automáticos no corren. Usá los botones de arriba para probar a mano.</p>}
        </div>
      )}

      <a href="/" className={`directorio ${estado === 'todas' ? 'actual' : ''}`} aria-current={estado === 'todas' ? 'page' : undefined}>
        <span className="n">{r.total.toLocaleString('es-UY')}</span>
        <span className="l">inmobiliarias encontradas</span>
        <span className="det">
          {r.email.toLocaleString('es-UY')} con email · {r.whatsapp.toLocaleString('es-UY')} con WhatsApp
          · {r.telefono.toLocaleString('es-UY')} con teléfono · {r.instagram.toLocaleString('es-UY')} con Instagram
          · {r.ninguno.toLocaleString('es-UY')} sin ningún contacto
        </span>
      </a>

      <nav className="flujo" aria-label="Etapas del flujo">
        {[...FLUJO, EVALUAR].map(([e, l]) => (
          <a key={e} href={`/?estado=${e}`} aria-current={e === estado ? 'page' : undefined}
             className={`etapa ${e === 'sin_respuesta' ? 'evaluar' : n[e] ? 'activa' : ''}`}>
            <span className="n">{n[e].toLocaleString('es-UY')}</span>
            <span className="l">{l}</span>
          </a>
        ))}
      </nav>
      <nav className="otros" aria-label="Fuera del flujo">
        {OTROS.map(([e, l]) => (
          <a key={e} href={`/?estado=${e}`} aria-current={e === estado ? 'page' : undefined}>{l}: {n[e]}</a>
        ))}
      </nav>

      <section className="seccion">
        <h2>{titulo}</h2>
        {AYUDA[estado] && <p className="ayuda">{AYUDA[estado]}</p>}
        {estado === 'todas' && (
          <form className="filtros" method="get" action="/">
            <label>Departamento
              <select name="depto" defaultValue={depto}>
                <option value="">Todos</option>
                {DEPARTAMENTOS.map(x => <option key={x} value={x}>{x}</option>)}
                <option value="sin">Sin identificar</option>
              </select>
            </label>
            <label>Contacto
              <select name="canal" defaultValue={canal}>
                {CANALES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
            <button type="submit">Filtrar</button>
            <a className="btn" href={`/api/export${filtros ? '?' + filtros : ''}`}>Descargar Excel ({dir.filtradas.length.toLocaleString('es-UY')})</a>
            <span className="sub">Mostrando {leads.length.toLocaleString('es-UY')} de {dir.filtradas.length.toLocaleString('es-UY')}</span>
          </form>
        )}
        <TablaLeads leads={leads} estado={estado} />
      </section>
    </main>
  );
}
