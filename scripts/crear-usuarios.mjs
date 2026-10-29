// Crea las cuentas del CRM en Firebase Auth y el perfil de cada una en usuarios/{uid} ({id, nombre, rol}).
// Se corre UNA vez, ANTES de publicar firestore.rules: después las reglas no dejan escribir en usuarios.
// Requiere el proveedor "Correo electrónico/contraseña" activado en Firebase → Authentication.
//
//   node scripts/crear-usuarios.mjs
//
// Deja las contraseñas iniciales en usuarios-iniciales.txt (no se sube a git). Cada persona la cambia
// después desde el botón "Contraseña" del CRM.
import { randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, emailDeUsuario } from "../src/firebase.js";
import { USERS } from "../src/constants.js";

// sin letras que se confunden al dictarlas (0/O, 1/l/I)
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const clave = () => Array.from({ length: 12 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

const lineas = [];
for (const u of USERS.filter(x => x.role !== "inactivo")) {
  const password = clave();
  try {
    const { user } = await createUserWithEmailAndPassword(auth, emailDeUsuario(u.id), password);
    await setDoc(doc(db, "usuarios", user.uid), { id: u.id, nombre: u.name, rol: u.role });
    await signOut(auth);
    lineas.push(`${u.name.padEnd(16)} ${password}`);
    console.log(`creado: ${u.name}`);
  } catch (e) {
    const motivo = e.code === "auth/email-already-in-use" ? "ya existía, no se tocó" : e.code || e.message;
    lineas.push(`${u.name.padEnd(16)} (${motivo})`);
    console.log(`${u.name}: ${motivo}`);
  }
}

writeFileSync("usuarios-iniciales.txt", [
  "Usuarios del CRM de Veocasas. Entregar a cada uno su contraseña y borrar este archivo.",
  "Se entra con el nombre de usuario (por ejemplo Mika) y la contraseña.", "", ...lineas, "",
].join("\n"));
console.log("\nContraseñas en usuarios-iniciales.txt");
process.exit(0); // la conexión de Firestore deja el proceso abierto
