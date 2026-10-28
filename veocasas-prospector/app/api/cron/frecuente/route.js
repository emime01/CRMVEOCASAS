import { cicloFrecuente } from '@/lib/pasos';
import { autorizadoCron, reloj } from '@/lib/util';
import { CONFIG } from '@/lib/config';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req) {
  if (!autorizadoCron(req)) return new Response('No autorizado', { status: 401 });
  if (!CONFIG.agenteActivo) return Response.json({ omitido: 'agente pausado (AGENTE_ACTIVO no es true)' });
  return Response.json(await cicloFrecuente(reloj()));
}
