export const FLUJO = [
  ['nuevo', 'Buscando email'],
  ['listo', 'Listas para escribir'],
  ['en_secuencia', 'En secuencia'],
  ['conversando', 'Conversando con el agente'],
  ['derivado', 'Con ejecutivo'],
];
export const EVALUAR = ['sin_respuesta', 'Sin respuesta, a evaluar'];
export const OTROS = [
  ['sin_email', 'Sin email'], ['manual', 'Contacto manual'], ['no_interesado', 'No interesadas'],
  ['rebotado', 'Rebotadas'], ['baja', 'Pidieron la baja'], ['cliente', 'Ya son clientes'], ['descartado', 'Descartadas'], ['duplicado', 'Repetidas (fusionadas)'],
];
export const TODAS = ['todas', 'Todas las inmobiliarias'];
export const ETIQUETA = Object.fromEntries([...FLUJO, EVALUAR, ...OTROS]);
export const AYUDA = {
  todas: 'La base completa de inmobiliarias encontradas, tengan email o no. Las que tienen email las contacta el agente; el resto se puede trabajar por WhatsApp o teléfono.',
  nuevo: 'El agente busca el correo de cada inmobiliaria en su web o en Google y verifica que el dominio reciba mails.',
  listo: 'Tienen correo válido. Salen en orden de llegada, dentro del cupo diario.',
  en_secuencia: 'Recibieron el primer correo. Si no responden, el agente sigue a los 3, 7 y 10 días.',
  conversando: 'Hicieron una consulta general y el agente respondió. Si no vuelven a escribir en 7 días, pasan a evaluar.',
  derivado: 'Mostraron interés o quieren contratar. Su ejecutivo está en copia del hilo.',
  sin_respuesta: 'Terminaron la secuencia sin responder. Elegí qué hacer con cada una.',
  duplicado: 'Registros repetidos de una misma inmobiliaria: sus datos se pasaron al registro principal y no se les escribe.',
  sin_email: 'No encontramos un correo. Agregalo a mano o contactalas por otro canal.',
};
