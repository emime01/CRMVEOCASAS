// Carga los clientes actuales de Veocasas para que el agente nunca les escriba.
// Uso: npm run importar-clientes -- clientes.csv   (columnas: nombre,email,web)
import fs from 'node:fs';
import { db, EXCL } from '../lib/firebase.js';
import { clavesDe } from '../lib/leads.js';

const archivo = process.argv[2];
if (!archivo) { console.error('Pasá la ruta del CSV.'); process.exit(1); }
const [cab, ...filas] = fs.readFileSync(archivo, 'utf8').split(/\r?\n/).filter(Boolean);
const cols = cab.split(',').map(s => s.trim().toLowerCase());

let n = 0;
for (const f of filas) {
  const v = f.split(',').map(s => s.trim());
  const row = Object.fromEntries(cols.map((c, i) => [c, v[i] || null]));
  const keys = clavesDe(row);
  if (!keys.length) continue;
  await db().collection(EXCL).add({ keys, nombre: row.nombre, motivo: 'cliente', fecha: new Date() });
  n++;
}
console.log(`${n} clientes cargados como excluidos.`);
process.exit(0);
