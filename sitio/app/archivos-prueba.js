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
     · el material de estudio que sube el personal (IndexedDB «material»).
   APD.cargar() los suma a los datos ficticios con mezcla() y mezclaMaterial(), así que todas las pantallas —«Mis
   trámites», «Mi perfil», la bandeja, las citas, los grupos, la asistencia, el examen y el material— ven lo mismo.
   Lo que la base rechazaría, aquí no cambia nada. Nada sale de la computadora; «Borrar lo guardado» y «Empezar de
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
    lista: 'apd.examen.lista',
    examen: 'apd.examen.c.',
    latido: 'apd.examen.latido.',
    ultimoUso: 'apd.prueba.ultimo_uso',
    inicio: 'apd.prueba.inicio'
  };
  let abierta = null;

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
  /* Lee un registro y escribe el que resulte, en la misma transacción */
  function cambia(almacen, llave, nuevo) {
    return abre().then((db) => new Promise((ok, mal) => {
      const t = db.transaction(almacen, 'readwrite');
      const s = t.objectStore(almacen);
      const g = s.get(llave);
      g.onsuccess = () => s.put(nuevo(g.result || null));
      t.oncomplete = () => ok();
      t.onerror = () => mal(t.error);
      t.onabort = () => mal(t.error);
    }));
  }

  /* ----- localStorage de la prueba ----- */
  const leeLs = (clave, vacio) => { try { const v = JSON.parse(global.localStorage.getItem(clave) || 'null'); return v === null ? vacio : v; } catch (e) { return vacio; } };
  /* Revisiones y citas atendidas: una lista por folio. Lo guardado antes de 0.27 era un registro por folio: lista de uno. */
  const comoLista = (t) => Object.fromEntries(Object.entries(t || {}).map(([f, v]) => [f, Array.isArray(v) ? v : [v]]));
  const listaPorFolio = (clave) => comoLista(leeLs(clave, {}));
  const eventosGrupos = () => { const v = leeLs(CLAVES.grupos, []); return Array.isArray(v) ? v : []; };
  const paseDeLista = () => leeLs(CLAVES.lista, {}) || {};
  function clavesLs(prefijo) { try { return Object.keys(global.localStorage).filter((k) => k.startsWith(prefijo)); } catch (e) { return []; } }
  function codigosExamen() {
    const lista = [];
    for (const k of clavesLs(CLAVES.examen)) { const r = leeLs(k, null); if (r && r.inscripcion_id) lista.push(r); }
    return lista;
  }

  /* ----- Solicitudes y documentos ----- */
  /* Guarda el envío (resumen para la bandeja) y sus archivos: [{ requisito, blob, nombre, tipo, size }]. Cada reenvío se
     agrega a la lista de envíos del folio y cada archivo queda como una carga más, con su hora (auditoría 2026-10-18,
     C2): sustituir el registro perdía las revisiones de en medio y las cargas anteriores. */
  function guardaEnvio(solicitud, archivos) {
    const ahora = new Date().toISOString();
    const envio = Object.assign({}, solicitud, { guardada_en: ahora });
    return cambia(SOLS, solicitud.folio, (previo) => {
      const envios = previo ? (previo.envios || [Object.assign({}, previo, { envios: undefined })]) : [];
      return Object.assign({}, previo && envios[0] ? envios[0] : envio, { folio: solicitud.folio, envios: envios.concat([envio]), guardada_en: ahora });
    }).then(() => tx(DOCS, 'readwrite', (s) => {
      for (const a of archivos) {
        s.put({ clave: `${solicitud.folio}|${a.requisito}|${ahora}`, folio: solicitud.folio, requisito: a.requisito, blob: a.blob, envio: true,
          nombre_original: a.nombre, tipo_mime: a.tipo, tamano_bytes: a.size, cargado_en: ahora });
      }
    }));
  }
  /* Un documento suelto, con historial (no sustituye la carga anterior en el almacén): la corrección de un documento
     que no coincidió en el cotejo, o la factura que carga el personal. extra: { en, estado, cargado_por, motivo } */
  function guardaDocumento(folio, requisito, a, extra) {
    const { en, ...resto } = extra || {};
    const ahora = en || new Date().toISOString();
    return tx(DOCS, 'readwrite', (s) => s.put(Object.assign({ clave: `${folio}|${requisito}|${ahora}`, folio, requisito, blob: a.blob,
      nombre_original: a.nombre, tipo_mime: a.tipo, tamano_bytes: a.size, cargado_en: ahora }, resto)));
  }
  function solicitudes() { return tx(SOLS, 'readonly', (s) => s.getAll()).catch(() => []); }
  function todosLosDocumentos() { return tx(DOCS, 'readonly', (s) => s.getAll()).catch(() => []); }

  /* ----- Fotografía de la persona: { blob, nombre, tipo } por CURP ----- */
  function guardaFoto(curp, a) {
    return tx(FOTOS, 'readwrite', (s) => s.put({ curp, blob: a.blob, nombre_original: a.nombre, tipo_mime: a.tipo, cargada_en: new Date().toISOString() }));
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
    if (registro.blob) return tx(MATERIAL, 'readwrite', (s) => s.put(Object.assign({ guardado_en: ahora }, registro)));
    const { id, ...cambios } = registro;
    return cambia(MATERIAL, id, (previo) => {
      if (previo && previo.blob) return Object.assign({}, previo, { cambios: Object.assign({}, previo.cambios, cambios) });
      return Object.assign({ guardado_en: ahora }, previo, cambios, { id });
    });
  }
  function materiales() { return tx(MATERIAL, 'readonly', (s) => s.getAll()).catch(() => []); }
  const urls = {};
  function mezclaMaterial(datos) {
    return materiales().then((registros) => {
      // El archivo de un documento de la base está en el sitio, en la ruta de su clave en el almacén
      let filas = (datos.material_estudio || []).map((m) => Object.assign({}, m, { url: m.url || m.archivo_clave }));
      if (!registros.length) return Object.assign({}, datos, { material_estudio: filas });
      registros.sort((a, b) => String(a.guardado_en).localeCompare(String(b.guardado_en)));
      for (const r of registros) {
        const { blob, guardado_en, cambios, ...campos } = r;
        const i = filas.findIndex((m) => m.id === r.id);
        if (i >= 0 && !blob) { filas[i] = Object.assign({}, filas[i], campos); continue; }
        // Un cambio sin su documento (lo dejó así una versión anterior de la prueba, que sustituía el registro): no se aplica
        if (!blob || !campos.clave) continue;
        // Carga nueva: sustituye a la vigente del mismo documento y hereda si estaba publicada; después, sus cambios
        const previa = filas.find((m) => m.clave === r.clave && m.vigente);
        if (previa) { previa.vigente = false; campos.publicado = previa.publicado; }
        if (!urls[r.id]) { try { urls[r.id] = global.URL.createObjectURL(blob); } catch (e) { urls[r.id] = ''; } }
        filas.push(Object.assign({ temas: [], orden: (previa && previa.orden) || 99 }, campos, cambios || {}, { vigente: true, url: urls[r.id] || '' }));
      }
      filas = filas.map((m) => Object.assign({}, m));
      return Object.assign({}, datos, { material_estudio: filas });
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
     cuenta (auditoría 2026-10-18, A 8.3: quedaba una cuenta con la CURP vacía). */
  function guardaCuenta({ curp, id, persona, contrasena }) {
    if (!curp || !id) return Promise.reject(new Error('sin_curp'));
    return resumen(contrasena).then((r) => tx(CUENTAS, 'readwrite', (s) => s.put({ curp, id, persona, resumen: r, creada_en: new Date().toISOString() })));
  }
  function cuentas() { return tx(CUENTAS, 'readonly', (s) => s.getAll()).catch(() => []); }
  function cuenta(curp) { return curp ? tx(CUENTAS, 'readonly', (s) => s.get(curp)).catch(() => null) : Promise.resolve(null); }
  function contrasenaValida(c, contrasena) { return c ? resumen(contrasena).then((r) => r === c.resumen) : Promise.resolve(false); }

  /* ----- Cambios de «Mi perfil» (contacto, adscripción, fotografía nueva), por persona ----- */
  const leePerfiles = () => leeLs(CLAVES.perfiles, {}) || {};
  function guardaPerfil(id, cambios) {
    const t = leePerfiles();
    t[id] = Object.assign({}, t[id], cambios);
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
  /* Lo guardado, para el menú de pruebas: cuántos registros de cada cosa */
  function guardado() {
    const cuantos = (clave) => Object.values(leeLs(clave, {}) || {}).reduce((n, v) => n + (Array.isArray(v) ? v.length : 1), 0);
    return Promise.all([solicitudes(), fotos(), cuentas(), todosLosDocumentos(), materiales()]).then(([s, f, c, docs, mat]) => ({
      cuentas: c.length, fotos: f,
      envios: s.reduce((n, x) => n + ((x.envios || []).length || 1), 0),
      documentos: docs.filter((x) => !x.envio && String(x.clave).split('|').length > 2).length,
      perfiles: Object.keys(leePerfiles()).length,
      material: mat.length,
      revisiones: cuantos(CLAVES.revisiones), cotejos: cuantos(CLAVES.cotejos), grupos: eventosGrupos().length,
      lista: Object.keys(paseDeLista()).length, examenes: clavesLs(CLAVES.examen).length,
      // Cualquier otra clave de la prueba (por ejemplo, una señal de pantalla abierta del examen)
      otras: clavesLs('apd.').filter((k) => ![CLAVES.sesion, CLAVES.ultimoUso, CLAVES.inicio].includes(k)).length
    }));
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
  function aplicaGrupos(d, eventos, t) {
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
    for (const e of eventos.slice().sort((a, b) => String(a.en).localeCompare(String(b.en)))) {
      const en = t.alCorte(e.en);
      if (e.tipo === 'pase') {
        // Pase de lista del día del examen (P94, decisión 2026-10-18): la asistencia del último día, como la registraría
        // la API en apd.asistencia. Con la calificación ya capturada, la base no la cambia (asistencia_cerrada).
        const x = deInscripcion(e.inscripcion_id);
        if (!x || x.g.estado !== 'en_curso' || conExamen(x.ins.id)) continue;
        const dia = x.c.dias_duracion;
        d.asistencia = d.asistencia.filter((a) => !(a.inscripcion_id === x.ins.id && a.dia === dia));
        d.asistencia.push({ inscripcion_id: x.ins.id, dia, asistio: Boolean(e.presente), capturada_por: e.por, capturada_en: t.enSuDia(e.en, fechaExamen(x.g, x.c)), de_prueba: true, pase_de_lista: true });
        continue;
      }
      if (e.tipo === 'examen') {
        // Examen en línea enviado (auditoría 2026-10-18, C3): la calificación llega a apd.examen con origen «examen_web»
        // y la solicitud queda aprobada o no acreditada (apd.examen_captura y apd.examen_aplicar). Se presenta el último
        // día del curso, con el pase de lista de ese día; la calificación no se modifica.
        const r = e.registro;
        const x = deInscripcion(r.inscripcion_id);
        if (!x || x.g.estado !== 'en_curso' || conExamen(x.ins.id)) continue;
        const dia = fechaExamen(x.g, x.c);
        if (!d.asistencia.some((a) => a.inscripcion_id === x.ins.id && a.dia === x.c.dias_duracion && a.asistio)) continue;
        const capturado = t.enSuDia(r.terminado_en, dia);
        d.examen.push({ inscripcion_id: x.ins.id, presentado_en: dia, calificacion: Number(r.calificacion), origen: 'examen_web',
          capturado_por: r.generado_por || 'examen_web', capturado_en: capturado, de_prueba: true });
        ponSol(x.ins.solicitud_id, { estado: Number(r.calificacion) >= Number(x.c.calificacion_minima) ? 'aprobada' : 'no_acreditada', estado_desde: capturado });
        continue;
      }
      if (e.tipo === 'crear') {
        const c = curso(e.tipo_acreditacion, e.modalidad);
        if (!c || d.grupo.some((g) => g.id === e.grupo_id)) continue;
        const g = { id: e.grupo_id, folio: e.folio, tipo_acreditacion: e.tipo_acreditacion, modalidad: e.modalidad, integracion: e.integracion,
          organizacion_id: e.integracion === 'especifico' ? e.organizacion_id : null, cupo_minimo: c.cupo_minimo, cupo_maximo: c.cupo_maximo,
          instructor: null, sede, fecha_inicio: null, hora_entrada: null, estado: 'en_integracion', estado_desde: en, creado_en: en,
          motivo_cancelacion: null, es_ficticio: true, de_prueba: true };
        d.grupo.push(g);
        inscribe(g, e.folios, en);
        continue;
      }
      let g = d.grupo.find((x) => x.id === e.grupo_id);
      if (!g) continue;
      if (e.tipo === 'agregar') {
        inscribe(g, e.folios, en);
      } else if (e.tipo === 'baja') {
        const s = d.solicitud.find((x) => x.folio === e.folio);
        const ins = s && activas(g.id).find((i) => i.solicitud_id === s.id);
        if (!ins || conExamen(ins.id) || !String(e.motivo || '').trim()) continue;
        baja(ins, e.motivo, en);
        // Un grupo confirmado que queda por debajo del mínimo regresa a integración, con su fecha (como la base)
        if (g.estado === 'confirmado' && activas(g.id).length < g.cupo_minimo) g = ponGrupo(g, { estado: 'en_integracion', estado_desde: en });
      } else if (e.tipo === 'confirmar') {
        const c = curso(g.tipo_acreditacion, g.modalidad);
        const anticipacion = Number(global.APD.parametro(d, 'dias_anticipacion_grupo') || 7);
        if (g.estado !== 'en_integracion' || activas(g.id).length < g.cupo_minimo || !e.fecha_inicio || !e.hora_entrada || !e.instructor) continue;
        if (e.fecha_inicio < global.APD.sumaDias(hoy, anticipacion) || !c) continue;
        g = ponGrupo(g, { estado: 'confirmado', estado_desde: en, fecha_inicio: e.fecha_inicio, hora_entrada: e.hora_entrada, instructor: e.instructor });
      } else if (e.tipo === 'proponer') {
        // Fecha propuesta de un grupo por confirmar («Programar un curso», «Guardar sin confirmar»; 2026-10-18): la base
        // admite primer día, hora de entrada e instructor en un grupo en integración (apd.grupo_cambio sólo los fija al
        // confirmar); el curso no cambia. Lo que no se eligió queda vacío.
        if (g.estado !== 'en_integracion' || !e.fecha_inicio) continue;
        g = ponGrupo(g, { fecha_inicio: e.fecha_inicio, hora_entrada: e.hora_entrada || null, instructor: e.instructor || null });
      } else if (e.tipo === 'iniciar') {
        // Sólo en la versión de prueba (auditoría 2026-10-18, B5): la fecha simulada no avanza, así que un grupo
        // confirmado nunca llegaría a su primer día. «Iniciar el curso hoy» (menú de pruebas, en la ficha del grupo)
        // hace lo que la base permite: mover el primer día de un grupo confirmado a hoy y pasarlo a «en curso»
        // (apd.grupo_cambio: confirmado → en_curso desde su primer día, con el cupo mínimo). En el sistema el curso
        // empieza en la fecha confirmada; quién lo pasa a «en curso» está por decidir (P92).
        if (g.estado !== 'confirmado' || activas(g.id).length < g.cupo_minimo || !g.instructor) continue;
        g = ponGrupo(g, { estado: 'en_curso', estado_desde: en, fecha_inicio: hoy, inicio_simulado: true, fecha_inicio_confirmada: g.fecha_inicio });
      } else if (e.tipo === 'cancelar') {
        if (!['en_integracion', 'confirmado'].includes(g.estado) || !String(e.motivo || '').trim()) continue;
        for (const ins of activas(g.id)) baja(ins, `Grupo cancelado: ${e.motivo}`, en);
        g = ponGrupo(g, { estado: 'cancelado', estado_desde: en, motivo_cancelacion: e.motivo });
      } else if (e.tipo === 'asistencia') {
        const c = curso(g.tipo_acreditacion, g.modalidad);
        if (g.estado !== 'en_curso' || !c || e.dia < 1 || e.dia > c.dias_duracion) continue;
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

  function mezcla(datos) {
    return Promise.all([cuentas(), solicitudes(), todosLosDocumentos()]).then(([listaCuentas, registros, docs]) => {
      const revisiones = listaPorFolio(CLAVES.revisiones);
      const cotejos = listaPorFolio(CLAVES.cotejos);
      const perfiles = leePerfiles();
      // Pase de lista y exámenes en línea, en la misma línea de tiempo que los grupos y la asistencia
      const lista = paseDeLista();
      const examenes = codigosExamen().filter((r) => r.terminado_en && !r.reemplazado_por && !r.suspendido);
      const eventosGrupo = eventosGrupos()
        .concat(Object.entries(lista).map(([insId, r]) => ({ tipo: 'pase', en: r.en, inscripcion_id: insId, presente: r.presente, por: r.por })))
        .concat(examenes.map((r) => ({ tipo: 'examen', en: r.terminado_en, registro: r })));
      // Todos los folios con algo guardado: también los que sólo tienen documentos sueltos, como la corrección de una
      // cita en pausa de una solicitud ficticia (auditoría 2026-10-18, C1)
      const docsDe = {};
      for (const a of docs) (docsDe[a.folio] = docsDe[a.folio] || []).push(a);
      const folios = [...new Set([...registros.map((r) => r.folio), ...Object.keys(docsDe), ...Object.keys(revisiones), ...Object.keys(cotejos)])];
      if (!listaCuentas.length && !folios.length && !Object.keys(perfiles).length && !eventosGrupo.length) return datos;
      const d = Object.assign({}, datos, { solicitud: datos.solicitud.slice(), solicitante: datos.solicitante.slice(), documento: datos.documento.slice(),
        revision: datos.revision.slice(), fotografia: datos.fotografia.slice(), cita: (datos.cita || []).slice(),
        grupo: datos.grupo.slice(), inscripcion: datos.inscripcion.slice(), asistencia: datos.asistencia.slice(), examen: (datos.examen || []).slice() });
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
      const nombreReq = (k) => ((d.requisito || []).find((r) => r.clave === k) || {}).nombre || k;

      for (const folio of folios) {
        const r = registroDe[folio];
        const envios = r ? (r.envios || [r]) : [];
        const primero = envios[0];
        let i = d.solicitud.findIndex((x) => x.folio === folio);
        if (i < 0 && !primero) continue; // algo guardado de una solicitud que ya no existe
        if (i < 0) {
          // Solicitud nueva de la prueba: entra enviada (su primer envío); un reenvío posterior es otro evento «envio»
          let p = d.solicitante.find((x) => x.id === primero.persona.id) || d.solicitante.find((x) => x.curp === primero.persona.curp);
          if (!p) { p = Object.assign({ id: `prueba:${primero.persona.curp || primero.folio}`, estado: 'activa', de_prueba: true }, primero.persona); d.solicitante.push(p); }
          const perfil = primero.tipo_acreditacion === 'dictaminador' ? global.APD.perfilAcademico(datos, primero.nivel_estudios, primero.estatus_estudios, primero.carrera) : null;
          const enviada = alCorte(primero.enviada_en);
          d.solicitud.push({ id: `prueba:${primero.folio}`, folio: primero.folio, solicitante_id: p.id, estado: 'enviada', estado_desde: enviada,
            enviada_en: enviada, creada_en: enviada, tipo_acreditacion: primero.tipo_acreditacion, modalidad: primero.modalidad,
            nivel_estudios: primero.nivel_estudios, carrera: primero.carrera, carrera_tecnica: primero.carrera_tecnica || null, estatus_estudios: primero.estatus_estudios,
            anios_experiencia: primero.anios_experiencia, perfil_academico: perfil ? perfil.perfil : null, experiencia_minima: perfil ? perfil.minimo : null,
            adscripcion: primero.persona.adscripcion, organizacion_id: primero.persona.organizacion_id, organizacion_nombre: primero.persona.organizacion_nombre,
            acreditacion_anterior_id: primero.acreditacion_anterior_id || null, pago_referencia: primero.folio.replace(/-/g, ''), de_prueba: true });
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

        for (const e of eventos) {
          if (e.tipo === 'doc') {
            const a = e.a;
            const en = fecha(a.cargado_en);
            d.documento = d.documento.map((x) => (x.solicitud_id === id && x.requisito === a.requisito && x.vigente ? Object.assign({}, x, { vigente: false }) : x));
            d.documento.push({ solicitud_id: id, requisito: a.requisito, vigente: true, estado: a.estado || 'pendiente', observacion: '',
              cargado_en: en, cargado_real: a.cargado_en, cargado_por: a.cargado_por || 'persona', motivo: a.motivo || null,
              nombre_original: a.nombre_original, tamano_bytes: a.tamano_bytes, tipo_mime: a.tipo_mime, blob: a.blob, de_prueba: true });
          } else if (e.tipo === 'envio') {
            // Envío o reenvío: vuelve a revisión documental
            pon({ estado: 'enviada', estado_desde: fecha(e.r.estado_desde || e.en), de_prueba: true, cotejo_pausa: null });
          } else if (e.tipo === 'revision') {
            // Revisión del personal: la persona ve el resultado en «Mis trámites» como lo dejaría la base
            const rev = e.rev;
            const rd = rev.datos || {};
            const RESULTADO = { validada: 'validada_en_linea', con_observaciones: 'con_observaciones', rechazada: 'rechazada' };
            if (s.estado !== 'enviada' || !RESULTADO[rev.resultado]) continue;
            const en = fecha(rev.en);
            d.revision.push({ solicitud_id: id, revisor: rev.revisor, resultado: rev.resultado, revisada_en: en, observacion_general: rd.mensaje_general || rd.motivo_rechazo || '', de_prueba: true });
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
          const programada = abierta >= 0 ? d.cita[abierta].programada_en : c.cita_en;
          const en = fecha(c.en, programada);
          const noCoinciden = Object.keys(cd).filter((k) => k.startsWith('coincide_') && cd[k] === 'no').map((k) => k.slice(9));
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
              const p = d.solicitante[persona(s.solicitante_id)] || {};
              cambiaPersona(s.solicitante_id, { numero_expediente: p.numero_expediente || c.expediente || null });
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
      }
      // Grupos, asistencia, pase de lista y examen, después: una solicitud llega a la espera de grupo con su cotejo terminado
      aplicaGrupos(d, eventosGrupo, t);
      return d;
    }).catch((e) => {
      // Si algo de lo guardado no se puede aplicar, se ven los ficticios solos; queda el aviso en la consola
      if (global.console) global.console.warn('Versión de prueba: no se pudo aplicar lo guardado en este navegador.', e);
      return datos;
    });
  }

  global.APD_ARCHIVOS_PRUEBA = {
    CLAVES, caduca, comoLista, listaPorFolio, eventosGrupos,
    guardaEnvio, guardaDocumento, guardaFoto, foto,
    guardaCuenta, cuenta, contrasenaValida, guardaPerfil, borraTodo, borraPestana, guardado, mezcla,
    guardaMaterial, mezclaMaterial
  };
}(window));
