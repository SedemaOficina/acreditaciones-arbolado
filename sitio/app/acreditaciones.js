/* acreditaciones.js · «Acreditaciones» (personal; sesión de trabajo del 23/10/2026): las reposiciones de credencial por
   atender (P140) y la consulta del padrón, para abrir la ficha de una acreditación y cancelarla (P120) o atender su
   reposición. Lee los datos ficticios y lo registrado en la prueba (APD.cargar); en la etapa 3 los da la API del personal.
   El perfil de la prueba llega en ?perfil= y pasa a la ficha. */
(function () {
  'use strict';
  const { el, estado } = APD;
  const P = APD_PERSONAL;
  const form = document.getElementById('filtros');
  const $ = (s) => document.querySelector(s);
  const perfil = P.perfilDePrueba();
  const ficha = (numero) => `acreditacion.html?numero=${encodeURIComponent(numero)}${perfil !== 'revision_cotejo' ? `&perfil=${perfil}` : ''}`;

  /* La búsqueda no se envía: Enter sólo filtra */
  form.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); filtra(true); }, true);
  FormKit.iniciar(form, {});
  const norm = APD.normalizaBusqueda;
  let filas = [];

  function filtra(anuncia) {
    const q = norm(document.getElementById('buscar').value);
    let n = 0;
    for (const f of filas) { const ve = !q || f.clave.includes(q); f.tr.hidden = !ve; if (ve) n += 1; }
    const tabla = $('[data-acreditaciones-tabla]');
    tabla.querySelector('[data-tabla-vacia]').hidden = n > 0;
    const texto = q ? `${APD.plural(n, 'acreditación coincide', 'acreditaciones coinciden')} con la búsqueda.` : `${APD.plural(filas.length, 'acreditación', 'acreditaciones')} en el padrón.`;
    APD.escribe($('[data-cuenta]'), texto);
    if (anuncia && FormKit.anuncia) FormKit.anuncia(texto);
    tabla.dispatchEvent(new CustomEvent('formkit:tabla'));
  }
  let espera = 0;
  document.getElementById('buscar').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => filtra(true), 350); });

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'acreditaciones', perfil);
    const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    const porId = Object.fromEntries(datos.acreditacion.map((a) => [a.id, a]));

    /* Reposiciones abiertas, primero las que esperan al personal (acta por revisar y por entregar), las más antiguas antes */
    const abiertas = (datos.reposicion || []).filter((r) => APD.REPOSICION_ABIERTA.includes(r.estado) && porId[r.acreditacion_id])
      .sort((x, y) => Number(x.estado === 'con_observaciones') - Number(y.estado === 'con_observaciones') || String(x.solicitada_en).localeCompare(String(y.solicitada_en)));
    const filasR = abiertas.map((r) => {
      const a = porId[r.acreditacion_id];
      const quien = APD.nombreCompleto(persona[a.solicitante_id] || {});
      const verbo = r.estado === 'solicitada' ? 'Revisar el acta' : r.estado === 'acta_aceptada' ? 'Entregar' : 'Ver';
      return el('tr', { 'data-numero': a.numero }, [
        el('td', { texto: quien }),
        el('td', {}, [el('span', { class: 'mono', texto: a.numero })]),
        el('td', { texto: APD.fechaCorta(r.solicitada_en) }),
        el('td', {}, [APD.estadoReposicion(r, true)]),
        el('td', {}, [el('a', { class: 'btn btn-secundario btn-chico', href: ficha(a.numero), 'aria-label': `${verbo}: reposición de la credencial de ${quien}`, texto: verbo })])
      ]);
    });
    $('[data-filas-reposiciones]').replaceChildren(...filasR);
    const tablaR = $('[data-reposiciones-tabla]');
    tablaR.querySelector('[data-tabla-vacia]').hidden = filasR.length > 0;
    $('[data-cuenta-reposiciones]').textContent = filasR.length
      ? `${APD.plural(abiertas.filter((r) => r.estado !== 'con_observaciones').length, 'espera', 'esperan')} a la Secretaría; ${APD.plural(abiertas.filter((r) => r.estado === 'con_observaciones').length, 'espera', 'esperan')} el acta corregida.`
      : 'No hay reposiciones por atender.';
    tablaR.dispatchEvent(new CustomEvent('formkit:tabla'));

    /* El padrón, por número */
    filas = datos.acreditacion.slice().sort((x, y) => x.numero.localeCompare(y.numero)).map((a) => {
      const p = persona[a.solicitante_id] || {};
      const v = APD.vigencia(APD.situacion(datos, a), { personal: true });
      const quien = APD.nombreCompleto(p);
      const tr = el('tr', { 'data-numero': a.numero }, [
        el('td', {}, [el('span', { class: 'mono', texto: a.numero })]),
        el('td', { texto: quien }),
        el('td', { texto: APD.TIPOS[a.tipo_acreditacion] }),
        el('td', {}, [estado(v.texto, v.tono)]),
        el('td', {}, [el('a', { class: 'btn btn-secundario btn-chico', href: ficha(a.numero), 'aria-label': `Ver la acreditación ${a.numero} de ${quien}`, texto: 'Ver' })])
      ]);
      return { tr, clave: norm(`${a.numero} ${a.numero.replace(/-/g, '')} ${quien} ${p.curp || ''}`) };
    });
    $('[data-filas]').replaceChildren(...filas.map((f) => f.tr));
    filtra(false);
  }).catch(() => { $('[data-cuenta]').textContent = 'No se pudieron cargar las acreditaciones. Intente de nuevo más tarde.'; });
}());
