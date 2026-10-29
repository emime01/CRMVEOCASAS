import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from './config.js';
import { parseJSON } from './util.js';

let _c;
const cliente = () => (_c ||= new Anthropic());
const MODELO = () => process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

async function pedir(system, user, max_tokens = 1500) {
  const r = await cliente().messages.create({ model: MODELO(), max_tokens, system, messages: [{ role: 'user', content: user }] });
  return r.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

const SYS_EXTRAER = `Extraés inmobiliarias de contenido web. Inmobiliaria = empresa, estudio o corredor/rematador que vende o alquila propiedades en Uruguay.
Devolvé SOLO un array JSON: [{"nombre":"","web":null,"email":null,"telefono":null,"instagram":null,"facebook":null,"departamento":null}]
Reglas:
- No inventes datos. Si un campo no aparece literalmente, null.
- "web" es el sitio propio de la inmobiliaria. Nunca uses URLs de portales (InfoCasas, Casas y Más, Gallito, Mercado Libre, Veocasas, Properati), de Google ni de directorios.
- Si una URL es de instagram.com/usuario, poné el usuario en "instagram". Si es de facebook.com, poné la URL en "facebook".
- Excluí portales, bancos, constructoras sin área inmobiliaria, inmobiliarias de otros países y personas sin actividad inmobiliaria.
- Si no hay ninguna, devolvé [].`;

export async function extraerInmobiliarias(contenido) {
  // 8000 de salida: un pedazo de directorio puede traer ~60 inmobiliarias y un JSON cortado se pierde entero
  const out = parseJSON(await pedir(SYS_EXTRAER, contenido.slice(0, 24000), 8000));
  return Array.isArray(out) ? out.filter(x => x?.nombre) : [];
}

const SYS_CLASIFICAR = () => `Sos el asistente comercial de Veocasas, portal inmobiliario de Uruguay. Le escribimos a inmobiliarias para que publiquen con nosotros.
Analizá la ÚLTIMA respuesta de la inmobiliaria y devolvé SOLO un objeto JSON:
{"etapa":"","score":0,"resumen":"","contacto":null,"nuevo_email":null,"puede_responder":false,"respuesta":null}

etapa (una sola):
- "fuera_oficina": respuesta automática, vacaciones, acuse de recibo automático.
- "baja": pide no recibir más correos o que lo saquen de la lista.
- "no_interesado": rechazo claro (no les interesa, no publican en portales, cerraron, no son inmobiliaria).
- "redirige": indica a otra persona o correo para tratar el tema, sin mostrar interés propio.
- "info": hace preguntas generales que se responden por completo con CONOCIMIENTO, sin pedir reunión.
- "caliente": muestra interés: acepta llamada o reunión, pide propuesta, precios o condiciones, o pregunta algo que no está en CONOCIMIENTO.
- "cierre": quiere contratar o arrancar: pregunta cómo dar de alta, cómo pagar, pide contrato o factura.
Ante la duda entre "info" y "caliente", elegí "caliente". Ante la duda entre "caliente" y "cierre", elegí "caliente".

score: 0-100, qué tan cerca está de contratar.
resumen: 1-2 frases en español, para un ejecutivo de ventas.
contacto: nombre de pila de quien responde, si firma; si no, null.
nuevo_email: solo si "redirige" y aparece un correo concreto.
puede_responder y respuesta: solo para "info". respuesta = texto breve en español de Uruguay, tono cordial y profesional, tratando de "ustedes", usando ÚNICAMENTE datos de CONOCIMIENTO, cerrando con una invitación a coordinar una llamada${CONFIG.agendaUrl ? ` (link: ${CONFIG.agendaUrl})` : ''}. Sin saludo de cierre ni firma. Si algo de lo que preguntan no está en CONOCIMIENTO, puede_responder=false.

CONOCIMIENTO:
${CONFIG.conocimiento}`;

export async function clasificar({ nombre, historial, ultimo }) {
  const user = `Inmobiliaria: ${nombre}\n\nHilo (más antiguo primero):\n${historial}\n\nÚLTIMA RESPUESTA:\n${ultimo}`;
  const out = parseJSON(await pedir(SYS_CLASIFICAR(), user, 1200)) || {};
  const etapas = ['fuera_oficina', 'baja', 'no_interesado', 'redirige', 'info', 'caliente', 'cierre'];
  if (!etapas.includes(out.etapa)) out.etapa = 'caliente'; // ante error, que lo vea una persona
  out.score = Math.max(0, Math.min(100, Number(out.score) || 0));
  return out;
}
