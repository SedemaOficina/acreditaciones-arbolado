/* revision.js · «Solicitudes por revisar» (personal, etapa 2): las solicitudes enviadas, de la que más tiempo
   lleva esperando a la más reciente, con búsqueda por nombre, CURP, folio de la solicitud o número de
   expediente y filtros por acreditación, nueva o renovación y vuelta de revisión.
   Lee los datos ficticios exportados por la base; en la etapa 3 los da la API del personal. */
(function () {
  'use strict';
  const { el, estado, fechaCorta } = APD;
  const P = APD_PERSONAL;
  const form = document.getElementById('filtros');
  const $ = (s) => document.querySelector(s);

  /* Los filtros no se envían: Enter en la búsqueda no hace nada más que filtrar */
  form.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
  FormKit.iniciar(form, {});
  /* Acomodo de escritorio (decisión de Liber del 25/10/2026, DIAGNOSTICO 4.3): pestañas desde 1024 px (app/escritorio.js),
     indicadores arriba y paginación de 25 en 25 */
  APD_ESCRITORIO.pestanas($('[data-pestanas]'));
  const nav = $('[data-paginacion]');
  const POR_PAGINA = 25;
  let pagina = 1;
  nav.addEventListener('formkit:pagina', (e) => { pagina = e.detail.pagina; filtra(false); });

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
        // Una búsqueda o un filtro nuevo regresa a la página 1
        form.addEventListener('input', () => filtra(true));
        form.addEventListener('change', () => filtra(true));
        primera = false;
      }
      filtra(false);
      pintaIndicadores(datos);
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
    /* La espera en la bandeja: «en marcha» hasta UMBRAL.ambar, «te toca actuar» después y, desde UMBRAL.rojo, la misma
       etiqueta en rojo con «N días · atrasada» (decisión 3 a de Liber; auditoría 2026-10-20, C6-04) */
    const plazo = (e) => {
      const etq = estado(e.texto, e.tono || 'marcha');
      if (e.atrasada) etq.setAttribute('data-plazo', 'atrasada');
      return etq;
    };
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
        el('td', { class: 'sin-corte', texto: fechaCorta(s.estado_desde) }),
        el('td', {}, [plazo(e)]),
        el('td', { texto: v.texto }),
        el('td', {}, sen.length ? el('span', { class: 'senales' }, sen.map(([t, tono]) => (tono ? estado(t, tono) : el('span', { texto: t })))) : el('span', { class: 'texto-gris', texto: '—' })),
        el('td', {}, [enlace])
      ]);
      return {
        tr,
        tipo: s.tipo_acreditacion,
        modalidad: s.modalidad,
        vuelta: v.n > 1 ? 'reenviada' : 'primera',
        tono: e.atrasada ? 'atrasada' : e.tono,
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

  function filtra(desdeUno) {
    if (desdeUno) pagina = 1;
    const q = norm(document.getElementById('buscar').value);
    const [tipo, mod, vta] = SELECTS.map((id) => document.getElementById(id).value);
    let n = 0;
    let rojas = 0;
    let ambar = 0;
    const coinciden = [];
    for (const f of filas) {
      const ve = (!q || f.texto.includes(q)) && (!tipo || f.tipo === tipo) && (!mod || f.modalidad === mod) && (!vta || f.vuelta === vta);
      if (ve) { coinciden.push(f); n += 1; if (f.tono === 'atrasada') rojas += 1; else if (f.tono === 'pend') ambar += 1; }
    }
    /* La página: en el mismo orden (la de más espera primero), de 25 en 25 o lo que se elija en «Por página»; la cuenta de
       arriba sigue siendo la de todas las que coinciden */
    const tam = Number(nav.dataset.tamano) || POR_PAGINA;
    pagina = Math.min(Math.max(1, pagina), Math.max(1, Math.ceil(n / tam)));
    const enPagina = new Set(coinciden.slice((pagina - 1) * tam, pagina * tam));
    for (const f of filas) f.tr.hidden = !enPagina.has(f);
    nav.hidden = n <= POR_PAGINA;
    if (FormKit.paginacion) FormKit.paginacion(nav, { total: n, pagina });
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

  /* Indicadores del inicio (escritorio) y cuentas de las pestañas */
  const plural = APD.plural;
  function escribeIndicador(clave, numero, detalle) {
    $(`[data-ind="${clave}"]`).textContent = String(numero);
    $(`[data-ind-detalle="${clave}"]`).textContent = detalle;
  }
  function cuentaPestana(id, n) {
    const t = document.getElementById(id);
    t.textContent = `${t.dataset.pestanaCuenta} (${n})`;
  }
  function pintaIndicadores(datos) {
    const atrasadas = filas.filter((f) => f.tono === 'atrasada').length;
    escribeIndicador('revisar', filas.length, atrasadas ? plural(atrasadas, 'atrasada', 'atrasadas') : 'ninguna atrasada');
    cuentaPestana('pe-solicitudes', filas.length);
    const hoy = APD.hoy(datos);
    const deHoy = P.citas(datos).filter((c) => P.diaDe(c.en) === hoy);
    const porAtender = deHoy.filter((c) => c.pendiente).length;
    escribeIndicador('citas', deHoy.length, porAtender ? `${porAtender} por atender` : 'ninguna por atender');
    const esperas = P.CURSOS.map(([t, m]) => P.enEspera(datos, t, m).length);
    const enEspera = esperas.reduce((a, b) => a + b, 0);
    const cursos = esperas.filter(Boolean).length;
    escribeIndicador('espera', enEspera, cursos ? `en ${plural(cursos, 'curso', 'cursos')}` : 'nadie espera');
  }
  /* Los avisos por teléfono los pinta app/registro-asistido.js: se cuentan sus fichas cada vez que cambia la lista */
  const listaAvisos = $('[data-avisos-lista]');
  const cuentaAvisos = () => {
    if (/^Cargando/.test($('[data-avisos-cuenta]').textContent)) return;
    const n = listaAvisos.hidden ? 0 : listaAvisos.children.length;
    escribeIndicador('avisos', n, n === 1 ? 'pendiente' : 'pendientes');
    cuentaPestana('pe-avisos', n);
  };
  new MutationObserver(cuentaAvisos).observe($('[data-asistido-inicio]'), { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'], characterData: true });

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
