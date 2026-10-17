/* =========================================================
   archivos-prueba.js · Lo que se registra en la versión de prueba, guardado en este navegador
   (decisiones 2026-10-16 y 2026-10-17)

   Para recorrer el trámite completo sin servidor, todo lo que se hace en la prueba queda guardado en ESTE navegador
   y sobrevive a recargar, abrir otra pestaña o cerrar el navegador:
     · cuentas creadas (IndexedDB «cuentas», por CURP), con la contraseña sólo como resumen SHA-256;
     · fotografías de perfil (IndexedDB «fotos», por CURP);
     · solicitudes enviadas o reenviadas y sus documentos (IndexedDB «solicitudes» y «documentos»);
     · cambios hechos en «Mi perfil» (localStorage «apd.perfiles»).
   APD.cargar() los suma a los datos ficticios con mezcla(), así que todas las pantallas —«Mis trámites», «Mi
   perfil», la bandeja y la revisión del personal— ven lo mismo. Nada sale de la computadora; «Borrar lo guardado» y
   «Empezar de cero» (menú de pruebas) lo quitan. Otro navegador u otro equipo no lo ven.

   En la etapa 3 este archivo se quita: todo lo guarda y lo entrega la API.
   ========================================================= */
(function (global) {
  'use strict';
  const BASE = 'apd-prueba';
  const DOCS = 'documentos';
  const SOLS = 'solicitudes';
  const FOTOS = 'fotos';
  const CUENTAS = 'cuentas';
  const PERFILES = 'apd.perfiles';
  let abierta = null;

  function abre() {
    if (abierta) return abierta;
    abierta = new Promise((ok, mal) => {
      let r;
      try { r = global.indexedDB.open(BASE, 3); } catch (e) { mal(e); return; }
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(DOCS)) db.createObjectStore(DOCS, { keyPath: 'clave' }).createIndex('folio', 'folio');
        if (!db.objectStoreNames.contains(SOLS)) db.createObjectStore(SOLS, { keyPath: 'folio' });
        if (!db.objectStoreNames.contains(FOTOS)) db.createObjectStore(FOTOS, { keyPath: 'curp' });
        if (!db.objectStoreNames.contains(CUENTAS)) db.createObjectStore(CUENTAS, { keyPath: 'curp' });
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

  /* ----- Solicitudes y documentos ----- */
  /* Guarda la solicitud (resumen para la bandeja) y sus archivos: [{ requisito, blob, nombre, tipo, size }] */
  function guardaEnvio(solicitud, archivos) {
    const ahora = new Date().toISOString();
    return tx(SOLS, 'readwrite', (s) => s.put(Object.assign({}, solicitud, { guardada_en: ahora })))
      .then(() => tx(DOCS, 'readwrite', (s) => {
        for (const a of archivos) {
          s.put({ clave: `${solicitud.folio}|${a.requisito}`, folio: solicitud.folio, requisito: a.requisito, blob: a.blob,
            nombre_original: a.nombre, tipo_mime: a.tipo, tamano_bytes: a.size, cargado_en: ahora });
        }
      }));
  }
  function solicitudes() { return tx(SOLS, 'readonly', (s) => s.getAll()).catch(() => []); }
  function documentos(folio) { return tx(DOCS, 'readonly', (s) => s.index('folio').getAll(folio)).catch(() => []); }

  /* ----- Fotografía de la persona: { blob, nombre, tipo } por CURP ----- */
  function guardaFoto(curp, a) {
    return tx(FOTOS, 'readwrite', (s) => s.put({ curp, blob: a.blob, nombre_original: a.nombre, tipo_mime: a.tipo, cargada_en: new Date().toISOString() }));
  }
  function foto(curp) { return curp ? tx(FOTOS, 'readonly', (s) => s.get(curp)).catch(() => null) : Promise.resolve(null); }
  function fotos() { return tx(FOTOS, 'readonly', (s) => s.count()).catch(() => 0); }

  /* ----- Cuentas creadas en la prueba ----- */
  /* La contraseña nunca se guarda: sólo su resumen SHA-256, para poder entrar otra vez con ella en este navegador. */
  function resumen(texto) {
    const datos = new TextEncoder().encode(String(texto));
    return global.crypto.subtle.digest('SHA-256', datos)
      .then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''));
  }
  /* cuenta: { curp, id, persona: {…datos de la persona…}, contrasena } → se guarda con el resumen */
  function guardaCuenta({ curp, id, persona, contrasena }) {
    return resumen(contrasena).then((r) => tx(CUENTAS, 'readwrite', (s) => s.put({ curp, id, persona, resumen: r, creada_en: new Date().toISOString() })));
  }
  function cuentas() { return tx(CUENTAS, 'readonly', (s) => s.getAll()).catch(() => []); }
  function cuenta(curp) { return curp ? tx(CUENTAS, 'readonly', (s) => s.get(curp)).catch(() => null) : Promise.resolve(null); }
  function contrasenaValida(c, contrasena) { return c ? resumen(contrasena).then((r) => r === c.resumen) : Promise.resolve(false); }

  /* ----- Cambios de «Mi perfil» (contacto, adscripción, fotografía nueva), por persona ----- */
  const leePerfiles = () => { try { return JSON.parse(global.localStorage.getItem(PERFILES) || '{}'); } catch (e) { return {}; } };
  function guardaPerfil(id, cambios) {
    const t = leePerfiles();
    t[id] = Object.assign({}, t[id], cambios);
    try { global.localStorage.setItem(PERFILES, JSON.stringify(t)); return true; } catch (e) { return false; }
  }

  function borraTodo() {
    try { global.localStorage.removeItem(PERFILES); } catch (e) { /* sin almacenamiento */ }
    return Promise.all([SOLS, DOCS, FOTOS, CUENTAS].map((a) => tx(a, 'readwrite', (s) => s.clear())));
  }
  function cuenta_() { return Promise.all([solicitudes(), fotos(), cuentas()]).then(([s, f, c]) => ({ envios: s.length, fotos: f, cuentas: c.length })); }

  /* ----- Mezcla: lo guardado en la prueba, encima de los datos ficticios (lo llama APD.cargar) ----- */
  function mezcla(datos) {
    return Promise.all([cuentas(), solicitudes()]).then(([listaCuentas, registros]) => Promise.all(registros.map((r) =>
      documentos(r.folio).then((docs) => ({ r, docs })))).then((lista) => ({ listaCuentas, lista }))).then(({ listaCuentas, lista }) => {
      const perfiles = leePerfiles();
      if (!listaCuentas.length && !lista.length && !Object.keys(perfiles).length) return datos;
      const d = Object.assign({}, datos, { solicitud: datos.solicitud.slice(), solicitante: datos.solicitante.slice(), documento: datos.documento.slice() });
      // Cuentas: una del registro anterior queda activa; una nueva se agrega como persona de la prueba
      for (const c of listaCuentas) {
        const i = d.solicitante.findIndex((x) => x.curp === c.curp);
        if (i >= 0) d.solicitante[i] = Object.assign({}, d.solicitante[i], c.persona, { id: d.solicitante[i].id, estado: 'activa' });
        else d.solicitante.push(Object.assign({ numero_expediente: null }, c.persona, { id: c.id, curp: c.curp, estado: 'activa', creada_en: c.creada_en, de_prueba: true }));
      }
      // Cambios de «Mi perfil»
      d.solicitante = d.solicitante.map((p) => (perfiles[p.id] ? Object.assign({}, p, perfiles[p.id]) : p));
      // La prueba vive en una fecha simulada (fecha_corte): lo enviado hoy de verdad cuenta como enviado ese día, para
      // que la espera no salga negativa (decisión 2026-10-17)
      const tope = `${datos.fecha_corte}T19:00:00-06:00`;
      const alCorte = (iso) => (iso && new Date(iso) > new Date(tope) ? new Date(tope).toISOString() : iso);
      for (const { r: original, docs } of lista) {
        const r = Object.assign({}, original, { estado_desde: alCorte(original.estado_desde), enviada_en: alCorte(original.enviada_en) });
        let s = d.solicitud.find((x) => x.folio === r.folio);
        if (s) {
          // Reenvío de una solicitud ficticia con observaciones: vuelve a revisión
          s = Object.assign({}, s, { estado: 'enviada', estado_desde: r.estado_desde, de_prueba: true });
          d.solicitud[d.solicitud.findIndex((x) => x.folio === r.folio)] = s;
        } else {
          let persona = d.solicitante.find((x) => x.id === r.persona.id) || d.solicitante.find((x) => x.curp === r.persona.curp);
          if (!persona) { persona = Object.assign({ id: `prueba:${r.persona.curp || r.folio}`, estado: 'activa', de_prueba: true }, r.persona); d.solicitante.push(persona); }
          const perfil = r.tipo_acreditacion === 'dictaminador' ? global.APD.perfilAcademico(datos, r.nivel_estudios, r.estatus_estudios, r.carrera) : null;
          s = { id: `prueba:${r.folio}`, folio: r.folio, solicitante_id: persona.id, estado: 'enviada', estado_desde: r.estado_desde,
            enviada_en: r.enviada_en, creada_en: r.enviada_en, tipo_acreditacion: r.tipo_acreditacion, modalidad: r.modalidad,
            nivel_estudios: r.nivel_estudios, carrera: r.carrera, carrera_tecnica: r.carrera_tecnica || null, estatus_estudios: r.estatus_estudios,
            anios_experiencia: r.anios_experiencia, perfil_academico: perfil ? perfil.perfil : null, experiencia_minima: perfil ? perfil.minimo : null,
            adscripcion: r.persona.adscripcion, organizacion_id: r.persona.organizacion_id, organizacion_nombre: r.persona.organizacion_nombre,
            acreditacion_anterior_id: r.acreditacion_anterior_id || null, de_prueba: true };
          d.solicitud.push(s);
        }
        for (const a of docs) {
          d.documento = d.documento.map((x) => (x.solicitud_id === s.id && x.requisito === a.requisito && x.vigente ? Object.assign({}, x, { vigente: false }) : x));
          d.documento.push({ solicitud_id: s.id, requisito: a.requisito, vigente: true, estado: 'pendiente', cargado_en: alCorte(a.cargado_en),
            nombre_original: a.nombre_original, tamano_bytes: a.tamano_bytes, tipo_mime: a.tipo_mime, blob: a.blob });
        }
      }
      return d;
    }).catch(() => datos);
  }

  global.APD_ARCHIVOS_PRUEBA = {
    guardaEnvio, solicitudes, documentos, guardaFoto, foto, fotos,
    guardaCuenta, cuentas, cuenta, contrasenaValida, guardaPerfil, borraTodo, guardado: cuenta_, mezcla
  };
}(window));
