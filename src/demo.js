// Datos inventados para el modo demo (solo en desarrollo: http://localhost:5173/?demo=gerente).
// Sirven para revisar las pantallas sin entrar a la base real. No se usan en producción.
const pad = n => String(n).padStart(2, "0");
const hoy = new Date();
const dia = n => { const d = new Date(hoy.getTime() + n * 864e5); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const masMeses = (iso, m) => { const [a, mm, d] = iso.split("-").map(Number); const t = a * 12 + mm - 1 + m; return `${Math.floor(t / 12)}-${pad(t % 12 + 1)}-${pad(Math.min(d, 28))}`; };

const NOMBRES = ["García Propiedades", "Inmobiliaria del Este", "Casas del Sur", "Punta Real Estate", "Pocitos Negocios", "Carrasco Inmuebles",
  "Rambla Propiedades", "Colonia Hogar", "Atlántida Inmobiliaria", "Piriápolis Bienes Raíces", "Maldonado Propiedades", "Cordón Inmuebles",
  "La Barra Homes", "Solymar Casas", "Malvín Propiedades", "Prado Inmobiliaria", "Centro Hogar", "Salto Inmuebles"];
const VENDEDORES = ["sebastian", "juanba", "paty", "stefano"];
const PLANES = ["50", "Standard", "Premium", "Elite"];

export const datosDemo = () => {
  const ventas = [];
  NOMBRES.forEach((nombre, i) => {
    const inicio = dia(-330 + i * 25);
    const meses = [6, 12][i % 2];
    const subtotal = 18000 + i * 3500;
    const total = Math.round(subtotal * 1.22);
    const nc = [1, 3, 6, 12][i % 4];
    const cuotas = nc > 1 ? Array.from({ length: nc }, (_, k) => ({
      numero: k + 1, fecha: masMeses(inicio, k), monto: Math.round(total / nc),
      pagada: masMeses(inicio, k) < dia(-20) && (i + k) % 5 !== 0, gestionado: false, nro_factura: k < 2 ? String(300 + i * 3 + k) : "",
    })) : [];
    ventas.push({
      id: `v${i}`, inmobiliaria: nombre, razon_social: `${nombre} S.R.L.`, rut: i % 3 ? `21${pad(i)}345670012` : "",
      mail: `contacto@${nombre.toLowerCase().replace(/[^a-z]/g, "")}.com.uy`, telefono: `09${pad(i)} ${100 + i} ${200 + i}`,
      direccion: "Av. Brasil 2500", crm: ["Tokko", "Tera", "SIN CRM"][i % 3], ejecutivo: VENDEDORES[i % 4],
      plan: PLANES[i % 4], propiedades: 20 + i * 5, productos_seleccionados: ["Propiedades", i % 2 ? "Destacadas" : "Superdestacadas"],
      fecha_inicio: inicio, fecha_fin: masMeses(inicio, meses), tipo_pago: nc > 1 ? "cuotas" : "contado", num_cuotas: nc,
      subtipo_contado: "transferencia", metodo_pago: nc > 1 ? `contrato (${nc} cuotas)` : "transferencia",
      valor_mensual: Math.round(subtotal / meses), subtotal, total, cuotas_detalle: cuotas,
      estado: i === 7 ? "cancelada" : "activa", facturado: nc === 1 && i % 2 === 0, cobrado: nc === 1 ? i % 3 === 0 : undefined,
      cliente_id: i < 10 ? `c${i}` : undefined, created_at: inicio,
    });
  });
  const clientes = ventas.slice(0, 10).map((v, i) => ({
    id: `c${i}`, nombre: v.inmobiliaria, razon_social: v.razon_social, rut: v.rut, email: v.mail, telefono: v.telefono,
    direccion: v.direccion, crm: v.crm, ejecutivo: v.ejecutivo, notas: i === 0 ? "Prefieren que los llamen de mañana." : "",
    contactos: i % 2 ? [] : [{ nombre: "Laura Pérez", cargo: "Dueña", email: "laura@ejemplo.uy", telefono: "099 111 222" }],
  }));
  const estados = ["listo", "en_secuencia", "derivado", "sin_respuesta", "no_interesado", "sin_email", "manual", "cliente", "ex_cliente"];
  const prospeccion_leads = Array.from({ length: 60 }, (_, i) => ({
    id: `p${i}`, nombre: `Inmobiliaria Prueba ${i + 1}`, email: i % 4 ? `info${i}@prueba.uy` : "", telefono: `09${pad(i % 90)} 123 456`,
    whatsapp: i % 3 ? `5989${pad(i % 90)}123456`.slice(0, 11) : "", departamento: ["Montevideo", "Maldonado", "Canelones", "Colonia", ""][i % 5],
    web: `www.prueba${i}.com.uy`, estado: estados[i % estados.length], fuentes: ["maps"], score: (i * 13) % 100,
    resumenIA: i % 9 === 2 ? "Pidió precios y quiere una llamada esta semana." : "",
    asignadoA: i % 9 === 6 || i % 9 === 2 && i > 20 ? VENDEDORES[i % 4] : null,
  }));
  return {
    ventas, clientes, prospeccion_leads,
    kpis: [], producciones: [], posts_social: [], facturas: [], comisiones: [], runs: [], documentos: [], presentaciones: [],
    competencias: [], metricas_ads: [], disponibilidad: [],
    objetivos: VENDEDORES.map((v, i) => ({ id: `o${i}`, ejecutivo: v, objetivo: 400000, q: Math.ceil((hoy.getMonth() + 1) / 3), anio: hoy.getFullYear() })),
    tickets: [{ id: "t1", titulo: "Cuota lista para facturar", descripcion: "Cuota 2/3 de García Propiedades.", de: "paty", para: "admin", estado: "pendiente", created_at: dia(-2) }],
    tareas: [{ id: "ta1", titulo: "Llamar a Casas del Sur", asignado: "sebastian", estado: "pendiente", fecha: dia(2), created_at: dia(-1) }],
  };
};
