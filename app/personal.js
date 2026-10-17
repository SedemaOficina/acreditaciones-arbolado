/* =========================================================
   personal.js · Lo común de las pantallas del personal de la Secretaría (etapa 2)

   A las personas del personal se les habla de usted (decisión 2026-10-16).

   ACCESO SIMULADO: en la versión de prueba no hay cuentas del personal. Las
   pantallas entran con un perfil ficticio de revisión documental; los demás
   perfiles (cotejo, instructor, emisión, consulta) se simulan cuando existan
   sus pantallas (P27). En la etapa 3 lo sustituye el acceso del SIA.

   Las decisiones que se registran en una prueba sólo se recuerdan en esta
   navegador (localStorage), para que la bandeja muestre lo que ya se revisó.
   ========================================================= */
(function (global) {
  'use strict';
  const { el } = APD;
  const CLAVE = 'apd.personal.revisiones';

  /* Perfil ficticio de quien revisa (no es una persona real) */
  const REVISORA = { usuario: 'revision.prueba', nombre: 'María Ejemplo Revisora', perfil: 'Revisión documental' };

  /* Plazos de la bandeja: días de espera desde que la solicitud llegó a revisión.
     Pendiente (P02): los fija la Dirección; mientras, estos valores de prueba. */
  const UMBRAL = { ambar: 3, rojo: 10 };

  function revisiones() { try { return JSON.parse(global.localStorage.getItem(CLAVE) || '{}'); } catch (e) { return {}; } }
  function guardaRevision(folio, registro) {
    const r = revisiones();
    r[folio] = registro;
    try { global.localStorage.setItem(CLAVE, JSON.stringify(r)); return true; } catch (e) { return false; }
  }

  /* Días naturales entre dos fechas ISO, en hora de la Ciudad de México */
  function dias(desde, hasta) {
    const d = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00-06:00`);
    const local = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    return Math.round((d(local(hasta)) - d(local(desde))) / 86400000);
  }
  function espera(desde, corte) {
    const n = dias(desde, corte);
    return { n, texto: n === 0 ? 'Hoy' : n === 1 ? '1 día' : `${n} días`, tono: n >= UMBRAL.rojo ? 'error' : n >= UMBRAL.ambar ? 'pend' : '' };
  }
  const ORDINAL = ['', '1.ª', '2.ª', '3.ª', '4.ª', '5.ª', '6.ª'];
  function vuelta(datos, s) {
    const n = datos.revision.filter((r) => r.solicitud_id === s.id).length + 1;
    return { n, texto: n > 1 ? `${ORDINAL[n] || n + '.ª'} (reenviada)` : '1.ª' };
  }
  /* Documentos cargados de nuevo desde la última revisión: lo que la persona corrigió */
  function corregidos(datos, s) {
    const ult = datos.revision.filter((r) => r.solicitud_id === s.id).map((r) => r.revisada_en).sort().pop();
    if (!ult) return [];
    return datos.documento.filter((d) => d.solicitud_id === s.id && d.vigente && d.cargado_en > ult);
  }
  /* Lo que conviene revisar con atención */
  function senales(datos, s) {
    const lista = [];
    if (s.perfil_academico === 'por_clasificar') lista.push(['Carrera por clasificar', 'pend']);
    if (s.perfil_academico === 'no_cumple') lista.push(['Podría no cumplir el perfil', 'error']);
    const c = corregidos(datos, s).length;
    if (c) lista.push([c === 1 ? '1 documento corregido' : `${c} documentos corregidos`, '']);
    if (datos.documento.some((d) => d.solicitud_id === s.id && d.vigente && d.blob)) lista.push(['Archivos cargados en este navegador', 'ok']);
    return lista;
  }

  /* Cabecera de sesión del personal */
  function pintaSesion(contenedor, actual) {
    if (!contenedor) return;
    const salir = el('a', { class: 'btn-enlace', href: 'index.html', texto: 'Salir' });
    contenedor.replaceChildren(
      el('p', { class: 'sesion-nombre' }, [document.createTextNode(`${REVISORA.nombre} `), APD.estado(`Perfil: ${REVISORA.perfil.toLowerCase()}`)]),
      el('nav', { class: 'sesion-enlaces', 'aria-label': 'Secciones del personal' }, [
        el('a', { class: 'btn-enlace', href: 'revision.html', 'aria-current': actual === 'revision' ? 'page' : null, texto: 'Revisión documental' }),
        salir
      ])
    );
  }

  /* Versión de prueba: los datos ficticios más lo que se envió en este navegador (app/archivos-prueba.js), con la misma
     forma que la base. Una solicitud nueva entra como enviada, con su persona y sus documentos; un reenvío de una
     solicitud ficticia la vuelve a poner en revisión con los documentos corregidos como carga vigente. */
  /* Lo registrado en este navegador durante la prueba ya viene en los datos (APD.cargar → APD_ARCHIVOS_PRUEBA.mezcla) */
  function datosConPrueba(datos) { return Promise.resolve(datos); }

  global.APD_PERSONAL = { datosConPrueba, REVISORA, UMBRAL, revisiones, guardaRevision, dias, espera, vuelta, corregidos, senales, pintaSesion };
}(window));
