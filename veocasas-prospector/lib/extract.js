import { RE_INMOBILIARIA, adivinarDepto } from './normalize.js';
import { extraerInmobiliarias } from './claude.js';

// Convierte un ítem crudo en candidatos { nombre, web, email, telefono, instagram, facebook, departamento }
export async function mapear(fuente, it) {
  switch (fuente) {
    case 'maps': {
      const esInmo = (it.types || []).includes('real_estate_agency') || RE_INMOBILIARIA.test(`${it.title} ${it.categoryName}`);
      if (!esInmo) return [];
      return [{ nombre: it.title, web: it.website, telefono: it.phone, departamento: adivinarDepto(it.address), direccion: it.address }];
    }
    case 'google': {
      const res = (it.resultados || []).map(r => `- ${r.title} | ${r.url} | ${r.description}`).join('\n');
      return res ? extraerInmobiliarias(`Resultados de Google para "${it.consulta}":\n${res}`) : [];
    }
    case 'directorios': {
      const t = it.texto || '';
      return t.length < 200 ? [] : extraerInmobiliarias(`Página: ${it.url}\n\n${t}`);
    }
    default: return [];
  }
}
