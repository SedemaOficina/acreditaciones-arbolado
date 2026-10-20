import { navegador, contexto, BASE, espera } from './comun.mjs';
const [,, vista, url, js] = process.argv;
const nav = await navegador(); const c = await contexto(nav, vista); const p = await c.newPage();
await p.goto(BASE + url, { waitUntil: 'networkidle' }); await espera(500);
console.log(JSON.stringify(await p.evaluate(js), null, 1)); await nav.close();
