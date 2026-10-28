import { db, FieldValue, COL, JOBS, META } from './firebase.js';
import { CONFIG, FUENTES } from './config.js';
import { buscarPlaces, buscarGoogle } from './fuentes.js';
import { mapear } from './extract.js';
import { upsertLead, excluir, motivoExclusion, estadoExcluido } from './leads.js';
import { tieneMX, buscarEmailEnWeb, buscarWebs } from './enrich.js';
import { enviarCorreo, leerHilo, hayRespuestaNueva, listarMensajes, destinatarioRebotado, esMio } from './gmail.js';
import { clasificar } from './claude.js';
import { cleanEmail, domainOf } from './normalize.js';
import { addDays, ajustarHabil, esFinDeSemana, inicioDiaUY, render, pool, sleep, bajaUrl } from './util.js';

const ahora = () => new Date();
const evento = (tipo, extra = {}) => FieldValue.arrayUnion({ tipo, fecha: new Date(), ...extra });

/* ---------- 1. Prospección: busca en Places y Google y deja los resultados crudos en cola ---------- */
export async function guardarLote(fuente, items, tam = 20) {
  const d = db();
  for (let i = 0; i < items.length; i += tam) {
    await d.collection(JOBS).add({ fuente, items: items.slice(i, i + tam), offset: 0, done: false, creado: FieldValue.serverTimestamp() });
  }
}

export async function prospectar(vivo = () => true) {
  const res = {};
  for (const fuente of CONFIG.fuentesActivas) {
    const f = FUENTES[fuente];
    if (!f) continue;
    const items = [];
    for (const q of f.consultas()) {
      if (!vivo()) break;
      try {
        if (fuente === 'maps') {
          const lugares = await buscarPlaces(q, f.paginas);
          items.push(...lugares);
          if (lugares.topeAlcanzado) { res.topePlaces = true; break; }
        } else items.push({ consulta: q, resultados: await buscarGoogle(q, f.paginas) });
      } catch (e) {
        console.error(`[${fuente}]`, q, e.message);
        if (e.code === 'TOPE_PLACES') { res.topePlaces = true; break; }
      }
    }
    await guardarLote(fuente, items);
    res[fuente] = items.length;
  }
  await db().collection(META).doc('ultima_prospeccion').set({ fecha: ahora(), res });
  return res;
}

/* ---------- 2. Procesar la cola: normalizar, deduplicar y guardar ---------- */
export async function procesarJobs(vivo) {
  const jobs = await db().collection(JOBS).where('done', '==', false).orderBy('creado').limit(30).get();
  let leads = 0;
  for (const job of jobs.docs) {
    if (!vivo()) break;
    const { fuente, items, offset = 0 } = job.data();
    let i = offset;
    for (; i < items.length && vivo(); i++) {
      for (const c of await mapear(fuente, items[i]).catch(() => [])) {
        if (await upsertLead(c, fuente).catch(e => console.error('[upsert]', e.message))) leads++;
      }
    }
    await job.ref.update(i >= items.length ? { offset: i, done: true, terminado: ahora() } : { offset: i });
  }
  return { leads };
}

/* ---------- 3. Enriquecer: conseguir y validar email ---------- */
export async function enriquecer(vivo) {
  const snap = await db().collection(COL).where('estado', '==', 'nuevo').orderBy('creado').limit(150).get();
  const buscarWeb = [];
  let listos = 0, sinEmail = 0;

  await pool(snap.docs, 8, async doc => {
    const l = doc.data();
    let email = l.email && (await tieneMX(l.email)) ? l.email : null;
    if (!email && l.web) {
      const e = await buscarEmailEnWeb(l.web);
      if (e && (await tieneMX(e))) email = e;
    }
    if (email) {
      await doc.ref.update({ email, estado: 'listo', keys: FieldValue.arrayUnion(`em:${email}`), actualizado: FieldValue.serverTimestamp() });
      listos++; return;
    }
    const intentos = (l.intentosEnriquecer || 0) + 1;
    if (intentos === 1 && !l.web && l.nombre) buscarWeb.push(doc);
    const patch = { intentosEnriquecer: intentos, actualizado: FieldValue.serverTimestamp() };
    if (intentos >= 2) { patch.estado = 'sin_email'; sinEmail++; }
    await doc.ref.update(patch);
  }, vivo);

  if (buscarWeb.length && vivo()) {
    const lote = buscarWeb.slice(0, 40);
    const halla = await buscarWebs(lote.map(d => d.data().nombre)).catch(() => new Map());
    for (const doc of lote) {
      const h = halla.get(doc.data().nombre);
      if (!h) continue;
      const patch = {};
      if (h.web) { patch.web = h.web; patch.keys = FieldValue.arrayUnion(`dom:${domainOf(h.web)}`); }
      if (h.email && !doc.data().email) patch.email = h.email; // se valida con MX en la próxima pasada
      await doc.ref.update(patch);
    }
  }
  return { listos, sinEmail };
}

/* ---------- 4. Envíos: seguimientos vencidos + primeros correos dentro del cupo ---------- */
function vars(l, id) {
  return {
    nombre: l.nombre, zona: l.departamento || 'todo el país', agenda: CONFIG.agendaUrl,
    remitente: CONFIG.remitente.nombre, firma: CONFIG.firma, bajaUrl: bajaUrl(id),
  };
}
const conPie = (cuerpo, v) => render(cuerpo, v) + render(CONFIG.plantillas.pie, v);
const proximo = (primer, paso) => paso <= CONFIG.secuenciaDias.length
  ? ajustarHabil(addDays(primer, CONFIG.secuenciaDias[paso - 1]))
  : ajustarHabil(addDays(ahora(), CONFIG.graciaFinalDias));

// clientes o bajas cargados después de crear el lead: se revisa justo antes de cada envío
async function frenarSiExcluido(doc, l) {
  const motivo = await motivoExclusion(l.keys);
  if (!motivo) return false;
  await doc.ref.update({
    estado: estadoExcluido(motivo), proximoEnvio: null, historial: evento('excluido', { motivo }),
    actualizado: FieldValue.serverTimestamp(),
  });
  return true;
}

export async function enviar(vivo) {
  if (esFinDeSemana()) return { omitido: 'fin de semana' };
  const d = db();
  const res = { seguimientos: 0, iniciales: 0, sinRespuesta: 0, excluidos: 0 };
  const totalPasos = CONFIG.secuenciaDias.length + 1;

  const vencidos = await d.collection(COL).where('estado', 'in', ['en_secuencia', 'conversando'])
    .where('proximoEnvio', '<=', ahora()).orderBy('proximoEnvio').limit(150).get();

  for (const doc of vencidos.docs) {
    if (!vivo()) break;
    const l = doc.data();
    if (l.estado === 'conversando' || l.paso >= totalPasos) {
      await doc.ref.update({ estado: 'sin_respuesta', proximoEnvio: null, sinRespuestaEn: ahora(), historial: evento('sin_respuesta') });
      res.sinRespuesta++; continue;
    }
    // desde lo último ya visto: si no, un "fuera de oficina" ya procesado frena la secuencia para siempre
    const desde = Math.max(l.ultimoEnvio?.toMillis?.() || 0, l.ultimoInboundProcesado || 0);
    if (await hayRespuestaNueva(l.threadId, desde)) continue; // la toma revisarRespuestas
    if (await frenarSiExcluido(doc, l)) { res.excluidos++; continue; }
    const v = vars(l, doc.id);
    const r = await enviarCorreo({
      to: l.email, subject: `Re: ${l.asunto}`, text: conPie(CONFIG.plantillas.seguimientos[l.paso - 1], v),
      threadId: l.threadId, inReplyTo: l.ultimoMessageId, references: l.referencias, unsubscribeUrl: v.bajaUrl,
    });
    const paso = l.paso + 1;
    await doc.ref.update({
      paso, ultimoEnvio: ahora(), ultimoMessageId: r.messageId,
      referencias: [l.referencias, r.messageId].filter(Boolean).join(' '),
      proximoEnvio: proximo(l.primerEnvio.toDate(), paso), historial: evento('seguimiento', { paso }),
      actualizado: FieldValue.serverTimestamp(),
    });
    res.seguimientos++;
    await sleep(2000 + Math.random() * 2000);
  }

  const hoy = (await d.collection(COL).where('primerEnvio', '>=', inicioDiaUY()).count().get()).data().count;
  const cupo = CONFIG.cupoDiario - hoy;
  if (cupo > 0 && vivo()) {
    const listos = await d.collection(COL).where('estado', '==', 'listo').orderBy('creado').limit(cupo).get();
    for (const doc of listos.docs) {
      if (!vivo()) break;
      const l = doc.data();
      if (await frenarSiExcluido(doc, l)) { res.excluidos++; continue; }
      const v = vars(l, doc.id);
      const asunto = render(CONFIG.plantillas.inicial.asunto, v);
      const r = await enviarCorreo({ to: l.email, subject: asunto, text: conPie(CONFIG.plantillas.inicial.cuerpo, v), unsubscribeUrl: v.bajaUrl });
      const t = ahora();
      await doc.ref.update({
        estado: 'en_secuencia', paso: 1, asunto, threadId: r.threadId, ultimoMessageId: r.messageId, referencias: r.messageId,
        primerEnvio: t, ultimoEnvio: t, proximoEnvio: proximo(t, 1), historial: evento('inicial'),
        actualizado: FieldValue.serverTimestamp(),
      });
      res.iniciales++;
      await sleep(2000 + Math.random() * 2000);
    }
  }
  return res;
}

/* ---------- 5. Respuestas: detecta, clasifica y actúa ---------- */
async function asignarEjecutivo(etapa, depto) {
  const lista = CONFIG.ejecutivos.filter(e =>
    (!e.etapas || e.etapas.includes(etapa)) && (!e.departamentos?.length || e.departamentos.includes(depto)));
  const candidatos = lista.length ? lista : CONFIG.ejecutivos.filter(e => !e.etapas || e.etapas.includes(etapa));
  if (!candidatos.length) return null;
  const ref = db().collection(META).doc(`rr_${etapa}`);
  const n = await db().runTransaction(async t => {
    const s = await t.get(ref);
    const n = s.exists ? s.data().n : 0;
    t.set(ref, { n: n + 1 });
    return n;
  });
  return candidatos[n % candidatos.length];
}

async function derivar(doc, l, base, etapa, ultimo, c) {
  const ej = await asignarEjecutivo(etapa, l.departamento);
  const v = vars(l, doc.id);
  const referencias = [l.referencias, ultimo.messageId].filter(Boolean).join(' ');
  let threadPatch = {};
  if (ej) {
    const texto = render(CONFIG.plantillas.derivacion, {
      saludo: c.contacto ? `Gracias, ${c.contacto}.` : 'Muchas gracias por responder.',
      ejecutivo: ej.nombre, ejecutivoEmail: ej.email,
    }) + render(CONFIG.plantillas.pie, v);
    const r = await enviarCorreo({
      to: l.email, cc: ej.email, subject: `Re: ${l.asunto}`, text: texto,
      threadId: l.threadId, inReplyTo: ultimo.messageId, references: referencias, unsubscribeUrl: v.bajaUrl,
    });
    threadPatch = { ultimoMessageId: r.messageId, referencias: `${referencias} ${r.messageId}`, ultimoEnvio: ahora() };
  }
  const aviso = [
    `${etapa === 'cierre' ? 'LISTO PARA CERRAR' : 'Lead caliente'} (score ${c.score}/100): ${l.nombre}`,
    '', `Resumen: ${c.resumen || '-'}`, '',
    `Email: ${l.email}`, `Teléfono: ${l.telefono || '-'}`, `Web: ${l.web || '-'}`,
    `Instagram: ${l.instagram ? '@' + l.instagram : '-'}`, `Zona: ${l.departamento || '-'}`, `Origen: ${(l.fuentes || []).join(', ')}`,
    '', 'Último mensaje:', ultimo.texto.split('\n').map(x => `> ${x}`).join('\n'), '',
    ej ? 'Ya te presenté en el hilo (estás en copia). Seguí directo con "Responder a todos".'
       : 'No hay ejecutivo configurado para esta etapa: asignalo a mano.',
    `Panel: ${CONFIG.baseUrl}/?estado=derivado`,
  ].join('\n');
  const para = ej?.email || CONFIG.adminEmail;
  if (para) {
    await enviarCorreo({
      to: para, cc: ej && CONFIG.adminEmail && CONFIG.adminEmail !== ej.email ? CONFIG.adminEmail : undefined,
      subject: `[Veocasas] ${etapa === 'cierre' ? 'Cierre' : 'Caliente'}: ${l.nombre}`, text: aviso,
    });
  }
  await doc.ref.update({
    ...base, ...threadPatch, estado: 'derivado', etapa, ejecutivo: ej || null, derivadoEn: ahora(), proximoEnvio: null,
    historial: FieldValue.arrayUnion(
      { tipo: 'respuesta', fecha: new Date(), etapa: c.etapa, resumen: c.resumen || '' },
      { tipo: 'derivado', fecha: new Date(), ejecutivo: ej?.nombre || null },
    ),
  });
}

async function procesarHilo(doc) {
  const l = doc.data();
  const msgs = await leerHilo(l.threadId);
  const nuevos = msgs.filter(m => !esMio(m.from) && m.internalDate > (l.ultimoInboundProcesado || 0));
  if (!nuevos.length) return null;
  const ultimo = nuevos[nuevos.length - 1];

  if (/mailer-daemon|postmaster/i.test(ultimo.from)) {
    await doc.ref.update({ estado: 'rebotado', proximoEnvio: null, ultimoInboundProcesado: ultimo.internalDate, historial: evento('rebote') });
    return 'rebotado';
  }

  const historial = msgs.slice(-6).map(m => `${esMio(m.from) ? 'VEOCASAS' : 'INMOBILIARIA'}: ${m.texto.slice(0, 1500)}`).join('\n\n');
  const c = await clasificar({ nombre: l.nombre, historial, ultimo: nuevos.map(m => m.texto).join('\n\n') });
  const base = {
    ultimoInboundProcesado: ultimo.internalDate, etapa: c.etapa, score: c.score, resumenIA: c.resumen || null,
    contacto: c.contacto || l.contacto || null, actualizado: FieldValue.serverTimestamp(),
  };
  const registro = evento('respuesta', { etapa: c.etapa, resumen: c.resumen || '' });

  switch (c.etapa) {
    case 'fuera_oficina':
      await doc.ref.update({ ...base, historial: registro }); break;
    case 'baja':
      await doc.ref.update({ ...base, estado: 'baja', proximoEnvio: null, historial: registro });
      await excluir(l, 'pidió la baja por correo'); break;
    case 'no_interesado':
      await doc.ref.update({ ...base, estado: 'no_interesado', proximoEnvio: null, historial: registro }); break;
    case 'redirige': {
      const nuevo = cleanEmail(c.nuevo_email);
      if (nuevo && nuevo !== l.email && (await tieneMX(nuevo))) {
        await doc.ref.update({
          ...base, estado: 'listo', email: nuevo, emailAnterior: l.email, paso: 0, threadId: null, proximoEnvio: null,
          keys: FieldValue.arrayUnion(`em:${nuevo}`), historial: registro,
        });
      } else await derivar(doc, l, base, 'caliente', ultimo, c);
      break;
    }
    case 'info':
      if (CONFIG.autoResponderInfo && c.puede_responder && c.respuesta) {
        const v = vars(l, doc.id);
        const referencias = [l.referencias, ultimo.messageId].filter(Boolean).join(' ');
        const r = await enviarCorreo({
          to: l.email, subject: `Re: ${l.asunto}`, text: c.respuesta + render(CONFIG.plantillas.pie, v),
          threadId: l.threadId, inReplyTo: ultimo.messageId, references: referencias, unsubscribeUrl: v.bajaUrl,
        });
        await doc.ref.update({
          ...base, estado: 'conversando', ultimoEnvio: ahora(), ultimoMessageId: r.messageId,
          referencias: `${referencias} ${r.messageId}`,
          proximoEnvio: ajustarHabil(addDays(ahora(), CONFIG.conversacionSinRespuestaDias)),
          historial: FieldValue.arrayUnion(
            { tipo: 'respuesta', fecha: new Date(), etapa: 'info', resumen: c.resumen || '' },
            { tipo: 'respuesta_agente', fecha: new Date() },
          ),
        });
      } else await derivar(doc, l, base, 'caliente', ultimo, c);
      break;
    case 'cierre':
      await derivar(doc, l, base, 'cierre', ultimo, c); break;
    default:
      await derivar(doc, l, base, 'caliente', ultimo, c);
  }
  return c.etapa;
}

export async function revisarRespuestas(vivo) {
  const d = db();
  const res = { revisados: 0, etapas: {} };
  const mensajes = await listarMensajes(`-from:${CONFIG.remitente.email} newer_than:4d`);
  const hilos = [...new Set(mensajes.map(m => m.threadId))];

  for (let i = 0; i < hilos.length && vivo(); i += 30) {
    const snap = await d.collection(COL).where('threadId', 'in', hilos.slice(i, i + 30)).get();
    for (const doc of snap.docs) {
      if (!vivo()) break;
      if (!['en_secuencia', 'conversando'].includes(doc.data().estado)) continue;
      try {
        const etapa = await procesarHilo(doc);
        if (etapa) { res.revisados++; res.etapas[etapa] = (res.etapas[etapa] || 0) + 1; }
      } catch (e) { console.error('[hilo]', doc.id, e.message); }
    }
  }

  // rebotes que Gmail no agrupó en el hilo original
  for (const m of await listarMensajes('from:(mailer-daemon OR postmaster) newer_than:4d', 200)) {
    if (!vivo()) break;
    const email = await destinatarioRebotado(m.id).catch(() => null);
    if (!email) continue;
    const snap = await d.collection(COL).where('keys', 'array-contains', `em:${email}`).limit(1).get();
    const doc = snap.docs[0];
    if (doc && doc.data().estado === 'en_secuencia') {
      await doc.ref.update({ estado: 'rebotado', proximoEnvio: null, historial: evento('rebote') });
      res.etapas.rebotado = (res.etapas.rebotado || 0) + 1;
    }
  }
  return res;
}

/* ---------- Orquestadores ---------- */
export async function cicloDiario(hasta) {
  return {
    respuestas: await revisarRespuestas(hasta(70_000)),
    procesar: await procesarJobs(hasta(130_000)),
    enriquecer: await enriquecer(hasta(185_000)),
    enviar: await enviar(hasta(285_000)),
  };
}

export async function cicloFrecuente(hasta) {
  return {
    respuestas: await revisarRespuestas(hasta(90_000)),
    procesar: await procesarJobs(hasta(180_000)),
    enriquecer: await enriquecer(hasta(280_000)),
  };
}
