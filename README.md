# CRM / ERP de Veocasas

React + Vite sobre Firebase (proyecto `crmveocasas-4fc8c`). El agente de prospección vive en `veocasas-prospector/`.

## Acceso

- Cada persona entra con su usuario (por ejemplo `Mika`) y su contraseña. Por dentro es una cuenta de Firebase Auth
  `{id}@crm.veocasas.com.uy`; ese correo no recibe nada.
- El perfil y el rol de cada cuenta están en `usuarios/{uid}` (`{id, nombre, rol}`). Las reglas de Firestore
  (`firestore.rules`) solo dejan entrar a cuentas con perfil, y dan permisos según el rol.
- Cada uno cambia su contraseña con el botón **Contraseña** de la barra de arriba.

### Puesta en marcha (una sola vez)

1. Firebase → Authentication → Comenzar → activar **Correo electrónico/contraseña**.
2. `npm run crear-usuarios`: crea las cuentas y deja las contraseñas iniciales en `usuarios-iniciales.txt`
   (no se sube a git). Entregarlas y borrar el archivo.
3. Firebase → Firestore Database → Reglas: pegar `firestore.rules` y publicar.

El paso 2 tiene que ir antes del 3: con las reglas publicadas ya no se puede escribir en `usuarios`.

### Agregar una persona o restablecer una contraseña

- Persona nueva: agregarla en `USERS` (`src/constants.js`), crear la cuenta en Authentication → Agregar usuario
  con `{id}@crm.veocasas.com.uy`, y en Firestore crear `usuarios/{UID de la cuenta}` con `id`, `nombre` y `rol`.
- Contraseña olvidada: borrar la cuenta en Authentication, crearla de nuevo con una contraseña nueva, y en
  `usuarios` crear el documento con el UID nuevo (mismos campos) y borrar el viejo.

## Probar pantallas sin entrar a la base

`npm run dev` y abrir `http://localhost:5173/?demo=gerente` (o `vendedor`, `admin`, `marketing`, `gerente_general`):
entra sin login con datos inventados (`src/demo.js`) que viven en memoria. Solo funciona en desarrollo; no está
en la versión publicada.
