import { cicloDiario, cicloFrecuente, prospectar, reintentarSinEmail, buscarDirectorios } from '@/lib/pasos';
import { reloj } from '@/lib/util';
import { fusionarRepetidas } from '@/lib/fusion';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Protegido por middleware (clave del panel)
export async function POST(req) {
  const paso = new URL(req.url).searchParams.get('paso');
  try {
    if (paso === 'prospectar') return Response.json({ encontrados: await prospectar(reloj()(280_000)) });
    // fusionar: ?aplicar=1 para escribir; sin eso muestra qué haría
    if (paso === 'fusionar') return Response.json(await fusionarRepetidas({ aplicar: new URL(req.url).searchParams.get('aplicar') === '1' }));
    if (paso === 'directorios') return Response.json(await buscarDirectorios(reloj()(280_000), new URL(req.url).searchParams.get('solo') || ''));
    if (paso === 'reintentar_sin_email') return Response.json(await reintentarSinEmail());
    if (paso === 'frecuente') return Response.json(await cicloFrecuente(reloj()));
    return Response.json(await cicloDiario(reloj()));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
