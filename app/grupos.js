/* grupos.js · «Grupos» como planeador por curso (personal, etapa 2; propuesta A, aprobada por Liber el 2026-10-18).
   ?curso=poda-nueva (tipo-modalidad, como APD_PERSONAL.claveCurso): el curso elegido queda en la dirección, así «Atrás» y
   recargar lo conservan. ?grupo=APD-G-… (desde la ficha de un grupo, «Agregar personas de la espera»): sólo ese grupo
   recibe y, si es de una organización, sólo se ve a su gente (auditoría de tareas, M1).
     · Arriba: la fecha de hoy (simulada), «Programar un curso» (programar.html) y los cuatro cursos, cada uno con cuántas
       personas esperan y, en renovación, cuántas tienen la acreditación vencida.
     · «En espera»: de la que más espera a la más reciente (renovación: por la fecha en que vence; desde
       dias_alerta_espera días, prioritaria); las de una misma organización, juntas en un bloque. Se eligen y se agregan a
       un grupo del curso que recibe personas, o «A un curso nuevo…» (programar.html con esas personas).
     · «Próximas semanas»: esta semana (grupos en curso, «Día X de Y» o «examen hoy») y las siguientes, cada una con su
       grupo (cupo de 25 lugares, «Completar con las N que más esperan», «Confirmar el grupo», «Ver a las personas») o, si
       está libre y se puede (7 días de anticipación, sin otro curso igual esas fechas), «Programar un curso esta semana».
       Al final, «Sin fecha» y los grupos que ya terminaron.
   Cada grupo se reconoce por su nombre calculado (APD.nombreGrupo, propuesta D) y su folio en chico. Lo hecho se guarda
   como en la espera y en la ficha (APD_PERSONAL.guardaGrupo: agregar, confirmar); la base lo vuelve a aplicar
   (apd.inscripcion_alta, apd.grupo_cambio). En la etapa 3 los datos los da la API del personal. */
(function () {
  'use strict';
  const { el, estado, fecha } = APD;
  const P = APD_PERSONAL;
  const $ = (s, r) => (r || document).querySelector(s);
  const plural = APD.plural;
  const params = new URLSearchParams(location.search);
  /* Esta semana y las siguientes que se muestran siempre (al menos 6 después de la actual); las que tienen un grupo más
     adelante se agregan */
  const SEMANAS = 8;
  const NOMBRE_SEMANA = ['Esta semana', 'La siguiente'];

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'grupos');
    const hoy = APD.hoy(datos);
    const curso0 = datos.curso[0] || {};
    $('[data-cupo-min]').textContent = curso0.cupo_minimo;
    $('[data-cupo-max]').textContent = curso0.cupo_maximo;
    $('[data-hoy]').textContent = `Hoy es ${APD.fechaConDia(hoy)}. Elija el curso para ver quién espera y sus próximas semanas.`;
    const pedido = params.get('grupo');
    const gPedido = pedido ? datos.grupo.find((g) => g.folio === pedido) : null;
    let clave = P.deClave(params.get('curso')) ? params.get('curso')
      : gPedido ? P.claveCurso(gPedido.tipo_acreditacion, gPedido.modalidad) : P.claveCurso(...P.CURSOS[0]);
    const minimo = P.primerDiaPosible(datos);
    const todos = P.grupos(datos);

    /* Las elegidas de cada curso se conservan al cambiar de curso y al volver (auditoría «intentar romperlo», F3 B7) */
    const elegidasDe = new Map();
    /* ----- Selector de cursos ----- */
    const botones = P.CURSOS.map(([t, m]) => {
      const lista = P.enEspera(datos, t, m);
      const vencidas = lista.filter((x) => x.vencida).length;
      const b = el('button', { type: 'button', class: 'plan-curso', 'data-curso': P.claveCurso(t, m), 'aria-pressed': 'false' }, [
        el('span', { class: 'plan-curso-nombre', texto: APD.cursoLargo(t, m) }),
        el('span', { class: 'plan-curso-cifra' }, [document.createTextNode(String(lista.length)), el('span', { class: 'solo-lector', texto: ' en espera' })]),
        vencidas ? el('span', { class: 'plan-curso-vencidas', texto: plural(vencidas, 'vencida', 'vencidas') }) : null
      ]);
      b.addEventListener('click', () => {
        if (clave === b.dataset.curso && !pedido) return;
        clave = b.dataset.curso;
        // Sin «Atrás» de más: la dirección cambia en su lugar y conserva el curso al recargar o al volver
        history.replaceState(null, '', `${location.pathname}?curso=${clave}`);
        modoGrupo = null;
        noRecibe = null;
        pinta();
      });
      return b;
    });
    $('[data-cursos]').replaceChildren(...botones);

    /* Desde un grupo: sólo ese grupo recibe (si todavía recibe personas) */
    let modoGrupo = gPedido ? todos.find((x) => x.g.id === gPedido.id && x.recibe) || null : null;
    // Un enlace guardado a un grupo que ya no recibe (concluido, en curso, lleno): se dice, con su ficha (F3 B6)
    let noRecibe = gPedido && !modoGrupo ? P.grupo(datos, gPedido) : null;
    avisoHecho();
    pinta();

    /* ----- Aviso de lo que se acaba de hacer (llega en la dirección) ----- */
    function avisoHecho() {
      const hecho = params.get('hecho');
      const n = Number(params.get('n')) || 0;
      const g = datos.grupo.find((x) => x.folio === params.get('a'));
      if (!hecho || !g) return;
      const x = P.grupo(datos, g);
      const falta = g.cupo_minimo - x.n;
      const enlace = el('p', {}, [el('a', { href: `grupo.html?folio=${encodeURIComponent(g.folio)}`, texto: 'Ver a las personas del grupo' })]);
      // Sin fecha, dos grupos se llaman igual: el aviso lleva el folio, como el botón (auditoría «intentar romperlo», F3 B5)
      const cual = g.fecha_inicio ? x.calculado : `${x.calculado} · ${g.folio}`;
      if (hecho === 'agregadas') {
        APD.pintaAviso($('[data-hecho]'), 'ok', `${n === 1 ? 'Se agregó 1 persona' : `Se agregaron ${n} personas`} a «${cual}»`,
          falta > 0 ? `Le ${falta === 1 ? 'falta 1' : `faltan ${falta}`} para el mínimo de ${g.cupo_minimo}.`
            : g.estado === 'en_integracion' ? 'Ya tiene el mínimo: puede confirmarlo.' : `Tiene ${plural(x.n, 'persona', 'personas')}.`, true);
      } else if (hecho === 'confirmado') {
        APD.pintaAviso($('[data-hecho]'), 'ok', `Grupo confirmado: «${cual}»`, 'Cada persona ya ve en «Mis trámites» las fechas, la hora de entrada y dónde presentarse.', true);
      } else return;
      $('[data-hecho] .aviso-texto').append(enlace);
      // Que recargar la página no repita el aviso
      history.replaceState(null, '', `${location.pathname}?curso=${clave}`);
    }

    const irConAviso = (hecho, folio, n) => {
      location.href = `grupos.html?curso=${clave}&hecho=${hecho}&a=${encodeURIComponent(folio)}${n ? `&n=${n}` : ''}`;
    };

    /* ----- Todo lo del curso elegido ----- */
    function pinta() {
      const [tipo, modalidad] = P.deClave(clave);
      const renov = modalidad === 'renovacion';
      const c = APD.curso(datos, tipo, modalidad);
      const largo = APD.cursoLargo(tipo, modalidad);
      document.title = `Grupos · ${largo} · Personal · Acreditaciones de arbolado urbano`;
      for (const b of botones) b.setAttribute('aria-pressed', String(b.dataset.curso === clave));
      $('[data-programar]').href = `programar.html?curso=${clave}`;
      const delCurso = todos.filter((x) => x.g.tipo_acreditacion === tipo && x.g.modalidad === modalidad);
      if (modoGrupo && (modoGrupo.g.tipo_acreditacion !== tipo || modoGrupo.g.modalidad !== modalidad)) modoGrupo = null;
      const receptores = modoGrupo ? [modoGrupo] : delCurso.filter((x) => x.recibe)
        .sort((a, b) => String(a.g.fecha_inicio || '9999').localeCompare(String(b.g.fecha_inicio || '9999')) || a.g.folio.localeCompare(b.g.folio));
      const soloOrg = modoGrupo && modoGrupo.g.integracion === 'especifico' ? modoGrupo.g.organizacion_id : null;
      const espera = P.enEspera(datos, tipo, modalidad);
      const lista = soloOrg ? espera.filter((x) => x.s.organizacion_id === soloOrg) : espera;
      const activos = delCurso.filter((x) => ['en_integracion', 'confirmado', 'en_curso'].includes(x.g.estado)).length;
      $('[data-cuenta]').textContent = `${largo}: ${plural(espera.length, 'persona en espera', 'personas en espera')} · ${plural(activos, 'grupo activo', 'grupos activos')} (por confirmar, confirmados o en curso).`;
      pintaEspera({ tipo, modalidad, renov, c, lista, receptores, soloOrg });
      pintaSemanas({ tipo, modalidad, c, largo, delCurso, espera });
    }

    /* ----- En espera ----- */
    function pintaEspera({ tipo, modalidad, renov, c, lista, receptores, soloOrg }) {
      const alerta = APD.parametro(datos, 'dias_alerta_espera') || 31;
      $('#t-espera').textContent = `En espera · ${lista.length}`;
      $('[data-orden]').textContent = renov ? 'primero quien vence antes' : 'primero quien más espera';
      const modo = $('[data-modo-grupo]');
      modo.hidden = !modoGrupo && !noRecibe;
      if (!modoGrupo && noRecibe) {
        APD.pintaAviso(modo, 'info', `«${noRecibe.calculado}» ya no recibe personas`,
          `Su situación es «${noRecibe.situacion.texto}»${noRecibe.lugar <= 0 ? ' y está lleno' : ''}. Abajo está la espera del curso, para agregarlas a otro grupo.`);
        $('.aviso-texto', modo).append(el('p', {}, [el('a', { href: `grupo.html?folio=${encodeURIComponent(noRecibe.g.folio)}`, texto: 'Ver la ficha del grupo' })]));
      }
      if (modoGrupo) {
        const volver = el('a', { href: `grupos.html?curso=${clave}`, texto: 'Ver toda la espera del curso' });
        APD.pintaAviso(modo, 'info', `Agregando personas a «${modoGrupo.calculado}»`,
          soloOrg ? `Es un grupo de una sola organización: sólo se muestra a su gente. Caben ${modoGrupo.lugar}.` : `Caben ${modoGrupo.lugar}.`);
        $('.aviso-texto', modo).append(el('p', {}, [volver]));
      }
      const filas = [];
      const casilla = (x, etiqueta) => {
        const k = el('input', { class: 'casilla-input plan-casilla', type: 'checkbox', value: x.s.folio, 'aria-label': etiqueta || null });
        filas.push({ x, k });
        return k;
      };
      const espera = (x) => {
        const dias = x.dias === 0 ? 'Hoy' : x.dias === 1 ? '1 día' : `${x.dias} días`;
        const partes = [x.prioritaria ? estado(`${dias} · prioritaria`, 'pend') : el('span', { class: 'plan-dias', texto: dias })];
        if (renov && x.vence) partes.push(x.vencida ? estado(`Vencida el ${fecha(x.vence)}`, 'pend') : el('span', { class: 'plan-dias', texto: `vence el ${fecha(x.vence)}` }));
        return el('span', { class: 'plan-persona-espera' }, partes);
      };
      const persona = (x, conAdscripcion) => el('label', { class: 'plan-persona' }, [
        casilla(x),
        el('span', { class: 'plan-persona-nombre', texto: APD.nombreCompleto(x.p) }),
        espera(x),
        conAdscripcion ? el('span', { class: 'plan-persona-org', texto: x.organizacion }) : null
      ]);
      const bloques = P.bloquesEspera(lista).map((b, i) => {
        if (!b.junta) return persona(b.xs[0], true);
        const todas = el('input', { class: 'casilla-input plan-casilla', type: 'checkbox', 'aria-label': `Elegir a las ${b.xs.length} personas de ${b.nombre}` });
        const propias = b.xs.map((x) => persona(x, false));
        const suyas = () => filas.filter((f) => b.xs.includes(f.x));
        todas.addEventListener('change', () => { for (const f of suyas()) f.k.checked = todas.checked; pintaEleccion(); });
        const refleja = () => { const m = suyas().filter((f) => f.k.checked).length; todas.checked = m === b.xs.length; todas.indeterminate = m > 0 && m < b.xs.length; };
        const bloque = el('div', { class: 'plan-bloque', role: 'group', 'aria-labelledby': `bloque-${i}` }, [
          el('label', { class: 'plan-bloque-cabeza' }, [todas, el('span', { class: 'plan-bloque-nombre', id: `bloque-${i}`, texto: `${b.nombre} · ${b.xs.length} personas, juntas` })]),
          ...propias
        ]);
        bloque.addEventListener('change', (e) => { if (e.target !== todas) refleja(); });
        return bloque;
      });
      $('[data-personas]').replaceChildren(...(bloques.length ? bloques : [el('p', { class: 'texto-gris', texto: soloOrg ? 'Nadie de esa organización espera en este curso.' : 'Nadie espera en este curso.' })]));
      const guardadas = elegidasDe.get(clave) || new Set();
      for (const f of filas) { if (guardadas.has(f.x.s.folio)) f.k.checked = true; f.k.addEventListener('change', pintaEleccion); }
      for (const b of $('[data-personas]').querySelectorAll('.plan-bloque')) b.dispatchEvent(new Event('change'));

      const barra = $('[data-barra]');
      barra.hidden = !filas.length;
      const error = $('[data-error-eleccion]');
      error.hidden = true;
      const elegidas = () => filas.filter((f) => f.k.checked);
      function pintaEleccion() {
        elegidasDe.set(clave, new Set(elegidas().map((f) => f.x.s.folio)));
        const n = elegidas().length;
        $('[data-elegidas]').textContent = n ? plural(n, 'elegida', 'elegidas') : 'Ninguna elegida';
        if (n) { error.hidden = true; for (const x of document.querySelectorAll('.falta-marcar')) x.classList.remove('falta-marcar'); }
      }
      /* Lo que impide agregar a ese grupo → [título, texto] o null (como en la espera; la base lo vuelve a revisar) */
      function problema(eleg, x) {
        if (!eleg.length) return ['No se agregó a nadie', 'Marque la casilla junto al nombre de cada persona que quiere agregar.'];
        if (eleg.length > x.lugar) return ['Eligió más personas de las que caben', `«${x.calculado}» tiene lugar para ${plural(x.lugar, 'persona', 'personas')}; eligió ${eleg.length}.`];
        if (x.g.integracion === 'especifico') {
          const fuera = eleg.filter((f) => (f.x.s.organizacion_id || null) !== x.g.organizacion_id);
          if (fuera.length) return [`No se agregó a nadie a «${x.calculado}»`, `Es un grupo de una sola organización: ${fuera.map((f) => APD.nombreCompleto(f.x.p)).join(', ')} no ${fuera.length === 1 ? 'es' : 'son'} de esa organización.`];
        }
        return null;
      }
      function falla([titulo, texto]) {
        if (!elegidas().length) for (const f of filas) f.k.closest('.plan-persona').classList.add('falta-marcar');
        APD.pintaAviso(error, 'error', titulo, texto, true);
      }
      const acciones = receptores.map((x, i) => {
        const n = APD.nombreGrupo(x.g, datos, { sinCurso: true });
        const texto = `${x.g.fecha_inicio ? 'Al curso' : 'Al grupo'} ${n.charAt(0).toLocaleLowerCase('es-MX')}${n.slice(1)}${x.g.fecha_inicio ? '' : ` · ${x.g.folio}`}`;
        const b = el('button', { type: 'button', class: `btn ${i === 0 ? 'btn-primario' : 'btn-secundario'} btn-chico`, 'aria-describedby': 'plan-elegidas' }, [
          el('span', { texto }), el('span', { class: 'plan-destino-cupo', texto: ` (${x.n} de ${x.g.cupo_maximo})` })]);
        b.addEventListener('click', () => {
          const eleg = elegidas();
          const mal = problema(eleg, x);
          if (mal) { falla(mal); return; }
          P.guardaGrupo({ tipo: 'agregar', grupo_id: x.g.id, folios: eleg.map((f) => f.x.s.folio), por: P.REVISORA.usuario })
            .then(() => {
              if (modoGrupo) location.href = `grupo.html?folio=${encodeURIComponent(x.g.folio)}&hecho=agregadas&n=${eleg.length}`;
              else irConAviso('agregadas', x.g.folio, eleg.length);
            })
            .catch(() => falla(['No se pudo guardar', 'La elección sigue aquí; intente de nuevo.']));
        });
        return b;
      });
      if (!modoGrupo) {
        // «A un curso nuevo…»: Programar con las elegidas (sin elegir a nadie, Programar propone a las que más esperan)
        const nuevo = el('a', { class: `btn ${acciones.length ? 'btn-secundario' : 'btn-primario'} btn-chico`, href: `programar.html?curso=${clave}`, texto: 'A un curso nuevo…' });
        nuevo.addEventListener('click', (e) => {
          const eleg = elegidas();
          if (eleg.length > c.cupo_maximo) { e.preventDefault(); falla(['Eligió más personas de las que caben', `Un grupo recibe hasta ${c.cupo_maximo}; eligió ${eleg.length}.`]); return; }
          if (eleg.length) nuevo.href = `programar.html?curso=${clave}&personas=${eleg.map((f) => encodeURIComponent(f.x.s.folio)).join(',')}`;
        });
        acciones.push(nuevo);
      } else if (!receptores.length) {
        acciones.push(el('p', { class: 'texto-gris', texto: 'Ese grupo ya no recibe personas.' }));
      }
      $('[data-destinos]').replaceChildren(...acciones);
      pintaEleccion();
    }

    /* ----- Próximas semanas ----- */
    function pintaSemanas({ tipo, modalidad, c, largo, delCurso, espera }) {
      $('#t-semanas').textContent = `Próximas semanas · ${largo}`;
      $('[data-semanas-nota]').textContent = c.dias_duracion > 1 ? `${c.dias_duracion} días seguidos; el examen, el último, en el PILARES` : 'un día; el examen, ese mismo día, en el PILARES';
      const lunes0 = P.lunesDe(hoy);
      const activos = delCurso.filter((x) => ['en_integracion', 'confirmado', 'en_curso'].includes(x.g.estado));
      const conFecha = activos.filter((x) => x.g.fecha_inicio && (x.g.estado === 'en_curso' || APD.ultimoDia(datos, x.g) >= lunes0));
      const sinFecha = activos.filter((x) => !conFecha.includes(x));
      // Semana de cada grupo: la de su primer día; un grupo en curso que empezó antes, en esta semana
      const semanaDe = (x) => Math.max(0, Math.round((new Date(`${P.lunesDe(x.g.fecha_inicio)}T12:00:00-06:00`) - new Date(`${lunes0}T12:00:00-06:00`)) / (7 * 86400000)));
      const total = Math.max(SEMANAS, ...conFecha.map((x) => semanaDe(x) + 1));
      const secciones = [];
      for (let i = 0; i < total; i++) {
        const lunes = APD.sumaDias(lunes0, 7 * i);
        const domingo = APD.sumaDias(lunes, 6);
        const suyos = conFecha.filter((x) => semanaDe(x) === i).sort((a, b) => a.g.fecha_inicio.localeCompare(b.g.fecha_inicio));
        // Más allá de las semanas fijas sólo se muestran las que tienen un grupo
        if (i >= SEMANAS && !suyos.length) continue;
        const nombre = NOMBRE_SEMANA[i] || `En ${i} semanas`;
        const id = `semana-${i}`;
        const cuerpo = suyos.length ? suyos.map((x) => tarjeta(x, espera, 'h5'))
          : [libre(tipo, modalidad, lunes, domingo)];
        secciones.push(el('section', { class: 'plan-semana', 'aria-labelledby': id, 'data-semana': lunes }, [
          el('h4', { class: 'plan-semana-titulo', id }, [el('span', { class: 'plan-semana-nombre', texto: nombre }),
            el('span', { class: 'plan-semana-fechas', texto: APD.rangoFechas(lunes, domingo, hoy.slice(0, 4)).replace(/^del /, '') })]),
          el('div', { class: 'plan-semana-cuerpo' }, cuerpo)
        ]));
      }
      if (sinFecha.length) {
        secciones.push(el('section', { class: 'plan-semana', 'aria-labelledby': 'semana-sin', 'data-semana': '' }, [
          el('h4', { class: 'plan-semana-titulo', id: 'semana-sin' }, [el('span', { class: 'plan-semana-nombre', texto: 'Sin fecha' })]),
          el('div', { class: 'plan-semana-cuerpo' }, sinFecha.map((x) => tarjeta(x, espera, 'h5')))
        ]));
      }
      $('[data-semanas]').replaceChildren(...secciones);

      /* Grupos que ya terminaron: concluidos y cancelados */
      const hechos = delCurso.filter((x) => ['concluido', 'cancelado'].includes(x.g.estado));
      $('[data-terminados]').hidden = !hechos.length;
      $('[data-terminados-titulo]').textContent = `Grupos que ya terminaron · ${hechos.length}`;
      $('[data-terminados-lista]').replaceChildren(...hechos.map((x) => el('li', { class: 'plan-terminado' }, [
        APD.grupoTitulo(x.g, datos), estado(x.situacion.texto, x.situacion.tono),
        el('a', { class: 'btn-enlace', href: `grupo.html?folio=${encodeURIComponent(x.g.folio)}`, 'aria-label': `Ver el grupo ${x.calculado}`, texto: 'Ver' })
      ])));
    }

    /* Una semana sin grupo de este curso: se puede programar (con su enlace) o se dice por qué no, en una línea */
    function libre(tipo, modalidad, lunes, domingo) {
      const programar = (desde, texto) => el('a', { class: 'plan-programar-semana', href: `programar.html?curso=${clave}&semana=${desde}` }, [APD.icono('mas'), el('span', { texto })]);
      const razon = P.razonNoInicio(datos, tipo, modalidad, lunes);
      if (!razon) return programar(lunes, 'Programar un curso esta semana');
      let primero = null;
      for (let d = APD.sumaDias(lunes, 1); d <= domingo; d = APD.sumaDias(d, 1)) if (!P.razonNoInicio(datos, tipo, modalidad, d)) { primero = d; break; }
      const linea = el('p', { class: 'plan-semana-no', texto: `El lunes ya no se puede: ${razon.texto}.${primero ? ` Desde el ${APD.diaSemana(primero)} ${fecha(primero).slice(0, 5)} sí, a media semana.` : ''}` });
      return primero ? el('div', { class: 'plan-semana-libre' }, [linea, programar(primero, `Programar desde el ${APD.diaSemana(primero)} ${fecha(primero).slice(0, 5)}`)]) : linea;
    }

    /* La tarjeta de un grupo en su semana */
    function tarjeta(x, espera, nivel) {
      const { g, c } = x;
      const dia = P.diaDelCurso(datos, g);
      const fin = APD.ultimoDia(datos, g);
      const situacion = dia ? estado(dia.texto, 'marcha') : estado(x.situacion.texto, x.situacion.tono);
      const examen = !g.fecha_inicio ? null : c.dias_duracion > 1 ? `examen el ${APD.diaSemana(fin)} ${fecha(fin).slice(0, 5)} en el PILARES` : 'examen ese día en el PILARES';
      // Un grupo por confirmar lleno ya no recibe, pero se confirma y se le elige semana como cualquiera (auditoría
      // «intentar romperlo», F3 M3): el cupo y esas acciones van con «por confirmar»; sólo «Completar» pide lugar
      const integra = g.estado === 'en_integracion';
      const conCupo = x.recibe || integra;
      const datosLinea = APD.meta([
        g.integracion === 'especifico' ? 'De una organización' : 'Combinado',
        conCupo ? null : plural(x.n, 'persona', 'personas'),
        g.hora_entrada ? `entrada ${APD.hhmm(g.hora_entrada)}` : 'sin hora',
        g.instructor ? P.nombreInstructor(g.instructor) : 'sin instructor',
        examen
      ]);
      const partes = [
        el('div', { class: 'plan-grupo-cabeza' }, [el(nivel, { class: 'plan-grupo-nombre' }, [APD.grupoTitulo(g, datos)]), situacion]),
        el('p', { class: 'plan-grupo-datos' }, datosLinea)
      ];
      const acciones = [];
      const falta = g.cupo_minimo - x.n;
      if (conCupo) partes.push(cupo(x));
      if (x.recibe) {
        const propia = g.integracion === 'especifico';
        const filtro = propia ? (y) => y.s.organizacion_id === g.organizacion_id : null;
        if (falta > 0) {
          const van = P.lasQueMasEsperan(espera, falta, filtro);
          if (van.length) {
            const b = el('button', { type: 'button', class: 'btn btn-primario btn-chico', texto: van.length === 1 ? 'Completar con la que más espera' : `Completar con las ${van.length} que más esperan` });
            b.addEventListener('click', () => {
              P.guardaGrupo({ tipo: 'agregar', grupo_id: g.id, folios: van.map((y) => y.s.folio), por: P.REVISORA.usuario })
                .then(() => irConAviso('agregadas', g.folio, van.length))
                .catch(() => APD.pintaAviso($('[data-hecho]'), 'error', 'No se pudo guardar', 'Intente de nuevo.', true));
            });
            acciones.push(b);
          }
        }
      }
      if (integra && falta <= 0) acciones.push(botonConfirmar(x));
      if (integra) {
        acciones.push(el('a', { class: 'btn btn-secundario btn-chico', href: `programar.html?curso=${clave}&grupo=${encodeURIComponent(g.folio)}`,
          texto: g.fecha_inicio ? 'Cambiar la semana' : 'Elegir semana' }));
      }
      acciones.push(el('a', { class: 'btn-enlace', href: `grupo.html?folio=${encodeURIComponent(g.folio)}`, 'aria-label': `Ver a las personas de ${x.calculado}`, texto: 'Ver a las personas' }));
      partes.push(el('div', { class: 'plan-grupo-acciones' }, acciones));
      return el('article', { class: 'plan-grupo', 'data-grupo': g.folio, 'data-situacion': g.estado }, partes);
    }

    /* Cupo de 25 lugares: lo ocupado, lo que falta para el mínimo y lo libre (la forma no depende sólo del color) */
    function cupo(x) {
      const { g } = x;
      const falta = g.cupo_minimo - x.n;
      const celdas = Array.from({ length: g.cupo_maximo }, (_, i) => el('span', { class: 'plan-cupo-lugar', 'data-lugar': i < x.n ? 'ocupado' : i < g.cupo_minimo ? 'minimo' : 'libre' }));
      const hasta = g.estado === 'confirmado' ? ` hasta el ${fecha(APD.sumaDias(g.fecha_inicio, -1))}` : '';
      return el('div', { class: 'plan-cupo' }, [
        el('div', { class: 'plan-cupo-barra', 'aria-hidden': 'true' }, celdas),
        el('p', { class: 'plan-cupo-texto' }, falta > 0
          ? [document.createTextNode(`${x.n} de ${g.cupo_maximo} · `), el('strong', { texto: `${falta === 1 ? 'falta 1' : `faltan ${falta}`} para confirmarlo` }), document.createTextNode(` (mínimo ${g.cupo_minimo})`)]
          : [document.createTextNode(`${x.n} de ${g.cupo_maximo} · ${x.lugar <= 0 ? 'lleno' : x.lugar === 1 ? `cabe 1 más${hasta}` : `caben ${x.lugar} más${hasta}`}`)])
      ]);
    }

    /* «Confirmar el grupo»: si ya tiene fecha (a tiempo), hora e instructor, se confirma aquí con su confirmación; si le
       falta algo, lleva a su ficha, donde se completa */
    function botonConfirmar(x) {
      const { g } = x;
      const listo = g.fecha_inicio && g.fecha_inicio >= minimo && g.hora_entrada && g.instructor && !P.razonNoInicio(datos, g.tipo_acreditacion, g.modalidad, g.fecha_inicio, g.id);
      if (!listo) return el('a', { class: 'btn btn-secundario btn-chico', href: `grupo.html?folio=${encodeURIComponent(g.folio)}#t-confirmar`, texto: 'Confirmar el grupo' });
      const b = el('button', { type: 'button', class: 'btn btn-secundario btn-chico', texto: 'Confirmar el grupo' });
      b.addEventListener('click', () => {
        FormKit.confirma(b, { titulo: `¿Confirmar «${x.calculado}»?`,
          consecuencias: [`${plural(x.n, 'persona', 'personas')}, entrada a las ${APD.hhmm(g.hora_entrada)}, con ${P.nombreInstructor(g.instructor)}.`,
            'Cada persona ve en «Mis trámites» las fechas, la hora de entrada y dónde presentarse.',
            `Sigue recibiendo personas hasta el ${fecha(APD.sumaDias(g.fecha_inicio, -1))}, sin pasar de ${g.cupo_maximo}.`],
          si: 'Sí, confirmar el grupo' })
          .then((si) => {
            if (!si) return;
            P.guardaGrupo({ tipo: 'confirmar', grupo_id: g.id, fecha_inicio: g.fecha_inicio, hora_entrada: APD.hhmm(g.hora_entrada), instructor: g.instructor, por: P.REVISORA.usuario })
              .then(() => irConAviso('confirmado', g.folio))
              .catch(() => APD.pintaAviso($('[data-hecho]'), 'error', 'No se pudo confirmar', 'Intente de nuevo.', true));
          });
      });
      return b;
    }
  }).catch(() => {
    $('[data-hoy]').textContent = 'No se pudieron cargar los grupos. Intente de nuevo más tarde.';
  });
}());
