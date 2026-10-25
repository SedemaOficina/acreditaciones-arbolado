/* =========================================================
   archivos-prueba.js · Lo que se registra en la versión de prueba, guardado en este navegador
   (decisiones 2026-10-16, 2026-10-17 y 2026-10-18)

   Para recorrer el trámite completo sin servidor, todo lo que se hace en la prueba queda guardado en ESTE navegador
   y sobrevive a recargar, abrir otra pestaña o cerrar el navegador:
     · cuentas creadas (IndexedDB «cuentas», por CURP), con la contraseña sólo como resumen SHA-256;
     · fotografías de perfil (IndexedDB «fotos», por CURP);
     · solicitudes enviadas y cada uno de sus reenvíos (IndexedDB «solicitudes», con la lista de envíos) y todos sus
       documentos, sin sustituir las cargas anteriores (IndexedDB «documentos»): lo del envío, la corrección de una
       cita en pausa y la factura que carga el personal;
     · cambios hechos en «Mi perfil» (localStorage «apd.perfiles»);
     · revisiones del personal («apd.personal.revisiones») y citas de cotejo atendidas («apd.personal.cotejos»);
     · grupos, sus cambios y la asistencia («apd.personal.grupos», una lista de eventos en orden);
     · el pase de lista del día del examen («apd.examen.lista») y los exámenes en línea («apd.examen.c.<código>»,
       app/examen-servidor.js): la calificación llega a la solicitud como la llevaría la base (apd.examen);
     · el material de estudio que sube el personal (IndexedDB «material»);
     · la cancelación de acreditaciones y la reposición de credenciales («apd.acreditaciones», una lista de eventos en orden;
       el acta de la reposición, en IndexedDB «documentos» con el folio «reposicion:<número>»; sesión del 23/10/2026).
   APD.cargar() los suma a los datos ficticios con mezcla() y mezclaMaterial(), así que todas las pantallas —«Mis
   trámites», «Mi perfil», la bandeja, las citas, los grupos, la asistencia, el examen y el material— ven lo mismo.
   Lo que la base rechazaría, aquí no cambia nada: la mezcla aplica a cada evento las reglas de la base en el momento en
   que pasó (transiciones de la solicitud y de la cita, una solicitud activa por persona y tipo, folio de solicitud y de
   grupo únicos, expediente consecutivo, folio fiscal único; auditoría «intentar romperlo», bloque 2), así que dos
   pestañas o dos personas a la vez quedan como las dejaría la base. Las pantallas vuelven a leer antes de guardar y
   comprueban después que su cambio se aplicó: si no, lo retiran y lo dicen (nunca un éxito falso). Nada sale de la computadora; «Borrar lo guardado» y «Empezar de
   cero» (menú de pruebas) lo quitan, y se borra solo a los 7 días sin usar la prueba (caduca). Otro navegador u otro
   equipo no lo ven.

   En la etapa 3 este archivo se quita: todo lo guarda y lo entrega la API.
   ========================================================= */
(function (global) {
  'use strict';
  const BASE = 'apd-prueba';
  const DOCS = 'documentos';
  const SOLS = 'solicitudes';
  const FOTOS = 'fotos';
  const CUENTAS = 'cuentas';
  const MATERIAL = 'material';
  /* Las claves de localStorage de la prueba, en un solo lugar (auditoría 2026-10-18, A 6.1). El servidor simulado del
     examen (app/examen-servidor.js) usa las mismas para los códigos y el pase de lista. */
  const CLAVES = {
    sesion: 'apd.sesion',
    perfiles: 'apd.perfiles',
    revisiones: 'apd.personal.revisiones',
    cotejos: 'apd.personal.cotejos',
    grupos: 'apd.personal.grupos',
    acreditaciones: 'apd.acreditaciones',
    // Avisos por teléfono del registro asistido que registró el personal en esta prueba (decisión 2026-10-25)
    avisosTelefono: 'apd.personal.avisos_telefono',
    lista: 'apd.examen.lista',
    examen: 'apd.examen.c.',
    latido: 'apd.examen.latido.',
    ultimoUso: 'apd.prueba.ultimo_uso',
    inicio: 'apd.prueba.inicio'
  };
  let abierta = null;

  /* ----- Aviso de que algo cambió en lo guardado (auditoría «intentar romperlo», F2 B1) -----
     localStorage avisa solo a las otras pestañas (evento storage); IndexedDB no. Cada escritura en IndexedDB de la prueba
     lo dice por un canal del mismo origen, y alCambiar(fn) junta las dos señales y la vuelta a la pestaña (foco), para
     que una pantalla abierta (la agenda de citas, el cotejo que se retoma) vuelva a leer lo de ahora. En la etapa 3 la
     pantalla consulta la API al volver el foco o cada minuto. */
  let canal = null;
  try { canal = typeof global.BroadcastChannel === 'function' ? new global.BroadcastChannel('apd-prueba') : null; } catch (e) { canal = null; }
  function avisaCambio() { try { if (canal) canal.postMessage('cambio'); } catch (e) { /* sin canal: queda el foco */ } }
  const despuesDe = (promesa) => promesa.then((r) => { avisaCambio(); return r; });
  function alCambiar(fn) {
    let t = 0;
    const programa = () => { clearTimeout(t); t = setTimeout(fn, 150); };
    if (canal) canal.addEventListener('message', programa);
    global.addEventListener('storage', (e) => {
      if (!e.key || (e.key.startsWith('apd.') && !e.key.startsWith(CLAVES.latido) && e.key !== CLAVES.ultimoUso)) programa();
    });
    global.addEventListener('focus', programa);
    global.document.addEventListener('visibilitychange', () => { if (global.document.visibilityState === 'visible') programa(); });
  }

  /* Las preguntas del banco ficticio vigente (datos/examen-ficticio.js), sin la clave de respuestas: un examen guardado con
     otro banco (preguntas que ya no existen) se ignora en la mezcla igual que en el servidor simulado del examen, también
     en las pantallas que no cargan el banco (auditoría «intentar romperlo», F4 M5). probar-examen comprueba que esta
     lista sea la del banco. */
  const PREGUNTAS_BANCO = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10'];
  const preguntasBanco = () => (global.APD_EXAMEN_BANCO && Array.isArray(global.APD_EXAMEN_BANCO.reactivos)
    ? global.APD_EXAMEN_BANCO.reactivos.map((r) => r.clave) : PREGUNTAS_BANCO);
  const delBanco = (r) => Array.isArray(r.preguntas) && r.preguntas.length > 0 && r.preguntas.every((k) => preguntasBanco().includes(k));

  function abre() {
    if (abierta) return abierta;
    abierta = new Promise((ok, mal) => {
      let r;
      try { r = global.indexedDB.open(BASE, 4); } catch (e) { mal(e); return; }
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(DOCS)) db.createObjectStore(DOCS, { keyPath: 'clave' }).createIndex('folio', 'folio');
        if (!db.objectStoreNames.contains(SOLS)) db.createObjectStore(SOLS, { keyPath: 'folio' });
        if (!db.objectStoreNames.contains(FOTOS)) db.createObjectStore(FOTOS, { keyPath: 'curp' });
        if (!db.objectStoreNames.contains(CUENTAS)) db.createObjectStore(CUENTAS, { keyPath: 'curp' });
        if (!db.objectStoreNames.contains(MATERIAL)) db.createObjectStore(MATERIAL, { keyPath: 'id' });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    return abierta;
  }
  function tx(almacen, modo, accion) {
    return abre().then((db) => new Promise((ok, mal) => {
      const t = db.transaction(almacen, modo);
      const res = accion(t.objectStore(almacen));
      t.oncomplete = () => ok(res && 'result' in res ? res.result : undefined);
      t.onerror = () => mal(t.error);
      t.onabort = () => mal(t.error);
    }));
  }
  /* Lee un registro y escribe el que resulte, en la misma transacción. Si nuevo() lanza un error (el registro ya no admite
     el cambio), la transacción se deshace y la promesa se rechaza con ese error: no se guarda nada. nuevo() puede
     devolver null para borrar el registro. */
  function cambia(almacen, llave, nuevo) {
    return abre().then((db) => new Promise((ok, mal) => {
      const t = db.transaction(almacen, 'readwrite');
      const s = t.objectStore(almacen);
      const g = s.get(llave);
      let error = null;
      g.onsuccess = () => {
        try {
          const n = nuevo(g.result || null);
          if (n === null) s.delete(llave); else s.put(n);
        } catch (e) { error = e; t.abort(); }
      };
      t.oncomplete = () => ok();
      t.onerror = () => mal(error || t.error);
      t.onabort = () => mal(error || t.error);
    }));
  }

  /* ----- Registros dañados (auditoría «intentar romperlo», F4 A6) -----
     Un solo registro sin forma (null, sin su persona, sin su hora) hacía que la mezcla fallara entera y todas las pantallas
     vieran sólo los ficticios. Ahora la mezcla salta lo que no tiene forma de registro y aplica cada folio y cada evento de
     grupo por su cuenta: si uno no se puede aplicar, se deja como estaba antes de él y siguen los demás. Cuántos se
     ignoraron en la última lectura lo dice ignorados(); el menú de pruebas lo avisa una vez por pantalla («Borrar lo
     guardado» los quita). La base no admite registros así: en la etapa 3 no aplica. */
  const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  const conTexto = (x, k) => esObjeto(x) && typeof x[k] === 'string' && x[k] !== '';
  let ultimosIgnorados = 0;
  function ignorados() { return ultimosIgnorados; }

  /* ----- localStorage de la prueba ----- */
  const leeLs = (clave, vacio) => { try { const v = JSON.parse(global.localStorage.getItem(clave) || 'null'); return v === null ? vacio : v; } catch (e) { return vacio; } };
  /* Revisiones y citas atendidas: una lista por folio. Lo guardado antes de 0.27 era un registro por folio: lista de uno. */
  const comoLista = (t) => Object.fromEntries(Object.entries(esObjeto(t) ? t : {}).map(([f, v]) => [f, Array.isArray(v) ? v : [v]]));
  const listaPorFolio = (clave) => comoLista(leeLs(clave, {}));
  const eventosGrupos = () => { const v = leeLs(CLAVES.grupos, []); return Array.isArray(v) ? v : []; };
  const eventosAcreditaciones = () => { const v = leeLs(CLAVES.acreditaciones, []); return Array.isArray(v) ? v : []; };
  /* Un evento de cancelación o de reposición (P120, P140), con su hora real «en». Devuelve el evento guardado, o null si el
     navegador no lo permitió (la pantalla lo dice, bloque 3) */
  function guardaEventoAcreditacion(e) {
    const ev = Object.assign({ en: new Date().toISOString() }, e);
    try { global.localStorage.setItem(CLAVES.acreditaciones, JSON.stringify(eventosAcreditaciones().concat([ev]))); return ev; } catch (x) { return null; }
  }
  /* Retira un evento que la base no habría aplicado (se reconoce por su hora real «en») */
  function retiraEventoAcreditacion(en) {
    try { global.localStorage.setItem(CLAVES.acreditaciones, JSON.stringify(eventosAcreditaciones().filter((x) => !esObjeto(x) || x.en !== en))); } catch (x) { /* sin almacenamiento */ }
  }
  const paseDeLista = () => { const v = leeLs(CLAVES.lista, {}); return esObjeto(v) ? v : {}; };
  function clavesLs(prefijo) { try { return Object.keys(global.localStorage).filter((k) => k.startsWith(prefijo)); } catch (e) { return []; } }
  /* dañado(): se llama por cada código que no tiene forma de registro (F4 A6); uno de otro banco se ignora sin contarlo */
  function codigosExamen(danado) {
    const lista = [];
    for (const k of clavesLs(CLAVES.examen)) {
      const r = leeLs(k, null);
      if (!esObjeto(r) || !r.inscripcion_id) { if (danado) danado(); continue; }
      if (delBanco(r)) lista.push(r);
    }
    return lista;
  }

  /* ----- Solicitudes y documentos ----- */
  /* Guarda el envío (resumen para la bandeja) y sus archivos: [{ requisito, blob, nombre, tipo, size }]. Cada reenvío se
     agrega a la lista de envíos del folio y cada archivo queda como una carga más, con su hora (auditoría 2026-10-18,
     C2): sustituir el registro perdía las revisiones de en medio y las cargas anteriores. */
  function guardaEnvio(solicitud, archivos) {
    const ahora = new Date().toISOString();
    const envio = Object.assign({}, solicitud, { guardada_en: ahora });
    return despuesDe(cambia(SOLS, solicitud.folio, (previo) => {
      // Una solicitud nueva con un folio que otra pestaña acaba de tomar: no se suma como reenvío de la otra (la base
      // asigna el folio al guardar, solicitud_folio_uk; auditoría «intentar romperlo», bloque 2)
      if (previo && !solicitud.existente) throw Object.assign(new Error('folio_ocupado'), { codigo: 'folio_ocupado' });
      const envios = previo ? (previo.envios || [Object.assign({}, previo, { envios: undefined })]) : [];
      return Object.assign({}, previo && envios[0] ? envios[0] : envio, { folio: solicitud.folio, envios: envios.concat([envio]), guardada_en: ahora });
    }).then(() => tx(DOCS, 'readwrite', (s) => {
      for (const a of archivos) {
        s.put({ clave: `${solicitud.folio}|${a.requisito}|${ahora}`, folio: solicitud.folio, requisito: a.requisito, blob: a.blob, envio: true,
          nombre_original: a.nombre, tipo_mime: a.tipo, tamano_bytes: a.size, cargado_en: ahora });
      }
    })).then(() => ahora));
  }
  /* Un documento suelto, con historial (no sustituye la carga anterior en el almacén): la corrección de un documento
     que no coincidió en el cotejo, o la factura que carga el personal. extra: { en, estado, cargado_por, motivo } */
  function guardaDocumento(folio, requisito, a, extra) {
    const { en, ...resto } = extra || {};
    const ahora = en || new Date().toISOString();
    return despuesDe(tx(DOCS, 'readwrite', (s) => s.put(Object.assign({ clave: `${folio}|${requisito}|${ahora}`, folio, requisito, blob: a.blob,
      nombre_original: a.nombre, tipo_mime: a.tipo, tamano_bytes: a.size, cargado_en: ahora }, resto))));
  }
  /* Retira lo que se acaba de guardar y la base habría rechazado (bloque 2: la página vuelve a leer después de guardar y,
     si el cambio no se aplicó, lo quita y lo dice; en la base ni siquiera se habría guardado). retiraEnvio quita un
     envío de la lista del folio (el registro, si era el único) y sus archivos; quitaDocumento, una carga suelta. */
  function retiraEnvio(folio, guardadaEn) {
    return despuesDe(cambia(SOLS, folio, (previo) => {
      if (!previo) return null;
      const envios = (previo.envios || [previo]).filter((x) => x.guardada_en !== guardadaEn);
      return envios.length ? Object.assign({}, previo, { envios }) : null;
    }).then(() => abre()).then((db) => new Promise((ok, mal) => {
      const t = db.transaction(DOCS, 'readwrite');
      const s = t.objectStore(DOCS);
      const q = s.index('folio').getAll(folio);
      q.onsuccess = () => { for (const a of q.result || []) if (a.envio && a.cargado_en === guardadaEn) s.delete(a.clave); };
      t.oncomplete = () => ok();
      t.onerror = () => mal(t.error);
      t.onabort = () => mal(t.error);
    })));
  }
  function quitaDocumento(folio, requisito, en) {
    return despuesDe(tx(DOCS, 'readwrite', (s) => s.delete(`${folio}|${requisito}|${en}`)));
  }
  function solicitudes() { return tx(SOLS, 'readonly', (s) => s.getAll()).catch(() => []); }
  function todosLosDocumentos() { return tx(DOCS, 'readonly', (s) => s.getAll()).catch(() => []); }
  /* Los documentos de un folio, por el índice «folio» (lo usa el borrador de la solicitud: «borrador:<persona>:<folio>») */
  function documentos(folio) { return tx(DOCS, 'readonly', (s) => s.index('folio').getAll(folio)).then((r) => r || []).catch(() => []); }
  /* Borra los documentos de un folio: «Empezar de nuevo» y el envío borran los del borrador (auditoría «intentar
     romperlo», F1 7 y F4 M6: se quedaban en este navegador y el menú los contaba como «cargados aparte») */
  function borraDocumentos(folio) {
    return despuesDe(abre().then((db) => new Promise((ok, mal) => {
      const t = db.transaction(DOCS, 'readwrite');
      const s = t.objectStore(DOCS);
      const q = s.index('folio').getAllKeys(folio);
      q.onsuccess = () => { for (const k of q.result || []) s.delete(k); };
      t.oncomplete = () => ok();
      t.onerror = () => mal(t.error);
      t.onabort = () => mal(t.error);
    })));
  }

  /* ----- Fotografía de la persona: { blob, nombre, tipo } por CURP ----- */
  function guardaFoto(curp, a) {
    return despuesDe(tx(FOTOS, 'readwrite', (s) => s.put({ curp, blob: a.blob, nombre_original: a.nombre, tipo_mime: a.tipo, cargada_en: new Date().toISOString() })));
  }
  function foto(curp) { return curp ? tx(FOTOS, 'readonly', (s) => s.get(curp)).catch(() => null) : Promise.resolve(null); }
  function fotos() { return tx(FOTOS, 'readonly', (s) => s.count()).catch(() => 0); }

  /* ----- Material de estudio que sube el personal (decisión 2026-10-18) -----
     Una carga nueva lleva su registro completo, con el archivo (blob), como apd.material_estudio. Un cambio de datos o
     de publicación se COMBINA con lo guardado del mismo documento (auditoría 2026-10-18, C4: sustituirlo borraba el
     archivo, el título y la fecha): en una carga de la prueba, en su campo «cambios»; en un documento de los ficticios,
     en un registro de cambios que se acumulan. Como la base (apd.material_alta y apd.material_cambio): la carga nueva
     de un documento deja la anterior como no vigente y conserva si estaba publicado; el archivo no se modifica. */
  function guardaMaterial(registro) {
    const ahora = new Date().toISOString();
    if (registro.blob) return despuesDe(tx(MATERIAL, 'readwrite', (s) => s.put(Object.assign({ guardado_en: ahora }, registro))));
    const { id, ...cambios } = registro;
    return despuesDe(cambia(MATERIAL, id, (previo) => {
      if (previo && previo.blob) return Object.assign({}, previo, { cambios: Object.assign({}, previo.cambios, cambios) });
      return Object.assign({ guardado_en: ahora }, previo, cambios, { id });
    }));
  }
  function materiales() { return tx(MATERIAL, 'readonly', (s) => s.getAll()).catch(() => []); }
  const urls = {};
  function mezclaMaterial(datos) {
    return materiales().then((todos) => {
      // El archivo de un documento de la base está en el sitio, en la ruta de su clave en el almacén
      let filas = (datos.material_estudio || []).map((m) => Object.assign({}, m, { url: m.url || m.archivo_clave }));
      // Un registro sin forma (null, sin id) se salta y se cuenta con los demás dañados (F4 A6)
      const registros = (todos || []).filter((r) => esObjeto(r) && r.id);
      // prueba_ignorados: los dañados de la mezcla (mezcla) más los del material; es lo que dice ignorados()
      const prueba_ignorados = (Number(datos.prueba_ignorados) || 0) + (todos || []).length - registros.length;
      ultimosIgnorados = prueba_ignorados;
      if (!registros.length) return Object.assign({}, datos, { material_estudio: filas, prueba_ignorados });
      registros.sort((a, b) => String(a.guardado_en).localeCompare(String(b.guardado_en)));
      for (const r of registros) {
        const { blob, guardado_en, cambios, ...campos } = r;
        const i = filas.findIndex((m) => m.id === r.id);
        if (i >= 0 && !blob) { filas[i] = Object.assign({}, filas[i], campos); continue; }
        // Un cambio sin su documento (lo dejó así una versión anterior de la prueba, que sustituía el registro): no se aplica
        // Una carga incompleta (de una versión anterior de la prueba, sin páginas ni nombre de archivo) tampoco: se veía
        // «undefined páginas» (auditoría «intentar romperlo», F4 B7). La base exige los dos (apd.material_estudio).
        if (!blob || !campos.clave || !(Number(campos.paginas) > 0) || !campos.nombre_archivo) continue;
        // Carga nueva: sustituye a la vigente del mismo documento y hereda si estaba publicada; después, sus cambios
        const previa = filas.find((m) => m.clave === r.clave && m.vigente);
        if (previa) { previa.vigente = false; campos.publicado = previa.publicado; }
        if (!urls[r.id]) { try { urls[r.id] = global.URL.createObjectURL(blob); } catch (e) { urls[r.id] = ''; } }
        filas.push(Object.assign({ temas: [], orden: (previa && previa.orden) || 99 }, campos, cambios || {}, { vigente: true, url: urls[r.id] || '' }));
      }
      filas = filas.map((m) => Object.assign({}, m));
      return Object.assign({}, datos, { material_estudio: filas, prueba_ignorados });
    });
  }

  /* ----- Cuentas creadas en la prueba ----- */
  /* La contraseña nunca se guarda: sólo su resumen SHA-256, para poder entrar otra vez con ella en este navegador. */
  function resumen(texto) {
    const datos = new TextEncoder().encode(String(texto));
    return global.crypto.subtle.digest('SHA-256', datos)
      .then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''));
  }
  /* cuenta: { curp, id, persona: {…datos de la persona…}, contrasena } → se guarda con el resumen. Sin CURP no hay
     cuenta (auditoría 2026-10-18, A 8.3: quedaba una cuenta con la CURP vacía). La del registro asistido (decisión
     2026-10-25) llega sin contraseña: se guarda sin resumen y no entra hasta que la persona la activa. */
  function guardaCuenta({ curp, id, persona, contrasena }) {
    if (!curp || !id) return Promise.reject(new Error('sin_curp'));
    const r0 = contrasena == null ? Promise.resolve(null) : resumen(contrasena);
    return despuesDe(r0.then((r) => tx(CUENTAS, 'readwrite', (s) => s.put({ curp, id, persona, resumen: r, creada_en: new Date().toISOString() }))));
  }
  function cuentas() { return tx(CUENTAS, 'readonly', (s) => s.getAll()).catch(() => []); }
  function cuenta(curp) { return curp ? tx(CUENTAS, 'readonly', (s) => s.get(curp)).catch(() => null) : Promise.resolve(null); }
  function contrasenaValida(c, contrasena) { return c && c.resumen ? resumen(contrasena).then((r) => r === c.resumen) : Promise.resolve(false); }

  /* ----- Cambios de «Mi perfil» (contacto, adscripción, fotografía nueva), por persona ----- */
  const leePerfiles = () => { const v = leeLs(CLAVES.perfiles, {}); return esObjeto(v) ? v : {}; };
  /* Devuelve true si quedó guardado (false: el navegador no lo permitió; la pantalla lo dice, bloque 3) */
  function guardaPerfil(id, cambios) {
    const t = leePerfiles();
    t[id] = Object.assign({}, esObjeto(t[id]) ? t[id] : {}, cambios);
    try { global.localStorage.setItem(CLAVES.perfiles, JSON.stringify(t)); return true; } catch (e) { return false; }
  }

  /* ----- Borrar lo guardado (auditoría 2026-10-18, C 1.1 a 1.4) -----
     Una sola lista: todo lo de la prueba en localStorage (prefijo «apd.»), salvo la sesión y la fecha del último uso, y
     los cinco almacenes de IndexedDB. Si la sesión era de una cuenta creada en la prueba, se cierra: la cuenta ya no
     existe. Lo usan «Borrar lo guardado», «Empezar de cero» y la caducidad. */
  function borraTodo() {
    const sesion = leeLs(CLAVES.sesion, null);
    for (const k of clavesLs('apd.')) {
      if (k === CLAVES.ultimoUso || (k === CLAVES.sesion && !(sesion && /^prueba:/.test(String(sesion.id))))) continue;
      try { global.localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ }
    }
    return Promise.all([SOLS, DOCS, FOTOS, CUENTAS, MATERIAL].map((a) => tx(a, 'readwrite', (s) => s.clear())));
  }
  /* Lo de esta pestaña (sessionStorage): el código de examen abierto, la pantalla del examen y las preguntas
     obligatorias desactivadas */
  function borraPestana() {
    try { for (const k of Object.keys(global.sessionStorage)) if (k.startsWith('apd.')) global.sessionStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ }
  }
  /* Caducidad (auditoría integral, alta 1): la dirección del sitio de prueba la comparten otros sitios, así que lo
     guardado no se queda para siempre. Si pasan CADUCA_DIAS días sin usar la prueba en este navegador, se borra todo
     lo suyo (también la sesión, los códigos de examen y lo de la pestaña) antes de leer los datos. La cuenta es en
     días reales, no en la fecha simulada. */
  const CADUCA_DIAS = 7;
  let revisada = null;
  function caduca() {
    if (revisada) return revisada;
    let antes = 0;
    try { antes = Number(global.localStorage.getItem(CLAVES.ultimoUso)) || 0; } catch (e) { /* sin almacenamiento */ }
    const ahora = Date.now();
    const vencida = antes > 0 && ahora - antes > CADUCA_DIAS * 864e5;
    const borra = () => {
      try { for (const k of clavesLs('apd.')) global.localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ }
      borraPestana();
      return borraTodo();
    };
    revisada = (vencida ? borra() : Promise.resolve()).catch(() => undefined).then(() => {
      try { global.localStorage.setItem(CLAVES.ultimoUso, String(ahora)); } catch (e) { /* sin almacenamiento */ }
      return vencida;
    });
    return revisada;
  }
  /* El borrador de una solicitud: «apd.borrador.solicitud.<persona>.<folio>» en localStorage (app/config-solicitud.js) y
     sus archivos con folio «borrador:<persona>:<folio>» */
  const BORRADOR_LS = 'apd.borrador.solicitud.';
  const folioDeBorrador = (k) => { const r = k.slice(BORRADOR_LS.length); const i = r.lastIndexOf('.'); return `borrador:${r.slice(0, i)}:${r.slice(i + 1)}`; };
  /* Lo guardado, para el menú de pruebas: cuántos registros de cada cosa */
  function guardado() {
    const cuantos = (clave) => { const v = leeLs(clave, {}); return Object.values(esObjeto(v) ? v : {}).reduce((n, x) => n + (Array.isArray(x) ? x.length : 1), 0); };
    // Los archivos de un borrador de solicitud (folio «borrador:…») no son documentos cargados aparte: se cuentan como
    // borradores (auditoría «intentar romperlo», F4 M6)
    const deBorrador = (x) => String(x.folio || '').startsWith('borrador:');
    // Un registro dañado (null) se cuenta como uno más, sin leerlo (F4 A6: el conteo fallaba y el menú decía «nada»)
    return Promise.all([solicitudes(), fotos(), cuentas(), todosLosDocumentos(), materiales()]).then(([s, f, c, docsLeidos, mat]) => {
      const docs = docsLeidos.map((x) => (esObjeto(x) ? x : {}));
      return {
        cuentas: c.length, fotos: f,
        envios: s.reduce((n, x) => n + ((esObjeto(x) && Array.isArray(x.envios) && x.envios.length) || 1), 0),
        documentos: docs.filter((x) => !x.envio && !deBorrador(x) && String(x.clave).split('|').length > 2).length,
        borradores: new Set(docs.filter(deBorrador).map((x) => x.folio).concat(clavesLs(BORRADOR_LS).map(folioDeBorrador))).size,
        borradorArchivos: docs.filter(deBorrador).length,
        perfiles: Object.keys(leePerfiles()).length,
        material: mat.length,
        revisiones: cuantos(CLAVES.revisiones), cotejos: cuantos(CLAVES.cotejos), grupos: eventosGrupos().length,
        acreditaciones: eventosAcreditaciones().length,
        lista: Object.keys(paseDeLista()).length, examenes: clavesLs(CLAVES.examen).length,
        avisos: cuantos(CLAVES.avisosTelefono),
        // Cualquier otra clave de la prueba (por ejemplo, una señal de pantalla abierta del examen)
        otras: clavesLs('apd.').filter((k) => ![CLAVES.sesion, CLAVES.ultimoUso, CLAVES.inicio, CLAVES.avisosTelefono].includes(k) && !k.startsWith(BORRADOR_LS)).length
      };
    });
  }

  /* ----- La fecha simulada (auditoría 2026-10-18, C 5.1 a 5.5) -----
     La prueba vive en la fecha de corte de los ficticios (fecha_corte): lo hecho de verdad se registra ese día, para
     que la espera no salga negativa (decisión 2026-10-17). El tiempo real se comprime a partir de un ancla fija, el
     primer uso de la prueba en este navegador («apd.prueba.inicio»): un día real son unos 86 segundos simulados desde
     las 18:00, sin llegar a las 19:00. Así la misma acción tiene la misma hora en cada carga y en las dos caras, y se
     conserva el orden entre envío, revisión, cotejo y reenvío. Lo que tiene un día fijo posterior (una cita, el
     examen del grupo) se fecha ese día: no se atiende una cita antes de su hora. */
  function inicioPrueba() {
    let t = 0;
    try { t = Number(global.localStorage.getItem(CLAVES.inicio)) || 0; } catch (e) { /* sin almacenamiento */ }
    if (!t) { t = Date.now(); try { global.localStorage.setItem(CLAVES.inicio, String(t)); } catch (e) { /* sin almacenamiento */ } }
    return t;
  }
  function reloj(datos) {
    const tope = new Date(`${datos.fecha_corte}T19:00:00-06:00`).getTime();
    const desde = tope - 3600000;           // 18:00 del día simulado
    const techo = 3599000;                  // nunca después de las 18:59:59
    const inicio = inicioPrueba();
    const ms = (iso) => new Date(iso).getTime();
    /* Lo hecho de verdad, en el día simulado (lo que ya está en ese día o antes, como viene) */
    const alCorte = (iso) => {
      if (!iso || !datos.fecha_corte || !(ms(iso) > tope)) return iso;
      const x = (ms(iso) - inicio) / 1000;
      const y = x >= 0 ? techo * (1 - Math.exp(-x / techo)) : x;
      return new Date(Math.round(desde + y)).toISOString();
    };
    const hora = (iso) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour12: false });
    /* Lo hecho de verdad en un acto con día fijo (el examen): ese día, a la hora real */
    const enSuDia = (iso, dia) => (dia && datos.fecha_corte && dia > datos.fecha_corte ? `${dia}T${hora(iso)}-06:00` : alCorte(iso));
    /* La mayor de dos fechas y horas (se comparan como fechas: los ficticios usan -06:00 y la prueba, Z) */
    const mayor = (a, b) => (!a ? b : !b ? a : ms(a) >= ms(b) ? a : b);
    return { alCorte, enSuDia, mayor, ms };
  }

  /* ----- Mezcla: lo guardado en la prueba, encima de los datos ficticios (lo llama APD.cargar) ----- */
  /* Todo lo que pasó con una solicitud en la prueba se aplica en el orden en que pasó, como lo dejaría la base
     (decisión 2026-10-17): cargas de documentos, envíos y reenvíos, revisiones y citas de cotejo. Así una solicitud
     puede dar todas las vueltas: observada, reenviada, validada, en pausa en el cotejo, corregida el mismo día,
     regresada con observaciones desde el cotejo, sin presentarse, con el cotejo terminado… */
  const ORDEN_TIPO = { doc: 0, envio: 1, revision: 2, cotejo: 3 };
  // Resultado de la pantalla de cotejo → resultado de la cita en la base (apd.cita.resultado)
  const EN_LA_BASE = { terminado: 'atendida', pausa: 'en_pausa', con_observaciones: 'con_observaciones', otra_cita: 'sin_pago',
    no_se_presento: 'no_se_presento', cerrar: 'no_se_presento', no_es_la_persona: 'no_es_la_persona' };

  /* Grupos, asistencia y examen de la prueba (grupos.html, programar.html, grupo.html, asistencia.html, aplicar.html,
     examen.html): una lista de lo que pasó, en orden. Cada evento se aplica como lo dejaría la base (apd.grupo_cambio,
     apd.inscripcion_alta, apd.asistencia_captura, apd.examen_captura y apd.examen_aplicar): lo que la base rechazaría,
     aquí no cambia nada. */
  function aplicaGrupos(d, eventos, t, deshace) {
    const hoy = d.fecha_corte;
    const sede = global.APD.sede(d).nombre || null;
    const curso = (tipo, m) => global.APD.curso(d, tipo, m);
    const activas = (gid) => d.inscripcion.filter((i) => i.grupo_id === gid && i.activa);
    const conExamen = (insId) => d.examen.some((x) => x.inscripcion_id === insId);
    const ponSol = (id, cambios) => { const i = d.solicitud.findIndex((x) => x.id === id); if (i >= 0) d.solicitud[i] = Object.assign({}, d.solicitud[i], cambios); };
    const ponGrupo = (g, cambios) => { const i = d.grupo.indexOf(g); const n = Object.assign({}, g, cambios); d.grupo[i] = n; return n; };
    const fechaExamen = (g, c) => global.APD.sumaDias(g.fecha_inicio, c.dias_duracion - 1);
    function recibe(g) { return g.estado === 'en_integracion' || (g.estado === 'confirmado' && hoy < g.fecha_inicio); }
    function inscribe(g, folios, en) {
      for (const f of folios || []) {
        const s = d.solicitud.find((x) => x.folio === f);
        if (!s || s.estado !== 'lista_para_curso' || !recibe(g) || s.tipo_acreditacion !== g.tipo_acreditacion || s.modalidad !== g.modalidad) continue;
        if (g.integracion === 'especifico' && (s.organizacion_id || null) !== g.organizacion_id) continue;
        if (activas(g.id).length >= g.cupo_maximo) continue;
        // No se inscribe antes de que la persona llegara a la espera
        const cuando = t.mayor(en, s.lista_para_curso_en || s.estado_desde);
        d.inscripcion.push({ id: `prueba:${g.id}:${s.id}:${en}`, solicitud_id: s.id, grupo_id: g.id, activa: true, inscrita_en: cuando, baja_en: null, motivo_baja: null, de_prueba: true });
        ponSol(s.id, { estado: 'inscrita', estado_desde: cuando });
      }
    }
    function baja(ins, motivo, en) {
      d.inscripcion = d.inscripcion.map((x) => (x === ins ? Object.assign({}, x, { activa: false, baja_en: en, motivo_baja: motivo }) : x));
      const s = d.solicitud.find((x) => x.id === ins.solicitud_id);
      // Regresa a la espera con su antigüedad (lista_para_curso_en no cambia)
      if (s && s.estado === 'inscrita') ponSol(s.id, { estado: 'lista_para_curso', estado_desde: en });
    }
    /* La inscripción activa, su grupo y su curso */
    const deInscripcion = (insId) => {
      const ins = d.inscripcion.find((i) => i.id === insId && i.activa);
      const g = ins && d.grupo.find((x) => x.id === ins.grupo_id);
      const c = g && curso(g.tipo_acreditacion, g.modalidad);
      return c ? { ins, g, c } : null;
    };
    /* Cada evento por su cuenta (F4 A6): si uno no se puede aplicar, todo queda como estaba antes de él */
    const LISTAS = ['grupo', 'inscripcion', 'asistencia', 'examen', 'solicitud'];
    for (const e of eventos.slice().sort((a, b) => String(a.en).localeCompare(String(b.en)))) {
      const antes = Object.fromEntries(LISTAS.map((k) => [k, d[k].slice()]));
      try {
        aplica(e);
      } catch (error) {
        if (deshace) deshace(antes, `un evento de grupos (${e.tipo})`, error); else Object.assign(d, antes);
      }
    }
    function aplica(e) {
      const en = t.alCorte(e.en);
      if (e.tipo === 'pase') {
        // Pase de lista del día del examen (P94, decisión 2026-10-18): la asistencia del último día, como la registraría
        // la API en apd.asistencia. Con la calificación ya capturada, la base no la cambia (asistencia_cerrada).
        const x = deInscripcion(e.inscripcion_id);
        if (!x || x.g.estado !== 'en_curso' || conExamen(x.ins.id)) return;
        const dia = x.c.dias_duracion;
        d.asistencia = d.asistencia.filter((a) => !(a.inscripcion_id === x.ins.id && a.dia === dia));
        d.asistencia.push({ inscripcion_id: x.ins.id, dia, asistio: Boolean(e.presente), capturada_por: e.por, capturada_en: t.enSuDia(e.en, fechaExamen(x.g, x.c)), de_prueba: true, pase_de_lista: true });
        return;
      }
      if (e.tipo === 'examen') {
        // Examen en línea enviado (auditoría 2026-10-18, C3): la calificación llega a apd.examen con origen «examen_web»
        // y la solicitud queda aprobada o no acreditada (apd.examen_captura y apd.examen_aplicar). Se presenta el último
        // día del curso, con el pase de lista de ese día; la calificación no se modifica.
        const r = e.registro;
        const x = deInscripcion(r.inscripcion_id);
        if (!x || x.g.estado !== 'en_curso' || conExamen(x.ins.id)) return;
        const dia = fechaExamen(x.g, x.c);
        if (!d.asistencia.some((a) => a.inscripcion_id === x.ins.id && a.dia === x.c.dias_duracion && a.asistio)) return;
        const capturado = t.enSuDia(r.terminado_en, dia);
        d.examen.push({ inscripcion_id: x.ins.id, presentado_en: dia, calificacion: Number(r.calificacion), origen: 'examen_web',
          capturado_por: r.generado_por || 'examen_web', capturado_en: capturado, de_prueba: true });
        ponSol(x.ins.solicitud_id, { estado: Number(r.calificacion) >= Number(x.c.calificacion_minima) ? 'aprobada' : 'no_acreditada', estado_desde: capturado });
        return;
      }
      if (e.tipo === 'crear') {
        // El folio no se repite (grupo_folio_uk): un «crear» con un folio que ya tiene otro grupo (dos pestañas de
        // «Programar» que lo calcularon igual) no se aplica, y los eventos que lo acompañan tampoco, porque llevan el id
        // propio de esa creación y ese grupo no existe (auditoría «intentar romperlo», F3 A1: sobrescribían al otro)
        const c = curso(e.tipo_acreditacion, e.modalidad);
        if (!c || d.grupo.some((g) => g.id === e.grupo_id || g.folio === e.folio)) return;
        const g = { id: e.grupo_id, folio: e.folio, tipo_acreditacion: e.tipo_acreditacion, modalidad: e.modalidad, integracion: e.integracion,
          organizacion_id: e.integracion === 'especifico' ? e.organizacion_id : null, cupo_minimo: c.cupo_minimo, cupo_maximo: c.cupo_maximo,
          instructor: null, sede, fecha_inicio: null, hora_entrada: null, estado: 'en_integracion', estado_desde: en, creado_en: en,
          motivo_cancelacion: null, es_ficticio: true, de_prueba: true };
        d.grupo.push(g);
        inscribe(g, e.folios, en);
        return;
      }
      let g = d.grupo.find((x) => x.id === e.grupo_id);
      if (!g) return;
      if (e.tipo === 'agregar') {
        inscribe(g, e.folios, en);
      } else if (e.tipo === 'baja') {
        const s = d.solicitud.find((x) => x.folio === e.folio);
        const ins = s && activas(g.id).find((i) => i.solicitud_id === s.id);
        if (!ins || conExamen(ins.id) || !String(e.motivo || '').trim()) return;
        baja(ins, e.motivo, en);
        // Un grupo confirmado que queda por debajo del mínimo regresa a integración, con su fecha (como la base)
        if (g.estado === 'confirmado' && activas(g.id).length < g.cupo_minimo) g = ponGrupo(g, { estado: 'en_integracion', estado_desde: en });
      } else if (e.tipo === 'confirmar') {
        const c = curso(g.tipo_acreditacion, g.modalidad);
        const anticipacion = Number(global.APD.parametro(d, 'dias_anticipacion_grupo') || 7);
        if (g.estado !== 'en_integracion' || activas(g.id).length < g.cupo_minimo || !e.fecha_inicio || !e.hora_entrada || !e.instructor) return;
        // Como la base: ni antes de la anticipación ni más de un año después de hoy (decisión 3, auditoría 2026-10-19)
        if (e.fecha_inicio < global.APD.sumaDias(hoy, anticipacion) || e.fecha_inicio > global.APD.sumaMeses(hoy, 12) || !c) return;
        g = ponGrupo(g, { estado: 'confirmado', estado_desde: en, fecha_inicio: e.fecha_inicio, hora_entrada: e.hora_entrada, instructor: e.instructor });
      } else if (e.tipo === 'proponer') {
        // Fecha propuesta de un grupo por confirmar («Programar un curso», «Guardar sin confirmar»; 2026-10-18): la base
        // admite primer día, hora de entrada e instructor en un grupo en integración (apd.grupo_cambio sólo los fija al
        // confirmar); el curso no cambia. Lo que no se eligió queda vacío.
        if (g.estado !== 'en_integracion' || !e.fecha_inicio || e.fecha_inicio > global.APD.sumaMeses(hoy, 12)) return;
        g = ponGrupo(g, { fecha_inicio: e.fecha_inicio, hora_entrada: e.hora_entrada || null, instructor: e.instructor || null });
      } else if (e.tipo === 'iniciar') {
        // Sólo en la versión de prueba (auditoría 2026-10-18, B5): la fecha simulada no avanza, así que un grupo
        // confirmado nunca llegaría a su primer día. «Iniciar el curso hoy» (menú de pruebas, en la ficha del grupo)
        // hace lo que la base permite: mover el primer día de un grupo confirmado a hoy y pasarlo a «en curso»
        // (apd.grupo_cambio: confirmado → en_curso desde su primer día, con el cupo mínimo). En el sistema el curso
        // empieza en la fecha confirmada; quién lo pasa a «en curso» está por decidir (P124).
        if (g.estado !== 'confirmado' || activas(g.id).length < g.cupo_minimo || !g.instructor) return;
        g = ponGrupo(g, { estado: 'en_curso', estado_desde: en, fecha_inicio: hoy, inicio_simulado: true, fecha_inicio_confirmada: g.fecha_inicio });
      } else if (e.tipo === 'cancelar') {
        if (!['en_integracion', 'confirmado'].includes(g.estado) || !String(e.motivo || '').trim()) return;
        for (const ins of activas(g.id)) baja(ins, `Grupo cancelado: ${e.motivo}`, en);
        g = ponGrupo(g, { estado: 'cancelado', estado_desde: en, motivo_cancelacion: e.motivo });
      } else if (e.tipo === 'asistencia') {
        const c = curso(g.tipo_acreditacion, g.modalidad);
        if (g.estado !== 'en_curso' || !c || e.dia < 1 || e.dia > c.dias_duracion) return;
        // Un día que aún no llega sólo se captura en la prueba (la base lo rechaza: dia_futuro). Va marcado «simulada» y
        // se fecha el día capturado, a la hora real, como lo registraría la base ese día (C 3.4)
        const cuando = e.simulada ? t.enSuDia(e.en, e.fecha_dia || global.APD.sumaDias(g.fecha_inicio, e.dia - 1)) : en;
        for (const [insId, asistio] of Object.entries(e.lista || {})) {
          const ins = activas(g.id).find((i) => i.id === insId);
          if (!ins || conExamen(insId)) continue;
          d.asistencia = d.asistencia.filter((a) => !(a.inscripcion_id === insId && a.dia === e.dia));
          d.asistencia.push(Object.assign({ inscripcion_id: insId, dia: e.dia, asistio: Boolean(asistio), capturada_por: e.por, capturada_en: cuando, de_prueba: true },
            e.simulada ? { simulada: true, fecha_dia: e.fecha_dia || null } : {}));
        }
      }
    }
  }

  /* Cancelación de acreditaciones (P120) y reposición de credenciales (P140), sesión de trabajo del 23/10/2026: una lista
     de eventos en orden, cada uno aplicado como lo dejaría la base (apd.acreditacion_cambio, apd.acreditacion_cancelada,
     apd.reposicion_alta y apd.reposicion_cambio); lo que la base rechazaría, aquí no cambia nada. Tipos:
       cancelar { numero, motivo, fundamento, perfil, por } · reposicion { numero, motivo, acta } · acta { numero,
       resultado: acta_aceptada | con_observaciones, observacion, por } · acta_corregida { numero, motivo, acta } ·
       repuesta { numero, factura_rfc, factura_razon_social, factura_folio_fiscal, por }
     acta: { nombre, tipo, tamano, en } (el archivo, en IndexedDB «documentos», folio «reposicion:<número>», requisito
     «acta_reposicion» y la hora en). */
  const ABIERTAS_REPOSICION = ['solicitada', 'con_observaciones', 'acta_aceptada'];
  const CIERRA_RENOVACION = ['borrador', 'enviada', 'con_observaciones', 'validada_en_linea', 'lista_para_curso', 'inscrita'];
  function aplicaAcreditaciones(d, eventos, t, danado) {
    if (!eventos.length) return;
    const APD = global.APD;
    d.acreditacion = d.acreditacion.slice();
    d.reposicion = (d.reposicion || []).slice();
    d.estado_acreditacion = Object.assign({}, d.estado_acreditacion);
    d.verificacion_publica = (d.verificacion_publica || []).slice();
    const sit = (a) => d.estado_acreditacion[a.numero];
    const vigente = (a) => ['vigente', 'por_vencer'].includes(sit(a));
    const texto = (x) => String(x || '').trim();
    const persona = (a) => d.solicitante.find((p) => p.id === a.solicitante_id) || {};
    for (const e of eventos.slice().sort((x, y) => t.ms(x.en) - t.ms(y.en))) {
      const i = d.acreditacion.findIndex((a) => a.numero === e.numero);
      if (i < 0) { danado(); continue; }
      const a = d.acreditacion[i];
      const en = t.alCorte(e.en);
      const ri = d.reposicion.findIndex((r) => r.acreditacion_id === a.id && ABIERTAS_REPOSICION.includes(r.estado));
      const ponR = (cambios) => { d.reposicion[ri] = Object.assign({}, d.reposicion[ri], cambios, { estado_desde: en }); };
      const acta = (x) => (esObjeto(x) ? { acta_archivo_clave: `reposicion:${a.numero}|acta_reposicion|${x.en}`, acta_nombre_original: texto(x.nombre) || 'acta.pdf',
        acta_tipo_mime: x.tipo || 'application/pdf', acta_tamano_bytes: Number(x.tamano) || 0, acta_en: x.en,
        acta_nombre_archivo: APD.nombreDeArchivo('ACTA DE PERDIDA O ROBO', persona(a), x.nombre) } : null);
      switch (e.tipo) {
        case 'cancelar': {
          // Sólo instructores y la Dirección, con motivo (10 caracteres) y fundamento, de una vigente y una sola vez
          if (a.cancelada_en || !vigente(a) || !APD.perfilesCancelan(d).includes(e.perfil) || texto(e.motivo).length < 10 || !texto(e.fundamento)) break;
          d.acreditacion[i] = Object.assign({}, a, { cancelada_en: en, cancelada_por: e.por || '', cancelacion_motivo: texto(e.motivo), cancelacion_fundamento: texto(e.fundamento) });
          d.estado_acreditacion[a.numero] = 'cancelada';
          d.verificacion_publica = d.verificacion_publica.map((v) => (v.numero === a.numero ? Object.assign({}, v, { situacion: 'Cancelada', cancelada_el: APD.diaDe(en) }) : v));
          if (ri >= 0) ponR({ estado: 'cancelada', observacion: 'La acreditación se canceló.' });
          // La renovación en trámite se cancela con el motivo; sale de su grupo y su cita abierta se cierra
          d.solicitud = d.solicitud.map((s) => {
            if (s.acreditacion_anterior_id !== a.id || s.modalidad !== 'renovacion' || !CIERRA_RENOVACION.includes(s.estado)) return s;
            const motivo = `La acreditación ${a.numero} que se renovaba fue cancelada.`;
            d.inscripcion = d.inscripcion.map((x) => (x.solicitud_id === s.id && x.activa ? Object.assign({}, x, { activa: false, baja_en: en, motivo_baja: `Solicitud cancelada: ${motivo}` }) : x));
            d.cita = d.cita.map((c) => (c.solicitud_id === s.id && ['pendiente', 'en_pausa'].includes(c.resultado) ? Object.assign({}, c, { resultado: 'cancelada', observacion: `Solicitud cancelada: ${motivo}`, atendida_en: en }) : c));
            return Object.assign({}, s, { estado: 'cancelada', estado_desde: en, motivo_cierre: motivo, cotejo_pausa: null });
          });
          break;
        }
        case 'reposicion': {
          const x = acta(e.acta);
          if (!x || APD.porQueNoReponer(d, a) || !['perdida', 'robo'].includes(e.motivo)) break;
          d.reposicion.push(Object.assign({ id: `prueba:reposicion:${a.numero}:${e.en}`, acreditacion_id: a.id, motivo: e.motivo, estado: 'solicitada', estado_desde: en,
            observacion: '', solicitada_en: en, revisada_por: null, revisada_en: null, pago_monto: null, factura_rfc: null, factura_razon_social: null,
            factura_folio_fiscal: null, repuesta_en: null, repuesta_por: null, es_ficticio: true, de_prueba: true }, x));
          break;
        }
        case 'acta': {
          if (ri < 0 || d.reposicion[ri].estado !== 'solicitada' || !vigente(a)) break;
          if (e.resultado === 'con_observaciones' && texto(e.observacion).length >= 10) ponR({ estado: 'con_observaciones', observacion: texto(e.observacion), revisada_por: e.por || '', revisada_en: en });
          else if (e.resultado === 'acta_aceptada') ponR({ estado: 'acta_aceptada', observacion: '', revisada_por: e.por || '', revisada_en: en, pago_monto: APD.cuotaReposicion(d).monto });
          break;
        }
        case 'acta_corregida': {
          const x = acta(e.acta);
          if (!x || ri < 0 || d.reposicion[ri].estado !== 'con_observaciones' || !['perdida', 'robo'].includes(e.motivo)) break;
          ponR(Object.assign({ estado: 'solicitada', motivo: e.motivo, observacion: '' }, x));
          break;
        }
        case 'repuesta': {
          if (ri < 0 || d.reposicion[ri].estado !== 'acta_aceptada' || !vigente(a)) break;
          const rfc = texto(e.factura_rfc).toUpperCase();
          const folio = texto(e.factura_folio_fiscal).toUpperCase();
          const razon = texto(e.factura_razon_social);
          // Un folio fiscal no se repite, tampoco con el de una solicitud (apd.reposicion_cambio: folio_fiscal_repetido)
          if (!rfc || !folio || !razon || d.solicitud.some((s) => s.factura_folio_fiscal === folio) || d.reposicion.some((r) => r.factura_folio_fiscal === folio)) break;
          ponR({ estado: 'repuesta', factura_rfc: rfc, factura_razon_social: razon, factura_folio_fiscal: folio, repuesta_en: APD.diaDe(en), repuesta_por: e.por || '' });
          break;
        }
        default:
          danado();
      }
    }
  }

  function mezcla(datos) {
    let danados = 0;
    const danado = () => { danados += 1; };
    /* Sólo lo que tiene forma de registro; lo demás se cuenta (F4 A6) */
    const conForma = (lista, valido) => (lista || []).filter((x) => { const si = valido(x); if (!si) danado(); return si; });
    const porFolioConForma = (t) => Object.fromEntries(Object.entries(t).map(([f, l]) => [f, conForma(l, (x) => conTexto(x, 'en'))]).filter(([, l]) => l.length));
    return Promise.all([cuentas(), solicitudes(), todosLosDocumentos()]).then(([cuentasLeidas, solsLeidas, docsLeidos]) => {
      const listaCuentas = conForma(cuentasLeidas, (c) => conTexto(c, 'curp') && Boolean(c.id));
      // Una solicitud guardada necesita su folio y sus envíos; si no es de los ficticios (la crea la prueba), su primer
      // envío con la persona (sin ella, la base no la crea). El reenvío de una ficticia no la necesita.
      const ficticias = new Set((datos.solicitud || []).map((s) => s.folio));
      const registros = conForma(solsLeidas, (r) => {
        if (!conTexto(r, 'folio')) return false;
        const envios = Array.isArray(r.envios) ? r.envios : [r];
        return envios.length > 0 && envios.every(esObjeto) && (ficticias.has(r.folio) || esObjeto(envios[0].persona));
      });
      const docs = conForma(docsLeidos, (a) => conTexto(a, 'folio') && conTexto(a, 'cargado_en'));
      const revisiones = porFolioConForma(listaPorFolio(CLAVES.revisiones));
      const cotejos = porFolioConForma(listaPorFolio(CLAVES.cotejos));
      const perfiles = Object.fromEntries(Object.entries(leePerfiles()).filter(([, v]) => { if (!esObjeto(v)) danado(); return esObjeto(v); }));
      // Pase de lista y exámenes en línea, en la misma línea de tiempo que los grupos y la asistencia
      const lista = paseDeLista();
      const examenes = codigosExamen(danado).filter((r) => r.terminado_en && !r.reemplazado_por && !r.suspendido);
      const eventosGrupo = conForma(eventosGrupos(), (e) => conTexto(e, 'tipo') && conTexto(e, 'en'))
        .concat(conForma(Object.entries(lista), ([, r]) => conTexto(r, 'en')).map(([insId, r]) => ({ tipo: 'pase', en: r.en, inscripcion_id: insId, presente: r.presente, por: r.por })))
        .concat(examenes.filter((r) => typeof r.terminado_en === 'string').map((r) => ({ tipo: 'examen', en: r.terminado_en, registro: r })));
      // Todos los folios con algo guardado: también los que sólo tienen documentos sueltos, como la corrección de una
      // cita en pausa de una solicitud ficticia (auditoría 2026-10-18, C1)
      const docsDe = {};
      for (const a of docs) (docsDe[a.folio] = docsDe[a.folio] || []).push(a);
      const folios = [...new Set([...registros.map((r) => r.folio), ...Object.keys(docsDe), ...Object.keys(revisiones), ...Object.keys(cotejos)])];
      const eventosAcred = conForma(eventosAcreditaciones(), (e) => conTexto(e, 'tipo') && conTexto(e, 'en') && conTexto(e, 'numero'));
      if (!listaCuentas.length && !folios.length && !Object.keys(perfiles).length && !eventosGrupo.length && !eventosAcred.length) return Object.assign({}, datos, { prueba_ignorados: danados });
      const d = Object.assign({}, datos, { solicitud: datos.solicitud.slice(), solicitante: datos.solicitante.slice(), documento: datos.documento.slice(),
        revision: datos.revision.slice(), fotografia: datos.fotografia.slice(), cita: (datos.cita || []).slice(),
        grupo: datos.grupo.slice(), inscripcion: datos.inscripcion.slice(), asistencia: datos.asistencia.slice(), examen: (datos.examen || []).slice(),
        carrera: (datos.carrera || []).slice() });
      const t = reloj(datos);
      const { alCorte, mayor } = t;
      // Cuentas: una del registro anterior queda activa; una nueva se agrega como persona de la prueba (la cuenta se
      // crea el día simulado, no después de su propia solicitud: C 5.3)
      for (const c of listaCuentas) {
        if (!c.curp) continue;
        const i = d.solicitante.findIndex((x) => x.curp === c.curp);
        if (i >= 0) d.solicitante[i] = Object.assign({}, d.solicitante[i], c.persona, { id: d.solicitante[i].id, estado: 'activa' });
        else d.solicitante.push(Object.assign({ numero_expediente: null }, c.persona, { id: c.id, curp: c.curp, estado: 'activa', creada_en: alCorte(c.creada_en), de_prueba: true }));
      }
      // Cambios de «Mi perfil»
      d.solicitante = d.solicitante.map((p) => (perfiles[p.id] ? Object.assign({}, p, perfiles[p.id]) : p));
      const registroDe = Object.fromEntries(registros.map((r) => [r.folio, r]));
      const persona = (id) => d.solicitante.findIndex((x) => x.id === id);
      const cambiaPersona = (id, cambios) => { const i = persona(id); if (i >= 0) d.solicitante[i] = Object.assign({}, d.solicitante[i], cambios); };
      const citaEn = (fecha, hora) => `${fecha}T${hora || '09:00'}:00-06:00`;
      const hoy = datos.fecha_corte || global.APD.hoy(datos);
      const momentoDe = (k) => ((d.requisito || []).find((r) => r.clave === k) || {}).momento;
      /* Perfil del dictaminador y experiencia mínima de una solicitud, con el catálogo de carreras de ahora (el de la base,
         con lo que el personal clasificó en la prueba) */
      const conPerfil = (x) => {
        if (x.tipo_acreditacion !== 'dictaminador') return x;
        const pf = global.APD.perfilAcademico(d, x.nivel_estudios, x.estatus_estudios, x.carrera);
        return Object.assign({}, x, { perfil_academico: pf ? pf.perfil : null, experiencia_minima: pf ? pf.minimo : null });
      };
      /* La clasificación de una carrera en la revisión (P62) queda en el catálogo (apd.carrera.grupo) y la base recalcula el
         perfil de las solicitudes abiertas con esa carrera (apd.carrera_clasificada; auditoría «intentar romperlo», F2 M3) */
      const ABIERTAS = ['borrador', 'enviada', 'con_observaciones'];
      function clasifica(carrera, grupo) {
        const norm = global.APD_PERFIL_ACADEMICO.normaliza;
        const n = norm(carrera);
        if (!n || !['afin', 'disciplina_afin', 'no_afin'].includes(grupo)) return;
        const i = d.carrera.findIndex((x) => x.nombre_normalizado === n);
        if (i >= 0) d.carrera[i] = Object.assign({}, d.carrera[i], { grupo });
        else d.carrera.push({ id: `prueba-carrera:${n}`, nombre: String(carrera).trim(), nombre_normalizado: n, grupo, activa: true, es_ficticio: true, de_prueba: true });
        d.solicitud = d.solicitud.map((x) => (x.tipo_acreditacion === 'dictaminador' && ABIERTAS.includes(x.estado) && norm(x.carrera) === n ? conPerfil(x) : x));
      }
      const nombreReq = (k) => ((d.requisito || []).find((r) => r.clave === k) || {}).nombre || k;
      /* EXP-AAAA-NNNN: el siguiente del año, con lo asignado hasta ese momento (el formato de APD_PERSONAL.siguienteExpediente) */
      const siguienteExpediente = () => {
        const anio = String(hoy).slice(0, 4);
        const n = d.solicitante.map((x) => String(x.numero_expediente || '').match(new RegExp(`^EXP-${anio}-(\\d+)$`))).filter(Boolean).map((m) => Number(m[1]));
        return `EXP-${anio}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(4, '0')}`;
      };

      /* ¿Tenía la persona otra solicitud activa de ese tipo cuando envió ésta? (la base: solicitud_una_activa y la regla
         solicitud_activa). Cuenta la que sigue activa y la que se cerró después de ese momento. */
      const FINALES = global.APD.FINALES;
      const otraActiva = (pid, tipo, cuando) => d.solicitud.some((o) => o.solicitante_id === pid && o.tipo_acreditacion === tipo
        && t.ms(o.creada_en || o.enviada_en || o.estado_desde) <= t.ms(cuando)
        && (!FINALES.includes(o.estado) || t.ms(o.estado_desde) > t.ms(cuando)));

      /* Cada folio por su cuenta (F4 A6): si algo de lo guardado de un folio no se puede aplicar, ese folio queda como
         estaba antes de él y siguen los demás. Lo que un folio cambia: estas listas de d. */
      const LISTAS = ['solicitud', 'solicitante', 'documento', 'revision', 'cita', 'fotografia', 'carrera'];
      const copia = () => Object.fromEntries(LISTAS.map((k) => [k, d[k].slice()]));
      const deshace = (antes, que, e) => {
        Object.assign(d, antes);
        danado();
        if (global.console) global.console.warn(`Versión de prueba: no se pudo aplicar lo guardado de ${que}; se ignora.`, e);
      };
      for (const folio of folios) {
        const antesDelFolio = copia();
        try {
          const r = registroDe[folio];
          const envios = r ? (r.envios || [r]) : [];
          const primero = envios[0];
          let i = d.solicitud.findIndex((x) => x.folio === folio);
          if (i < 0 && !primero) continue; // algo guardado de una solicitud que ya no existe
          // Un envío nuevo con el folio de una solicitud que ya existe (otra pestaña lo calculó igual): la base no lo admite
          // (solicitud_folio_uk); no es un reenvío de aquélla (auditoría «intentar romperlo», bloque 2)
          if (i >= 0 && primero && primero.existente === false) continue;
          const nueva = i < 0;
          if (nueva) {
            // Solicitud nueva de la prueba: entra enviada (su primer envío); un reenvío posterior es otro evento «envio»
            let p = d.solicitante.find((x) => x.id === primero.persona.id) || d.solicitante.find((x) => x.curp === primero.persona.curp);
            // Sin persona no hay solicitud (auditoría «intentar romperlo», F1 2: un envío sin sesión creaba una solicitud de
            // «prueba:undefined»); la base exige solicitante_id
            if (!p && !primero.persona.curp) continue;
            const sinCuenta = !p;
            if (sinCuenta) p = Object.assign({ id: `prueba:${primero.persona.curp || primero.folio}`, estado: 'activa', de_prueba: true }, primero.persona);
            const enviada = alCorte(primero.enviada_en);
            // Las reglas de la base al iniciar una solicitud (apd.solicitud_alta): una sola activa por persona y tipo (F1 3:
            // dos pestañas enviaban dos solicitudes de poda), y la elegibilidad por sus acreditaciones (apd.comprobar_elegibilidad)
            if (otraActiva(p.id, primero.tipo_acreditacion, enviada)) continue;
            const op = (global.APD.opciones(Object.assign({}, d, { solicitud: [] }), p) || {})[primero.tipo_acreditacion];
            if (!op || !op.disponible || op.modalidad !== primero.modalidad) continue;
            if (sinCuenta) d.solicitante.push(p);
            const perfil = primero.tipo_acreditacion === 'dictaminador' ? global.APD.perfilAcademico(d, primero.nivel_estudios, primero.estatus_estudios, primero.carrera) : null;
            d.solicitud.push({ id: `prueba:${primero.folio}`, folio: primero.folio, solicitante_id: p.id, estado: 'enviada', estado_desde: enviada,
              enviada_en: enviada, creada_en: enviada, tipo_acreditacion: primero.tipo_acreditacion, modalidad: primero.modalidad,
              nivel_estudios: primero.nivel_estudios, carrera: primero.carrera, carrera_tecnica: primero.carrera_tecnica || null, estatus_estudios: primero.estatus_estudios,
              anios_experiencia: primero.anios_experiencia, perfil_academico: perfil ? perfil.perfil : null, experiencia_minima: perfil ? perfil.minimo : null,
              adscripcion: primero.persona.adscripcion, organizacion_id: primero.persona.organizacion_id, organizacion_nombre: primero.persona.organizacion_nombre,
              acreditacion_anterior_id: primero.acreditacion_anterior_id || null, pago_referencia: primero.folio.replace(/-/g, ''),
              // Registro asistido (decisión 2026-10-25): quién la capturó con la persona presente (apd.solicitud.capturada_por)
              capturada_por: primero.capturada_por || null, de_prueba: true });
            i = d.solicitud.length - 1;
          }
          const id = d.solicitud[i].id;
          let s = d.solicitud[i];
          const pon = (cambios) => { s = Object.assign({}, s, cambios); d.solicitud[i] = s; };
          const docsVigentes = () => d.documento.filter((x) => x.solicitud_id === id && x.vigente);
          const marcaDoc = (k, cambios) => { d.documento = d.documento.map((x) => (x.solicitud_id === id && x.vigente && x.requisito === k ? Object.assign({}, x, cambios) : x)); };
          /* Reloj de la solicitud: cada hecho después del anterior (y de lo que ya traían los ficticios), y lo de una cita
             no antes de su hora (C 5.1) */
          let ultimo = s.de_prueba ? null : s.estado_desde;
          const fecha = (iso, minimo) => {
            let x = mayor(alCorte(iso), minimo);
            if (ultimo && t.ms(x) <= t.ms(ultimo)) x = new Date(t.ms(ultimo) + 1000).toISOString();
            ultimo = x;
            return x;
          };

          const eventos = [
            ...(docsDe[folio] || []).map((a) => ({ tipo: 'doc', en: a.cargado_en, a })),
            ...envios.map((x) => ({ tipo: 'envio', en: x.guardada_en, r: x })),
            ...(revisiones[folio] || []).map((rev) => ({ tipo: 'revision', en: rev.en, rev })),
            ...(cotejos[folio] || []).map((c) => ({ tipo: 'cotejo', en: c.en, c }))
          ].filter((e) => e.en).sort((x, y) => String(x.en).localeCompare(String(y.en)) || ORDEN_TIPO[x.tipo] - ORDEN_TIPO[y.tipo]);

          const cargaDoc = (a) => {
            const en = fecha(a.cargado_en);
            d.documento = d.documento.map((x) => (x.solicitud_id === id && x.requisito === a.requisito && x.vigente ? Object.assign({}, x, { vigente: false }) : x));
            d.documento.push({ solicitud_id: id, requisito: a.requisito, vigente: true, estado: a.estado || 'pendiente', observacion: '',
              cargado_en: en, cargado_real: a.cargado_en, cargado_por: a.cargado_por || 'persona', motivo: a.motivo || null,
              nombre_original: a.nombre_original, tamano_bytes: a.tamano_bytes, tipo_mime: a.tipo_mime, blob: a.blob, de_prueba: true });
          };
          // Los archivos de un envío van con su envío (misma hora): si la base rechaza el envío, tampoco quedan sus archivos
          const horasDeEnvio = new Set(envios.map((x) => x.guardada_en));
          const delEnvio = (a) => Boolean(a.envio) && horasDeEnvio.has(a.cargado_en);
          for (const e of eventos) {
            if (e.tipo === 'doc') {
              if (!delEnvio(e.a)) cargaDoc(e.a);
            } else if (e.tipo === 'envio') {
              // La máquina de estados de la base (apd.solicitud_cambio): sólo se envía una solicitud en borrador o con
              // observaciones (auditoría «intentar romperlo», F1 4: una pestaña vieja reenviaba una solicitud ya validada y
              // la regresaba a revisión). El primer envío de una solicitud nueva de la prueba es el que la crea.
              const primerEnvio = nueva && e.r === primero;
              if (!primerEnvio && !['borrador', 'con_observaciones'].includes(s.estado)) continue;
              for (const a of docsDe[folio] || []) if (delEnvio(a) && a.cargado_en === e.r.guardada_en) cargaDoc(a);
              // Envío o reenvío: vuelve a revisión documental con lo que la persona corrigió (estudios, experiencia) y la
              // adscripción que tiene hoy en «Mi perfil», como la base al pasar a «enviada»; en dictaminador se recalculan el
              // perfil y la experiencia mínima (decisión 2026-10-16, opción C; auditoría «intentar romperlo», F1 5). Sólo lo
              // que el envío trae: un envío sin un campo no lo borra.
              const env = e.r || {};
              const corregido = {};
              for (const k of ['nivel_estudios', 'carrera', 'carrera_tecnica', 'estatus_estudios', 'anios_experiencia']) if (k in env) corregido[k] = env[k];
              const pe = env.persona || {};
              if (pe.adscripcion) Object.assign(corregido, { adscripcion: pe.adscripcion, organizacion_id: pe.organizacion_id || null, organizacion_nombre: pe.organizacion_nombre || '' });
              // envio_real: la hora real del envío, que no depende de la fecha simulada; marca la vuelta de revisión (bloque 2)
              pon(Object.assign(conPerfil(Object.assign({}, s, corregido)), { estado: 'enviada', estado_desde: fecha(env.estado_desde || e.en), envio_real: e.r.guardada_en || null, de_prueba: true, cotejo_pausa: null }));
            } else if (e.tipo === 'revision') {
              // Revisión del personal: la persona ve el resultado en «Mis trámites» como lo dejaría la base
              const rev = e.rev;
              const rd = rev.datos || {};
              const RESULTADO = { validada: 'validada_en_linea', con_observaciones: 'con_observaciones', rechazada: 'rechazada' };
              if (s.estado !== 'enviada' || !RESULTADO[rev.resultado]) continue;
              // La revisión es de la vuelta que se abrió: si la solicitud cambió desde entonces (la persona la reenvió con un
              // documento nuevo que nadie abrió), no se aplica (auditoría «intentar romperlo», F2 A2). La vuelta se reconoce por
              // la hora real de su envío (o, en una solicitud ficticia que no se ha reenviado, por su estado_desde), que no
              // cambia con la fecha simulada. Lo guardado antes del bloque 2 no trae «desde» y se aplica como antes.
              if (rev.desde && rev.desde !== (s.envio_real || s.estado_desde)) continue;
              if (rd.clasificacion && s.perfil_academico === 'por_clasificar') { clasifica(s.carrera, rd.clasificacion); s = d.solicitud[i]; }
              const en = fecha(rev.en);
              // registrada_en: la hora real con que la guardó la pantalla, para que la bandeja y la pantalla que la guardó
              // sepan si se aplicó (F2 M1)
              d.revision.push({ solicitud_id: id, revisor: rev.revisor, resultado: rev.resultado, revisada_en: en, observacion_general: rd.mensaje_general || rd.motivo_rechazo || '',
                texto: rev.texto || '', registrada_en: rev.en, de_prueba: true });
              for (const x of docsVigentes()) {
                const dec = rd[`decision_${x.requisito}`];
                if (dec) marcaDoc(x.requisito, { estado: dec, observacion: dec === 'con_observacion' ? rd[`observacion_${x.requisito}`] || '' : '', revisado_en: en, revisado_por: rev.revisor });
              }
              pon({ estado: RESULTADO[rev.resultado], estado_desde: en,
                cita_en: rev.resultado === 'validada' && rd.cita_fecha ? citaEn(rd.cita_fecha, rd.cita_hora) : s.cita_en,
                // La cuenta de inasistencias no se reinicia al volver a validar: la base cuenta todas (auditoría, A4)
                inasistencias: s.inasistencias,
                motivo_cierre: rev.resultado === 'rechazada' ? rd.motivo_rechazo || null : s.motivo_cierre });
              // Al validar, la base crea la cita pendiente (apd.solicitud_cita)
              if (rev.resultado === 'validada' && s.cita_en) abreCita(s.cita_en);
            } else if (e.tipo === 'cotejo') {
              aplicaCotejo(e.c);
            }
          }

          /* Citas de cotejo (apd.cita, decisiones 2026-10-17): la abierta (pendiente o en pausa) se cierra con lo que pasó;
             una cita nueva nace pendiente. Mismo vocabulario que la base. */
          function abreCita(en) {
            d.cita.push({ solicitud_id: id, programada_en: en, resultado: 'pendiente', observacion: '', creada_en: s.estado_desde, de_prueba: true });
          }
          function aplicaCotejo(c) {
            if (s.estado !== 'validada_en_linea') return;
            const cd = c.datos || {};
            const abierta = d.cita.findIndex((x) => x.solicitud_id === id && ['pendiente', 'en_pausa'].includes(x.resultado));
            // Sin cita abierta, la cita ya se cerró (la base: cita_cerrada). Sólo lo guardado por versiones anteriores de la
            // prueba en una solicitud sin ninguna cita registrada se aplica como antes.
            if (abierta < 0 && d.cita.some((x) => x.solicitud_id === id)) return;
            const programada = abierta >= 0 ? d.cita[abierta].programada_en : c.cita_en;
            // Lo de dos pestañas con la misma cita (auditoría «intentar romperlo», F2 A3): lo registrado es de la cita que se
            // abrió, no de la cita nueva que otra pestaña acaba de dar; y desde la situación en que se abrió (pendiente o en
            // pausa, y la misma pausa). Como la base (apd.cita_cambio): una cita en pausa no pasa a «no se presentó» ni a
            // «no era la persona» (cita_transicion).
            if (abierta >= 0 && c.cita_en && t.ms(programada) !== t.ms(c.cita_en)) return;
            const deAhora = abierta >= 0 ? d.cita[abierta].resultado : 'pendiente';
            if (c.desde && c.desde !== deAhora) return;
            if (c.pausa_real && (!s.cotejo_pausa || s.cotejo_pausa.real !== c.pausa_real)) return;
            if (deAhora === 'en_pausa' && ['no_se_presento', 'cerrar', 'no_es_la_persona'].includes(c.resultado)) return;
            // Lo que pasó en una cita se registra su día, no antes (la base: cita_futura; auditoría «intentar romperlo», F2
            // A6). Sólo la prueba atiende una cita futura «como si fuera su día», marcada simulada (la fecha no avanza).
            if (global.APD.diaDe(programada) > hoy && !c.simulada) return;
            const noCoinciden = Object.keys(cd).filter((k) => k.startsWith('coincide_') && cd[k] === 'no').map((k) => k.slice(9));
            if (c.resultado === 'terminado') {
              // Terminar el cotejo exige que todos los documentos coincidan (la base: documentos_sin_cotejar). Al retomar una
              // pausa, el que no coincidió sólo cuenta si la persona cargó otro después (F2 A7); lo cotejado queda aceptado.
              if (noCoinciden.length) return;
              const pausa = s.cotejo_pausa;
              if (pausa && (pausa.docs || []).some((k) => !docsVigentes().some((x) => x.requisito === k && global.APD.cargadoTras(x, pausa)))) return;
              const coinciden = Object.keys(cd).filter((x) => x.startsWith('coincide_') && cd[x] === 'si').map((x) => x.slice(9));
              if (docsVigentes().some((x) => momentoDe(x.requisito) === 'en_linea' && x.estado !== 'aceptado' && !coinciden.includes(x.requisito))) return;
              // Un folio fiscal no se repite entre solicitudes (la base: folio_fiscal_repetido, R20; F2 A5)
              const ff = String(cd.factura_folio_fiscal || '').trim().toUpperCase();
              if (ff && d.solicitud.some((x) => x.id !== id && String(x.factura_folio_fiscal || '').trim().toUpperCase() === ff)) return;
              for (const k of coinciden) marcaDoc(k, { estado: 'aceptado' });
            }
            const en = fecha(c.en, programada);
            // La observación de la cita (C 3.1): lo que no coincidió, documento por documento; la base la exige en una cita
            // en pausa, con observaciones o de otra persona (cita_observacion_ck) y la usa como motivo («Cotejo: …»)
            const observacion = [cd.nota_identidad, ...noCoinciden.map((k) => `${nombreReq(k)}: ${String(cd[`diferencia_${k}`] || '').trim()}`)]
              .map((x) => String(x || '').trim()).filter(Boolean).join('; ');
            const cierre = { resultado: EN_LA_BASE[c.resultado], atendida_por: c.atendio, cierra: c.resultado === 'cerrar', de_prueba: true,
              observacion: observacion || (abierta >= 0 ? d.cita[abierta].observacion : '') || '', pausada_en: c.resultado === 'pausa' ? en : undefined, atendida_en: c.resultado === 'pausa' ? null : en };
            if (cierre.pausada_en === undefined) delete cierre.pausada_en;
            if (abierta >= 0) d.cita[abierta] = Object.assign({}, d.cita[abierta], cierre);
            else d.cita.push(Object.assign({ solicitud_id: id, programada_en: c.cita_en }, cierre));
            // en_cotejo: marca propia de la prueba en el documento (la base lo sabe por la cita con observaciones de esa hora)
            const observa = () => { for (const k of noCoinciden) marcaDoc(k, { estado: 'con_observacion', observacion: cd[`diferencia_${k}`] || '', revisado_en: en, revisado_por: c.atendio, en_cotejo: true }); };
            switch (c.resultado) {
              case 'terminado': {
                // El expediente lo asigna la base al terminar el cotejo, consecutivo y sin huecos (apd.asignar_expediente): el
                // siguiente en orden de registro, no el que la pantalla anticipó al abrir (auditoría «intentar romperlo», F2
                // A4: dos ventanillas daban el mismo número a dos personas)
                const p = d.solicitante[persona(s.solicitante_id)] || {};
                cambiaPersona(s.solicitante_id, { numero_expediente: p.numero_expediente || siguienteExpediente() });
                // La fotografía de su cuenta queda confirmada (en la cita no se toma otra, decisión 2026-10-17)
                const f = d.fotografia.find((x) => x.solicitante_id === s.solicitante_id && x.vigente);
                if (f) d.fotografia = d.fotografia.map((x) => (x === f ? Object.assign({}, x, { estado: 'confirmada', confirmada_en: en, confirmada_por: c.atendio }) : x));
                else d.fotografia.push({ solicitante_id: s.solicitante_id, vigente: true, origen: 'en_linea', estado: 'confirmada', confirmada_en: en, confirmada_por: c.atendio, de_prueba: true });
                cambiaPersona(s.solicitante_id, { foto_nueva: false });
                pon({ estado: 'lista_para_curso', estado_desde: en, lista_para_curso_en: s.lista_para_curso_en || en, cotejo_pausa: null,
                  factura_rfc: cd.factura_rfc || null, factura_razon_social: cd.factura_razon_social || null, factura_folio_fiscal: cd.factura_folio_fiscal || null });
                break;
              }
              case 'pausa':
                observa();
                pon({ cotejo_pausa: { desde: en, real: c.en, cita_en: c.cita_en, docs: noCoinciden } });
                break;
              case 'con_observaciones':
                // Como la base (apd.cita_aplicar): la cita queda «con observaciones» y la solicitud regresa a corregir. No es
                // una revisión: la base no la crearía (C 3.2); el historial lo lee de la cita.
                observa();
                pon({ estado: 'con_observaciones', estado_desde: en, cotejo_pausa: null });
                break;
              case 'no_se_presento':
                pon({ inasistencias: (s.inasistencias || 0) + 1, cita_anterior: c.cita_en, cita_motivo: 'inasistencia', cita_en: citaEn(cd.cita_fecha, cd.cita_hora) });
                abreCita(s.cita_en);
                break;
              case 'otra_cita':
                pon({ cita_anterior: c.cita_en, cita_motivo: 'sin_pago', cita_en: citaEn(cd.cita_fecha, cd.cita_hora), cotejo_pausa: null });
                abreCita(s.cita_en);
                break;
              case 'cerrar':
                // El mismo motivo que escribe la base (03-apd-reglas.sql): «Mis trámites» lo distingue por él (alta 5)
                pon({ estado: 'concluida_sin_atender', estado_desde: en, inasistencias: (s.inasistencias || 0) + 1,
                  motivo_cierre: `No se presentó a su cita de cotejo ${(s.inasistencias || 0) + 1} veces.` });
                break;
              case 'no_es_la_persona':
                // No se atiende la cita; se avisa a la Dirección y la cuenta queda bloqueada hasta aclararlo
                cambiaPersona(s.solicitante_id, { estado: 'bloqueada', bloqueo_motivo: 'identidad' });
                pon({ cotejo_bloqueado: true });
                break;
              default:
                break;
            }
          }
        } catch (e) { deshace(antesDelFolio, `la solicitud ${folio}`, e); }
      }
      // Grupos, asistencia, pase de lista y examen, después: una solicitud llega a la espera de grupo con su cotejo terminado
      aplicaGrupos(d, eventosGrupo, t, deshace);
      // Cancelaciones y reposiciones, al final: cancelar cierra la renovación en trámite (apd.acreditacion_cancelada)
      aplicaAcreditaciones(d, eventosAcred, t, danado);
      d.prueba_ignorados = danados;
      return d;
    }).catch((e) => {
      // Último recurso: si lo guardado no se pudo leer en absoluto, se ven los ficticios solos y el menú de pruebas lo dice
      if (global.console) global.console.warn('Versión de prueba: no se pudo aplicar lo guardado en este navegador.', e);
      return Object.assign({}, datos, { prueba_ignorados: danados + 1 });
    });
  }

  /* Una fecha y hora real, en el día simulado de la prueba (el acuse de la solicitud: F4 M7) */
  function alCorte(datos, iso) { return datos && datos.fecha_corte ? reloj(datos).alCorte(iso) : iso; }

  global.APD_ARCHIVOS_PRUEBA = {
    CLAVES, caduca, comoLista, listaPorFolio, eventosGrupos, alCambiar, avisaCambio, alCorte, PREGUNTAS_BANCO,
    guardaEnvio, retiraEnvio, guardaDocumento, quitaDocumento, documentos, borraDocumentos, guardaFoto, foto,
    guardaCuenta, cuenta, contrasenaValida, guardaPerfil, borraTodo, borraPestana, guardado, mezcla,
    guardaMaterial, mezclaMaterial, ignorados, eventosAcreditaciones, guardaEventoAcreditacion, retiraEventoAcreditacion
  };
}(window));
