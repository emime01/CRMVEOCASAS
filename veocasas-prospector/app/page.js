import { db, COL } from '@/lib/firebase';
import { toISO } from '@/lib/util';
import { FLUJO, EVALUAR, OTROS, AYUDA } from './estados';
import TablaLeads from './TablaLeads';
import CorrerAhora from './CorrerAhora';

export const dynamic = 'force-dynamic';

const CAMPOS = ['nombre', 'web', 'email', 'telefono', 'instagram', 'departamento', 'fuentes', 'estado', 'paso',
  'etapa', 'score', 'resumenIA', 'contacto', 'ejecutivo', 'proximoEnvio', 'actualizado', 'primerEnvio'];

export default async function Panel({ searchParams }) {
  const d = db();
  const todos = [...FLUJO, EVALUAR, ...OTROS];
  const estado = todos.some(([e]) => e === searchParams?.estado) ? searchParams.estado : 'sin_respuesta';

  const [conteos, snap] = await Promise.all([
    Promise.all(todos.map(([e]) => d.collection(COL).where('estado', '==', e).count().get().then(r => [e, r.data().count]))),
    d.collection(COL).where('estado', '==', estado).orderBy('actualizado', 'desc').limit(200).get(),
  ]);
  const n = Object.fromEntries(conteos);
  const leads = snap.docs.map(doc => {
    const x = doc.data();
    const out = { id: doc.id };
    for (const k of CAMPOS) out[k] = ['proximoEnvio', 'actualizado', 'primerEnvio'].includes(k) ? toISO(x[k]) : x[k] ?? null;
    return out;
  });
  const titulo = todos.find(([e]) => e === estado)[1];

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>Prospección de inmobiliarias</h1>
          <p>El agente encuentra inmobiliarias, les escribe y le pasa las interesadas a un ejecutivo.</p>
        </div>
        <CorrerAhora />
      </header>

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
        <TablaLeads leads={leads} estado={estado} />
      </section>
    </main>
  );
}
