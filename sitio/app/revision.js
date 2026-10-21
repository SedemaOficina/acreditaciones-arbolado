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

  const norm = APD.normalizaBusqueda;

  /* Los filtros quedan en la dirección (?tipo=&modalidad=&vuelta=), como el día en «Citas» (?dia=): al volver de una
     solicitud con «Atrás» o al recargar, la bandeja sigue filtrada (auditoría 2026-10-20, C4-01). La búsqueda no: puede
     llevar un nombre o una CURP. «Revisar una solicitud» regresa a la bandeja con los mismos filtros (CLAVE_DIRECCION). */
  const PARAM = { f_tipo: 'tipo', f_modalidad: 'modalidad', f_vuelta: 'vuelta' };
  const CLAVE_DIRECCION = 'apd.bandeja.filtros';
  {
    const u = new URLSearchParams(location.search);
    for (const id of SELECTS) {
      const sel = document.getElementById(id);
      const v = u.get(PARAM[id]);
      if (v && [...sel.options].some((o) => o.value === v)) sel.value = v;
    }
    rotulaFiltrar();
  }
  function guardaFiltros() {
    const url = new URL(location.href);
    for (const id of SELECTS) { const v = document.getElementById(id).value; if (v) url.searchParams.set(PARAM[id], v); else url.searchParams.delete(PARAM[id]); }
    if (url.search !== location.search) history.replaceState(null, '', url);
    try { sessionStorage.setItem(CLAVE_DIRECCION, url.search); } catch (e) { /* sin almacenamiento */ }
  }

  let filas = [];
  let huella = null;
  let primera = true;
  /* La bandeja se vuelve a leer cuando otra pestaña guarda una revisión o al volver a esta (APD.alCambiar, como «Citas»):
     lo revisado en otra pestaña sale de la lista y de la cuenta (auditoría 2026-10-20, C4-05). Se conservan los filtros y
     la búsqueda; si nada cambió, no se vuelve a pintar (el foco se queda donde estaba). */
  function carga() {
    return APD.cargar().then((datos) => {
      if (primera) {
        P.pintaSesion($('[data-sesion-personal]'), 'revision');
        $('[data-umbral-ambar]').textContent = P.UMBRAL.ambar;
        $('[data-umbral-rojo]').textContent = P.UMBRAL.rojo;
      }
      const ahora = JSON.stringify([P.porRevisar(datos).map((s) => [s.folio, s.estado, s.estado_desde]), Object.keys(P.revisiones(datos))]);
      if (ahora === huella) return;
      huella = ahora;
      const enfocado = document.activeElement && document.activeElement.closest('[data-filas] tr') ? document.activeElement.closest('tr').dataset.folio : null;
      pintaBandeja(datos);
      if (enfocado) { const a = $(`[data-filas] tr[data-folio="${enfocado}"] a`); if (a) a.focus(); }
      if (primera) {
        form.addEventListener('input', filtra);
        form.addEventListener('change', filtra);
        primera = false;
      }
      filtra();
    });
  }

  function pintaBandeja(datos) {
    const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    // Las que se aplicaron, no lo último que se guardó (auditoría «intentar romperlo», F2 M1)
    const revisadas = P.revisiones(datos);

    // Lo que ya se revisó cambió de estado (APD.cargar aplica las revisiones de la prueba); si la persona lo reenvió,
    // vuelve a estar enviada y regresa a la bandeja como reenviada
    // Lo enviado en este navegador durante la prueba va primero, para encontrarlo (decisión 2026-10-17); lo demás, de la
    // que más espera a la más reciente
    const enviadas = P.porRevisar(datos);
    filas = enviadas.map((s) => {
      const p = persona[s.solicitante_id];
      const v = P.vuelta(datos, s);
      const e = P.espera(s.estado_desde, `${datos.fecha_corte}T20:00:00-06:00`);
      const sen = P.senales(datos, s);
      const enlace = el('a', { class: 'btn btn-secundario btn-chico', href: `revisar.html?folio=${encodeURIComponent(s.folio)}`, 'aria-label': `Revisar la solicitud ${s.folio}`, texto: 'Revisar' });
      const tr = el('tr', { 'data-folio': s.folio }, [
        el('td', {}, [el('span', { class: 'mono', texto: s.folio })]),
        el('td', { texto: APD.nombreCompleto(p) }),
        el('td', { texto: `${APD.TIPOS[s.tipo_acreditacion]} · ${s.modalidad === 'renovacion' ? 'renovación' : 'nueva'}` }),
        el('td', { class: 'sin-corte', texto: fecha(s.estado_desde) }),
        el('td', {}, [estado(e.texto, e.tono || 'marcha')]),
        el('td', { texto: v.texto }),
        el('td', {}, sen.length ? el('span', { class: 'senales' }, sen.map(([t, tono]) => (tono ? estado(t, tono) : el('span', { texto: t })))) : el('span', { class: 'texto-gris', texto: '—' })),
        el('td', {}, [enlace])
      ]);
      return {
        tr,
        tipo: s.tipo_acreditacion,
        modalidad: s.modalidad,
        vuelta: v.n > 1 ? 'reenviada' : 'primera',
        tono: e.tono,
        // Se busca por nombre, CURP, folio de la solicitud y número de expediente (si ya lo tiene)
        texto: norm([APD.nombreCompleto(p), p.curp, s.folio, p.numero_expediente].join(' '))
      };
    });
    $('[data-filas]').replaceChildren(...filas.map((f) => f.tr));
    // El módulo tabla copia el encabezado a cada celda para leerla como ficha en teléfono
    $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));

    // Revisadas en la prueba: salen de la bandeja y siguen su camino («Citas de cotejo», «Grupos»); aquí se listan con su
    // resultado y su situación actual, para seguirlas en la prueba (decisión 2026-10-17)
    const hechas = Object.entries(revisadas).sort((a, b) => String(b[1].en).localeCompare(String(a[1].en)));
    if (hechas.length) {
      const porFolio = Object.fromEntries(datos.solicitud.map((s) => [s.folio, s]));
      $('[data-revisadas-lista]').replaceChildren(...hechas.map(([folio, r]) => {
        const s = porFolio[folio];
        const p = s ? persona[s.solicitante_id] : null;
        const actual = s ? APD.nombrePersonal(s.estado) : '—';
        return el('li', {}, [el('span', { class: 'mono', texto: folio }), document.createTextNode(` · ${p ? APD.nombreCompleto(p) : ''} · ${r.texto || r.resultado} · situación actual: ${actual}`)]);
      }));
      $('[data-revisadas]').hidden = false;
    }
  }

  function filtra() {
    const q = norm(document.getElementById('buscar').value);
    const [tipo, mod, vta] = SELECTS.map((id) => document.getElementById(id).value);
    let n = 0;
    let rojas = 0;
    let ambar = 0;
    for (const f of filas) {
      const ve = (!q || f.texto.includes(q)) && (!tipo || f.tipo === tipo) && (!mod || f.modalidad === mod) && (!vta || f.vuelta === vta);
      f.tr.hidden = !ve;
      if (ve) { n += 1; if (f.tono === 'error') rojas += 1; else if (f.tono === 'pend') ambar += 1; }
    }
    // Cuántas llevan más tiempo, sin recorrer la lista (auditoría de tareas, M8)
    const espera = [rojas ? `${rojas} con ${P.UMBRAL.rojo} días o más` : '', ambar ? `${ambar} de ${P.UMBRAL.ambar} a ${P.UMBRAL.rojo - 1} días` : ''].filter(Boolean);
    const detalle = espera.length ? `: ${espera.join(' y ')}` : '';
    $('[data-tabla-vacia]').hidden = n > 0 || !filas.length;
    // La cuenta filtrada dice con qué (auditoría 2026-10-20, C4-02): en teléfono los filtros quedan plegados
    const con = [q ? `búsqueda «${document.getElementById('buscar').value.trim()}»` : null,
      ...SELECTS.map((id) => document.getElementById(id)).filter((sel) => sel.value).map((sel) => sel.selectedOptions[0].textContent)].filter(Boolean);
    $('[data-cuenta]').textContent = !filas.length ? 'No hay solicitudes por revisar.'
      : n === filas.length && !con.length ? `${n === 1 ? '1 solicitud por revisar' : `${n} solicitudes por revisar`}${detalle}.`
      : `Se muestran ${n} de ${filas.length} solicitudes (${con.join(' · ')})${detalle}.`;
    rotulaFiltrar();
    guardaFiltros();
  }

  APD.alCambiar(() => { carga().catch(() => {}); });
  carga().catch(() => {
    // El error, sin la lista a medias: la bandeja mostraba el mensaje y además las solicitudes (auditoría «intentar
    // romperlo», F4 A6)
    $('[data-filas]').replaceChildren();
    $('[data-tabla-vacia]').hidden = true;
    $('[data-revisadas]').hidden = true;
    $('[data-cuenta]').textContent = 'No se pudieron cargar las solicitudes. Intente de nuevo más tarde.';
  });
}());
