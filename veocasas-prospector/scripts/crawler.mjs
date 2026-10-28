// Rastrea portales, cámaras y guías con un navegador real y deja el texto de cada página en la cola.
// Corre en GitHub Actions (.github/workflows/directorios.yml) o a mano: npm run crawler
import { chromium } from 'playwright';
import { DIRECTORIOS } from '../lib/config.js';
import { guardarLote } from '../lib/pasos.js';

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'es-UY', userAgent: 'Mozilla/5.0 (compatible; VeocasasBot/1.0; +https://veocasas.com.uy)' });
const paginas = [];

for (const inicio of DIRECTORIOS.startUrls) {
  const host = new URL(inicio).hostname;
  const vistos = new Set();
  const cola = [[inicio, 0]];
  let n = 0;
  while (cola.length && n < DIRECTORIOS.maxPaginasPorSitio) {
    const [url, prof] = cola.shift();
    if (vistos.has(url)) continue;
    vistos.add(url);
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(1500);
      const texto = (await page.evaluate(() => document.body?.innerText || '')).slice(0, 20000);
      if (texto.length > 200) paginas.push({ url, texto });
      n++;
      if (prof < DIRECTORIOS.profundidad) {
        const links = await page.$$eval('a[href]', as => as.map(a => ({ href: a.href, texto: a.innerText || '' })));
        for (const l of links) {
          try {
            const u = new URL(l.href);
            u.hash = '';
            if (u.hostname === host && DIRECTORIOS.patronLinks.test(`${u.pathname} ${l.texto}`) && !vistos.has(u.href)) cola.push([u.href, prof + 1]);
          } catch {}
        }
      }
    } catch (e) { console.warn('No se pudo abrir', url, e.message); }
    await page.close();
  }
  console.log(`${host}: ${n} páginas`);
}

await browser.close();
await guardarLote('directorios', paginas, 10);
console.log(`${paginas.length} páginas en cola. Se procesan en el próximo ciclo del agente.`);
process.exit(0);
