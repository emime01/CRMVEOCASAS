// Tareas: tablero (kanban) con tres columnas. Al pasar a "Listo" la tarea sale del tablero y va al histórico.
// Cada movimiento queda registrado en t.historial ({estado, por, at}) para que Mika vea quién movió qué y cuándo.

export const COLUMNAS = [
  { id: "pendiente", label: "Por hacer", color: "gray" },
  { id: "en_curso", label: "En curso", color: "blue" },
  { id: "en_espera", label: "En espera", color: "amber", ayuda: "Esperando a alguien o algo" },
];
export const LISTA = "completada";
export const ESTADO_LABEL = { pendiente: "Por hacer", en_curso: "En curso", en_espera: "En espera", completada: "Listo" };

// Días sin moverse a partir de los cuales una tarea se marca como frenada
export const DIAS_FRENADA = 7;

const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export const abierta = t => t.estado !== LISTA;
export const estadoDe = t => (COLUMNAS.some(c => c.id === t.estado) ? t.estado : t.estado === LISTA ? LISTA : "pendiente");
export const ultimoMovimiento = t => t.movida_at || t.created_at || "";
export const diasDesde = iso => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : 0);
export const atrasada = t => abierta(t) && !!t.vence && t.vence < hoyLocal();
export const frenada = t => abierta(t) && diasDesde(ultimoMovimiento(t)) >= DIAS_FRENADA;

// Cambios para mover una tarea a otro estado (incluye el registro en el historial)
export const cambiosAlMover = (t, estado, por, comentario = "") => {
  const at = new Date().toISOString();
  const historial = [...(t.historial || []), { estado, por, at }];
  if (estado === LISTA) return { estado, historial, movida_at: at, completada_at: at, completada_por: por, comentario_completado: comentario };
  return { estado, historial, movida_at: at, ...(t.estado === LISTA ? { completada_at: null, completada_por: null } : {}) };
};

// Quién puede mover, editar o borrar: la persona asignada, quien la creó y Mika
export const puedeMover = (t, u) => t.asignada_a === u.id || t.creada_por === u.id || u.role === "gerente";
export const puedeEditar = (t, u) => t.creada_por === u.id || u.role === "gerente";

// Para el número rojo del menú: tareas mías que todavía no empecé
export const porHacerDe = (tareas, uid) => (tareas || []).filter(t => t.asignada_a === uid && estadoDe(t) === "pendiente").length;
