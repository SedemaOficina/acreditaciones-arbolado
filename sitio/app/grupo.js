/* grupo.js · Un grupo (personal, etapa 2; maqueta aprobada y decisiones del 2026-10-17). ?folio=APD-G-…
   Situación, cupo, datos del curso y personas inscritas. Según la situación:
     · en integración: agregar personas de la espera, dar de baja o cancelar; la persona instructora la asigna y el grupo
       lo confirma el área de Instructores y Capacitación (perfil «capacitación», ajustes del equipo del 25/10/2026; con el
       mínimo de personas y el primer día al menos dias_anticipacion_grupo días después; la hora de entrada es la del curso,
       curso_hora_entrada, y no se elige: decisión de Liber del 24/10/2026);
     · confirmado: agregar personas hasta el día anterior al inicio (sin pasar del máximo), dar de baja (si queda por
       debajo del mínimo regresa a integración, con su fecha) o cancelar;
     · en curso: asistencia (instructor) y, el último día, el examen; Capacitación puede cambiar la persona instructora;
     · concluido o cancelado: sólo consulta.
   Dar de baja y cancelar piden motivo; las personas regresan a la espera con su antigüedad. La base vuelve a aplicar
   todo (apd.grupo_cambio, apd.inscripcion_alta, apd.inscripcion_cambio); en la prueba, app/archivos-prueba.js. */
(function () {
  'use strict';
  const { el, estado, fechaCorta } = APD;
  const P = APD_PERSONAL;
  const $ = (s, r) => (r || document).querySelector(s);
  const plural = APD.plural;
  const params = new URLSearchParams(location.search);
  // El perfil de la prueba (?perfil=): el de quien arma los grupos o el del área de Instructores y Capacitación (25/10/2026)
  const perfil = P.perfilDePrueba();
  const quien = P.quienEs(perfil);
  // «a, b y c»
  const y = (l) => (l.length < 2 ? l[0] || '' : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`);
  // «Inscrita»: el curso está en marcha, no terminado (auditoría 2026-10-18, D6)
  const ESTADO_SOLICITUD = { inscrita: ['Inscrita', 'marcha'], aprobada: ['Aprobada', 'ok'], acreditada: ['Acreditada', 'ok'], no_acreditada: ['No acreditada', 'error'], sin_derecho_examen: ['Sin derecho a examen', 'error'] };

  /* Aviso de lo que se acaba de hacer (llega en la dirección desde la espera o tras guardar aquí) */
  function avisoHecho() {
    const hecho = params.get('hecho');
    const n = Number(params.get('n')) || 0;
    // [tono, título, texto]: aviso con título e icono (propuesta «Avisos y confirmaciones», 2026-10-17)
    const textos = {
      creado: ['ok', `Grupo creado con ${plural(n, 'persona', 'personas')}`, { texto: 'Todavía no está confirmado.', pasos: [
        'Complete al menos el mínimo de personas.', 'Elija el primer día y el instructor.', 'Confirme el grupo: cada persona ve las fechas en «Mis trámites».'] }],
      // Las que de verdad entraron; las que no, aparte (auditoría «intentar romperlo», F3 M1)
      agregadas: [params.get('no') ? 'pend' : 'ok', `${n === 1 ? 'Se agregó 1 persona' : `Se agregaron ${n} personas`} al grupo`,
        params.get('no') ? `${params.get('no').split(',').length === 1 ? '1 de las que eligió no entró: ya tenía grupo o el grupo se llenó' : `${params.get('no').split(',').length} de las que eligió no entraron: ya tenían grupo o el grupo se llenó`}.` : ''],
      confirmado: ['ok', 'Grupo confirmado', 'Cada persona ya ve en «Mis trámites» las fechas, la hora de entrada y dónde presentarse.'],
      // La persona instructora (ajustes del equipo, 25/10/2026): la asigna o la cambia el área de Instructores y Capacitación
      instructor: ['ok', 'Persona instructora asignada', 'El grupo sigue por confirmar hasta que tenga lo que le falta; la persona instructora ve el grupo en sus próximos.'],
      instructor_cambiado: ['ok', 'Persona instructora cambiada', 'El cambio queda en la bitácora. La persona instructora nueva ve el grupo en «Mis grupos de hoy» o en sus próximos.'],
      // Desde el paso a paso de «Grupos» sin confirmarlo: la semana y el instructor quedan como propuesta
      propuesto: ['pend', 'Se guardaron los cambios del grupo', { texto: `Sigue por confirmar: su semana queda como propuesta${n ? ` y se ${n === 1 ? 'agregó 1 persona' : `agregaron ${n} personas`}` : ''}.`, pasos: [
        'Complete lo que le falte: el mínimo de personas.', 'El área de Instructores y Capacitación le asigna la persona instructora y lo confirma: cada persona ve las fechas en «Mis trámites».'] }],
      baja: ['ok', 'La persona salió del grupo', 'Regresó a la espera con su antigüedad.'],
      baja_integracion: ['pend', 'El grupo dejó de estar confirmado', { texto: 'La persona salió y el grupo quedó por debajo del mínimo. Conserva su fecha, hora y persona instructora como propuesta.', pasos: [
        'Agregue personas hasta completar el mínimo.', 'El área de Instructores y Capacitación vuelve a confirmar el grupo.'] }],
      cancelado: ['info', 'Grupo cancelado', 'Las personas regresaron a la espera con su antigüedad.']
    };
    if (!textos[hecho]) return;
    const [tono, titulo, texto] = textos[hecho];
    // Un texto con sus pasos ({ texto, pasos }) va como la secuencia «Qué sigue» (APD.sigueEn): FormKit.aviso no recibe
    // objetos y escribía «[object Object]» en «Grupo creado» y «El grupo dejó de estar confirmado»
    APD.pintaAviso($('[data-hecho]'), tono, titulo, texto && typeof texto === 'object' ? APD.sigueEn(texto) : texto, true);
    // Que recargar la página no repita el aviso
    params.delete('hecho'); params.delete('n'); params.delete('no');
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
  }
  /* «Personas del grupo» y «Asistencia por día» como pestañas del módulo pestanas del estándar (acomodo de escritorio,
     25/10/2026), sólo si la página se abre en computadora (1024 px o más) y el grupo tiene asistencia (en curso o concluido).
     Son dos vistas de las mismas personas (decisión de Liber del 18/10/2026): cada tabla conserva sus columnas, su leyenda y su
     forma; la pestaña dice su título y el título de cada tabla sigue para el lector de pantalla, para navegar por encabezados.
     Las mismas pestañas de computadora del inicio del personal y de «Grupos» (app/escritorio.js, .pestanas-escritorio y
     .titulo-de-pestana): si la ventana se angosta, se vuelven las dos secciones de siempre, una debajo de otra. Se arman antes
     de FormKit.iniciar, que inicia el módulo. En teléfono y tableta, una debajo de otra, como antes. */
  function armaPestanas() {
    const tituloP = $('#t-personas');
    const tablaP = $('[data-tabla][data-clave="persona"]');
    const bloque = $('[data-concentrado-bloque]');
    const tituloA = $('#t-concentrado');
    const panelP = el('div', { class: 'pestanas-panel', id: 'pp-personas' });
    const panelA = el('div', { class: 'pestanas-panel', id: 'pp-asistencia' });
    const pestanas = el('div', { class: 'pestanas pestanas-escritorio pestanas-ficha', 'data-pestanas': '' }, [
      el('div', { class: 'pestanas-lista', role: 'tablist', 'aria-label': 'Personas y asistencia del grupo' }, [
        el('button', { type: 'button', class: 'pestana', role: 'tab', id: 'pt-personas', 'aria-controls': 'pp-personas', 'aria-selected': 'true', texto: tituloP.textContent }),
        el('button', { type: 'button', class: 'pestana', role: 'tab', id: 'pt-asistencia', 'aria-controls': 'pp-asistencia', 'aria-selected': 'false', tabindex: '-1', texto: tituloA.textContent })
      ]), panelP, panelA]);
    tituloP.before(pestanas);
    panelP.append(tituloP, tablaP);
    panelA.append(bloque);
    for (const t of [tituloP, tituloA]) t.classList.add('titulo-de-pestana');
    APD_ESCRITORIO.pestanas(pestanas);
  }
  const vuelve = (folio, hecho) => { location.href = `${P.fichaGrupo(folio, perfil)}&hecho=${hecho}`; };
  /* Un cambio que la base no aplicó (bloque 2): el aviso del formulario lo dice, con el enlace para ver el grupo como está */
  const noSeHizo = (titulo, motivo) => APD.rechazo(titulo, `${motivo.charAt(0).toLocaleUpperCase('es-MX')}${motivo.slice(1)}. Lo que escribió sigue aquí.`,
    { href: location.pathname.split('/').pop() + location.search, texto: 'Ver el grupo como está ahora' }, 'conflicto');

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), perfil === 'capacitacion' ? 'capacitacion' : 'grupos', perfil);
    // ¿Asigna la persona instructora y confirma grupos? (capacitación y administración, parámetro perfiles_asignan_instructor)
    const asigna = P.asignaInstructor(datos, perfil);
    // Capacitación regresa a su inicio, «Grupos por asignar y confirmar»
    if (perfil === 'capacitacion') { const atras = $('.btn-atras'); atras.href = 'capacitacion.html'; atras.lastChild.textContent = 'Grupos por asignar y confirmar'; }
    const g0 = datos.grupo.find((g) => g.folio === params.get('folio'));
    if (!g0) { $('[data-bajada]').textContent = 'No se encontró el grupo. Vuelva a «Grupos».'; return; }
    avisoHecho();
    const x = P.grupo(datos, g0);
    const { g, c } = x;
    const deAhora = (d) => d.grupo.find((y) => y.id === g.id);
    const hoy = APD.hoy(datos);
    const abierto = ['en_integracion', 'confirmado'].includes(g.estado);
    const antesDeIniciar = g.estado === 'en_integracion' || (g.estado === 'confirmado' && hoy < g.fecha_inicio);
    // Nombre calculado y, debajo, el folio en chico (propuesta D, 2026-10-18): el folio no cambia
    document.title = `${x.calculado} · ${g.folio} · Personal · Acreditaciones de arbolado urbano`;
    $('#t-grupo').replaceChildren(APD.grupoTitulo(g, datos));
    $('[data-bajada]').replaceChildren(APD.lineaDatos([x.nombre, g.integracion === 'especifico' ? `grupo de ${x.integracion.replace('De una organización · ', '')}` : 'grupo combinado', `creado el ${fechaCorta(g.creado_en)}`]));
    $('[data-situacion]').replaceChildren(estado(x.situacion.texto, x.situacion.tono));

    /* Cupo */
    if (g.estado !== 'cancelado') {
      const falta = g.cupo_minimo - x.n;
      $('[data-cupo]').hidden = false;
      // Hasta cuándo recibe y cuántos lugares quedan (auditoría de tareas, M10)
      const hasta = x.recibe && g.estado === 'confirmado' ? ` Recibe personas hasta el ${fechaCorta(APD.sumaDias(g.fecha_inicio, -1))}; ${x.lugar === 1 ? 'queda 1 lugar' : `quedan ${x.lugar} lugares`}.` : '';
      $('[data-cupo-texto]').textContent = `${x.n} de ${g.cupo_maximo} personas.${falta > 0 && abierto ? ` ${falta === 1 ? 'Falta 1' : `Faltan ${falta}`} para el mínimo de ${g.cupo_minimo}.` : ''}${hasta}`;
      $('[data-cupo-lleno]').style.width = `${Math.min(100, Math.round((x.n / g.cupo_maximo) * 100))}%`;
    }

    /* Datos del curso */
    const sede = APD.sede(datos).nombre;
    // Las horas del curso (parámetros curso_hora_entrada y curso_hora_salida, P91): fijas, no se eligen (24/10/2026)
    const horaEntrada = APD.hhmm(APD.parametroTexto(datos, 'curso_hora_entrada') || '09:00');
    const horaSalida = APD.hhmm(APD.parametroTexto(datos, 'curso_hora_salida') || '15:00');
    const hm = (t) => String(t).replace(/^0/, '');
    const pares = [];
    if (g.fecha_inicio) {
      // El último día es de examen o, en el curso de primera vez, de repaso de conocimientos y examen final; la salida es a
      // las 15:00 (sesión de trabajo del 23/10/2026, P91: parámetro curso_hora_salida)
      // La duración, de lunes a viernes (ajustes del equipo, 25/10/2026: duración y quinto día)
      pares.push(['Duración', x.c.dias_duracion > 1 ? `${x.c.dias_duracion} días, de lunes a viernes` : '1 día'],
        ['Primer día', fechaCorta(g.fecha_inicio)], [`Último día (${APD.diaFinal(x.c).toLowerCase()})`, fechaCorta(x.ultimo)],
        ['Hora de entrada', APD.hhmm(g.hora_entrada) || horaEntrada], ['Hora de salida', horaSalida],
        ['Persona instructora', g.instructor ? P.nombreInstructor(g.instructor) : 'Sin asignar: la asigna el área de Instructores y Capacitación'],
        ['Lugar del curso', `Aula de capacitación del ${sede}`], ['Lugar del examen', 'Salón de cómputo del PILARES Vivero Nezahualcóyotl, en el mismo predio']);
      // Texto neutro: la fecha puede venir de «Guardar sin confirmar» o de un grupo que dejó de estar confirmado
      // (auditoría «intentar romperlo», F3 M7)
      if (g.estado === 'en_integracion') pares.unshift(['Propuesta', 'Semana propuesta, todavía sin confirmar: el grupo lo confirma el área de Instructores y Capacitación']);
    }
    if (g.estado === 'cancelado') pares.push(['Motivo de la cancelación', g.motivo_cancelacion || ''], ['Cancelado el', fechaCorta(g.estado_desde)]);
    $('[data-datos]').replaceChildren(pares.length ? APD.datosLista(pares) : '');

    /* Personas */
    const conSituacion = ['en_curso', 'concluido'].includes(g.estado);
    // Dar de baja, agregar personas, cambiar la semana y cancelar son de quien arma los grupos, no del área de Instructores
    // y Capacitación (ajustes del equipo, 25/10/2026)
    const armaGrupos = perfil !== 'capacitacion';
    const puedeBaja = antesDeIniciar && armaGrupos;
    $('[data-encabezado]').replaceChildren(...['Persona', 'Folio de la solicitud', 'Adscripción', 'En el grupo desde', ...(conSituacion ? ['Situación'] : []), ...(puedeBaja ? ['Acción'] : [])]
      .map((t) => el('th', { scope: 'col' }, t === 'Acción' ? [el('span', { class: 'solo-lector', texto: t })] : [document.createTextNode(t)])));
    const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    const sols = Object.fromEntries(datos.solicitud.map((s) => [s.id, s]));
    // Un grupo cancelado muestra a quienes estaban al cancelarse
    const lista = g.estado === 'cancelado'
      ? datos.inscripcion.filter((i) => i.grupo_id === g.id && String(i.motivo_baja || '').startsWith('Grupo cancelado'))
      : x.inscritas;
    let bajaDe = null;
    const filas = lista.map((i) => {
      const s = sols[i.solicitud_id] || {};
      const p = persona[s.solicitante_id] || {};
      const quien = APD.nombreCompleto(p);
      const celdas = [
        el('td', { texto: quien }),
        el('td', {}, [el('span', { class: 'mono', texto: s.folio || '' })]),
        el('td', { texto: P.organizacionDe(datos, s) }),
        el('td', { texto: fechaCorta(i.inscrita_en) })
      ];
      if (conSituacion) {
        // Mientras sigue «inscrita», quien ya pasó de las faltas permitidas se ve sin derecho, como en el concentrado
        // (auditoría 2026-10-20, C4-07)
        const e = s.estado === 'inscrita' && P.sinDerechoPorFaltas(datos, x, i.id) ? ESTADO_SOLICITUD.sin_derecho_examen
          : ESTADO_SOLICITUD[s.estado] || [APD.nombrePersonal(s.estado), (APD.ESTADOS[s.estado] || {}).tono || ''];
        celdas.push(el('td', {}, [estado(e[0], e[1])]));
      }
      if (puedeBaja) {
        const b = el('button', { type: 'button', class: 'btn-enlace sin-corte', 'aria-label': `Dar de baja a ${quien}`, texto: 'Dar de baja' });
        b.addEventListener('click', () => {
          bajaDe = { folio: s.folio, quien, boton: b };
          const queda = x.n - 1;
          $('[data-baja-titulo]').textContent = `¿Dar de baja a ${quien}?`;
          $('[data-baja-de]').replaceChildren(...[`Regresa a la espera con su antigüedad y deja de ver el grupo en «Mis trámites».`,
            g.estado === 'confirmado' && queda < g.cupo_minimo ? `El grupo queda con ${plural(queda, 'persona', 'personas')}, menos del mínimo de ${g.cupo_minimo}: deja de estar confirmado y conserva su fecha como propuesta.` : '']
            .filter(Boolean).map((t) => el('li', { texto: t })));
          $('#dlg-baja').showModal();
        });
        celdas.push(el('td', {}, [b]));
      }
      return el('tr', { 'data-folio': s.folio }, celdas);
    });
    $('[data-filas]').replaceChildren(...filas);
    $('[data-tabla-vacia]').hidden = filas.length > 0;
    $('[data-leyenda]').textContent = g.estado === 'cancelado' ? `Personas que estaban en el grupo ${g.folio} al cancelarse` : `Personas inscritas en el grupo ${g.folio}`;
    $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));
    // Asistencia de conjunto: una columna por día, en curso o concluido (pedido de Liber 2026-10-18)
    $('[data-concentrado-bloque]').hidden = !conSituacion;
    if (conSituacion) P.pintaConcentrado($('[data-concentrado]'), datos, x);
    // Acomodo de escritorio (25/10/2026): en computadora, las dos vistas de las mismas personas como pestañas del estándar
    if (conSituacion && window.matchMedia('(min-width: 1024px)').matches) armaPestanas();
    $('[data-baja-ayuda]').hidden = !puedeBaja;

    /* Acciones del grupo */
    const acciones = [];
    if (!armaGrupos) { /* Capacitación: la persona instructora y la confirmación van abajo */ } else if (x.recibe) {
      // Un grupo de una organización sólo recibe a su gente: se cuenta sólo a ella (auditoría de tareas, M1)
      const propia = g.integracion === 'especifico';
      const org = propia ? x.integracion.replace('De una organización · ', '') : '';
      const espera = P.enEspera(datos, g.tipo_acreditacion, g.modalidad).filter((y) => !propia || y.s.organizacion_id === g.organizacion_id).length;
      // El paso 3 («Quiénes van») del paso a paso de «Grupos», con este grupo (decisión del 24/10/2026, opción B1)
      if (espera) acciones.push(el('a', { class: 'btn btn-secundario', href: `grupos.html?grupo=${encodeURIComponent(g.folio)}&paso=3`,
        texto: propia ? `Agregar personas de ${org} (${espera} en espera)` : `Agregar personas de la espera (${espera} en espera)` }));
      else acciones.push(el('p', { class: 'texto-gris', texto: propia ? `Nadie de ${org} espera grupo en este curso por ahora.` : 'Nadie espera grupo en este curso por ahora.' }));
    } else if (abierto && x.n >= g.cupo_maximo) {
      acciones.push(el('p', { class: 'texto-gris', texto: `El grupo está lleno: ${g.cupo_maximo} personas.` }));
    } else if (g.estado === 'confirmado') {
      acciones.push(el('p', { class: 'texto-gris', texto: 'El curso ya empezó: el grupo no recibe más personas.' }));
    }
    // La semana en el calendario de «Grupos» (paso 2 del paso a paso, con este grupo; decisión del 24/10/2026)
    if (g.estado === 'en_integracion' && armaGrupos) {
      acciones.push(el('a', { class: 'btn btn-secundario', href: `grupos.html?grupo=${encodeURIComponent(g.folio)}&paso=2`, texto: g.fecha_inicio ? 'Cambiar la semana en el calendario' : 'Elegir la semana en el calendario' }));
    }
    if (g.estado === 'en_curso') {
      acciones.push(el('a', { class: 'btn btn-secundario', href: `asistencia.html?folio=${encodeURIComponent(g.folio)}`, texto: 'Ver la asistencia' }));
      if (hoy === x.ultimo) acciones.push(el('a', { class: 'btn btn-secundario', href: `aplicar.html?folio=${encodeURIComponent(g.folio)}`, texto: 'Aplicar el examen' }));
    }
    let cancelar = null;
    if (antesDeIniciar && armaGrupos) {
      cancelar = el('button', { type: 'button', class: 'btn btn-peligro-contorno', texto: 'Cancelar el grupo' });
      cancelar.addEventListener('click', () => {
        $('[data-cancelar-titulo]').textContent = `¿Cancelar el grupo ${g.folio} (${x.calculado})?`;
        $('[data-cancelar-de]').replaceChildren(...[x.n ? `${x.n === 1 ? 'La persona regresa' : `Las ${x.n} personas regresan`} a la espera, con su antigüedad.` : 'El grupo no tiene personas.',
          x.n && g.estado === 'confirmado' ? 'Dejan de ver fechas y sede en «Mis trámites».' : ''].filter(Boolean).map((t) => el('li', { texto: t })));
        $('#dlg-cancelar').showModal();
      });
      acciones.push(cancelar);
    }
    $('[data-acciones]').replaceChildren(...acciones);

    /* Persona instructora y confirmación (ajustes del equipo, 25/10/2026). Las asigna, la cambia (también durante el curso,
       con constancia en la bitácora) y confirma el grupo el área de Instructores y Capacitación (perfiles de
       perfiles_asignan_instructor: capacitación y administración); quien arma los grupos ve aquí lo que le falta al grupo y
       quién lo confirma. Sólo se ofrecen las personas instructoras libres esas fechas (P.ocupado, la regla de choques de
       «Grupos»). La semana la elige quien arma el grupo, en «Grupos»: aquí no se cambia. */
    const enIntegracion = g.estado === 'en_integracion';
    const cambiable = ['confirmado', 'en_curso'].includes(g.estado);
    if (enIntegracion || (cambiable && asigna)) {
      const sec = $('[data-confirmar]');
      sec.hidden = false;
      const form = $('#confirmar');
      const anticipacion = APD.parametro(datos, 'dias_anticipacion_grupo') || 7;
      const minimo = APD.sumaDias(hoy, anticipacion);
      const faltaMin = g.cupo_minimo - x.n;
      const r = g.fecha_inicio ? P.razonNoInicio(datos, g.tipo_acreditacion, g.modalidad, g.fecha_inicio, g.id) : null;
      // Lo que le falta para confirmarse, sin la persona instructora (como la base: datos_para_confirmar, anticipacion,
      // cupo_minimo, curso_en_fin_de_semana, grupos_simultaneos)
      const falta = [];
      if (!g.fecha_inicio) falta.push('la semana, que elige quien arma los grupos en «Grupos»');
      else if (r) falta.push(`otra semana: el ${fechaCorta(g.fecha_inicio)} ya no se puede (${r.texto})`);
      if (faltaMin > 0) falta.push(faltaMin === 1 ? '1 persona más' : `${faltaMin} personas más`);
      const pintaFalta = (texto) => { $('[data-falta]').hidden = !texto; $('[data-falta] .aviso-texto').textContent = texto || ''; };
      if (!asigna) {
        // Quien arma los grupos: lo que le falta y quién lo confirma, sin formulario
        $('[data-confirmar-titulo]').textContent = 'Para confirmar el grupo';
        $('[data-confirmar-bajada]').textContent = 'La persona instructora la asigna y el grupo lo confirma el área de Instructores y Capacitación.';
        pintaFalta(falta.length ? `Le falta: ${y(falta)}. Ningún grupo abre con menos del mínimo.` : g.instructor ? 'Tiene lo necesario: falta que el área de Instructores y Capacitación lo confirme.' : 'Tiene lo que le toca a usted: falta que el área de Instructores y Capacitación le asigne la persona instructora y lo confirme.');
      } else if (enIntegracion && !g.fecha_inicio) {
        $('[data-confirmar-bajada]').textContent = 'Sólo se pueden elegir las personas instructoras libres esas fechas; después se confirma el grupo.';
        pintaFalta(`Este grupo todavía no tiene semana: la elige quien arma los grupos, en «Grupos». Después podrá asignarle la persona instructora y confirmarlo.${faltaMin > 0 ? ` También le ${faltaMin === 1 ? 'falta 1 persona' : `faltan ${faltaMin} personas`} para el mínimo de ${g.cupo_minimo}.` : ''}`);
      } else {
        form.hidden = false;
        const puedeConfirmar = enIntegracion && !falta.length && g.fecha_inicio >= minimo;
        // Las fechas en que da el curso: todo el curso; en curso, de hoy al último día
        const desde = g.estado === 'en_curso' && hoy > g.fecha_inicio ? hoy : g.fecha_inicio;
        const sel = $('#instructor');
        for (const o of sel.options) {
          if (!o.value) continue;
          const otros = P.ocupado(datos, o.value, desde, x.ultimo, g.id);
          // La asignada ahora también dice si tiene otro curso esas fechas (la semana pudo cambiar después de asignarla)
          o.textContent = `${P.nombreInstructor(o.value)}${o.value === g.instructor ? ' · la asignada ahora' : ''}${otros.length ? ' · tiene otro curso esas fechas' : o.value === g.instructor ? '' : ' · libre esas fechas'}`;
          o.disabled = Boolean(otros.length) && o.value !== g.instructor;
        }
        if (g.instructor) sel.value = g.instructor;
        $('[data-horario]').textContent = `Horario: de ${hm(horaEntrada)} a ${hm(horaSalida)}${c.dias_duracion > 1 ? ', de lunes a viernes' : ''}.`;
        $('[data-lugar]').replaceChildren(document.createTextNode('Lugar: aula de capacitación del '), el('strong', { texto: sede }),
          document.createTextNode('; el examen, en el salón de cómputo del PILARES Vivero Nezahualcóyotl, en el mismo predio.'));
        const principal = $('[data-asignar="principal"]');
        const solo = $('[data-asignar="solo"]');
        if (cambiable) {
          $('[data-confirmar-titulo]').textContent = 'Persona instructora';
          $('[data-confirmar-bajada]').textContent = `Puede cambiarla ${g.estado === 'en_curso' ? 'durante el curso' : 'hasta que concluya el curso'}: el cambio queda en la bitácora, y cada día queda quién capturó la asistencia. Sólo se pueden elegir las personas libres esas fechas.`;
          principal.textContent = 'Cambiar la persona instructora';
        } else if (puedeConfirmar) {
          $('[data-confirmar-bajada]').textContent = `Tiene ${plural(x.n, 'persona', 'personas')} y su semana: elija a la persona instructora, libre esas fechas, y confirme el grupo. Al confirmarlo, cada persona ve en «Mis trámites» su grupo, las fechas del curso, la hora de entrada y dónde presentarse.`;
          principal.textContent = g.instructor ? 'Confirmar el grupo' : 'Asignar y confirmar el grupo';
          solo.textContent = g.instructor ? 'Cambiar la persona instructora, sin confirmar' : 'Sólo asignar, sin confirmar';
          solo.hidden = false;
        } else {
          $('[data-confirmar-bajada]').textContent = 'Sólo se pueden elegir las personas instructoras libres esas fechas. El grupo se confirma cuando tenga lo que le falta.';
          principal.textContent = g.instructor ? 'Cambiar la persona instructora' : 'Asignar la persona instructora';
          pintaFalta(`Para confirmarlo le falta: ${y(falta.length ? falta : [`que el curso empiece al menos ${anticipacion} días después de confirmarlo`])}. Mientras, puede asignarle la persona instructora.`);
        }
        let accion = 'principal';
        for (const b of [principal, solo]) b.addEventListener('click', () => { accion = b.dataset.asignar; }, true);
        FormKit.iniciar(form, {
          enviar(payload) {
            const instructor = payload.datos.instructor;
            const confirmar = puedeConfirmar && accion === 'principal';
            if (instructor === g.instructor && !confirmar) return Promise.reject({ errores: [{ campo: 'instructor', mensaje: 'Esa persona ya es la instructora del grupo: elija otra.' }] });
            // Como la API: con lo guardado de ahora (otra pestaña pudo cambiar el grupo) y comprobando después que quedó
            const eventos = [];
            if (instructor !== g.instructor) eventos.push({ tipo: 'instructor', grupo_id: g.id, instructor, perfil, por: quien.usuario });
            if (confirmar) eventos.push({ tipo: 'confirmar', grupo_id: g.id, fecha_inicio: g.fecha_inicio, hora_entrada: horaEntrada, instructor, perfil, por: quien.usuario });
            return P.guardaGrupoComprobado({
              antes: (d1) => {
                const g1 = deAhora(d1);
                if (!g1 || g1.estado !== g.estado) return g1 ? `el grupo ya está «${P.grupo(d1, g1).situacion.texto}»` : 'el grupo ya no existe';
                // Sólo una persona instructora libre esas fechas (también la que ya estaba, si su semana cambió)
                if (P.ocupado(d1, instructor, desde, x.ultimo, g.id).length) return `${P.nombreInstructor(instructor)} ya tiene otro curso esas fechas: elija a otra persona instructora`;
                return confirmar ? P.razonNoConfirma(d1, g1, g.fecha_inicio) : null;
              },
              eventos: () => eventos,
              comprueba: (d2) => {
                const g2 = deAhora(d2);
                if (!g2 || g2.instructor !== instructor) return 'la persona instructora no se guardó';
                return confirmar && g2.estado !== 'confirmado' ? P.razonNoConfirma(d2, g2, g.fecha_inicio) || 'la base no lo confirmó' : null;
              }
            }).then(() => ({ confirmar, cambio: Boolean(g.instructor) && instructor !== g.instructor }))
              .catch((e) => Promise.reject(e && e.motivo ? noSeHizo(confirmar ? 'No se confirmó el grupo' : 'No se guardó la persona instructora', e.motivo) : e));
          },
          alEnviar(r) { vuelve(g.folio, r.confirmar ? 'confirmado' : r.cambio ? 'instructor_cambiado' : 'instructor'); },
          alFallar(err) { if (APD.muestraRechazo(err, form)) return; const a = $('[data-estado-envio] .aviso-texto', form); if (err && err.mensaje && a) a.textContent = err.mensaje; }
        });
      }
    }

    /* Dar de baja y cancelar: formularios del estándar en diálogos, con motivo */
    function dialogoConMotivo(id, alGuardar) {
      const form = $(`#${id}`);
      const dlg = $(`#dlg-${id}`);
      const inst = FormKit.iniciar(form, {
        enviar(payload) { return alGuardar(payload.datos.motivo); },
        alFallar(err) { if (APD.muestraRechazo(err, form)) return; const a = $('[data-estado-envio] .aviso-texto', form); if (err && err.mensaje && a) a.textContent = err.mensaje; }
      });
      dlg.addEventListener('close', () => { form.reset(); inst.ctx.limpia('motivo'); });
      return dlg;
    }
    // Lo mismo que confirmar: se comprueba después que la base lo aplicó (otra pestaña pudo haberla dado de baja o haber
    // cancelado el grupo); si no, se dice y no se anuncia un éxito
    const inscritaEn = (d, folio) => { const s = d.solicitud.find((y) => y.folio === folio); return Boolean(s) && d.inscripcion.some((i) => i.grupo_id === g.id && i.activa && i.solicitud_id === s.id); };
    dialogoConMotivo('baja', (motivo) => P.guardaGrupoComprobado({
      eventos: () => ({ tipo: 'baja', grupo_id: g.id, folio: bajaDe.folio, motivo, por: P.REVISORA.usuario }),
      antes: (d1) => (inscritaEn(d1, bajaDe.folio) ? null : `${bajaDe.quien} ya no está en el grupo`),
      comprueba: (d2) => (inscritaEn(d2, bajaDe.folio) ? `${bajaDe.quien} sigue en el grupo: ya presentó el examen o el grupo cambió` : null)
    }).then(({ datos: d2 }) => vuelve(g.folio, deAhora(d2).estado === 'en_integracion' && g.estado === 'confirmado' ? 'baja_integracion' : 'baja'),
      (e) => Promise.reject(e && e.motivo ? noSeHizo('No se dio de baja', e.motivo) : e)))
      .addEventListener('close', () => { if (bajaDe && bajaDe.boton.isConnected) bajaDe.boton.focus(); });
    dialogoConMotivo('cancelar', (motivo) => P.guardaGrupoComprobado({
      eventos: () => ({ tipo: 'cancelar', grupo_id: g.id, motivo, por: P.REVISORA.usuario }),
      antes: (d1) => (deAhora(d1) && ['en_integracion', 'confirmado'].includes(deAhora(d1).estado) ? null : `el grupo ya está «${deAhora(d1) ? P.grupo(d1, deAhora(d1)).situacion.texto : 'sin datos'}»`),
      comprueba: (d2) => (deAhora(d2) && deAhora(d2).estado === 'cancelado' ? null : 'el grupo no se canceló')
    }).then(() => vuelve(g.folio, 'cancelado'), (e) => Promise.reject(e && e.motivo ? noSeHizo('No se canceló el grupo', e.motivo) : e)))
      .addEventListener('close', () => { if (cancelar && cancelar.isConnected) cancelar.focus(); });
  }).catch(() => {
    $('[data-bajada]').textContent = 'No se pudo cargar el grupo. Intente de nuevo más tarde.';
  });
}());
