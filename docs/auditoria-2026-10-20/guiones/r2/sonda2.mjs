import { navegador, contexto, BASE, espera } from './comun.mjs';
import { readFileSync } from 'node:fs';
const est = JSON.parse(readFileSync('../b1/estados-ficticios.json', 'utf8'));
const [,, vista, caso, url, js] = process.argv;
const nav = await navegador(); const c = await contexto(nav, vista, { sesion: (est.find((s) => s.caso === caso) || {}).sesion }); const p = await c.newPage();
await p.goto(BASE + url, { waitUntil: 'networkidle' }); await espera(800);
console.log(JSON.stringify(await p.evaluate(js), null, 1)); await p.screenshot({ path: '/tmp/claude-0/sonda.png' }); await nav.close();
