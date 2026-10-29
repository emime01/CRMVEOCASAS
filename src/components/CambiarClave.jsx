import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "../firebase";
import { C } from "../constants";
import { Field, Modal, ModalHeader, ModalBody, ModalFooter, Btn, inp } from "./UI";

// Cada usuario cambia su propia contraseña. Firebase pide la actual de nuevo antes de cambiarla.
export default function CambiarClave({ onClose }) {
  const [f, setF] = useState({ actual:"", nueva:"", repetir:"" });
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const set = (k,v) => setF(x=>({...x,[k]:v}));

  const guardar = async () => {
    setError("");
    if(f.nueva.length<8) return setError("La contraseña nueva tiene que tener al menos 8 caracteres.");
    if(f.nueva!==f.repetir) return setError("Las contraseñas nuevas no coinciden.");
    setGuardando(true);
    try {
      const u = auth.currentUser;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, f.actual));
      await updatePassword(u, f.nueva);
      setListo(true);
    } catch(e) {
      setError(["auth/invalid-credential","auth/wrong-password"].includes(e.code) ? "La contraseña actual no es correcta."
        : e.code==="auth/too-many-requests" ? "Demasiados intentos. Esperá unos minutos."
        : "No se pudo cambiar la contraseña. Probá de nuevo.");
    }
    setGuardando(false);
  };

  return (
    <Modal onClose={onClose} maxWidth={400}>
      <ModalHeader title="Cambiar contraseña" onClose={onClose}/>
      <ModalBody>
        {listo ? (
          <div style={{fontSize:13,color:C.green}}>Listo. La próxima vez entrá con la contraseña nueva.</div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Field label="Contraseña actual"><input type="password" autoComplete="current-password" value={f.actual} onChange={e=>set("actual",e.target.value)} style={inp}/></Field>
            <Field label="Contraseña nueva" hint="Mínimo 8 caracteres."><input type="password" autoComplete="new-password" value={f.nueva} onChange={e=>set("nueva",e.target.value)} style={inp}/></Field>
            <Field label="Repetir contraseña nueva"><input type="password" autoComplete="new-password" value={f.repetir} onChange={e=>set("repetir",e.target.value)} style={inp}/></Field>
            {error&&<div style={{fontSize:12,color:C.red}}>{error}</div>}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        {listo ? <Btn variant="primary" onClick={onClose}>Cerrar</Btn> : <>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" disabled={guardando||!f.actual||!f.nueva} onClick={guardar}>Guardar</Btn>
        </>}
      </ModalFooter>
    </Modal>
  );
}
