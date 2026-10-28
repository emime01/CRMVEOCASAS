import { cicloDiario, cicloFrecuente, prospectar } from '@/lib/pasos';
import { reloj } from '@/lib/util';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Protegido por middleware (clave del panel)
export async function POST(req) {
  const paso = new URL(req.url).searchParams.get('paso');
  try {
    if (paso === 'prospectar') return Response.json({ encontrados: await prospectar(reloj()(280_000)) });
    if (paso === 'frecuente') return Response.json(await cicloFrecuente(reloj()));
    return Response.json(await cicloDiario(reloj()));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
