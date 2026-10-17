/* revision.js · «Solicitudes por revisar» (personal, etapa 2): las solicitudes enviadas, de la que más tiempo
   lleva esperando a la más reciente, con búsqueda por nombre, CURP, folio de la solicitud o número de
   expediente y filtros por acreditación, nueva o renovación y vuelta de revisión.
   Lee los datos ficticios exportados por la base; en la etapa 3 los da la API del personal. */
(function () {
  'use strict';
  const { el, estado, fecha } = APD;
  const P = APD_PERSONAL;
  const form = document.getElementById('filtros');
  const $ = (s) => document.querySelector(s);

  /* Los filtros no se envían: Enter en la búsqueda no hace nada más que filtrar */
  form.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
  FormKit.iniciar(form, {});

  /* En teléfono, los filtros quedan plegados bajo «Filtrar», que dice cuántos hay activos (decisión 2026-10-16) */
  const bF = $('[data-filtrar]');
  const extra = $('#filtros-extra');
  const SELECTS = ['f_tipo', 'f_modalidad', 'f_vuelta'];
  bF.addEventListener('click', () => {
    const abrir = bF.getAttribute('aria-expanded') !== 'true';
    bF.setAttribute('aria-expanded', String(abrir));
    extra.dataset.plegado = String(!abrir);
  });
  function rotulaFiltrar() {
    const n = SELECTS.filter((id) => document.getElementById(id).value).length;
    bF.textContent = n ? `Filtrar (${n} ${n === 1 ? 'activo' : 'activos'})` : 'Filtrar';
  }

  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

  APD.cargar().then(P.datosConPrueba).then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'revision');
    $('[data-umbral-ambar]').textContent = P.UMBRAL.ambar;
    $('[data-umbral-rojo]').textContent = P.UMBRAL.rojo;
    const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    const revisadas = P.revisiones();

    const enviadas = datos.solicitud.filter((s) => s.estado === 'enviada' && !revisadas[s.folio])
      // Lo enviado en este navegador durante la prueba va primero, para encontrarlo (decisión 2026-10-17); lo demás, de la
      // que más espera a la más reciente
      .sort((a, b) => Number(Boolean(b.de_prueba)) - Number(Boolean(a.de_prueba)) || a.estado_desde.localeCompare(b.estado_desde));
    const filas = enviadas.map((s) => {
      const p = persona[s.solicitante_id];
      const v = P.vuelta(datos, s);
      const e = P.espera(s.estado_desde, `${datos.fecha_corte}T20:00:00-06:00`);
      const sen = P.senales(datos, s);
      const enlace = el('a', { class: 'btn btn-secundario btn-chico', href: `revisar.html?folio=${encodeURIComponent(s.folio)}`, 'aria-label': `Revisar la solicitud ${s.folio}`, texto: 'Revisar' });
      const tr = el('tr', { 'data-folio': s.folio }, [
        el('td', {}, [el('span', { class: 'mono', texto: s.folio })]),
        el('td', { texto: APD.nombreCompleto(p) }),
        el('td', { texto: `${APD.TIPOS[s.tipo_acreditacion]} · ${s.modalidad === 'renovacion' ? 'renovación' : 'nueva'}` }),
        el('td', { texto: fecha(s.estado_desde) }),
        el('td', {}, [estado(e.texto, e.tono)]),
        el('td', { texto: v.texto }),
        el('td', {}, sen.length ? el('span', { class: 'senales' }, sen.map(([t, tono]) => (tono ? estado(t, tono) : el('span', { texto: t })))) : el('span', { class: 'texto-gris', texto: '—' })),
        el('td', {}, [enlace])
      ]);
      return {
        tr,
        tipo: s.tipo_acreditacion,
        modalidad: s.modalidad,
        vuelta: v.n > 1 ? 'reenviada' : 'primera',
        // Se busca por nombre, CURP, folio de la solicitud y número de expediente (si ya lo tiene)
        texto: norm([APD.nombreCompleto(p), p.curp, s.folio, p.numero_expediente].join(' '))
      };
    });
    $('[data-filas]').replaceChildren(...filas.map((f) => f.tr));
    // El módulo tabla copia el encabezado a cada celda para leerla como ficha en teléfono
    $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));

    function filtra() {
      const q = norm(document.getElementById('buscar').value);
      const [tipo, mod, vta] = SELECTS.map((id) => document.getElementById(id).value);
      let n = 0;
      for (const f of filas) {
        const ve = (!q || f.texto.includes(q)) && (!tipo || f.tipo === tipo) && (!mod || f.modalidad === mod) && (!vta || f.vuelta === vta);
        f.tr.hidden = !ve;
        if (ve) n += 1;
      }
      $('[data-tabla-vacia]').hidden = n > 0 || !filas.length;
      $('[data-cuenta]').textContent = !filas.length ? 'No hay solicitudes por revisar.'
        : n === filas.length ? `Se muestran ${n === 1 ? 'la única solicitud' : `las ${n} solicitudes`}.`
        : `Se muestran ${n} de ${filas.length} solicitudes.`;
      rotulaFiltrar();
    }
    form.addEventListener('input', filtra);
    form.addEventListener('change', filtra);
    filtra();

    const hechas = Object.keys(revisadas);
    if (hechas.length) {
      const nodo = $('[data-revisadas]');
      nodo.textContent = `En esta prueba ya registró ${hechas.length === 1 ? 'la revisión de' : `${hechas.length} revisiones:`} ${hechas.join(', ')}. Ya no aparecen aquí; al cerrar la pestaña vuelven.`;
      nodo.hidden = false;
    }
  }).catch(() => {
    $('[data-cuenta]').textContent = 'No se pudieron cargar las solicitudes. Intente de nuevo más tarde.';
  });
}());
