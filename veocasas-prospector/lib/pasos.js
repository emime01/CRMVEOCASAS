import { db, FieldValue, COL, JOBS, META } from './firebase.js';
import { CONFIG, FUENTES } from './config.js';
import { buscarPlaces, buscarGoogle, leerDirectorio } from './fuentes.js';
import { mapear } from './extract.js';
import { upsertLead, excluir, motivoExclusion, estadoExcluido } from './leads.js';
import { tieneMX, buscarContactoEnWeb, buscarContactosEnGoogle } from './enrich.js';
import { enviarCorreo, leerHilo, hayRespuestaNueva, listarMensajes, destinatarioRebotado, esMio } from './gmail.js';
import { clasificar } from './claude.js';
import { sincronizarClientesCRM } from './crm.js';
import { cleanEmail, domainOf, esBloqueado } from './normalize.js';
import { addDays, ajustarHabil, esFinDeSemana, inicioDiaUY, render, pool, sleep, bajaUrl } from './util.js';

const ahora = () => new Date();
const evento = (tipo, extra = {}) => FieldValue.arrayUnion({ tipo, fecha: new Date(), ...extra });

/* ---------- 1. Prospección: Places, Google y directorios; los resultados crudos van a la cola ---------- */
export async function guardarLote(fuente, items, tam = 20) {
  const d = db();
  for (let i = 0; i < items.length; i += tam) {
    await d.collection(JOBS).add({ fuente, items: items.slice(i, i + tam), offset: 0, done: false, creado: FieldValue.serverTimestamp() });
  }
}

const tareasBusqueda = () => CONFIG.fuentesActivas.flatMap(fuente =>
  FUENTES[fuente] ? FUENTES[fuente].consultas().map(c => ({ fuente, ...c })) : []);

const refBusqueda = () => db().collection(META).doc('busqueda');
export async function busquedaEnCurso() {
  const s = (await refBusqueda().get()).data();
  return Boolean(s && !s.terminada);
}

// La búsqueda completa (~220 consultas y directorios) no entra en una corrida de 300 s:
// avanza tarea por tarea, guarda en meta/busqueda por dónde va y la próxima llamada sigue desde ahí.
// Cuando termina, la llamada siguiente arranca una búsqueda nueva (lo repetido se fusiona al procesar).
export async function prospectar(vivo = () => true) {
  const ref = refBusqueda();
  const lista = tareasBusqueda();
  const previa = (await ref.get()).data();
  let { idx = 0, sinMaps = false, totales = {} } = previa && !previa.terminada ? previa : {};
  if (!previa || previa.terminada) await ref.set({ idx: 0, total: lista.length, iniciada: ahora(), terminada: null, sinMaps, totales });

  for (; idx < lista.length && vivo(); idx++) {
    const t = lista[idx];
    if (t.fuente === 'maps' && sinMaps) continue;
    try {
      let items = [];
      if (t.fuente === 'maps') {
        const lugares = await buscarPlaces(t.q, FUENTES.maps.paginas);
        items = lugares.map(l => ({ ...l, depto: t.depto }));
        if (lugares.topeAlcanzado) sinMaps = true;
      } else if (t.fuente === 'google') {
        items = [{ consulta: t.q, depto: t.depto, resultados: await buscarGoogle(t.q, FUENTES.google.paginas) }];
      } else if (t.fuente === 'directorios') {
        items = (await leerDirectorio(t.q)).map(x => ({ ...x, depto: t.depto }));
      }
      await guardarLote(t.fuente, items, t.fuente === 'directorios' ? 10 : 20);
      totales[t.fuente] = (totales[t.fuente] || 0) + items.length;
    } catch (e) {
      console.error(`[${t.fuente}]`, t.q, e.message);
      if (e.code === 'TOPE_PLACES') sinMaps = true;
    }
    await ref.update({ idx: idx + 1, sinMaps, totales });
  }
  const terminada = idx >= lista.length;
  if (terminada) await ref.update({ terminada: ahora() });
  return { ...totales, topePlaces: sinMaps, consultas: idx, total: lista.length, terminada };
}

// Solo cámaras y portales, sin tocar la búsqueda de Maps y Google (para sumar directorios nuevos).
// solo: parte de la URL para leer uno puntual (ej. 'gallito')
export async function buscarDirectorios(vivo = () => true, solo = '') {
  let registros = 0;
  for (const t of FUENTES.directorios.consultas().filter(c => !solo || c.q.includes(solo))) {
    if (!vivo()) break;
    try {
      const items = (await leerDirectorio(t.q)).map(x => ({ ...x, depto: t.depto }));
      await guardarLote('directorios', items, 10);
      registros += items.length;
    } catch (e) { console.error('[directorios]', t.q, e.message); }
  }
  return { directorios: registros };
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

/* ---------- 3. Enriquecer: conseguir y validar email (y WhatsApp de paso) ---------- */
// Pasada 1: email existente con MX, si no la web (incluye emails de Cloudflare y el WhatsApp).
// Si no aparece: Google (por dominio, por perfil de Instagram o por nombre). Lo que traiga se valida en la pasada 2.
// Solo pasa a sin_email después de probar web y Google.
export async function enriquecer(vivo) {
  const snap = await db().collection(COL).where('estado', '==', 'nuevo').orderBy('creado').limit(150).get();
  const aGoogle = [];
  let listos = 0, sinEmail = 0;

  await pool(snap.docs, 8, async doc => {
    const l = doc.data();
    const intentos = (l.intentosEnriquecer || 0) + 1;
    const patch = { intentosEnriquecer: intentos, actualizado: FieldValue.serverTimestamp() };
    let email = l.email && (await tieneMX(l.email)) ? l.email : null;
    const web = l.web && !esBloqueado(domainOf(l.web)) ? l.web : null;
    if (!email && web && l.webRevisada !== web) {
      const r = await buscarContactoEnWeb(web);
      patch.webRevisada = web;
      if (r.whatsapp && !l.whatsapp) patch.whatsapp = r.whatsapp;
      if (r.email && (await tieneMX(r.email))) email = r.email;
    }
    if (email) {
      await doc.ref.update({ ...patch, email, estado: 'listo', keys: FieldValue.arrayUnion(`em:${email}`) });
      listos++; return;
    }
    if (!l.googleBuscado) aGoogle.push({ doc, l: { ...l, id: doc.id } });
    else if (intentos >= 2) { patch.estado = 'sin_email'; sinEmail++; }
    await doc.ref.update(patch);
  }, vivo);

  if (aGoogle.length && vivo()) {
    const halla = await buscarContactosEnGoogle(aGoogle.map(x => x.l), vivo).catch(e => { console.error('[google]', e.message); return null; });
    if (halla) {
      for (const { doc, l } of aGoogle) {
        if (!halla.has(l.id)) continue; // no llegó a buscarse: queda para la próxima corrida
        const h = halla.get(l.id);
        const patch = { googleBuscado: true, googleError: h.error || null };
        if (h.web) { patch.web = h.web; patch.keys = FieldValue.arrayUnion(`dom:${domainOf(h.web)}`); }
        if (h.email && !l.email) patch.email = h.email; // se valida con MX en la próxima pasada
        if (h.whatsapp && !l.whatsapp) patch.whatsapp = h.whatsapp;
        await doc.ref.update(patch);
      }
    }
  }
  return { listos, sinEmail };
}

// Vuelve a buscar el email de las que quedaron sin email (después de mejorar la búsqueda)
export async function reintentarSinEmail() {
  const d = db();
  const snap = await d.collection(COL).where('estado', '==', 'sin_email').get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const b = d.batch();
    for (const doc of snap.docs.slice(i, i + 400)) {
      b.update(doc.ref, {
        estado: 'nuevo', intentosEnriquecer: 0, googleBuscado: false, webRevisada: FieldValue.delete(),
        actualizado: FieldValue.serverTimestamp(), historial: evento('reintento_email'),
      });
    }
    await b.commit();
  }
  return { reintentadas: snap.size };
}

/* ---------- 4. Envíos: seguimientos vencidos + primeros correos dentro del cupo ---------- */
function vars(l, id) {
  return {
    nombre: l.nombre, zona: l.departamento || 'todo el país', agenda: CONFIG.agendaUrl,
    remitente: CONFIG.remitente.nombre, firma: CONFIG.firma, bajaUrl: bajaUrl(id),
  };
}
const conPie = (cuerpo, v) => render(cuerpo, v) + render(CONFIG.plantillas.pie, v);
// la segunda ronda (reactivación) tiene su propio texto y un solo recordatorio
const secuencia = l => (l.ronda === 2 ? CONFIG.secuenciaDiasRonda2 : CONFIG.secuenciaDias);
const seguimientosDe = l => (l.ronda === 2 ? CONFIG.plantillas.seguimientosRonda2 : CONFIG.plantillas.seguimientos);
const proximo = (primer, paso, dias = CONFIG.secuenciaDias) => paso <= dias.length
  ? ajustarHabil(addDays(primer, dias[paso - 1]))
  : ajustarHabil(addDays(ahora(), CONFIG.graciaFinalDias));
// al cerrar la primera ronda se agenda la segunda; después de esa, solo contacto humano desde el CRM
const agendarReintento = (l, motivo) => ({ reintentarEn: (l.ronda || 1) < 2 ? addDays(ahora(), CONFIG.reactivarDias[motivo]) : null });

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

// Nunca dos secuencias al mismo email: si otro registro con ese email ya fue contactado (o quedó cerrado),
// este pasa a duplicado. Cubre las repetidas que la fusión no alcanzó a unir.
const YA_CONTACTADOS = ['en_secuencia', 'conversando', 'derivado', 'sin_respuesta', 'no_interesado', 'rebotado', 'baja', 'cliente', 'manual'];
async function frenarSiYaEscrito(doc, l) {
  const otros = await db().collection(COL).where('keys', 'array-contains', `em:${l.email}`).get();
  const previo = otros.docs.find(o => o.id !== doc.id && YA_CONTACTADOS.includes(o.data().estado));
  if (!previo) return false;
  await doc.ref.update({
    estado: 'duplicado', duplicadoDe: previo.id, proximoEnvio: null, keys: [],
    historial: evento('duplicado', { de: previo.id, motivo: 'mismo email ya contactado' }), actualizado: FieldValue.serverTimestamp(),
  });
  return true;
}

export async function enviar(vivo) {
  if (esFinDeSemana()) return { omitido: 'fin de semana' };
  const d = db();
  const res = { seguimientos: 0, iniciales: 0, sinRespuesta: 0, excluidos: 0, duplicados: 0 };
  const vencidos = await d.collection(COL).where('estado', 'in', ['en_secuencia', 'conversando'])
    .where('proximoEnvio', '<=', ahora()).orderBy('proximoEnvio').limit(150).get();

  for (const doc of vencidos.docs) {
    if (!vivo()) break;
    const l = doc.data();
    if (l.estado === 'conversando' || l.paso >= secuencia(l).length + 1) {
      await doc.ref.update({
        estado: 'sin_respuesta', proximoEnvio: null, sinRespuestaEn: ahora(), ...agendarReintento(l, 'sin_respuesta'),
        historial: evento('sin_respuesta'),
      });
      res.sinRespuesta++; continue;
    }
    // desde lo último ya visto: si no, un "fuera de oficina" ya procesado frena la secuencia para siempre
    const desde = Math.max(l.ultimoEnvio?.toMillis?.() || 0, l.ultimoInboundProcesado || 0);
    if (await hayRespuestaNueva(l.threadId, desde)) continue; // la toma revisarRespuestas
    if (await frenarSiExcluido(doc, l)) { res.excluidos++; continue; }
    const v = vars(l, doc.id);
    const r = await enviarCorreo({
      to: l.email, subject: `Re: ${l.asunto}`, text: conPie(seguimientosDe(l)[l.paso - 1], v),
      threadId: l.threadId, inReplyTo: l.ultimoMessageId, references: l.referencias, unsubscribeUrl: v.bajaUrl,
    });
    const paso = l.paso + 1;
    await doc.ref.update({
      paso, ultimoEnvio: ahora(), ultimoMessageId: r.messageId,
      referencias: [l.referencias, r.messageId].filter(Boolean).join(' '),
      proximoEnvio: proximo(l.primerEnvio.toDate(), paso, secuencia(l)), historial: evento('seguimiento', { paso }),
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
      if (await frenarSiYaEscrito(doc, l)) { res.duplicados++; continue; }
      // asignada por la gerente a un vendedor: la contacta una persona, no el agente
      if (l.asignadoA) {
        await doc.ref.update({ estado: 'manual', historial: evento('asignada_no_se_envia', { a: l.asignadoA }), actualizado: FieldValue.serverTimestamp() });
        continue;
      }
      const v = vars(l, doc.id);
      const tpl = l.ronda === 2 ? CONFIG.plantillas.reactivacion[l.reactivacion] || CONFIG.plantillas.reactivacion.sin_respuesta : CONFIG.plantillas.inicial;
      const asunto = render(tpl.asunto, v);
      const r = await enviarCorreo({ to: l.email, subject: asunto, text: conPie(tpl.cuerpo, v), unsubscribeUrl: v.bajaUrl });
      const t = ahora();
      await doc.ref.update({
        estado: 'en_secuencia', paso: 1, asunto, threadId: r.threadId, ultimoMessageId: r.messageId, referencias: r.messageId,
        primerEnvio: t, ultimoEnvio: t, proximoEnvio: proximo(t, 1, secuencia(l)), historial: evento(l.ronda === 2 ? 'inicial_ronda2' : 'inicial'),
        actualizado: FieldValue.serverTimestamp(),
      });
      res.iniciales++;
      await sleep(2000 + Math.random() * 2000);
    }
  }
  return res;
}

/* ---------- 5. Respuestas: detecta, clasifica y actúa ---------- */
// La gerente comercial asigna vendedores desde el CRM (asignadoA, con el id de usuario del CRM).
// Si una interesada ya tiene vendedor, el agente lo presenta en el hilo; si no, avisa que la contacta
// el equipo comercial y queda en el CRM como "Interesada sin asignar". El agente nunca elige vendedor.
const ejecutivoPorId = id => CONFIG.ejecutivos.find(e => e.id === id) || null;

async function avisarDerivacion(l, ej, etapa, c, ultimoTexto) {
  const para = ej?.email || CONFIG.gerenteEmail;
  if (!para) return;
  const aviso = [
    `${etapa === 'cierre' ? 'LISTO PARA CERRAR' : 'Interesada'} (score ${c.score ?? '-'}/100): ${l.nombre}`,
    '', `Resumen: ${c.resumen || '-'}`, '',
    `Email: ${l.email}`, `Teléfono: ${l.telefono || '-'}`, `WhatsApp: ${l.whatsapp ? '+' + l.whatsapp : '-'}`, `Web: ${l.web || '-'}`,
    `Instagram: ${l.instagram ? '@' + l.instagram : '-'}`, `Zona: ${l.departamento || '-'}`, `Origen: ${(l.fuentes || []).join(', ')}`,
    ...(ultimoTexto ? ['', 'Último mensaje:', ultimoTexto.split('\n').map(x => `> ${x}`).join('\n')] : []), '',
    ej ? 'Ya te presenté en el hilo (estás en copia). Seguí directo con "Responder a todos".'
       : 'Todavía no tiene vendedor: asignala en el CRM, en Prospectos → "Interesadas sin asignar". Al asignarla, el agente presenta al vendedor en el hilo.',
    `CRM: ${CONFIG.crmUrl}`,
  ].join('\n');
  await enviarCorreo({
    to: para, cc: ej && CONFIG.gerenteEmail && CONFIG.gerenteEmail !== ej.email ? CONFIG.gerenteEmail : undefined,
    subject: `[Veocasas] ${etapa === 'cierre' ? 'Cierre' : 'Interesada'}: ${l.nombre}`, text: aviso,
  });
}

async function derivar(doc, l, base, etapa, ultimo, c) {
  const ej = l.asignadoA ? ejecutivoPorId(l.asignadoA) : null;
  const v = vars(l, doc.id);
  const referencias = [l.referencias, ultimo.messageId].filter(Boolean).join(' ');
  const saludo = c.contacto ? `Gracias, ${c.contacto}.` : 'Muchas gracias por responder.';
  const texto = ej?.email
    ? render(CONFIG.plantillas.derivacion, { saludo, ejecutivo: ej.nombre, ejecutivoEmail: ej.email })
    : render(CONFIG.plantillas.derivacionEquipo, { saludo });
  const r = await enviarCorreo({
    to: l.email, cc: ej?.email || undefined, subject: `Re: ${l.asunto}`, text: texto + render(CONFIG.plantillas.pie, v),
    threadId: l.threadId, inReplyTo: ultimo.messageId, references: referencias, unsubscribeUrl: v.bajaUrl,
  });
  await avisarDerivacion(l, ej, etapa, c, ultimo.texto);
  await doc.ref.update({
    ...base, ultimoMessageId: r.messageId, referencias: `${referencias} ${r.messageId}`, ultimoEnvio: ahora(),
    estado: 'derivado', etapa, presentado: Boolean(ej?.email), derivadoEn: ahora(), proximoEnvio: null, reintentarEn: null,
    historial: FieldValue.arrayUnion(
      { tipo: 'respuesta', fecha: new Date(), etapa: c.etapa, resumen: c.resumen || '' },
      { tipo: 'derivado', fecha: new Date(), ejecutivo: ej?.id || null },
    ),
  });
}

// La gerente asignó vendedor en el CRM a una interesada que el agente dejó en espera: se lo presenta en el hilo
export async function presentarAsignados(vivo) {
  const snap = await db().collection(COL).where('estado', '==', 'derivado').get();
  const res = { presentados: 0, vendedorSinEmail: 0 };
  for (const doc of snap.docs) {
    if (!vivo()) break;
    const l = doc.data();
    if (l.presentado || !l.asignadoA || !l.threadId) continue;
    const ej = ejecutivoPorId(l.asignadoA);
    if (!ej?.email) { res.vendedorSinEmail++; continue; } // falta en EXECUTIVES_JSON: lo presenta la gerente a mano
    const v = vars(l, doc.id);
    const texto = render(CONFIG.plantillas.derivacion, {
      saludo: l.contacto ? `Hola, ${l.contacto}.` : 'Hola de nuevo.', ejecutivo: ej.nombre, ejecutivoEmail: ej.email,
    }) + render(CONFIG.plantillas.pie, v);
    const r = await enviarCorreo({
      to: l.email, cc: ej.email, subject: `Re: ${l.asunto}`, text: texto,
      threadId: l.threadId, inReplyTo: l.ultimoMessageId, references: l.referencias, unsubscribeUrl: v.bajaUrl,
    });
    await avisarDerivacion(l, ej, l.etapa || 'caliente', { score: l.score, resumen: l.resumenIA }, null);
    await doc.ref.update({
      presentado: true, presentadoEn: ahora(), ultimoMessageId: r.messageId, ultimoEnvio: ahora(),
      referencias: [l.referencias, r.messageId].filter(Boolean).join(' '),
      historial: evento('presentado', { ejecutivo: ej.id }), actualizado: FieldValue.serverTimestamp(),
    });
    res.presentados++;
    await sleep(1500);
  }
  return res;
}

// Segunda ronda: sin respuesta (90 días) o no interesadas (180 días) vuelven a la fila con otro texto.
// Las asignadas a un vendedor no: esas las trabaja una persona.
export async function reactivar(vivo) {
  const snap = await db().collection(COL).where('reintentarEn', '<=', ahora()).limit(200).get();
  const res = { reactivadas: 0 };
  for (const doc of snap.docs) {
    if (!vivo()) break;
    const l = doc.data();
    const patch = { reintentarEn: null };
    if (['sin_respuesta', 'no_interesado'].includes(l.estado) && !l.asignadoA && l.email) {
      Object.assign(patch, {
        estado: 'listo', ronda: 2, reactivacion: l.estado, paso: 0, threadId: null, asunto: null, proximoEnvio: null,
        historial: evento('segunda_ronda', { desde: l.estado }), actualizado: FieldValue.serverTimestamp(),
      });
      res.reactivadas++;
    }
    await doc.ref.update(patch);
  }
  return res;
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
      await doc.ref.update({ ...base, estado: 'no_interesado', proximoEnvio: null, ...agendarReintento(l, 'no_interesado'), historial: registro }); break;
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
// sin Gmail se puede probar igual la búsqueda, el deduplicado y el enriquecimiento
const gmailListo = () => Boolean(process.env.GMAIL_REFRESH_TOKEN && CONFIG.remitente.email);
const SIN_GMAIL = { omitido: 'Gmail sin configurar' };

export async function cicloDiario(hasta) {
  return {
    respuestas: gmailListo() ? await revisarRespuestas(hasta(60_000)) : SIN_GMAIL,
    presentar: gmailListo() ? await presentarAsignados(hasta(75_000)) : SIN_GMAIL,
    procesar: await procesarJobs(hasta(120_000)),
    enriquecer: await enriquecer(hasta(170_000)),
    reactivar: await reactivar(hasta(178_000)),
    enviar: gmailListo() ? await enviar(hasta(285_000)) : SIN_GMAIL,
  };
}

// También continúa la búsqueda trimestral: el cron que la arranca no alcanza a terminarla en una corrida
export async function cicloFrecuente(hasta) {
  return {
    respuestas: gmailListo() ? await revisarRespuestas(hasta(60_000)) : SIN_GMAIL,
    presentar: gmailListo() ? await presentarAsignados(hasta(75_000)) : SIN_GMAIL,
    // clientes del CRM: una vez por día alcanza (antes del envío de la mañana siguiente)
    crm: await sincronizarClientesCRM().catch(e => ({ error: e.message })),
    busqueda: (await busquedaEnCurso()) ? await prospectar(hasta(150_000)) : { omitido: 'sin búsqueda en curso' },
    // margen: un pedido a Claude o a una web en curso puede seguir ~60 s después del presupuesto
    procesar: await procesarJobs(hasta(180_000)),
    enriquecer: await enriquecer(hasta(240_000)),
  };
}
