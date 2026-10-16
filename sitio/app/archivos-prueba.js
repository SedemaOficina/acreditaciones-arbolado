/* =========================================================
   archivos-prueba.js · Documentos reales en la versión de prueba, sin servidor (decisión 2026-10-16)

   Para probar la revisión con documentos de verdad: al enviar (o reenviar) una solicitud en la
   versión de prueba, sus archivos y un resumen de la solicitud se guardan SÓLO en este navegador
   (IndexedDB). La bandeja y la revisión del personal los leen de ahí y el visor los muestra.
   Nada sale de la computadora; «Borrar los documentos de prueba» (menú de pruebas) los quita.

   En la etapa 3 este archivo se quita: los documentos los guarda y los entrega la API.
   ========================================================= */
(function (global) {
  'use strict';
  const BASE = 'apd-prueba';
  const DOCS = 'documentos';
  const SOLS = 'solicitudes';
  let abierta = null;

  function abre() {
    if (abierta) return abierta;
    abierta = new Promise((ok, mal) => {
      let r;
      try { r = global.indexedDB.open(BASE, 1); } catch (e) { mal(e); return; }
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(DOCS)) db.createObjectStore(DOCS, { keyPath: 'clave' }).createIndex('folio', 'folio');
        if (!db.objectStoreNames.contains(SOLS)) db.createObjectStore(SOLS, { keyPath: 'folio' });
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
  function borraTodo() {
    return Promise.all([tx(SOLS, 'readwrite', (s) => s.clear()), tx(DOCS, 'readwrite', (s) => s.clear())]);
  }

  global.APD_ARCHIVOS_PRUEBA = { guardaEnvio, solicitudes, documentos, borraTodo };
}(window));
