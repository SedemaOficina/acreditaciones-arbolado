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
  const plural = APD.plural;
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
      ? `Agrupadas por adscripción; primero la de quien tiene la acreditación más próxima a vencer (o ya vencida). Dentro de cada adscripción, por la fecha en que vence, de la más próxima a la más lejana. Quien tiene la acreditación vencida no puede ejercerla mientras espera. Desde los ${alerta} días de espera se marca como prioritaria.`
      : `Agrupadas por adscripción; primero la de quien más espera. Dentro de cada adscripción, de la que más espera a la más reciente; desde los ${alerta} días se marca como prioritaria.`;
    $('[data-leyenda]').textContent = `Personas en espera de grupo de ${nombre.toLowerCase()}`;

    const lista = P.enEspera(datos, tipo, modalidad);
    const prioritarias = lista.filter((x) => x.prioritaria).length;
    $('[data-cuenta]').textContent = lista.length
      ? `${plural(lista.length, 'persona en espera', 'personas en espera')}${prioritarias ? ` · ${plural(prioritarias, 'prioritaria', 'prioritarias')}` : ''}.`
      : 'Nadie espera grupo en este curso.';

    // Encabezado: en renovación, cuándo vence la acreditación que se renueva. La adscripción ya no es columna: es el
    // título de cada bloque
    const columnas = ['Elegir', 'Persona', 'Folio de la solicitud', ...(renov ? ['Vence'] : []), 'Espera'];
    $('[data-encabezado]').replaceChildren(...columnas
      .map((t, i) => el('th', { scope: 'col' }, i === 0 ? [el('span', { class: 'solo-lector', texto: t })] : [document.createTextNode(t)])));

    /* Agrupadas por adscripción (Liber, 2026-10-17): un grupo de una organización se arma con su propia gente, así que
       cada bloque dice cuántas son y si alcanzan para un grupo propio, y permite elegirlas a todas. Los bloques van en
       el orden de quien más espera en cada uno (la lista ya viene así); dentro, el mismo orden. Independientes y
       adscripciones sin organización registrada sólo pueden ir a un grupo combinado. */
    /* Grupos de este curso que reciben personas; si se llegó desde un grupo, sólo ése */
    const pedido = params.get('grupo');
    const receptores = P.grupos(datos).filter((g) => g.g.tipo_acreditacion === tipo && g.g.modalidad === modalidad && g.recibe);
    let destinos = pedido ? receptores.filter((g) => g.g.folio === pedido) : receptores;
    // Desde un grupo de una organización sólo se ve a su gente (auditoría de tareas, M1)
    const soloOrg = destinos.length === 1 && pedido && destinos[0].g.integracion === 'especifico' ? destinos[0].g.organizacion_id : null;
    const deQuien = (g) => (g.g.integracion === 'especifico' ? `sólo ${g.integracion.replace('De una organización · ', '')}` : 'combinado');
    const bloques = [];
    for (const x of lista) {
      if (soloOrg && x.s.organizacion_id !== soloOrg) continue;
      const clave = x.s.organizacion_id || `sin:${x.organizacion}`;
      let b = bloques.find((y) => y.clave === clave);
      if (!b) { b = { clave, nombre: x.organizacion, propia: Boolean(x.s.organizacion_id), xs: [] }; bloques.push(b); }
      b.xs.push(x);
    }
    const filas = [];
    const cuerpos = bloques.map((b, k) => {
      const n = b.xs.length;
      const idT = `adsc-${k}`;
      const todas = el('input', { class: 'casilla-input', type: 'checkbox', 'aria-label': n === 1 ? `Elegir a la persona de ${b.nombre}` : `Elegir a las ${n} personas de ${b.nombre}` });
      const falta = c.cupo_minimo - n;
      const van = n === 1 ? 'va' : 'van';
      // Si la organización ya tiene un grupo que recibe personas, se dice ése y no «alcanza para un grupo propio»
      // (auditoría de tareas, M3: invitaba a crear un segundo grupo)
      const suyo = b.propia ? receptores.find((g) => g.g.integracion === 'especifico' && g.g.organizacion_id === b.clave) : null;
      const faltaSuyo = suyo ? suyo.g.cupo_minimo - suyo.n : 0;
      const situacion = suyo ? estado(`Su grupo ${suyo.g.folio}: ${suyo.n} de ${suyo.g.cupo_maximo}${faltaSuyo > 0 ? `, le ${faltaSuyo === 1 ? 'falta 1' : `faltan ${faltaSuyo}`} para el mínimo` : `, caben ${suyo.lugar}`}`, faltaSuyo > 0 ? 'pend' : 'ok')
        : !b.propia ? el('span', { class: 'texto-gris', texto: `${n === 1 ? 'Va' : 'Van'} a un grupo combinado` })
        : falta <= 0 ? estado('Alcanza para un grupo propio', 'ok')
          : el('span', { class: 'texto-gris', texto: `${falta === 1 ? 'Falta 1' : `Faltan ${falta}`} para un grupo propio de ${c.cupo_minimo}; o ${van} a un grupo combinado` });
      const cabeza = el('tr', { class: 'fila-adscripcion' }, [
        el('td', {}, [el('label', { class: 'elegir' }, [todas])]),
        el('th', { scope: 'rowgroup', colspan: String(columnas.length - 1), id: idT }, [
          el('span', { class: 'adscripcion-nombre', texto: b.nombre }),
          el('span', { class: 'adscripcion-cuenta', texto: plural(n, 'persona', 'personas') }),
          situacion
        ])
      ]);
      const propias = b.xs.map((x) => {
        const quien = APD.nombreCompleto(x.p);
        const casilla = el('input', { class: 'casilla-input', type: 'checkbox', value: x.s.folio, 'aria-label': `Elegir a ${quien}` });
        const espera = `${x.dias === 0 ? 'Hoy' : x.dias === 1 ? '1 día' : `${x.dias} días`}${x.prioritaria ? ' · prioritaria' : ''}`;
        const tr = el('tr', { class: 'fila-persona', 'data-folio': x.s.folio }, [
          el('td', { class: 'celda-elegir' }, [el('label', { class: 'elegir' }, [casilla])]),
          el('td', { texto: quien }),
          el('td', {}, [el('span', { class: 'mono', texto: x.s.folio })]),
          // Vencida: pide atención (prioridad), no es un cierre (auditoría 2026-10-18, D6)
          ...(renov ? [el('td', {}, [x.vence ? estado(`${fecha(x.vence)}${x.vencida ? ' · vencida' : ''}`, x.vencida ? 'pend' : 'marcha') : document.createTextNode('—')])] : []),
          el('td', {}, [estado(espera, x.prioritaria ? 'pend' : 'marcha')])
        ]);
        return { x, tr, casilla };
      });
      filas.push(...propias);
      // La casilla del bloque elige o quita a todas; refleja si están todas, ninguna o algunas
      const refleja = () => {
        const m = propias.filter((f) => f.casilla.checked).length;
        todas.checked = m === n;
        todas.indeterminate = m > 0 && m < n;
      };
      todas.addEventListener('change', () => {
        for (const f of propias) f.casilla.checked = todas.checked;
        propias[0].casilla.dispatchEvent(new Event('change'));
      });
      for (const f of propias) f.casilla.addEventListener('change', refleja);
      return el('tbody', { class: 'bloque-adscripcion', 'aria-labelledby': idT }, [cabeza, ...propias.map((f) => f.tr)]);
    });
    $('[data-filas]').replaceWith(...(cuerpos.length ? cuerpos : [el('tbody', { 'data-filas': '' })]));
    $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));

    if (soloOrg) {
      const nota = el('p', { class: 'texto-gris', texto: `Sólo se muestran las personas de ${deQuien(destinos[0]).replace('sólo ', '')}: el grupo ${pedido} es de esa organización.` });
      $('[data-cuenta]').after(nota);
      $('[data-cuenta]').textContent = filas.length ? `${plural(filas.length, 'persona', 'personas')} de esa organización en espera.` : 'Nadie de esa organización espera grupo en este curso.';
    }
    if (!filas.length) return;
    $('[data-seleccion]').hidden = false;
    const elegidas = () => filas.filter((f) => f.casilla.checked);
    const aviso = $('[data-elegidas]');
    // Barra fija arriba con la cuenta y un enlace a los botones (en teléfono están al final de la lista; auditoría, M4)
    const barra = $('[data-barra-cuenta]');
    const barraIr = $('[data-barra-ir]');
    $('[data-barra]').hidden = false;

    const error = $('[data-error-eleccion]');
    function pintaEleccion() {
      const n = elegidas().length;
      // Cuántas caben, antes de intentar (auditoría de tareas, M4)
      const caben = destinos.length === 1 ? ` · caben ${destinos[0].lugar} en el grupo ${destinos[0].g.folio}` : ` · un grupo recibe hasta ${c.cupo_maximo}`;
      // Sin nadie elegido, se dice qué hacer antes de presionar un botón (auditoría 2026-10-18, D16)
      aviso.textContent = n ? `${plural(n, 'persona elegida', 'personas elegidas')}${caben}.` : 'Ninguna persona elegida: marque la casilla de cada persona que quiere agregar.';
      barra.textContent = n ? `${plural(n, 'elegida', 'elegidas')}` : 'Ninguna elegida';
      barraIr.hidden = !n;
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
    // Un solo botón primario (el primer grupo que recibe personas); texto corto, con el folio sin partir y, si hay varios
    // grupos, de quién es cada uno (auditoría 2026-10-18, D16)
    const acciones = destinos.map((g, i) => {
      const b = el('button', { type: 'button', class: `btn ${i === 0 ? 'btn-primario' : 'btn-secundario'}`, 'aria-describedby': 'espera-elegidas' }, [el('span', {}, [
        document.createTextNode('Agregar al grupo '), el('span', { class: 'sin-corte', texto: g.g.folio }),
        document.createTextNode(` (${destinos.length > 1 ? `${deQuien(g)} · ` : ''}${g.n} de ${g.g.cupo_maximo})`)])]);
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
      const nuevo = el('button', { type: 'button', class: destinos.length ? 'btn btn-secundario' : 'btn btn-primario', 'aria-describedby': 'espera-elegidas', texto: 'Crear un grupo con las elegidas' });
      nuevo.addEventListener('click', () => {
        const eleg = elegidas();
        const mal = problema(eleg, null);
        if (mal) { falla(mal); return; }
        const orgs = [...new Set(eleg.map((f) => f.x.s.organizacion_id || null))];
        if (orgs.length === 1 && orgs[0]) {
          crearCon = { eleg, boton: nuevo };
          $('[data-crear-de]').textContent = `${plural(eleg.length, 'persona elegida', 'personas elegidas')}, todas de ${eleg[0].x.organizacion}. ${nombre}.`;
          $('[data-especifico-de]').textContent = `Sólo de ${eleg[0].x.organizacion}`;
          // Lo que la regla dice antes de elegir (auditoría de tareas, M3): el mínimo y si ya tiene su grupo
          const suyo = receptores.find((g) => g.g.integracion === 'especifico' && g.g.organizacion_id === orgs[0]);
          const avisoEsp = $('[data-especifico-aviso]');
          avisoEsp.textContent = suyo ? `Ya tiene el grupo ${suyo.g.folio} (${suyo.n} de ${suyo.g.cupo_maximo}), que recibe personas: conviene agregarlas ahí.`
            : eleg.length < c.cupo_minimo ? `Son ${eleg.length}: se necesitan ${c.cupo_minimo} de esa organización para confirmarlo. Si no llegan, conviene un grupo combinado.` : '';
          avisoEsp.hidden = !avisoEsp.textContent;
          dialogo.showModal();
          return;
        }
        FormKit.confirma(nuevo, { titulo: `¿Crear un grupo combinado con ${plural(eleg.length, 'persona', 'personas')}?`,
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
