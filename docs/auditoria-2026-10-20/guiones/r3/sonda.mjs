import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.goto('http://localhost:8903/index.html');
const r = await p.evaluate(async () => { const d = await APD.cargar(); return { tiene: typeof APD_CASOS_PRUEBA, claves: Object.keys(APD), casos: typeof APD_CASOS_PRUEBA !== 'undefined' ? APD_CASOS_PRUEBA.lista(d).flatMap(g => g.casos.map(c => [g.perfil, c.clave, c.persona && c.persona.id, c.pantalla])) : null }; });
console.log(JSON.stringify(r));
console.log(typeof p.accessibility, typeof p.locator('body').ariaSnapshot);
await b.close();
