import { leerDirectorio, aCSV } from '@/lib/directorio';
import { ETIQUETA } from '@/app/estados';
export const dynamic = 'force-dynamic';

// Protegido por middleware (clave del panel). Mismos filtros que la vista "Todas".
export async function GET(req) {
  const u = new URL(req.url);
  const { filtradas } = await leerDirectorio({ depto: u.searchParams.get('depto') || '', canal: u.searchParams.get('canal') || '', q: u.searchParams.get('q') || '' });
  const fecha = new Date().toISOString().slice(0, 10);
  return new Response(aCSV(filtradas, e => ETIQUETA[e] || e), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="inmobiliarias-${fecha}.csv"`,
    },
  });
}
