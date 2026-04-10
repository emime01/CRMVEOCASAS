export const USERS = [
  { id:"mika",      name:"Mika",           role:"gerente",   avatar:"MI" },
  { id:"sebastian", name:"Sebastian",       role:"vendedor",  avatar:"SE" },
  { id:"juanba",    name:"Juanba",          role:"vendedor",  avatar:"JB" },
  { id:"paty",      name:"Paty",            role:"vendedor",  avatar:"PA" },
  { id:"stefano",   name:"Stefano",         role:"vendedor",  avatar:"ST" },
  { id:"mateo",     name:"Mateo",           role:"marketing", avatar:"MA" },
  { id:"admin",     name:"Administración",  role:"admin",     avatar:"AD" },
  { id:"lucas",     name:"Lucas",           role:"inactivo",  avatar:"LU" },
];

export const SELLERS = ["sebastian","juanba","paty","stefano","lucas"];
export const SELLERS_ACTIVE = ["sebastian","juanba","paty","stefano"];

export const CREDENTIALS = [
  { id:"mika",      username:"Mika",      password:"Veo#Mk9x2" },
  { id:"sebastian", username:"Sebastian", password:"Veo#Sb4k7" },
  { id:"juanba",    username:"Juanba",    password:"Veo#Jb3m5" },
  { id:"paty",      username:"Paty",      password:"Veo#Pt8n1" },
  { id:"stefano",   username:"Stefano",   password:"Veo#St6q4" },
  { id:"mateo",     username:"Mateo",     password:"Veo#Mt2w8" },
  { id:"admin",     username:"Admin",     password:"Veo#Ad5r9" },
];

export const CRMS = ["Tera","NAI","Casasweb","Tokko","Xintel","2clics","Otro CRM","SIN CRM"];

export const PRODUCTS = [
  "Propiedades","Destacadas","Superdestacadas",
  "Super destacada Home Venta","Destacada Home Venta",
  "Super destacada Home Alquiler","Destacada Home Alquiler",
  "Índice","Producción","Banner","Desarrollos"
];

export const PLANS = ["50","Standard","Premium","Elite","Unique","A medida"];

export const PLATFORMS = ["Instagram","Facebook","LinkedIn","TikTok","Twitter/X"];

export const C = {
  red:"#C0001A", redDark:"#8B0013", redLight:"#FFF0F0",
  black:"#0A0A0A", white:"#FFFFFF",
  gray50:"#FAFAFA", gray100:"#F4F4F5", gray200:"#E4E4E7",
  gray300:"#D1D1D6", gray400:"#A1A1AA", gray500:"#71717A",
  gray600:"#52525B", gray700:"#3F3F46", gray800:"#27272A", gray900:"#18181B",
  green:"#16A34A", greenLight:"#F0FDF4",
  amber:"#D97706", amberLight:"#FFFBEB",
  blue:"#2563EB", blueLight:"#EFF6FF",
};

export const TABS = {
  vendedor:[
    {id:"dashboard",label:"Dashboard"},
    {id:"ventas",label:"Mis Ventas"},
    {id:"kpis",label:"KPIs"},
    {id:"producciones",label:"Producciones"},
    {id:"disponibilidad",label:"Disponibilidad"},
  ],
  gerente:[
    {id:"dashboard_gerente",label:"Dashboard"},
    {id:"ventas",label:"Ventas"},
    {id:"kpis",label:"KPIs"},
    {id:"comisiones",label:"Comisiones"},
    {id:"disponibilidad",label:"Disponibilidad"},
    {id:"producciones",label:"Producciones"},
    {id:"modificaciones",label:"Modificaciones"},
    {id:"alertas",label:"Alertas"},
  ],
  marketing:[
    {id:"producciones",label:"Producciones"},
    {id:"social",label:"Redes Sociales"},
    {id:"assets",label:"Assets"},
    {id:"metricas",label:"Métricas"},
  ],
  admin:[
    {id:"facturacion",label:"Facturación"},
    {id:"contratos",label:"Contratos"},
    {id:"comisiones",label:"Comisiones"},
    {id:"clientes",label:"Clientes"},
    {id:"reportes",label:"Reportes"},
    {id:"alertas_admin",label:"Alertas"},
  ],
};

export const fmt = n => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);
export const pct = (a,b) => b>0 ? Math.round((a/b)*100) : 0;
export const daysUntil = dateStr => { if(!dateStr) return null; return Math.ceil((new Date(dateStr)-new Date())/(1000*60*60*24)); };

export const getWeekDates = (offset=0) => {
  const now=new Date(), day=now.getDay();
  const mon=new Date(now);
  mon.setDate(now.getDate()-(day===0?6:day-1)+offset*7);
  const sun=new Date(mon); sun.setDate(mon.getDate()+6);
  return {
    inicio:mon.toISOString().split("T")[0],
    fin:sun.toISOString().split("T")[0],
    label:`${mon.getDate()}/${mon.getMonth()+1} - ${sun.getDate()}/${sun.getMonth()+1}`
  };
};

// Calcular cuotas de una venta
export const calcCuotas = (venta) => {
  if(!venta.fecha_inicio || !venta.num_cuotas || venta.num_cuotas<=1) return [];
  const cuotas = [];
  const montoCuota = Math.round(venta.total / venta.num_cuotas);
  for(let i=0;i<venta.num_cuotas;i++){
    const fecha = new Date(venta.fecha_inicio);
    fecha.setMonth(fecha.getMonth()+i);
    cuotas.push({
      numero: i+1,
      fecha: fecha.toISOString().split("T")[0],
      monto: montoCuota,
      pagada: i < (venta.cuotas_pagadas||0),
    });
  }
  return cuotas;
};

// Calcular comisión mensual de un vendedor para una venta
export const calcComisionMensual = (venta, porcentaje) => {
  if(!venta || venta.estado==="cancelada") return 0;
  const meses = venta.num_cuotas||1;
  const montoPorMes = venta.total / meses;
  return Math.round(montoPorMes * (porcentaje/100));
};
