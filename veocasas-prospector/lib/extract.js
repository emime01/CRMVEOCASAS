import { RE_INMOBILIARIA, adivinarDepto } from './normalize.js';
import { extraerInmobiliarias } from './claude.js';

// el departamento de la consulta sirve cuando la dirección o el texto no lo dicen
const conDepto = (cands, depto) => cands.map(c => ({ ...c, departamento: c.departamento || depto || null }));

// Convierte un ítem crudo en candidatos { nombre, web, email, telefono, instagram, facebook, departamento }
export async function mapear(fuente, it) {
  switch (fuente) {
    case 'maps': {
      const esInmo = (it.types || []).includes('real_estate_agency') || RE_INMOBILIARIA.test(`${it.title} ${it.categoryName}`);
      if (!esInmo) return [];
      return [{
        nombre: it.title, web: it.website, telefono: it.phone, direccion: it.address,
        departamento: adivinarDepto(it.address) || it.depto || null,
      }];
    }
    case 'google': {
      const res = (it.resultados || []).map(r => `- ${r.title} | ${r.url} | ${r.description}`).join('\n');
      return res ? conDepto(await extraerInmobiliarias(`Resultados de Google para "${it.consulta}":\n${res}`), it.depto) : [];
    }
    case 'directorios': {
      if (it.estructurado) {
        const { estructurado, url, depto, ...datos } = it; // InfoCasas: nombre y dirección; Turismo y Casas y Más traen más
        return [{ ...datos, departamento: datos.departamento || adivinarDepto(datos.direccion) || depto || null }];
      }
      const t = it.texto || '';
      return t.length < 200 ? [] : conDepto(await extraerInmobiliarias(`Página: ${it.url}\n\n${t}`), it.depto);
    }
    default: return [];
  }
}
