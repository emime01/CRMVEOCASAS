import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCIkzYOgUsU_td-Qw69mbXyQV1zs7wQPOk",
  authDomain: "crmveocasas-4fc8c.firebaseapp.com",
  projectId: "crmveocasas-4fc8c",
  storageBucket: "crmveocasas-4fc8c.firebasestorage.app",
  messagingSenderId: "218951782203",
  appId: "1:218951782203:web:d2e97f06d2575dfcf1711e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Cuentas de Firebase Auth: el usuario escribe su nombre ("Mika") y entra con {id}@DOMINIO_USUARIOS.
// El correo no se usa para enviar nada; solo identifica la cuenta.
export const DOMINIO_USUARIOS = "crm.veocasas.com.uy";
export const emailDeUsuario = id => `${id}@${DOMINIO_USUARIOS}`;

// usuarios/{uid} = {id, nombre, rol}: lo leen las reglas de Firestore para dar acceso y permisos
export const getPerfil = async uid => {
  const s = await getDoc(doc(db, "usuarios", uid));
  return s.exists() ? s.data() : null;
};

// Modo demo, solo en desarrollo (npm run dev → http://localhost:5173/?demo=gerente, o vendedor, admin, marketing,
// gerente_general): entra sin login y usa datos inventados en memoria (src/demo.js). En producción no existe.
export const DEMO = import.meta.env?.DEV ? new URLSearchParams(globalThis.location?.search || "").get("demo") : null;
let memoria = null;
const demo = async col => { memoria ??= (await import("./demo.js")).datosDemo(); return (memoria[col] ??= []); };

// Helper functions
export const getAll = async (col, orderField = null) => {
  if (DEMO) return [...(await demo(col))];
  try {
    const ref = collection(db, col);
    const q = orderField ? query(ref, orderBy(orderField, "desc")) : ref;
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { console.error(e); return []; }
};

export const addItem = async (col, data) => {
  if (DEMO) { const x = { id: `demo${Date.now()}`, ...data, created_at: new Date().toISOString() }; (await demo(col)).unshift(x); return x; }
  try {
    const ref = await addDoc(collection(db, col), { ...data, created_at: new Date().toISOString() });
    return { id: ref.id, ...data, created_at: new Date().toISOString() };
  } catch(e) { console.error(e); return null; }
};

export const updateItem = async (col, id, data) => {
  if (DEMO) { const l = await demo(col); const i = l.findIndex(x => x.id === id); if (i >= 0) l[i] = { ...l[i], ...data }; return { id, ...data }; }
  try {
    await updateDoc(doc(db, col, String(id)), data);
    return { id, ...data };
  } catch(e) { console.error(e); return null; }
};

export const deleteItem = async (col, id) => {
  if (DEMO) { const l = await demo(col); const i = l.findIndex(x => x.id === id); if (i >= 0) l.splice(i, 1); return true; }
  try {
    await deleteDoc(doc(db, col, String(id)));
    return true;
  } catch(e) { console.error(e); return false; }
};

export const upsertItem = async (col, id, data) => {
  if (DEMO) { const l = await demo(col); const i = l.findIndex(x => x.id === id); if (i >= 0) l[i] = { ...l[i], ...data }; else l.push({ id, ...data }); return { id, ...data }; }
  try {
    await setDoc(doc(db, col, String(id)), data, { merge: true });
    return { id, ...data };
  } catch(e) { console.error(e); return null; }
};
