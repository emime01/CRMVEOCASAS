import { db, COL, FieldValue } from '@/lib/firebase';
import { firmar } from '@/lib/util';
import { excluir } from '@/lib/leads';
export const dynamic = 'force-dynamic';

async function darDeBaja(req) {
  const u = new URL(req.url);
  const id = u.searchParams.get('id');
  if (!id || u.searchParams.get('t') !== firmar(id)) return false;
  const ref = db().collection(COL).doc(id);
  const s = await ref.get();
  if (s.exists && s.data().estado !== 'baja') {
    await ref.update({ estado: 'baja', proximoEnvio: null, historial: FieldValue.arrayUnion({ tipo: 'baja_link', fecha: new Date() }) });
    await excluir(s.data(), 'link de baja');
  }
  return true;
}

const pagina = ok => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Veocasas</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#1a2421">
<h1 style="font-size:1.4rem">${ok ? 'Listo, no les vamos a escribir más.' : 'El enlace no es válido.'}</h1>
<p>${ok ? 'Quitamos su correo de nuestras comunicaciones comerciales.' : 'Respondan el último correo pidiendo la baja y la procesamos.'}</p></body>`,
  { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } },
);

export async function GET(req) { return pagina(await darDeBaja(req)); }
export async function POST(req) { return (await darDeBaja(req)) ? new Response('ok') : new Response('invalid', { status: 400 }); }
