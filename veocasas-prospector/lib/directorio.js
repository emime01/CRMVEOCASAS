import { db, COL } from './firebase.js';
import { DEPARTAMENTOS } from './config.js';
import { toISO } from './util.js';

// La base completa de inmobiliarias (todas menos las descartadas), para la vista "Todas" y la descarga.
// Son pocos miles de documentos: se leen enteros y se filtran en memoria, sin índices nuevos.
export const CAMPOS_DIRECTORIO = ['nombre', 'departamento', 'email', 'telefono', 'whatsapp', 'instagram', 'facebook', 'web',
  'estado', 'fuentes', 'paso', 'etapa', 'score', 'resumenIA', 'ejecutivo', 'proximoEnvio', 'actualizado', 'creado'];

export const CANALES = [
  ['', 'Cualquier contacto'], ['email', 'Con email'], ['sin_email', 'Sin email'], ['whatsapp', 'Con WhatsApp'],
  ['telefono', 'Con teléfono'], ['instagram', 'Con Instagram'], ['ninguno', 'Sin ningún contacto'],
];

const tiene = {
  email: l => Boolean(l.email),
  sin_email: l => !l.email,
  whatsapp: l => Boolean(l.whatsapp),
  telefono: l => Boolean(l.telefono || l.whatsapp),
  instagram: l => Boolean(l.instagram),
  ninguno: l => !l.email && !l.telefono && !l.whatsapp && !l.instagram,
};

export async function leerDirectorio({ depto = '', canal = '' } = {}) {
  const snap = await db().collection(COL).select(...CAMPOS_DIRECTORIO).get();
  const todas = snap.docs.map(doc => {
    const x = doc.data();
    const l = { id: doc.id };
    for (const k of CAMPOS_DIRECTORIO) l[k] = ['proximoEnvio', 'actualizado', 'creado'].includes(k) ? toISO(x[k]) : x[k] ?? null;
    return l;
  }).filter(l => !['descartado', 'duplicado'].includes(l.estado));

  const resumen = {
    total: todas.length,
    email: todas.filter(tiene.email).length,
    whatsapp: todas.filter(tiene.whatsapp).length,
    telefono: todas.filter(tiene.telefono).length,
    instagram: todas.filter(tiene.instagram).length,
    ninguno: todas.filter(tiene.ninguno).length,
  };
  const filtradas = todas
    .filter(l => !depto || (depto === 'sin' ? !DEPARTAMENTOS.includes(l.departamento) : l.departamento === depto))
    .filter(l => !canal || tiene[canal]?.(l))
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  return { resumen, filtradas };
}

const celda = v => {
  const s = Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// CSV con ; y BOM: Excel en español lo abre directo con tildes y columnas bien separadas
export function aCSV(leads, etiquetaEstado = e => e) {
  const cols = [['nombre', 'Inmobiliaria'], ['departamento', 'Departamento'], ['email', 'Email'], ['telefono', 'Teléfono'],
    ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['web', 'Web'], ['estado', 'Estado'],
    ['fuentes', 'Origen']];
  const filas = leads.map(l => cols.map(([k]) => celda(k === 'estado' ? etiquetaEstado(l.estado) : k === 'instagram' && l.instagram ? `@${l.instagram}` : l[k])).join(';'));
  return '﻿' + [cols.map(([, t]) => t).join(';'), ...filas].join('\r\n');
}
