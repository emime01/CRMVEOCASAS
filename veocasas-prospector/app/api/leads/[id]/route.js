import { db, COL, FieldValue } from '@/lib/firebase';
import { cleanEmail } from '@/lib/normalize';
import { tieneMX } from '@/lib/enrich';
import { excluir } from '@/lib/leads';
export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  const { accion, email } = await req.json();
  const ref = db().collection(COL).doc(params.id);
  const s = await ref.get();
  if (!s.exists) return Response.json({ error: 'No existe' }, { status: 404 });
  const ev = extra => FieldValue.arrayUnion({ tipo: `manual_${accion}`, fecha: new Date(), ...extra });
  const base = { actualizado: FieldValue.serverTimestamp(), historial: ev() };

  switch (accion) {
    case 'reactivar':
      await ref.update({ ...base, estado: 'listo', paso: 0, threadId: null, proximoEnvio: null, reactivaciones: FieldValue.increment(1) });
      break;
    case 'email': {
      const e = cleanEmail(email);
      if (!e || !(await tieneMX(e))) return Response.json({ error: 'Ese correo no es válido o su dominio no recibe mails.' }, { status: 400 });
      await ref.update({ ...base, email: e, estado: 'listo', keys: FieldValue.arrayUnion(`em:${e}`) });
      break;
    }
    case 'manual': await ref.update({ ...base, estado: 'manual', proximoEnvio: null }); break;
    case 'descartar': await ref.update({ ...base, estado: 'descartado', proximoEnvio: null }); break;
    case 'cliente':
      await ref.update({ ...base, estado: 'cliente', proximoEnvio: null });
      await excluir(s.data(), 'cliente');
      break;
    default: return Response.json({ error: 'Acción desconocida' }, { status: 400 });
  }
  return Response.json({ ok: true });
}
