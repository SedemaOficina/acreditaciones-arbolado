/* grupos.js · «Grupos» como planeador por curso (personal, etapa 2; propuesta A, aprobada por Liber el 2026-10-18).
   ?curso=poda-nueva (tipo-modalidad, como APD_PERSONAL.claveCurso): el curso elegido queda en la dirección, así «Atrás» y
   recargar lo conservan. ?grupo=APD-G-… (desde la ficha de un grupo, «Agregar personas de la espera»): sólo ese grupo
   recibe y, si es de una organización, sólo se ve a su gente (auditoría de tareas, M1).
     · Arriba: la fecha de hoy (simulada), «Programar un curso» (programar.html) y los cuatro cursos, cada uno con cuántas
       personas esperan y, en renovación, cuántas tienen la acreditación vencida.
     · «En espera»: de la que más espera a la más reciente (renovación: por la fecha en que vence; desde
       dias_alerta_espera días, prioritaria); las de una misma institución de gobierno local o federal, juntas en un bloque
       (sesión de trabajo del 23/10/2026: las demás, una por una). Se eligen y se agregan a
       un grupo del curso que recibe personas, o «A un curso nuevo…» (programar.html con esas personas).
     · «Próximas semanas»: esta semana (grupos en curso, «Día X de Y» o «examen hoy») y las siguientes, cada una con su
       grupo (cupo de 25 lugares, «Completar con las N que más esperan», «Confirmar el grupo», «Ver a las personas») o, si
       está libre y se puede (7 días de anticipación, sin otro curso igual esas fechas), «Programar un curso esta semana».
       Arriba, «Su fecha ya pasó» (propuestas vencidas y confirmados que no iniciaron), con «Elegir otra semana»; al
       final, «Sin fecha» y los grupos que ya terminaron.
   Cada grupo se reconoce por su nombre calculado (APD.nombreGrupo, propuesta D) y su folio en chico. Lo hecho se guarda
   como en la espera y en la ficha (APD_PERSONAL.guardaGrupo: agregar, confirmar); la base lo vuelve a aplicar
   (apd.inscripcion_alta, apd.grupo_cambio). En la etapa 3 los datos los da la API del personal. */
(function () {
  'use strict';
  /* Fechas (decisión 16 b, 20/10/2026): «Hoy es …» y el día en que puede empezar un curso, con fecha larga; las semanas,
     el cupo y la línea de datos de cada grupo, dd/mm/aaaa. El nombre del grupo («del 13 al 17 de octubre») es la
     decisión del 18/10 y lo arma APD.nombreGrupo. */
  const { el, estado, fechaLarga, fechaCorta } = APD;
  const semana = (lunes, domingo) => `del ${fechaCorta(lunes)} al ${fechaCorta(domingo)}`;
  const P = APD_PERSONAL;
  const $ = (s, r) => (r || document).querySelector(s);
  const plural = APD.plural;
  const mayus = (t) => t.charAt(0).toLocaleUpperCase('es-MX') + t.slice(1);
  const params = new URLSearchParams(location.search);
  /* Las semanas que se muestran siempre: esta semana y siete más (8 en total); las que tienen un grupo más adelante se
     agregan */
  const SEMANAS = 8;
  const NOMBRE_SEMANA = ['Esta semana', 'La siguiente'];

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'grupos');
    const hoy = APD.hoy(datos);
    const curso0 = datos.curso[0] || {};
    $('[data-cupo-min]').textContent = curso0.cupo_minimo;
    $('[data-cupo-max]').textContent = curso0.cupo_maximo;
    $('[data-hoy]').textContent = `Hoy es ${fechaLarga(hoy)}. Elija el curso para ver quién espera y sus próximas semanas.`;
    const pedido = params.get('grupo');
    const gPedido = pedido ? datos.grupo.find((g) => g.folio === pedido) : null;
    let clave = P.deClave(params.get('curso')) ? params.get('curso')
      : gPedido ? P.claveCurso(gPedido.tipo_acreditacion, gPedido.modalidad) : P.claveCurso(...P.CURSOS[0]);
    const minimo = P.primerDiaPosible(datos);
    const todos = P.grupos(datos);

    /* Las elegidas de cada curso se conservan al cambiar de curso y al volver (auditoría «intentar romperlo», F3 B7) y, en
       esta pestaña (sessionStorage), al recargar o al volver con «Atrás» aunque el navegador vuelva a cargar la página
       (auditoría 2026-10-20, C4-04). Al llegar de nuevo (desde el menú o tras agregar) se empieza sin elegidas; las que ya
       no esperan no se marcan porque ya no tienen casilla. */
    const elegidasDe = new Map();
    const CLAVE_ELEGIDAS = 'apd.grupos.elegidas';
    try {
      if (['reload', 'back_forward'].includes((performance.getEntriesByType('navigation')[0] || {}).type)) {
        for (const [k, v] of Object.entries(JSON.parse(sessionStorage.getItem(CLAVE_ELEGIDAS) || '{}'))) if (Array.isArray(v)) elegidasDe.set(k, new Set(v));
      } else sessionStorage.removeItem(CLAVE_ELEGIDAS);
    } catch (e) { /* sin almacenamiento: sólo en memoria */ }
    const guardaElegidas = () => { try { sessionStorage.setItem(CLAVE_ELEGIDAS, JSON.stringify(Object.fromEntries([...elegidasDe].map(([k, v]) => [k, [...v]])))); } catch (e) { /* sin almacenamiento */ } };
    /* Barra de elegidas (auditoría 2026-10-20, B4-01; decisión 1 a y c de Liber): desde 760 px va fija al pie de «En
       espera». Para que el foco del teclado no quede debajo de ella, la página reserva su alto real al desplazarse
       (scroll-padding-bottom, medido con un ResizeObserver y al cambiar la ventana); si la barra mide más de un cuarto de
       la ventana, deja de ser fija ([data-suelta] en app/apd.css) y no se reserva nada. Lo que se ve no cambia cuando la
       barra cabe. */
    const barraPie = $('[data-barra]');
    const anchoFija = matchMedia('(min-width: 760px)');
    const ajustaBarra = () => {
      // El alto visible: fija, la barra se extiende por debajo de la ventana (bottom negativo en app/apd.css) y esa parte
      // no cuenta ni para el cuarto de la ventana ni para lo que se reserva
      const extiende = barraPie.hasAttribute('data-suelta') ? 0 : Math.max(0, -parseFloat(getComputedStyle(barraPie).bottom) || 0);
      const alto = barraPie.hidden ? 0 : Math.max(0, barraPie.getBoundingClientRect().height - (anchoFija.matches ? extiende : 0));
      const suelta = anchoFija.matches && alto > innerHeight / 4;
      const cambia = suelta !== barraPie.hasAttribute('data-suelta');
      barraPie.toggleAttribute('data-suelta', suelta);
      // Si la barra cambia de lugar con el foco dentro (p. ej., al aparecer «No se agregó a nadie»), el foco sigue a la vista
      if (cambia && barraPie.contains(document.activeElement)) document.activeElement.scrollIntoView({ block: 'nearest' });
      const raiz = document.documentElement.style;
      if (anchoFija.matches && alto && !suelta) raiz.scrollPaddingBottom = `calc(${Math.ceil(alto)}px + var(--e-2))`;
      else raiz.removeProperty('scroll-padding-bottom');
    };
    new ResizeObserver(ajustaBarra).observe(barraPie);
    addEventListener('resize', ajustaBarra);
    /* ----- Selector de cursos ----- */
    const botones = P.CURSOS.map(([t, m]) => {
      const lista = P.enEspera(datos, t, m);
      const vencidas = lista.filter((x) => x.vencida).length;
      const b = el('button', { type: 'button', class: 'plan-curso', 'data-curso': P.claveCurso(t, m), 'aria-pressed': 'false' }, [
        // La palomita de lo elegido, como en las opciones del estándar: se ve sólo con aria-pressed="true" (C6-03)
        APD.icono('palomita', 'icono icono-sm plan-curso-marca'),
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
        // La cuenta del curso se ve siempre y se anuncia sólo al cambiar de curso (auditoría 2026-10-20, RI-04)
        FormKit.anuncia($('[data-cuenta]').textContent);
      });
      return b;
    });
    $('[data-cursos]').replaceChildren(...botones);

    /* Por qué una persona no entró a un grupo, con lo guardado de ahora (como lo diría la API: solicitud_no_lista,
       cupo_maximo, grupo_cerrado, otra_organizacion) */
    function porQueNo(d, g, folio) {
      const s = d.solicitud.find((x) => x.folio === folio);
      const quien = s ? APD.nombreCompleto(d.solicitante.find((p) => p.id === s.solicitante_id) || {}) : folio;
      if (!s) return [quien, 'ya no existe'];
      const ins = d.inscripcion.find((i) => i.solicitud_id === s.id && i.activa);
      const otro = ins && d.grupo.find((x) => x.id === ins.grupo_id);
      if (otro && otro.id === g.id) return [quien, 'ya estaba en el grupo'];
      if (otro) return [quien, `ya está en «${APD.nombreGrupo(otro, d)}» (${otro.folio})`];
      if (s.estado !== 'lista_para_curso') return [quien, `ya no está en espera («${APD.nombrePersonal(s.estado)}»)`];
      const x = P.grupo(d, g);
      if (x.n >= g.cupo_maximo) return [quien, `el grupo se llenó (${x.n} de ${g.cupo_maximo})`];
      if (!x.recibe) return [quien, `el grupo ya no recibe personas («${x.situacion.texto}»)`];
      if (g.integracion === 'especifico' && (s.organizacion_id || null) !== g.organizacion_id) return [quien, 'no es de la organización del grupo'];
      return [quien, 'no se pudo agregar'];
    }
    /* «NÉSTOR …: ya está en «…»; ANA …, LUIS …: el grupo se llenó (25 de 25)»: una razón por grupo de personas */
    function porQueNoEntraron(d, g, folios) {
      const porRazon = new Map();
      for (const f of folios) { const [quien, razon] = porQueNo(d, g, f); porRazon.set(razon, (porRazon.get(razon) || []).concat([quien])); }
      return [...porRazon].map(([razon, quienes]) => `${quienes.join(', ')}: ${razon}`).join('; ');
    }

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
        // n: las que de verdad entraron (lo leído después de guardar); no: las que no, con su razón (F3 M1)
        const no = (params.get('no') || '').split(',').filter(Boolean);
        const resto = falta > 0 ? `Le ${falta === 1 ? 'falta 1' : `faltan ${falta}`} para el mínimo de ${g.cupo_minimo}.`
          : g.estado === 'en_integracion' ? 'Ya tiene el mínimo: puede confirmarlo.' : `Tiene ${plural(x.n, 'persona', 'personas')}.`;
        APD.pintaAviso($('[data-hecho]'), no.length ? 'pend' : 'ok', `${n === 1 ? 'Se agregó 1 persona' : `Se agregaron ${n} personas`} a «${cual}»`,
          no.length ? `${no.length === 1 ? '1 de las que eligió no entró' : `${no.length} de las que eligió no entraron`}. ${porQueNoEntraron(datos, g, no)}. ${resto}` : resto, true);
      } else if (hecho === 'confirmado') {
        APD.pintaAviso($('[data-hecho]'), 'ok', `Grupo confirmado: «${cual}»`, 'Cada persona ya ve en «Mis trámites» las fechas, la hora de entrada y dónde presentarse.', true);
      } else return;
      $('[data-hecho] .aviso-texto').append(enlace);
      // Que recargar la página no repita el aviso
      history.replaceState(null, '', `${location.pathname}?curso=${clave}`);
    }

    const irConAviso = (hecho, folio, n, no) => {
      location.href = `grupos.html?curso=${clave}&hecho=${hecho}&a=${encodeURIComponent(folio)}${n ? `&n=${n}` : ''}${no && no.length ? `&no=${no.map(encodeURIComponent).join(',')}` : ''}`;
    };
    /* Agregar a un grupo como lo haría la API (auditoría «intentar romperlo», F3 M1 y B10): se guarda, se vuelve a leer y se
       cuenta a quién inscribió de verdad la base; si no entró nadie, no queda nada guardado y se dice por qué. Resuelve con
       { n, no } (las que entraron y los folios de las que no). */
    function agrega(g, folios) {
      const activasEn = (d) => new Set(d.inscripcion.filter((i) => i.grupo_id === g.id && i.activa).map((i) => (d.solicitud.find((s) => s.id === i.solicitud_id) || {}).folio));
      let entraron = [];
      return P.guardaGrupoComprobado({
        eventos: () => ({ tipo: 'agregar', grupo_id: g.id, folios, por: P.REVISORA.usuario }),
        comprueba(d2, d1) {
          const antes = activasEn(d1);
          const ahora = activasEn(d2);
          entraron = folios.filter((f) => ahora.has(f) && !antes.has(f));
          return entraron.length ? null : `No se agregó a nadie: ${porQueNoEntraron(d2, d2.grupo.find((x) => x.id === g.id) || g, folios)}`;
        }
      }).then(() => ({ n: entraron.length, no: folios.filter((f) => !entraron.includes(f)) }));
    }

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
      /* Cuántas son prioritarias (desde dias_alerta_espera días: 15 desde la sesión de trabajo del 23/10/2026, P143; antes
         «31 días o más») y cuántos grupos nuevos alcanzan, arriba de
         la lista (auditoría 2026-10-20, C1-01: se habían perdido con el planeador del 18/10; son la corrección M7 y la de
         «31 días o más» de la auditoría de tareas del 17/10). Los grupos nuevos, con la misma cuenta de entonces: los
         completos de cupo_maximo y uno más si lo que sobra llega al mínimo. */
      const prioritarias = espera.filter((x) => x.prioritaria).length;
      const falta = c.cupo_minimo - espera.length;
      const nuevos = Math.floor(espera.length / c.cupo_maximo) + (espera.length % c.cupo_maximo >= c.cupo_minimo ? 1 : 0);
      const alcanza = !espera.length ? '' : falta > 0 ? ` ${falta === 1 ? 'Falta 1' : `Faltan ${falta}`} para el mínimo de ${c.cupo_minimo}.`
        : ` Alcanza para ${nuevos === 1 ? 'un grupo nuevo' : `${nuevos} grupos nuevos`} de hasta ${c.cupo_maximo}.`;
      $('[data-cuenta]').textContent = `${largo}: ${plural(espera.length, 'persona en espera', 'personas en espera')}`
        + `${prioritarias ? ` (${plural(prioritarias, 'espera', 'esperan')} ${APD.parametro(datos, 'dias_alerta_espera') || 15} días o más)` : ''}`
        + ` · ${plural(activos, 'grupo activo', 'grupos activos')} (por confirmar, confirmados o en curso).${alcanza}`;
      pintaEspera({ renov, c, lista, receptores, soloOrg, delCursoRecibe: delCurso.filter((x) => x.recibe) });
      pintaSemanas({ tipo, modalidad, c, largo, delCurso, espera });
    }

    /* ----- En espera ----- */
    function pintaEspera({ renov, c, lista, receptores, soloOrg, delCursoRecibe }) {
      $('#t-espera').textContent = `En espera · ${lista.length}`;
      // En renovación, el orden que de verdad se ve (decisión 11 b, auditoría 2026-10-20, C1-03; P.bloquesEspera)
      // Sólo las instituciones de gobierno local y federal van juntas (sesión de trabajo del 23/10/2026)
      $('[data-orden]').textContent = renov ? 'por vencimiento: cada institución de gobierno va junta en el lugar de la primera que vence y, dentro, primero las vencidas; las demás, una por una' : 'primero quien más espera; las de una misma institución de gobierno, juntas';
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
      // La fila de cada persona y el bloque de su organización, los mismos de «Programar» (P.filaEspera, P.bloqueEspera)
      const persona = (x, conAdscripcion) => {
        const k = el('input', { class: 'casilla-input plan-casilla', type: 'checkbox', value: x.s.folio });
        filas.push({ x, k });
        return P.filaEspera(x, k, conAdscripcion);
      };
      /* «Su grupo» de cada organización (decisión 2 de la auditoría del 2026-10-19, Liber; DECISIONES, 17/10): si ya tiene un
         grupo propio que recibe personas, se dice cuál y cuántas le faltan; si no, si alcanzan para uno propio */
      const suGrupo = (org) => (org ? delCursoRecibe.find((y) => y.g.integracion === 'especifico' && y.g.organizacion_id === org) : null);
      const textoSuGrupo = (y) => {
        const falta = y.g.cupo_minimo - y.n;
        return `Su grupo ${y.g.folio}: ${y.n} de ${y.g.cupo_maximo}${falta > 0 ? `, le ${falta === 1 ? 'falta 1' : `faltan ${falta}`} para el mínimo` : `, caben ${y.lugar}`}`;
      };
      const situacionBloque = (b) => {
        const y = suGrupo(b.clave);
        if (y) return estado(textoSuGrupo(y), y.n < y.g.cupo_minimo ? 'pend' : 'ok');
        const falta = c.cupo_minimo - b.xs.length;
        return falta <= 0 ? estado('Alcanza para un grupo propio', 'ok')
          : el('span', { class: 'plan-bloque-grupo', texto: `${falta === 1 ? 'Falta 1' : `Faltan ${falta}`} para un grupo propio de ${c.cupo_minimo}; o van a un grupo combinado` });
      };
      const bloques = P.bloquesEspera(lista).map((b, i) => {
        if (!b.junta) {
          // Sola de su organización, pero con su grupo: también se dice
          const y = suGrupo(b.xs[0].s.organizacion_id);
          const fila = persona(b.xs[0], true);
          if (y) fila.append(el('span', { class: 'plan-persona-org' }, [estado(textoSuGrupo(y), y.n < y.g.cupo_minimo ? 'pend' : 'ok')]));
          return fila;
        }
        const propias = b.xs.map((x) => persona(x, false));
        const { bloque } = P.bloqueEspera(b, `bloque-${i}`, propias, filas.filter((f) => b.xs.includes(f.x)).map((f) => f.k), situacionBloque(b), () => pintaEleccion(true));
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
      /* Cuántas van elegidas: se ve siempre en la barra y se anuncia sólo cuando quien arma el grupo marca o desmarca (una
         casilla o un bloque), no al pintar la pantalla (auditoría 2026-10-20, RI-04) */
      function pintaEleccion(porPersona) {
        elegidasDe.set(clave, new Set(elegidas().map((f) => f.x.s.folio)));
        guardaElegidas();
        const n = elegidas().length;
        $('[data-elegidas]').textContent = n ? plural(n, 'elegida', 'elegidas') : 'Ninguna elegida';
        if (porPersona === true || (porPersona && porPersona.isTrusted)) FormKit.anuncia($('[data-elegidas]').textContent);
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
        /* Un solo botón principal por pantalla (auditoría 2026-10-20, C6-02 y C2-01; decisión 2 de Liber): el de «Grupos» es
           «Programar un curso»; los destinos son secundarios, también sin nadie elegido */
        const b = el('button', { type: 'button', class: 'btn btn-secundario btn-chico', 'aria-describedby': 'plan-elegidas' }, [
          el('span', { texto }), el('span', { class: 'plan-destino-cupo', texto: ` (${x.n} de ${x.g.cupo_maximo})` })]);
        b.addEventListener('click', () => {
          const eleg = elegidas();
          const mal = problema(eleg, x);
          if (mal) { falla(mal); return; }
          // Deshabilitado mientras guarda: un doble clic no guarda dos veces (F3 B10)
          const libera = APD.ocupa(b);
          if (!libera) return;
          agrega(x.g, eleg.map((f) => f.x.s.folio))
            .then(({ n, no }) => {
              if (modoGrupo) location.href = `grupo.html?folio=${encodeURIComponent(x.g.folio)}&hecho=agregadas&n=${n}${no.length ? `&no=${no.map(encodeURIComponent).join(',')}` : ''}`;
              else irConAviso('agregadas', x.g.folio, n, no);
            })
            .catch((e) => { libera(); falla(e && e.motivo ? [`No se agregó a nadie a «${x.calculado}»`, `${e.motivo.replace(/^No se agregó a nadie: /, '')}. Vuelva a cargar la página para ver la espera de ahora.`]
              : ['No se pudo guardar', 'La elección sigue aquí; intente de nuevo.']); });
        });
        return b;
      });
      if (!modoGrupo) {
        // «A un curso nuevo…»: Programar con las elegidas (sin elegir a nadie, Programar propone a las que más esperan)
        const nuevo = el('a', { class: 'btn btn-secundario btn-chico', href: `programar.html?curso=${clave}`, texto: 'A un curso nuevo…' });
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
      // Con fecha, pero ya pasó: una propuesta que nadie confirmó o un grupo confirmado que no inició (P124). No son «Sin
      // fecha»: van en su sección, arriba, para elegir otra semana (auditoría 2026-10-19, R4-04 y RI-07)
      const pasada = activos.filter((x) => !conFecha.includes(x) && x.g.fecha_inicio);
      const sinFecha = activos.filter((x) => !conFecha.includes(x) && !x.g.fecha_inicio);
      // Semana de cada grupo: la de su primer día; un grupo en curso que empezó antes, en esta semana
      const semanaDe = (x) => Math.max(0, Math.round((new Date(`${P.lunesDe(x.g.fecha_inicio)}T12:00:00-06:00`) - new Date(`${lunes0}T12:00:00-06:00`)) / (7 * 86400000)));
      const total = Math.max(SEMANAS, ...conFecha.map((x) => semanaDe(x) + 1));
      const secciones = [];
      if (pasada.length) {
        secciones.push(el('section', { class: 'plan-semana', 'aria-labelledby': 'semana-pasada', 'data-semana': 'pasada' }, [
          el('h4', { class: 'plan-semana-titulo', id: 'semana-pasada' }, [el('span', { class: 'plan-semana-nombre', texto: 'Su fecha ya pasó' })]),
          el('div', { class: 'plan-semana-cuerpo' }, pasada.sort((a, b) => a.g.fecha_inicio.localeCompare(b.g.fecha_inicio)).map((x) => tarjeta(x, espera, 'h5', true)))
        ]));
      }
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
            el('span', { class: 'plan-semana-fechas', texto: semana(lunes, domingo).replace(/^del /, '') })]),
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
      // Cada enlace dice también su semana (auditoría 2026-10-20, B4-07: eran 5 enlaces con el mismo nombre)
      if (!razon) { const a = programar(lunes, 'Programar un curso esta semana'); a.append(el('span', { class: 'solo-lector', texto: ` (${semana(lunes, domingo)})` })); return a; }
      let primero = null;
      for (let d = APD.sumaDias(lunes, 1); d <= domingo; d = APD.sumaDias(d, 1)) if (!P.razonNoInicio(datos, tipo, modalidad, d)) { primero = d; break; }
      const linea = el('p', { class: 'plan-semana-no', texto: `El lunes ya no se puede: ${razon.texto}.${primero ? ` Desde el ${fechaLarga(primero)} sí, a media semana.` : ''}` });
      return primero ? el('div', { class: 'plan-semana-libre' }, [linea, programar(primero, `Programar desde el ${fechaLarga(primero)}`)]) : linea;
    }

    /* La tarjeta de un grupo en su semana */
    /* pasada: su fecha ya pasó (propuesta vencida, o confirmado que no inició): sin el examen como si fuera a ocurrir */
    function tarjeta(x, espera, nivel, pasada) {
      const { g, c } = x;
      const dia = P.diaDelCurso(datos, g);
      const fin = APD.ultimoDia(datos, g);
      const situacion = dia ? estado(dia.texto, 'marcha')
        : pasada && g.estado === 'en_integracion' ? estado('Propuesta vencida', 'pend')
          : pasada ? estado(`${x.situacion.texto} · no inició`, 'pend') : estado(x.situacion.texto, x.situacion.tono);
      const examen = !g.fecha_inicio || pasada ? null : c.dias_duracion > 1 ? `examen el ${fechaCorta(fin)} en el PILARES` : 'examen ese día en el PILARES';
      // Un grupo por confirmar lleno ya no recibe, pero se confirma y se le elige semana como cualquiera (auditoría
      // «intentar romperlo», F3 M3): el cupo y esas acciones van con «por confirmar»; sólo «Completar» pide lugar
      const integra = g.estado === 'en_integracion';
      const conCupo = x.recibe || integra;
      const datosLinea = APD.lineaDatos([
        g.integracion === 'especifico' ? 'De una organización' : 'Combinado',
        conCupo ? null : plural(x.n, 'persona', 'personas'),
        g.hora_entrada ? `entrada ${APD.hhmm(g.hora_entrada)}` : 'sin hora',
        g.instructor ? P.nombreInstructor(g.instructor) : 'sin instructor',
        examen
      ]);
      const partes = [
        el('div', { class: 'plan-grupo-cabeza' }, [el(nivel, { class: 'plan-grupo-nombre' }, [APD.grupoTitulo(g, datos)]), situacion]),
        datosLinea
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
            // Secundario: el único principal de la pantalla es «Programar un curso» (C6-02, decisión 2)
            const b = el('button', { type: 'button', class: 'btn btn-secundario', texto: van.length === 1 ? 'Completar con la que más espera' : `Completar con las ${van.length} que más esperan` });
            b.addEventListener('click', () => {
              // Deshabilitado mientras guarda (F3 B10); el aviso dice cuántas entraron de verdad (F3 M1)
              const libera = APD.ocupa(b);
              if (!libera) return;
              agrega(g, van.map((y) => y.s.folio))
                .then(({ n, no }) => irConAviso('agregadas', g.folio, n, no))
                .catch((e) => { libera(); APD.pintaAviso($('[data-hecho]'), 'error', e && e.motivo ? `No se agregó a nadie a «${x.calculado}»` : 'No se pudo guardar',
                  e && e.motivo ? `${e.motivo.replace(/^No se agregó a nadie: /, '')}. Vuelva a cargar la página para ver la espera de ahora.` : 'Intente de nuevo.', true); });
            });
            acciones.push(b);
          }
        }
      }
      if (integra && falta <= 0) acciones.push(botonConfirmar(x));
      if (integra) {
        const texto = pasada ? 'Elegir otra semana' : g.fecha_inicio ? 'Cambiar la semana' : 'Elegir semana';
        acciones.push(el('a', { class: 'btn btn-secundario', href: `programar.html?curso=${clave}&grupo=${encodeURIComponent(g.folio)}`,
          'aria-label': `${texto} de ${x.calculado} · ${g.folio}`, texto }));
      }
      acciones.push(el('a', { class: 'btn-enlace', href: `grupo.html?folio=${encodeURIComponent(g.folio)}`, 'aria-label': `Ver a las personas de ${x.calculado} · ${g.folio}`, texto: 'Ver a las personas' }));
      partes.push(el('div', { class: 'plan-grupo-acciones' }, acciones));
      return el('article', { class: 'plan-grupo', 'data-grupo': g.folio, 'data-situacion': g.estado }, partes);
    }

    /* Cupo de 25 lugares: lo ocupado, lo que falta para el mínimo y lo libre (la forma no depende sólo del color) */
    function cupo(x) {
      const { g } = x;
      const falta = g.cupo_minimo - x.n;
      const celdas = Array.from({ length: g.cupo_maximo }, (_, i) => el('span', { class: 'plan-cupo-lugar', 'data-lugar': i < x.n ? 'ocupado' : i < g.cupo_minimo ? 'minimo' : 'libre' }));
      const hasta = g.estado === 'confirmado' ? ` hasta el ${fechaCorta(APD.sumaDias(g.fecha_inicio, -1))}` : '';
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
      if (!listo) return el('a', { class: 'btn btn-secundario', href: `grupo.html?folio=${encodeURIComponent(g.folio)}#t-confirmar`, texto: 'Confirmar el grupo' });
      const b = el('button', { type: 'button', class: 'btn btn-secundario', texto: 'Confirmar el grupo' });
      b.addEventListener('click', () => {
        FormKit.confirma(b, { titulo: `¿Confirmar «${x.calculado}»?`,
          consecuencias: [`${plural(x.n, 'persona', 'personas')}, entrada a las ${APD.hhmm(g.hora_entrada)}, con ${P.nombreInstructor(g.instructor)}.`,
            'Cada persona ve en «Mis trámites» las fechas, la hora de entrada y dónde presentarse.',
            `Sigue recibiendo personas hasta el ${fechaCorta(APD.sumaDias(g.fecha_inicio, -1))}, sin pasar de ${g.cupo_maximo}.`],
          si: 'Sí, confirmar el grupo' })
          .then((si) => {
            if (!si) return;
            const libera = APD.ocupa(b);
            if (!libera) return;
            // Como la API: con lo guardado de ahora (otra pestaña pudo dar de baja a alguien) y comprobando que quedó
            // confirmado; si no, se dice por qué (F3 M2: «Grupo confirmado» aunque no se confirmó)
            const deAhora = (d) => d.grupo.find((y) => y.id === g.id);
            P.guardaGrupoComprobado({
              antes: (d1) => P.razonNoConfirma(d1, deAhora(d1), g.fecha_inicio),
              eventos: () => ({ tipo: 'confirmar', grupo_id: g.id, fecha_inicio: g.fecha_inicio, hora_entrada: APD.hhmm(g.hora_entrada), instructor: g.instructor, por: P.REVISORA.usuario }),
              comprueba: (d2) => (deAhora(d2) && deAhora(d2).estado === 'confirmado' ? null : P.razonNoConfirma(d2, deAhora(d2), g.fecha_inicio) || 'la base no lo confirmó')
            })
              .then(() => irConAviso('confirmado', g.folio))
              .catch((e) => { libera(); APD.pintaAviso($('[data-hecho]'), 'error', 'No se confirmó el grupo', e && e.motivo ? `${mayus(e.motivo)}. Vuelva a cargar la página para ver el grupo como está ahora.` : 'Intente de nuevo.', true); });
          });
      });
      return b;
    }
  }).catch(() => {
    $('[data-hoy]').textContent = 'No se pudieron cargar los grupos. Intente de nuevo más tarde.';
  });
}());
