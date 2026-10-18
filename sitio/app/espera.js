/* espera.js · «En espera» de un curso (personal, etapa 2; maqueta aprobada y decisiones del 2026-10-17).
   ?curso=poda-nueva (tipo-modalidad) y, si se llega desde un grupo, ?grupo=APD-G-… para completarlo.
   Las personas en espera de grupo de ese curso, de la que más espera a la más reciente (en renovación, por la fecha en
   que vence su acreditación); se eligen y se agregan a un grupo que recibe personas (en integración o confirmado hasta
   el día anterior al inicio, sin pasar del máximo) o se crea un grupo nuevo con ellas. Un grupo específico sólo admite
   a su organización; uno combinado, cualquier mezcla (decisión 2026-10-17).
   La base vuelve a aplicar todo (apd.inscripcion_alta); en la prueba lo hace app/archivos-prueba.js (aplicaGrupos). */
(function () {
  'use strict';
  const { el, estado, fecha } = APD;
  const P = APD_PERSONAL;
  const $ = (s, r) => (r || document).querySelector(s);
  const plural = (n, uno, varios) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`);
  const params = new URLSearchParams(location.search);

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'grupos');
    const curso = P.deClave(params.get('curso'));
    if (!curso) { $('[data-cuenta]').textContent = 'No se encontró el curso. Vuelva a «Grupos» y elija «Ver la espera».'; return; }
    const [tipo, modalidad] = curso;
    const renov = modalidad === 'renovacion';
    const nombre = P.nombreCurso(tipo, modalidad);
    const c = APD.curso(datos, tipo, modalidad);
    document.title = `En espera · ${nombre} · Personal · Acreditaciones de arbolado urbano`;
    $('#t-espera').textContent = `En espera · ${nombre}`;
    const alerta = APD.parametro(datos, 'dias_alerta_espera');
    $('[data-orden]').textContent = renov
      ? `Por la fecha en que vence su acreditación, de la más próxima (o ya vencida) a la más lejana. Quien tiene la acreditación vencida no puede ejercerla mientras espera. Desde los ${alerta} días de espera se marca como prioritaria.`
      : `De la que más espera a la más reciente; desde los ${alerta} días se marca como prioritaria.`;
    $('[data-leyenda]').textContent = `Personas en espera de grupo de ${nombre.toLowerCase()}`;

    const lista = P.enEspera(datos, tipo, modalidad);
    const prioritarias = lista.filter((x) => x.prioritaria).length;
    $('[data-cuenta]').textContent = lista.length
      ? `${plural(lista.length, 'persona en espera', 'personas en espera')}${prioritarias ? ` · ${plural(prioritarias, 'prioritaria', 'prioritarias')}` : ''}.`
      : 'Nadie espera grupo en este curso.';

    // Encabezado: en renovación, cuándo vence la acreditación que se renueva
    $('[data-encabezado]').replaceChildren(...['Elegir', 'Persona', 'Folio de la solicitud', 'Adscripción', ...(renov ? ['Vence'] : []), 'Espera']
      .map((t, i) => el('th', { scope: 'col' }, i === 0 ? [el('span', { class: 'solo-lector', texto: t })] : [document.createTextNode(t)])));
    const filas = lista.map((x) => {
      const quien = APD.nombreCompleto(x.p);
      const casilla = el('input', { class: 'casilla-input', type: 'checkbox', value: x.s.folio, 'aria-label': `Elegir a ${quien}` });
      const espera = `${x.dias === 0 ? 'Hoy' : x.dias === 1 ? '1 día' : `${x.dias} días`}${x.prioritaria ? ' · prioritaria' : ''}`;
      const tr = el('tr', { 'data-folio': x.s.folio }, [
        el('td', {}, [el('label', { class: 'elegir' }, [casilla])]),
        el('td', { texto: quien }),
        el('td', {}, [el('span', { class: 'mono', texto: x.s.folio })]),
        el('td', { texto: x.organizacion }),
        ...(renov ? [el('td', {}, [x.vence ? estado(`${fecha(x.vence)}${x.vencida ? ' · vencida' : ''}`, x.vencida ? 'error' : 'marcha', x.vencida ? undefined : 'fecha') : document.createTextNode('')])] : []),
        el('td', {}, [estado(espera, x.prioritaria ? 'pend' : 'marcha')])
      ]);
      return { x, tr, casilla };
    });
    $('[data-filas]').replaceChildren(...filas.map((f) => f.tr));
    $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));

    /* Grupos de este curso que reciben personas; si se llegó desde un grupo, sólo ése */
    const pedido = params.get('grupo');
    let destinos = P.grupos(datos).filter((g) => g.g.tipo_acreditacion === tipo && g.g.modalidad === modalidad && g.recibe);
    if (pedido) destinos = destinos.filter((g) => g.g.folio === pedido);
    if (!lista.length) return;
    $('[data-seleccion]').hidden = false;
    const elegidas = () => filas.filter((f) => f.casilla.checked);
    const aviso = $('[data-elegidas]');

    const error = $('[data-error-eleccion]');
    function pintaEleccion() {
      const n = elegidas().length;
      aviso.textContent = n ? `${plural(n, 'persona elegida', 'personas elegidas')}.` : 'Ninguna persona elegida.';
      if (n) { error.hidden = true; for (const x of document.querySelectorAll('.falta-marcar')) x.classList.remove('falta-marcar'); }
    }
    for (const f of filas) f.casilla.addEventListener('change', pintaEleccion);

    /* Comprueba la elección contra un grupo (o contra un grupo nuevo); devuelve el problema [título, texto] o null */
    function problema(eleg, g) {
      if (!eleg.length) return ['No se agregó a nadie', 'Marque la casilla junto al nombre de cada persona que quiere agregar.'];
      const lugar = g ? g.lugar : c.cupo_maximo;
      if (eleg.length > lugar) return ['Eligió más personas de las que caben', `${g ? `El grupo ${g.g.folio}` : 'Un grupo'} tiene lugar para ${plural(lugar, 'persona', 'personas')}; eligió ${eleg.length}.`];
      if (g && g.g.integracion === 'especifico') {
        const fuera = eleg.filter((f) => (f.x.s.organizacion_id || null) !== g.g.organizacion_id);
        if (fuera.length) return [`No se agregó a nadie al grupo ${g.g.folio}`, `Ese grupo es sólo de ${g.integracion.replace('De una organización · ', '')}: ${fuera.map((f) => APD.nombreCompleto(f.x.p)).join(', ')} no ${fuera.length === 1 ? 'es' : 'son'} de esa organización.`];
      }
      return null;
    }
    /* El error queda junto a los botones, con el foco ahí; sin nadie elegido, se señalan las casillas (propuesta «Avisos y
       confirmaciones»: antes el foco saltaba a la primera casilla, lejos del mensaje) */
    function falla([titulo, texto]) {
      if (!elegidas().length) for (const f of filas) f.casilla.closest('.elegir').classList.add('falta-marcar');
      APD.pintaAviso(error, 'error', titulo, texto, true);
    }
    const noSeGuardo = ['No se pudo guardar', 'La elección sigue aquí; intente de nuevo.'];
    const irAlGrupo = (folio, hecho, n) => { location.href = `grupo.html?folio=${encodeURIComponent(folio)}&hecho=${hecho}&n=${n}`; };

    /* Agregar a un grupo que recibe personas */
    const acciones = destinos.map((g) => {
      const b = el('button', { type: 'button', class: 'btn btn-primario', texto: `Agregar al grupo ${g.g.folio} (${g.n} de ${g.g.cupo_maximo})` });
      b.addEventListener('click', () => {
        const eleg = elegidas();
        const mal = problema(eleg, g);
        if (mal) { falla(mal); return; }
        P.guardaGrupo({ tipo: 'agregar', grupo_id: g.g.id, folios: eleg.map((f) => f.x.s.folio), por: P.REVISORA.usuario })
          .then(() => irAlGrupo(g.g.folio, 'agregadas', eleg.length))
          .catch(() => falla(noSeGuardo));
      });
      return b;
    });

    /* Crear un grupo nuevo con las elegidas: si todas son de la misma organización, se pregunta si es específico */
    const dialogo = $('#dlg-crear');
    const formCrear = $('#crear');
    let crearCon = null;
    function crea(integracion, eleg) {
      const folio = P.siguienteFolioGrupo(datos);
      const org = integracion === 'especifico' ? eleg[0].x.s.organizacion_id : null;
      return P.guardaGrupo({ tipo: 'crear', grupo_id: `prueba-grupo:${folio}`, folio, tipo_acreditacion: tipo, modalidad, integracion, organizacion_id: org,
        folios: eleg.map((f) => f.x.s.folio), por: P.REVISORA.usuario }).then(() => irAlGrupo(folio, 'creado', eleg.length));
    }
    if (!pedido) {
      const nuevo = el('button', { type: 'button', class: destinos.length ? 'btn btn-secundario' : 'btn btn-primario', texto: 'Crear un grupo con las elegidas' });
      nuevo.addEventListener('click', () => {
        const eleg = elegidas();
        const mal = problema(eleg, null);
        if (mal) { falla(mal); return; }
        const orgs = [...new Set(eleg.map((f) => f.x.s.organizacion_id || null))];
        if (orgs.length === 1 && orgs[0]) {
          crearCon = { eleg, boton: nuevo };
          $('[data-crear-de]').textContent = `${plural(eleg.length, 'persona elegida', 'personas elegidas')}, todas de ${eleg[0].x.organizacion}. ${nombre}.`;
          $('[data-especifico-de]').textContent = `Sólo de ${eleg[0].x.organizacion}`;
          dialogo.showModal();
          return;
        }
        APD.confirma(nuevo, { titulo: `¿Crear un grupo combinado con ${plural(eleg.length, 'persona', 'personas')}?`,
          consecuencias: [`Es un grupo de ${nombre.toLowerCase()} que recibe personas de cualquier organización e independientes.`,
            `Se crea sin confirmar: se confirma cuando tenga al menos ${c.cupo_minimo} personas, con su fecha, hora de entrada e instructor.`],
          si: 'Sí, crear el grupo' })
          .then((si) => { if (si) crea('combinado', eleg).catch(() => falla(noSeGuardo)); });
      });
      acciones.push(nuevo);
    }
    $('[data-destinos]').replaceChildren(...acciones);
    if (pedido && !destinos.length) {
      $('[data-destinos]').replaceChildren(el('p', { class: 'texto-gris', texto: `El grupo ${pedido} ya no recibe personas (está lleno, ya empezó o se cerró).` }));
    }

    const instCrear = FormKit.iniciar(formCrear, {
      enviar(payload) { return crea(payload.datos.integracion, crearCon.eleg); },
      alFallar(err) { const a = $('[data-estado-envio] .aviso-texto', formCrear); if (err && err.mensaje && a) a.textContent = err.mensaje; }
    });
    dialogo.addEventListener('close', () => { formCrear.reset(); instCrear.ctx.limpia('integracion'); if (crearCon && crearCon.boton.isConnected) crearCon.boton.focus(); });
    pintaEleccion();
  }).catch(() => {
    $('[data-cuenta]').textContent = 'No se pudo cargar la espera. Intente de nuevo más tarde.';
  });
}());
