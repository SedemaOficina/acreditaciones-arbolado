/* asistencia.js · «Asistencia» (instructor, etapa 2). ?folio=APD-G-… opcional; ?dia=N para corregir un día anterior.
   Propuesta A, elegida por Liber el 2026-10-18: una sola lista, la del día. Por persona: su fotografía, su nombre, una
   tira de marcas hasta el día en pantalla (asistió, faltó, sin marcar, sin capturar) y «¿Asistió?» Sí/No (opción corta del estándar, decisión 4 a del 20/10).
   La etiqueta sólo aparece cuando hay riesgo («Ya no puede faltar», «Sin derecho a examen»); abajo, una línea con lo
   marcado y «Guardar». Corregir otro día es la excepción: va en «Corregir otro día». La vista de todos los días está en la
   ficha del grupo (P.pintaConcentrado).
   Sin folio, el grupo en curso del instructor (si tiene varios, los lista). Los días que ya pasaron se capturan y se
   pueden corregir mientras el curso siga; los que no han ocurrido no se capturan (como la base, apd.asistencia_captura).
   El último día es el del examen: su asistencia se registra al pasar lista en el salón de cómputo («Aplicar el examen»),
   no aquí (P94). No se guarda un día con alguien sin marcar. Asistencia mínima del curso: R33 y R35.
   ACCESO SIMULADO: perfil ficticio «instructor» (P27). En la prueba se guarda en «apd.personal.grupos»; un día que aún no
   llega (sólo la prueba lo permite) va marcado «simulada», porque la base lo rechaza (dia_futuro; auditoría C 3.4). */
(function () {
  'use strict';
  const { el, estado, fechaLarga, fechaCorta } = APD;
  const P = APD_PERSONAL;
  const G = window.APD_EXAMEN_GRUPO;
  const $ = (s, r) => (r || document).querySelector(s);
  const plural = APD.plural;
  const params = new URLSearchParams(location.search);
  /* Fechas (decisión 16 b, 20/10/2026): el día del curso en el título y en los avisos, con fecha larga («martes 13 de
     octubre de 2026»); en las listas y los enlaces de días, dd/mm/aaaa. Sin «13/10» sin año (C5-01). */

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'asistencia', 'instructor');
    const hoy = APD.hoy(datos);
    const enCurso = datos.grupo.filter((g) => g.estado === 'en_curso');
    const pedido = params.get('folio');
    // El personal de grupos llega con ?folio; el instructor, a «Mis grupos de hoy» (propuesta D, 2026-10-18): con un solo
    // grupo con clase o examen hoy entra directo; con varios, los elige por su nombre calculado
    const misDeHoy = P.gruposDeHoy(datos, P.INSTRUCTORA.usuario);
    // Si el único grupo de hoy tiene hoy su examen, no se entra directo a corregir un día anterior: se muestra «Mis grupos
    // de hoy», con «Pasar lista y aplicar» (auditoría «intentar romperlo», F3 M9)
    const unico = misDeHoy.length === 1 && !(P.diaDelCurso(datos, misDeHoy[0]) || {}).examen ? misDeHoy[0] : null;
    // El instructor sólo abre y opera sus propios grupos, también con ?folio= (decisión 12 de la auditoría del 2026-10-19,
    // Liber; E1-01). En el SIA, la API lo vuelve a comparar con la cuenta de la sesión.
    const gPedido = pedido ? enCurso.find((g) => g.folio === pedido) : null;
    const ajeno = Boolean(gPedido) && gPedido.instructor !== P.INSTRUCTORA.usuario;
    const g0 = pedido ? (ajeno ? null : gPedido) : unico;
    if (!g0) {
      $('[data-sin-grupo]').hidden = false;
      if (ajeno) {
        $('#t-mis-grupos').textContent = 'Asistencia';
        $('[data-sin-grupo-texto]').textContent = `Este grupo lo da otra persona: sólo puede pasar asistencia en sus grupos. Hoy, ${fechaLarga(hoy)}, ${misDeHoy.length ? `tiene ${plural(misDeHoy.length, 'grupo', 'grupos')}:` : 'no tiene grupos con clase ni examen.'}`;
        P.pintaMisGrupos($('[data-mis-grupos]'), datos, P.INSTRUCTORA.usuario);
        return;
      }
      if (pedido) {
        $('#t-mis-grupos').textContent = 'Asistencia';
        $('[data-sin-grupo-texto]').textContent = `El grupo ${pedido} no está en curso: la asistencia se captura sólo mientras el curso está en marcha.`;
        return;
      }
      $('[data-sin-grupo-texto]').textContent = misDeHoy.length ? `Hoy, ${fechaLarga(hoy)}, tiene ${plural(misDeHoy.length, 'grupo', 'grupos')}. Elija el grupo:` : `Hoy, ${fechaLarga(hoy)}, no tiene grupos con clase ni examen.`;
      P.pintaMisGrupos($('[data-mis-grupos]'), datos, P.INSTRUCTORA.usuario);
      return;
    }
    const x = P.grupo(datos, g0);
    const { g, c } = x;
    $('[data-con-grupo]').hidden = false;
    document.title = `Asistencia · ${x.calculado} · ${g.folio} · Personal · Acreditaciones de arbolado urbano`;
    const permitidas = c.dias_duracion - c.dias_minimos_asistencia;
    const ultimoDia = c.dias_duracion;
    // El grupo por su nombre calculado y su folio en chico (propuesta D, 2026-10-18)
    $('[data-bajada]').replaceChildren(APD.grupoTitulo(g, datos), APD.lineaDatos([x.nombre,
      `del ${fechaCorta(g.fecha_inicio)} al ${fechaCorta(x.ultimo)}`, plural(x.n, 'persona', 'personas')], 'grupo-bajada-datos'));
    $('[data-regla]').textContent = permitidas > 0
      ? `Para el examen se necesitan ${c.dias_minimos_asistencia} de ${c.dias_duracion} días: cada persona puede faltar ${permitidas === 1 ? '1' : permitidas}.`
      : `Para el examen se necesita asistir ${c.dias_duracion === 1 ? 'al día del curso' : `los ${c.dias_duracion} días`}.`;

    /* Personas del grupo, con su fotografía para reconocerlas */
    const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    const sols = Object.fromEntries(datos.solicitud.map((s) => [s.id, s]));
    const personas = x.inscritas.map((i) => {
      const s = sols[i.solicitud_id] || {};
      const p = persona[s.solicitante_id] || {};
      return { i, s, p, quien: APD.nombreCompleto(p) };
    }).sort((a, b) => a.quien.localeCompare(b.quien, 'es'));
    const capturada = (insId, dia) => { const a = datos.asistencia.find((r) => r.inscripcion_id === insId && r.dia === dia); return a ? a.asistio : null; };
    // Quien ya tiene su calificación registrada ya no cambia su asistencia: la base lo rechaza (asistencia_cerrada; F3 M8)
    const cerrada = (f) => (datos.examen || []).some((x) => x.inscripcion_id === f.i.id);

    /* Días: se capturan del primero al penúltimo, sólo los que ya ocurrieron. Sin ?dia, el de hoy */
    const diaDe = (n) => APD.sumaDias(g.fecha_inicio, n - 1);
    // Versión de prueba (hay fecha simulada): se puede recorrer el curso completo, también los días que aún no llegan
    // (pedido de Liber, 2026-10-18). En el SIA sólo se capturan los días ya ocurridos.
    const prueba = Boolean(datos.fecha_corte);
    const capturables = [];
    for (let n = 1; n < ultimoDia; n++) if (diaDe(n) <= hoy || prueba) capturables.push(n);
    const listo = (n) => personas.length && personas.every((f) => capturada(f.i.id, n) !== null);
    const deHoy = capturables.find((n) => diaDe(n) === hoy) || null;
    const pedidoDia = Number(params.get('dia'));
    const pendiente = capturables.find((n) => diaDe(n) <= hoy && !listo(n));
    const dia = capturables.includes(pedidoDia) ? pedidoDia : deHoy || pendiente || capturables[capturables.length - 1] || null;
    const examenHoy = diaDe(ultimoDia) === hoy;

    /* Días anteriores sin capturar: la base los cuenta como falta (auditoría de tareas, A1) */
    const sinCapturar = capturables.filter((n) => diaDe(n) < hoy && !listo(n) && n !== dia);
    const avisos = [];
    if (sinCapturar.length) {
      const dias = sinCapturar.map((n) => `${n} (${fechaLarga(diaDe(n))})`);
      const lista = dias.length > 1 ? `los días ${dias.slice(0, -1).join(', ')} y ${dias[dias.length - 1]}` : `el día ${dias[0]}`;
      // Es un estado de la página, no una alerta (auditoría 2026-10-20, RI-09): se ve igual, pero sin role="alert", que lo
      // hacía sonar en cada carga y cortaba la confirmación «Asistencia del día N guardada». FormKit.aviso da el rol por el
      // tono y no tiene uno de bloqueo sin anuncio (nota del revisor independiente sobre el estándar, informe-ri, sección 4).
      // Con un enlace a cada día que falta (auditoría 2026-10-20, C1-05): «Corregir otro día» queda plegado y abajo
      const enlaces = sinCapturar.flatMap((n, i) => [i ? document.createTextNode(' · ') : null,
        el('a', { href: `asistencia.html?folio=${encodeURIComponent(g.folio)}&dia=${n}`, texto: `Capturar el día ${n} (${fechaLarga(diaDe(n))})` })]).filter(Boolean);
      const falta = FormKit.aviso(el('div', { class: 'aviso' }), { tono: 'bloqueo', titulo: `Falta capturar ${lista}`,
        texto: el('p', {}, [document.createTextNode('Un día sin capturar cuenta como falta para todas las personas del grupo: podrían quedarse sin derecho a examen. '), ...enlaces]) });
      falta.removeAttribute('role');
      avisos.push(falta);
    }
    $('[data-avisos]').replaceChildren(...avisos);
    if (examenHoy) {
      $('[data-ultimo-dia]').hidden = false;
      $('[data-ultimo-dia]').textContent = 'Hoy es el examen: la asistencia de hoy se registra al pasar lista en el salón de cómputo, en «Aplicar el examen».';
    }

    /* Corregir otro día: los días ya ocurridos, salvo el que está en pantalla */
    const otros = capturables.filter((n) => n !== dia && diaDe(n) <= hoy);
    $('[data-otro-dia]').hidden = !otros.length;
    $('[data-dias]').replaceChildren(...otros.map((n) => el('li', {}, [
      el('a', { href: `asistencia.html?folio=${encodeURIComponent(g.folio)}&dia=${n}`, texto: `Día ${n} · ${fechaCorta(diaDe(n))}` }),
      document.createTextNode(listo(n) ? ' · capturado' : ' · sin capturar')
    ])));
    if (dia && dia !== deHoy && deHoy) {
      $('[data-dias]').prepend(el('li', {}, [el('a', { href: `asistencia.html?folio=${encodeURIComponent(g.folio)}`, texto: `Volver al día de hoy (día ${deHoy})` })]));
    }

    /* Versión de prueba: recorrer todos los días del curso, el examen incluido */
    if (prueba) {
      const enlaces = [];
      for (let n = 1; n <= ultimoDia; n++) {
        const examen = n === ultimoDia;
        const texto = `Día ${n} · ${fechaCorta(diaDe(n))}${examen ? ' · examen' : listo(n) ? ' · capturado' : ''}`;
        const href = examen ? `aplicar.html?folio=${encodeURIComponent(g.folio)}` : `asistencia.html?folio=${encodeURIComponent(g.folio)}&dia=${n}`;
        enlaces.push(n === dia ? el('strong', { 'aria-current': 'page', texto }) : el('a', { href, texto }));
      }
      $('[data-recorrido]').hidden = false;
      $('[data-recorrido-dias]').replaceChildren(...enlaces.flatMap((e, i) => (i ? [document.createTextNode(' · '), e] : [e])));
    }

    /* Hecho: aviso tras guardar */
    if (params.get('hecho') === 'asistencia' && dia) {
      // En la prueba, guardar lleva al día siguiente (?guardado = el día que se guardó); en el SIA se queda en el día
      const n = Number(params.get('guardado') || params.get('dia'));
      const asistieron = personas.filter((f) => capturada(f.i.id, n) === true).length;
      // «(simulado)» sólo en un día que todavía no llega; al corregir un día anterior se vuelve al de hoy (F3 B1)
      const sigue = n === dia ? (prueba && n === ultimoDia - 1 ? ' Lo que sigue es el examen, el último día.' : '')
        : dia === deHoy ? ` Sigue el día de hoy (día ${dia}).` : diaDe(dia) > hoy ? ` Sigue el día ${dia} (simulado).` : ` Sigue el día ${dia}.`;
      const noEntraron = Number(params.get('cerradas')) || 0;
      APD.pintaAviso($('[data-hecho]'), 'ok', `Asistencia del día ${n} guardada`,
        `${plural(asistieron, 'persona asistió', 'personas asistieron')} y ${plural(personas.length - asistieron, 'faltó', 'faltaron')}. Puede corregirla mientras siga el curso.${sigue}${noEntraron ? ` ${noEntraron === 1 ? 'A 1 persona no se le cambió' : `A ${noEntraron} personas no se les cambió`}: ya presentó el examen.` : ''}`, true);
      if (prueba && n === ultimoDia - 1) {
        $('[data-hecho]').append(el('p', { class: 'nota-prueba' }, [document.createTextNode('Versión de prueba: '),
          el('a', { href: `aplicar.html?folio=${encodeURIComponent(g.folio)}`, texto: `ir a «Aplicar el examen» (día ${ultimoDia})` })]));
      }
      params.delete('hecho');
      params.delete('guardado');
      params.delete('cerradas');
      history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
    }

    if (!dia) {
      $('[data-titulo-dia]').textContent = examenHoy ? `Día ${ultimoDia} de ${ultimoDia} · examen` : 'Todavía no hay días por capturar';
      if (!examenHoy) {
        $('[data-ultimo-dia]').hidden = false;
        $('[data-ultimo-dia]').textContent = `El curso empieza el ${fechaLarga(g.fecha_inicio)}.`;
      }
      $('[data-acciones]').hidden = true;
      return;
    }
    const corrige = dia !== deHoy;
    const futuro = diaDe(dia) > hoy;
    $('[data-titulo-dia]').textContent = `${corrige && !futuro ? 'Corregir el día' : 'Día'} ${dia} de ${ultimoDia} · ${fechaLarga(diaDe(dia))}${futuro ? ' (simulado)' : ''}`;
    $('[data-guardar]').textContent = `Guardar la asistencia del día ${dia}`;

    /* Faltas de la persona con lo marcado ahora en pantalla */
    const marcado = (f) => { const r = document.querySelector(`[data-personas] input[name="a-${CSS.escape(f.i.id)}"]:checked`); return r ? r.value : ''; };
    const faltasDe = (f, hoyMarca) => {
      let faltas = 0;
      for (let n = 1; n < ultimoDia; n++) if (n === dia ? hoyMarca === 'no' : capturada(f.i.id, n) === false) faltas += 1;
      return faltas;
    };
    // La tira llega hasta el día en pantalla (o hasta hoy, si se corrige uno anterior): sin días por venir ni examen
    // (decisión de Liber, 2026-10-18). ✓ verde asistió, ✗ rojo faltó, aro punteado: el día en pantalla sin marcar,
    // «?»: un día anterior sin capturar. Cada marca lleva su texto para el lector de pantalla.
    const hasta = Math.min(ultimoDia - 1, Math.max(dia, capturables.filter((n) => diaDe(n) <= hoy).pop() || 0));
    function marcas(f, hoyMarca) {
      const lista = [];
      const texto = [];
      for (let n = 1; n <= hasta; n++) {
        const v = n === dia ? (hoyMarca === 'si' ? true : hoyMarca === 'no' ? false : null) : capturada(f.i.id, n);
        const [clase, signo, que] = v === true ? ['asis-si', '✓', 'asistió'] : v === false ? ['asis-no', '✗', 'faltó']
          : n === dia ? ['asis-hoy', '', 'sin marcar'] : ['asis-sin', '?', 'sin capturar'];
        lista.push(el('span', { class: `asis-marca ${clase}`, 'aria-hidden': 'true', title: `Día ${n}: ${que}`, texto: signo }));
        texto.push(`día ${n} ${que}`);
      }
      return [...lista, el('span', { class: 'solo-lector', texto: `${texto.join(', ')}.` })];
    }
    function pintaFila(fila, f) {
      // Se lee de la fila: al pintarla por primera vez todavía no está en la página
      const r = fila.querySelector('input:checked');
      const m = r ? r.value : '';
      const faltas = faltasDe(f, m);
      fila.querySelector('[data-marcas]').replaceChildren(...marcas(f, m));
      const riesgo = cerrada(f) ? null : faltas > permitidas ? estado('Sin derecho a examen', 'error') : faltas === permitidas && faltas ? estado('Ya no puede faltar', 'pend') : null;
      fila.querySelector('[data-aviso]').replaceChildren(...(riesgo ? [riesgo] : []));
      pintaTotales();
    }
    function pintaTotales() {
      const marcas = personas.map(marcado);
      const si = marcas.filter((v) => v === 'si').length;
      const no = marcas.filter((v) => v === 'no').length;
      const partes = [`${si} ${si === 1 ? 'asistió' : 'asistieron'}`, `${no} ${no === 1 ? 'faltó' : 'faltaron'}`];
      if (personas.length - si - no) partes.push(`${personas.length - si - no} sin marcar`);
      $('[data-totales]').textContent = partes.join(' · ');
      return partes.join(' · ');
    }

    $('[data-personas]').replaceChildren(...personas.map((f) => {
      const valor = capturada(f.i.id, dia);
      const nombre = `a-${f.i.id}`;
      const fija = cerrada(f);
      // «¿Asistió?» Sí/No: la opción corta del estándar (módulo opciones), con su palomita (decisión 4 a, C6-09)
      const opcion = (v, etq) => el('label', { class: 'opcion opcion-corta' }, [
        el('input', { class: 'opcion-input', type: 'radio', name: nombre, value: v, autocomplete: 'off', checked: valor === (v === 'si'), disabled: fija }),
        el('span', { class: 'opcion-nombre' }, [APD.icono('palomita', 'icono opcion-marca'), document.createTextNode(etq)])]);
      const foto = el('img', { class: 'asistencia-foto', alt: `Fotografía de ${f.quien}`, src: 'data:,' });
      G.fotoDe(f.p.curp, f.quien).then((url) => { foto.src = url; });
      const fila = el('div', { class: 'asistencia-fila', 'data-ins': f.i.id }, [
        foto,
        el('div', { class: 'asis-quien' }, [
          el('p', { class: 'asis-nombre', texto: f.quien }),
          // La etiqueta de riesgo va en el mismo renglón que la tira, para no alargar la fila (pedido de Liber, 2026-10-18)
          el('p', { class: 'asis-historia' }, [el('span', { class: 'asis-marcas', 'data-marcas': '' }), el('span', { class: 'asis-riesgo', 'data-aviso': '' })]),
          fija ? el('p', { class: 'asis-cerrada', texto: 'Ya presentó el examen: su asistencia ya no cambia.' }) : null
        ]),
        el('fieldset', { class: 'asis-opciones' }, [
          el('legend', { class: 'asis-pregunta' }, [el('span', { class: 'solo-lector', texto: `${f.quien}, día ${dia}: ` }), document.createTextNode('¿Asistió?')]),
          el('div', { class: 'opciones-cortas' }, [opcion('si', 'Sí'), opcion('no', 'No')])
        ])
      ]);
      pintaFila(fila, f);
      // Lo que se marca cambia la tira y la etiqueta al momento
      // Los totales se ven siempre, pero se anuncian sólo cuando la persona marca a alguien (B4-03): al cargar un día nuevo
      // no suenan «0 asistieron…» encima de la confirmación de lo guardado; «Todas asistieron» dice lo suyo (nombre del botón: decisión de Liber del 21/10)
      fila.addEventListener('change', (e) => { pintaFila(fila, f); if (e.isTrusted) { sinGuardar = true; FormKit.anuncia(pintaTotales()); } });
      return fila;
    }));
    pintaTotales();

    /* Recargar o salir con marcas sin guardar las pierde: el navegador lo advierte (auditoría 2026-10-18, B9) */
    let sinGuardar = false;
    window.addEventListener('beforeunload', (e) => { if (sinGuardar) { e.preventDefault(); e.returnValue = ''; } });

    $('[data-todas]').addEventListener('click', () => {
      sinGuardar = true;
      for (const r of document.querySelectorAll('[data-personas] input[value="si"]:not(:disabled)')) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      for (const f of document.querySelectorAll('.falta-marcar')) f.classList.remove('falta-marcar');
      // Lo que antes sólo oía el lector de pantalla también se ve (hallazgo P117)
      APD.pintaAviso($('[data-falta-marcar]'), 'info', `${plural(personas.length, 'persona marcada', 'personas marcadas')} con «Sí»`, 'Cambie a «No» a quien no vino y guarde.');
    });
    $('[data-guardar]').addEventListener('click', () => {
      const lista = {};
      const sinMarcar = [];
      let cerradas = 0;
      for (const f of personas) {
        const v = marcado(f);
        // Quien ya presentó el examen no va en la lista: la base no lo cambiaría (asistencia_cerrada)
        if (cerrada(f)) { if (v && (v === 'si') !== capturada(f.i.id, dia)) cerradas += 1; continue; }
        if (v) lista[f.i.id] = v === 'si'; else sinMarcar.push(f);
      }
      const aviso = $('[data-falta-marcar]');
      for (const f of document.querySelectorAll('.falta-marcar')) f.classList.remove('falta-marcar');
      if (sinMarcar.length) {
        // El error queda junto al botón, con el foco ahí, y cada persona sin marcar se señala en su fila
        for (const f of sinMarcar) { const fila = document.querySelector(`[data-ins="${CSS.escape(f.i.id)}"]`); if (fila) fila.classList.add('falta-marcar'); }
        APD.pintaAviso(aviso, 'error', 'No se guardó la asistencia',
          `Falta marcar a ${sinMarcar.length === 1 ? sinMarcar[0].quien : `${sinMarcar.length} personas, señaladas en rojo`}. Marque «Sí» o «No» a cada una.`, true);
        return;
      }
      // Deshabilitado mientras guarda: un doble clic no guarda dos veces (auditoría «intentar romperlo», bloque 2)
      const libera = APD.ocupa($('[data-guardar]'));
      if (!libera) return;
      // Un día que aún no llega sólo se captura en la prueba: va marcado «simulada» (C 3.4)
      P.guardaGrupo(Object.assign({ tipo: 'asistencia', grupo_id: g.id, dia, lista, por: P.INSTRUCTORA.usuario }, futuro ? { simulada: true, fecha_dia: diaDe(dia) } : {})).then(() => {
        sinGuardar = false;
        // Versión de prueba: pasa al día siguiente del curso (el examen no se captura aquí). En el SIA se queda en el
        // día: los días que no han pasado no se capturan (decisión de Liber, 2026-10-18)
        // Al corregir un día anterior a hoy se vuelve al de hoy (F3 B1)
        const extra = cerradas ? `&cerradas=${cerradas}` : '';
        if (diaDe(dia) < hoy && deHoy) { location.href = `asistencia.html?folio=${encodeURIComponent(g.folio)}&hecho=asistencia&guardado=${dia}${extra}`; return; }
        const siguiente = prueba && dia + 1 < ultimoDia ? dia + 1 : dia;
        location.href = `asistencia.html?folio=${encodeURIComponent(g.folio)}&dia=${siguiente}&hecho=asistencia&guardado=${dia}${extra}`;
      }).catch(() => {
        libera();
        APD.pintaAviso(aviso, 'error', 'No se pudo guardar la asistencia', 'Lo marcado sigue aquí; intente de nuevo.', true);
      });
    });
  }).catch(() => {
    $('[data-sin-grupo]').hidden = false;
    $('[data-sin-grupo-texto]').textContent = 'No se pudo cargar la asistencia. Intente de nuevo más tarde.';
  });
}());
