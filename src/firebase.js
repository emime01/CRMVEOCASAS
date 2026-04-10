import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, setDoc } from "firebase/firestore";

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

// Helper functions
export const getAll = async (col, orderField = null) => {
  try {
    const ref = collection(db, col);
    const q = orderField ? query(ref, orderBy(orderField, "desc")) : ref;
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { console.error(e); return []; }
};

export const addItem = async (col, data) => {
  try {
    const ref = await addDoc(collection(db, col), { ...data, created_at: new Date().toISOString() });
    return { id: ref.id, ...data, created_at: new Date().toISOString() };
  } catch(e) { console.error(e); return null; }
};

export const updateItem = async (col, id, data) => {
  try {
    await updateDoc(doc(db, col, String(id)), data);
    return { id, ...data };
  } catch(e) { console.error(e); return null; }
};

export const deleteItem = async (col, id) => {
  try {
    await deleteDoc(doc(db, col, String(id)));
    return true;
  } catch(e) { console.error(e); return false; }
};

export const upsertItem = async (col, id, data) => {
  try {
    await setDoc(doc(db, col, String(id)), data, { merge: true });
    return { id, ...data };
  } catch(e) { console.error(e); return null; }
};
