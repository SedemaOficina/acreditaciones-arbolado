/* asistencia.js · «Asistencia» (instructor, etapa 2; maqueta aprobada el 2026-10-17). ?folio=APD-G-… opcional.
   Sin folio, el grupo en curso del instructor (si tiene varios, los lista). Un botón por día del curso: los días que
   ya pasaron se capturan y se pueden corregir mientras el curso siga; los que no han ocurrido no se capturan (como la
   base, apd.asistencia_captura). El último día es el del examen: su asistencia se registra al pasar lista en el salón
   de cómputo («Aplicar el examen»), no aquí, para no capturarla dos veces (P94, por decidir; opción recomendada).
   Cada persona se marca «Asistió» o «Faltó»; no se guarda un día con alguien sin marcar. Con las faltas que lleva, la
   página avisa a quién ya no le alcanza para el examen (asistencia mínima del curso, R33 y R35).
   ACCESO SIMULADO: perfil ficticio «instructor» (P27). En la prueba se guarda en «apd.personal.grupos». */
(function () {
  'use strict';
  const { el, estado, fecha } = APD;
  const P = APD_PERSONAL;
  const G = window.APD_EXAMEN_GRUPO;
  const $ = (s, r) => (r || document).querySelector(s);
  const plural = (n, uno, varios) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`);
  const params = new URLSearchParams(location.search);
  const corta = (iso) => fecha(iso).slice(0, 5);

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'asistencia', 'instructor');
    const hoy = APD.hoy(datos);
    const enCurso = datos.grupo.filter((g) => g.estado === 'en_curso');
    const pedido = params.get('folio');
    // El personal de grupos llega con ?folio; el instructor, a sus grupos en curso
    const mios = enCurso.filter((g) => g.instructor === P.INSTRUCTORA.usuario);
    const g0 = pedido ? enCurso.find((g) => g.folio === pedido) : mios.length === 1 ? mios[0] : null;
    if (!g0) {
      $('[data-sin-grupo]').hidden = false;
      if (pedido) $('[data-sin-grupo-texto]').textContent = `El grupo ${pedido} no está en curso: la asistencia se captura sólo mientras el curso está en marcha.`;
      else if (mios.length > 1) {
        $('[data-sin-grupo-texto]').textContent = 'Elija el grupo:';
        $('[data-mis-grupos]').replaceChildren(...mios.map((g) => el('li', {}, [el('a', { href: `asistencia.html?folio=${encodeURIComponent(g.folio)}`, texto: `${g.folio} · ${P.nombreCurso(g.tipo_acreditacion, g.modalidad)}` })])));
      }
      return;
    }
    const x = P.grupo(datos, g0);
    const { g, c } = x;
    $('[data-con-grupo]').hidden = false;
    document.title = `Asistencia · grupo ${g.folio} · Personal · Acreditaciones de arbolado urbano`;
    $('#t-asistencia').replaceChildren(document.createTextNode('Asistencia · grupo '), el('span', { class: 'mono', texto: g.folio }));
    $('[data-bajada]').textContent = `${x.nombre} · del ${fecha(g.fecha_inicio)} al ${fecha(x.ultimo)} · ${plural(x.n, 'persona', 'personas')} · para el examen se necesitan ${c.dias_minimos_asistencia} de ${c.dias_duracion} días`;
    $('[data-situacion]').replaceChildren(estado(x.situacion.texto, x.situacion.tono));
    const permitidas = c.dias_duracion - c.dias_minimos_asistencia;
    const ultimoDia = c.dias_duracion;
    $('[data-ultimo-dia]').textContent = c.dias_duracion > 1
      ? `El día ${ultimoDia} (${fecha(x.ultimo)}) es el del examen: la asistencia de ese día se registra al pasar lista en el salón de cómputo, en «Aplicar el examen».`
      : `El curso dura un día, el del examen: la asistencia se registra al pasar lista en el salón de cómputo, en «Aplicar el examen».`;

    /* Personas del grupo, con su fotografía para reconocerlas */
    const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    const sols = Object.fromEntries(datos.solicitud.map((s) => [s.id, s]));
    const personas = x.inscritas.map((i) => {
      const s = sols[i.solicitud_id] || {};
      const p = persona[s.solicitante_id] || {};
      return { i, s, p, quien: APD.nombreCompleto(p) };
    }).sort((a, b) => a.quien.localeCompare(b.quien, 'es'));
    const capturada = (insId, dia) => { const a = datos.asistencia.find((r) => r.inscripcion_id === insId && r.dia === dia); return a ? a.asistio : null; };

    /* Días: se capturan del primero al penúltimo, sólo los que ya ocurrieron */
    const diaDe = (n) => APD.sumaDias(g.fecha_inicio, n - 1);
    const capturables = [];
    for (let n = 1; n < ultimoDia; n++) if (diaDe(n) <= hoy) capturables.push(n);
    const pedidoDia = Number(params.get('dia'));
    const pendiente = capturables.find((n) => personas.some((f) => capturada(f.i.id, n) === null));
    let dia = capturables.includes(pedidoDia) ? pedidoDia : (capturables.includes(x.dia) ? x.dia : null) || pendiente || capturables[capturables.length - 1] || null;

    const botones = [];
    for (let n = 1; n <= ultimoDia; n++) {
      const listo = personas.length && personas.every((f) => capturada(f.i.id, n) !== null);
      const futuro = diaDe(n) > hoy;
      const texto = `Día ${n} · ${corta(diaDe(n))}${n === ultimoDia ? ' · examen' : listo ? ' · capturado' : ''}`;
      const b = el('button', { type: 'button', class: 'dia-btn', 'aria-pressed': 'false', texto, disabled: n === ultimoDia || futuro });
      b.addEventListener('click', () => { dia = n; pinta(); b.focus(); });
      botones.push(b);
    }
    $('[data-dias]').replaceChildren(...botones);

    /* Hecho: aviso tras guardar */
    if (params.get('hecho') === 'asistencia' && dia) {
      const n = Number(params.get('dia'));
      const asistieron = personas.filter((f) => capturada(f.i.id, n) === true).length;
      $('[data-hecho] .aviso-texto').textContent = `Asistencia del día ${n} guardada: ${plural(asistieron, 'persona asistió', 'personas asistieron')} y ${plural(personas.length - asistieron, 'faltó', 'faltaron')}.`;
      $('[data-hecho]').hidden = false;
      params.delete('hecho');
      history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
    }

    /* Faltas de la persona: las de los otros días capturados y la del día en pantalla según lo marcado ahora */
    function resumen(f, faltoHoy) {
      const faltas = [];
      for (let n = 1; n < ultimoDia; n++) if ((n === dia ? faltoHoy : capturada(f.i.id, n) === false)) faltas.push(n);
      const lista = faltas.length > 1 ? `${faltas.slice(0, -1).join(', ')} y ${faltas[faltas.length - 1]}` : String(faltas[0]);
      const texto = faltas.length ? `Faltó ${faltas.length === 1 ? `el día ${lista}` : `los días ${lista}`}` : 'Sin faltas';
      if (faltas.length > permitidas) return [texto, estado('Ya no tiene derecho a examen', 'error')];
      if (faltas.length === permitidas && faltas.length) return [texto, estado('Ya no puede faltar otro día', 'pend')];
      return [texto, null];
    }
    function pintaResumen(fila, f) {
      const marcado = fila.querySelector('input:checked');
      const [texto, aviso] = resumen(f, marcado ? marcado.value === 'no' : false);
      fila.querySelector('[data-resumen]').textContent = texto;
      fila.querySelector('[data-aviso]').replaceChildren(...(aviso ? [aviso] : []));
    }

    function pinta() {
      for (const [k, b] of botones.entries()) b.setAttribute('aria-pressed', String(k + 1 === dia));
      $('[data-falta-marcar]').hidden = true;
      if (!dia) {
        $('[data-titulo-dia]').textContent = 'Todavía no hay días por capturar';
        $('[data-ayuda-dia]').textContent = `El curso empieza el ${fecha(g.fecha_inicio)}.`;
        $('[data-personas]').replaceChildren();
        $('[data-acciones]').hidden = true;
        return;
      }
      $('[data-acciones]').hidden = false;
      const yaCapturado = personas.some((f) => capturada(f.i.id, dia) !== null);
      $('[data-titulo-dia]').textContent = `Día ${dia} · ${fecha(diaDe(dia))}`;
      $('[data-ayuda-dia]').textContent = yaCapturado
        ? 'Este día ya se capturó. Si algo cambió, corríjalo y vuelva a guardar.'
        : 'Marque si cada persona asistió o faltó. Todas deben quedar marcadas para guardar.';
      $('[data-guardar]').textContent = `Guardar la asistencia del día ${dia}`;
      $('[data-personas]').replaceChildren(...personas.map((f) => {
        const valor = capturada(f.i.id, dia);
        const nombre = `a-${f.i.id}`;
        const opcion = (v, etq) => el('label', { class: 'opcion-fila' }, [
          el('input', { class: 'opcion-fila-input', type: 'radio', name: nombre, value: v, autocomplete: 'off', checked: valor === (v === 'si') }),
          el('span', {}, [el('span', { class: 'opcion-nombre', texto: etq })])]);
        const foto = el('img', { class: 'asistencia-foto', alt: `Fotografía de ${f.quien}`, src: 'data:,' });
        G.fotoDe(f.p.curp, f.quien).then((url) => { foto.src = url; });
        const fila = el('div', { class: 'asistencia-fila', 'data-ins': f.i.id }, [
          el('div', { class: 'asistencia-quien' }, [foto, el('div', {}, [
            el('p', {}, [el('strong', { texto: f.quien })]),
            el('p', { class: 'texto-gris', 'data-resumen': '' }),
            el('p', { 'data-aviso': '' })])]),
          el('fieldset', { class: 'grupo' }, [
            el('legend', { class: 'solo-lector', texto: `¿${f.quien} asistió el día ${dia}?` }),
            el('div', { class: 'opciones-lista opciones-en-linea' }, [opcion('si', 'Asistió'), opcion('no', 'Faltó')])])
        ]);
        pintaResumen(fila, f);
        // Lo que se marca cambia el aviso al momento (quién ya no puede faltar o ya no tiene derecho a examen)
        fila.addEventListener('change', () => pintaResumen(fila, f));
        return fila;
      }));
    }

    $('[data-todas]').addEventListener('click', () => {
      for (const r of document.querySelectorAll('[data-personas] input[value="si"]')) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      FormKit.anuncia(`${plural(personas.length, 'persona marcada', 'personas marcadas')} «Asistió». Cambie a «Faltó» a quien no vino y guarde.`);
    });
    $('[data-guardar]').addEventListener('click', () => {
      const lista = {};
      const sinMarcar = [];
      for (const f of personas) {
        const r = document.querySelector(`[data-personas] input[name="a-${CSS.escape(f.i.id)}"]:checked`);
        if (r) lista[f.i.id] = r.value === 'si'; else sinMarcar.push(f);
      }
      const aviso = $('[data-falta-marcar]');
      if (sinMarcar.length) {
        $('.aviso-texto', aviso).textContent = `Falta marcar a ${sinMarcar.length === 1 ? sinMarcar[0].quien : `${sinMarcar.length} personas`}. Marque «Asistió» o «Faltó» a cada persona antes de guardar.`;
        aviso.hidden = false;
        const primera = document.querySelector(`[data-personas] input[name="a-${CSS.escape(sinMarcar[0].i.id)}"]`);
        if (primera) primera.focus();
        return;
      }
      P.guardaGrupo({ tipo: 'asistencia', grupo_id: g.id, dia, lista, por: P.INSTRUCTORA.usuario }).then(() => {
        location.href = `asistencia.html?folio=${encodeURIComponent(g.folio)}&dia=${dia}&hecho=asistencia`;
      }).catch(() => {
        $('.aviso-texto', aviso).textContent = 'No se pudo guardar la asistencia. Intente de nuevo.';
        aviso.hidden = false;
      });
    });
    pinta();
  }).catch(() => {
    $('[data-sin-grupo]').hidden = false;
    $('[data-sin-grupo-texto]').textContent = 'No se pudo cargar la asistencia. Intente de nuevo más tarde.';
  });
}());
