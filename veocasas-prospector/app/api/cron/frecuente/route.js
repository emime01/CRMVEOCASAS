import { cicloFrecuente } from '@/lib/pasos';
import { autorizadoCron, reloj } from '@/lib/util';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req) {
  if (!autorizadoCron(req)) return new Response('No autorizado', { status: 401 });
  return Response.json(await cicloFrecuente(reloj()));
}
