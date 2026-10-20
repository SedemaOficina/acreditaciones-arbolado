import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ timezoneId: 'America/Mexico_City' })).newPage();
await p.goto('http://localhost:8902/index.html');
const r = await p.evaluate(() => APD.cargar().then((d) => ({ casos: APD_CASOS_PRUEBA.lista(d).map((g) => ({ perfil: g.perfil, grupo: g.grupo, casos: g.casos.map((c) => ({ clave: c.clave, persona: c.persona && c.persona.id, pantalla: c.pantalla, migrada: c.migrada })) })), grupos: d.grupo.map((g) => [g.folio, g.estado, g.curso || g.tipo_curso]), corte: d.fecha_corte })));
console.log(JSON.stringify(r, null, 1));
await b.close();
