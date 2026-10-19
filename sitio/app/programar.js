/* programar.js · «Programar un curso» en tres pasos (personal, etapa 2; propuesta B, aprobada por Liber el 2026-10-18).
   ?curso=poda-nueva (tipo-modalidad) · &semana=AAAA-MM-DD (el día en que empieza; desde «Programar un curso esta semana»)
   · &personas=folio1,folio2 (las elegidas en «Grupos», «A un curso nuevo…») · ?grupo=APD-G-… (un grupo por confirmar que
   ya existe: «Elegir semana» o «Cambiar la semana»; su curso y su tipo de grupo no cambian).
     1. ¿Qué semana? Calendario del mes (lunes a domingo): se toca el día en que empieza y se resalta el curso completo
        (5 días seguidos o 1), con «inicia» y «examen». No se puede empezar con menos de dias_anticipacion_grupo días ni si
        otro grupo del mismo curso ocupa esas fechas; los días inhábiles del calendario oficial quedan [por confirmar]
        (P.diasInhabiles: hoy no hay ninguno). El calendario es una tabla con un botón por día (aria-pressed, nombre con la
        fecha completa y, si no se puede, la razón); con el teclado: flechas, Inicio, Fin, RePág y AvPág.
     2. ¿Quién lo da y a qué hora? Instructor (dice si ya tiene otro curso esas fechas) y hora de entrada de la misma
        lista cerrada que la ficha del grupo.
     3. ¿Quiénes van? La propuesta: las que más esperan, hasta 25, con las prioritarias primero y las de una misma
        organización juntas (P.lasQueMasEsperan); o las elegidas en «Grupos».
   «Así quedaría» resume el grupo con su nombre calculado (APD.nombreGrupo). «Crear y confirmar el grupo» exige lo de
   confirmar (mínimo de personas, primer día a tiempo, hora e instructor) y dice qué falta; «Guardar sin confirmar» lo deja
   en integración con su fecha como propuesta. Se guarda con los eventos de siempre (APD_PERSONAL.guardaGrupo: crear,
   agregar, proponer, confirmar); la base lo vuelve a aplicar todo (apd.grupo_alta, apd.inscripcion_alta,
   apd.grupo_cambio). Al terminar, el resultado del estándar (FormKit.resultado) con «Qué sigue». */
(function () {
  'use strict';
  const { el, fecha } = APD;
  const P = APD_PERSONAL;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const plural = APD.plural;
  const params = new URLSearchParams(location.search);
  const MESES = APD.MESES;
  const mayuscula = (t) => t.charAt(0).toLocaleUpperCase('es-MX') + t.slice(1);
  const V = () => window.FORMKIT_VALIDACIONES;

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'grupos');
    const hoy = APD.hoy(datos);
    const gExistente = params.get('grupo') ? datos.grupo.find((g) => g.folio === params.get('grupo')) : null;
    const clave = gExistente ? P.claveCurso(gExistente.tipo_acreditacion, gExistente.modalidad) : params.get('curso');
    const curso = P.deClave(clave);

    /* Sin curso: se elige aquí */
    if (!curso) {
      // Lo que trae la dirección no se repite en pantalla: sólo un folio con forma de folio (auditoría 2026-10-19, E1-02)
      const g = params.get('grupo');
      $('[data-bajada]').textContent = g ? `No se encontró ${/^APD-G-\d{4}-\d{3}$/.test(g) ? `el grupo ${g}` : 'ese grupo'}. Elija el curso que quiere programar.` : 'Elija el curso que quiere programar.';
      $('[data-sin-curso]').hidden = false;
      $('[data-cursos]').replaceChildren(...P.CURSOS.map(([t, m]) => el('li', {}, [el('a', { class: 'btn btn-secundario', href: `programar.html?curso=${P.claveCurso(t, m)}`, texto: APD.cursoLargo(t, m) })])));
      return;
    }
    const [tipo, modalidad] = curso;
    const c = APD.curso(datos, tipo, modalidad);
    const dur = c.dias_duracion;
    const largo = APD.cursoLargo(tipo, modalidad);
    const xG = gExistente ? P.grupo(datos, gExistente) : null;
    $('[data-volver]').href = `grupos.html?curso=${clave}`;
    $('[data-ir-grupos]').href = `grupos.html?curso=${clave}`;
    if (gExistente && gExistente.estado !== 'en_integracion') {
      $('#t-programar').textContent = `Programar «${xG.calculado}»`;
      $('[data-bajada]').replaceChildren(document.createTextNode('Este grupo ya no está por confirmar: su fecha se ve en su '),
        el('a', { href: `grupo.html?folio=${encodeURIComponent(gExistente.folio)}`, texto: 'ficha' }), document.createTextNode('.'));
      return;
    }
    document.title = `Programar un curso · ${largo} · Personal · Acreditaciones de arbolado urbano`;
    $('#t-programar').replaceChildren(document.createTextNode(gExistente ? 'Programar el grupo ' : 'Programar un curso · '),
      gExistente ? el('span', { class: 'mono', texto: gExistente.folio }) : document.createTextNode(largo));
    $('[data-bajada]').textContent = gExistente
      ? `${largo}, ${xG.integracion.toLowerCase()}, con ${plural(xG.n, 'persona', 'personas')}. Elija la semana, quién lo da y a qué hora, y si quiere, agregue personas de la espera. El sistema propone; usted ajusta.`
      : 'Tres decisiones, en el orden en que se piensan: qué semana, quién lo da y a qué hora, y quiénes van. El sistema propone; usted ajusta.';
    const form = $('#programar');
    form.hidden = false;
    /* Salir a mitad pierde lo elegido: el navegador lo advierte mientras haya algo sin guardar, como en las otras pantallas
       del personal (auditoría 2026-10-19, B5-02). Sólo cuenta lo que hace quien programa, no lo que propone la página. */
    let sinGuardar = false;
    const marcaCambio = (e) => { if (e.isTrusted && !form.hidden) sinGuardar = true; };
    form.addEventListener('input', marcaCambio);
    form.addEventListener('change', marcaCambio);
    window.addEventListener('beforeunload', (e) => { if (sinGuardar && !form.hidden) { e.preventDefault(); e.returnValue = ''; } });
    const minimo = P.primerDiaPosible(datos);
    const maximo = P.ultimoDiaPosible(datos); // un año después de hoy (decisión 3, auditoría 2026-10-19)
    const anticipacion = APD.parametro(datos, 'dias_anticipacion_grupo') || 7;
    // La leyenda dice los días de anticipación del parámetro, como la regla (auditoría 2026-10-19, R4-15)
    $('[data-leyenda-no]').textContent = `No se puede: menos de ${anticipacion} días u otro curso igual esas fechas`;
    const inhabiles = new Set(P.diasInhabiles(datos));
    const excepto = gExistente ? gExistente.id : null;
    const razon = (d) => P.razonNoInicio(datos, tipo, modalidad, d, excepto);
    const finDe = (d) => APD.sumaDias(d, dur - 1);
    const sede = APD.sede(datos).nombre;
    $('[data-ayuda-semana]').textContent = dur > 1
      ? `Toque el día en que empieza (de preferencia, un lunes). El curso dura ${dur} días seguidos; el examen es el último, en el PILARES. Desde el ${APD.diaSemana(minimo)} ${fecha(minimo)}: ${anticipacion} días después de hoy; hasta el ${fecha(maximo)}, un año después.`
      : `Toque el día del curso. Dura un día y el examen es ese mismo día, en el PILARES. Desde el ${APD.diaSemana(minimo)} ${fecha(minimo)}: ${anticipacion} días después de hoy; hasta el ${fecha(maximo)}, un año después.`;

    /* ----- Paso 1 · calendario ----- */
    const fi = $('#fecha_inicio');
    $('[data-campo="fecha_inicio"]').dataset.min = minimo;
    $('[data-campo="fecha_inicio"]').dataset.max = maximo;
    const isoDe = (t) => (V() && V().isoDeDma ? V().isoDeDma(t) : '') || '';
    let inicio = null;
    let mes = null; // AAAA-MM
    let foco = null; // día con el tabindex del calendario
    const mesDe = (d) => d.slice(0, 7);
    // El calendario va del mes de hoy al del último día posible: una fecha fuera (?semana=2099-01-05, 01/01/2099 escrito)
    // no lo lleva a ese mes
    const mesValido = (d) => Boolean(d) && mesDe(d) >= mesDe(hoy) && mesDe(d) <= mesDe(maximo);
    const primerElegible = () => {
      // Primero un lunes (como se piensa la semana); si en medio año no hay, el primer día que se pueda
      for (let d = P.lunesDe(minimo), k = 0; k < 26; k++, d = APD.sumaDias(d, 7)) if (d >= minimo && !razon(d)) return d;
      for (let d = minimo, k = 0; k < 180; k++, d = APD.sumaDias(d, 1)) if (!razon(d)) return d;
      return null;
    };
    // Una fecha imposible en la dirección (2026-13-45, 2026-11-31) se ignora: se propone la primera semana posible
    // (auditoría «intentar romperlo», F3 B2)
    const semana = params.get('semana') || '';
    const pedida = /^\d{4}-\d{2}-\d{2}$/.test(semana) && V() && V().isoDeDma(V().dmaDeIso(semana)) === semana ? semana : null;
    const estadoCal = $('[data-cal-estado]');
    const diga = (texto) => FormKit.anuncia(texto, { visible: estadoCal });
    if (pedida && !razon(pedida)) inicio = pedida;
    else if (!pedida && gExistente && gExistente.fecha_inicio && !razon(gExistente.fecha_inicio)) inicio = gExistente.fecha_inicio;
    else if (!pedida) inicio = primerElegible();
    const pedidaValida = mesValido(pedida) ? pedida : null;
    mes = mesDe(inicio || pedidaValida || minimo);
    foco = inicio || pedidaValida || minimo;

    function etiquetaDia(d, r, enRango, k) {
      const base = `${APD.diaSemana(d)} ${APD.diaMes(d, true)}`;
      if (d === inicio) return `${base}: empieza el curso elegido${dur > 1 ? `, ${APD.rangoFechas(inicio, finDe(inicio), hoy.slice(0, 4))}` : ''}`;
      if (enRango) return `${base}: día ${k} de ${dur} del curso elegido${k === dur ? ', examen' : ''}`;
      if (r) return `${base}: no se puede empezar, ${r.texto}`;
      return `${base}: se puede empezar`;
    }
    function pintaCalendario(enfocar) {
      const [a, m] = mes.split('-').map(Number);
      $('[data-mes-nombre]').textContent = `${mayuscula(MESES[m - 1])} de ${a}`;
      const primero = `${mes}-01`;
      const siguiente = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
      const ultimo = APD.sumaDias(siguiente, -1);
      const fin = inicio ? finDe(inicio) : null;
      if (!foco || mesDe(foco) !== mes) foco = inicio && mesDe(inicio) === mes ? inicio : primero;
      const filas = [];
      for (let lunes = P.lunesDe(primero); lunes <= ultimo; lunes = APD.sumaDias(lunes, 7)) {
        const celdas = [];
        for (let i = 0; i < 7; i++) {
          const d = APD.sumaDias(lunes, i);
          if (mesDe(d) !== mes) { celdas.push(el('td', { class: 'cal-fuera' })); continue; }
          const r = razon(d);
          const enRango = Boolean(inicio) && d >= inicio && d <= fin;
          const k = enRango ? Math.round((new Date(`${d}T12:00:00-06:00`) - new Date(`${inicio}T12:00:00-06:00`)) / 86400000) + 1 : 0;
          const otro = !enRango && P.choques(datos, tipo, modalidad, d, d, excepto)[0];
          const nota = enRango ? (d === inicio ? (dur > 1 ? 'inicia' : 'curso y examen') : d === fin ? 'examen' : '')
            : inhabiles.has(d) ? 'inhábil' : otro ? otro.folio.replace(/^APD-/, '') : d === hoy ? 'hoy' : '';
          const b = el('button', { type: 'button', class: 'cal-dia', 'data-fecha': d, tabindex: d === foco ? '0' : '-1',
            'aria-pressed': String(d === inicio), 'aria-disabled': r ? 'true' : null, 'data-rango': enRango ? (d === inicio ? 'inicio' : d === fin ? 'fin' : 'medio') : null,
            'data-no': r ? r.clave : null, 'data-inhabil': inhabiles.has(d) ? 'si' : null, 'aria-label': etiquetaDia(d, r, enRango, k) }, [
            el('span', { class: 'cal-num', 'aria-hidden': 'true', texto: String(Number(d.slice(8))) }),
            el('span', { class: 'cal-nota', 'aria-hidden': 'true', texto: nota })
          ]);
          celdas.push(el('td', {}, [b]));
        }
        filas.push(el('tr', {}, celdas));
      }
      $('[data-dias]').replaceChildren(...filas);
      $('[data-mes="-1"]').disabled = mes <= mesDe(hoy);
      $('[data-mes="1"]').disabled = mes >= mesDe(maximo);
      if (enfocar) { const b = $(`.cal-dia[data-fecha="${foco}"]`); if (b) b.focus(); }
    }
    /* Elegir un día (calendario o campo): el campo se llena en día/mes/año y el estándar lo valida */
    function elige(d, desdeCampo) {
      const r = razon(d);
      if (r) {
        diga(`El ${APD.diaSemana(d)} ${fecha(d)} no se puede: ${r.texto}.`);
        return false;
      }
      inicio = d;
      mes = mesDe(d);
      foco = d;
      recuerdaSemana(d);
      if (!desdeCampo) { fi.value = V().dmaDeIso(d); APD.avisa(fi); }
      diga(dur > 1 ? `Elegido: ${APD.rangoFechas(d, finDe(d), hoy.slice(0, 4))}; el examen, el ${APD.diaSemana(finDe(d))} ${APD.diaMes(finDe(d))}.` : `Elegido: ${APD.diaSemana(d)} ${APD.diaMes(d)}, con su examen.`);
      return true;
    }
    /* La semana elegida queda en la dirección (&semana=): recargar, «Atrás» y «Adelante» la conservan (auditoría 2026-10-19,
       B5-02). Lo demás (instructor, hora, personas) no: salir con cambios lo advierte el navegador (abajo). */
    function recuerdaSemana(d) {
      const url = new URL(location.href);
      if (d) url.searchParams.set('semana', d); else url.searchParams.delete('semana');
      if (url.href !== location.href) history.replaceState(history.state, '', url);
    }
    $('[data-dias]').addEventListener('click', (e) => {
      const b = e.target.closest('.cal-dia');
      if (!b) return;
      if (e.isTrusted) sinGuardar = true;
      elige(b.dataset.fecha);
      foco = b.dataset.fecha;
      pintaTodo(true);
    });
    $('[data-dias]').addEventListener('keydown', (e) => {
      const b = e.target.closest('.cal-dia');
      if (!b) return;
      const d = b.dataset.fecha;
      const paso = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      let nuevo = null;
      if (paso) nuevo = APD.sumaDias(d, paso);
      else if (e.key === 'Home') nuevo = P.lunesDe(d);
      else if (e.key === 'End') nuevo = APD.sumaDias(P.lunesDe(d), 6);
      else if (e.key === 'PageUp' || e.key === 'PageDown') {
        const [a, m] = d.split('-').map(Number);
        const dt = new Date(Date.UTC(a, m - 1 + (e.key === 'PageUp' ? -1 : 1), 1, 18));
        const finMes = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0, 18)).getUTCDate();
        nuevo = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(Number(d.slice(8)), finMes)).padStart(2, '0')}`;
      }
      if (!nuevo) return;
      e.preventDefault();
      if (!mesValido(nuevo)) return;
      foco = nuevo;
      mes = mesDe(nuevo);
      pintaCalendario(true);
    });
    for (const b of $$('[data-mes]')) {
      b.addEventListener('click', () => {
        const [a, m] = mes.split('-').map(Number);
        const dt = new Date(Date.UTC(a, m - 1 + Number(b.dataset.mes), 1, 18));
        mes = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
        foco = null;
        pintaCalendario(false);
      });
    }
    // Lo escrito en el campo mueve el calendario (y si no se puede, lo dice)
    const deCampo = () => {
      const d = isoDe(fi.value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        // Vacío, o completo (dd/mm/aaaa) pero no es una fecha real (29/02/2027): el resumen y el calendario quedan sin
        // elegir y se dice al momento (F3 B3)
        const completo = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fi.value.trim());
        if (!fi.value.trim() || completo) {
          inicio = null;
          recuerdaSemana(null);
          pintaTodo(false);
          if (completo) diga(`${fi.value.trim()} no es una fecha real. Escriba otra o elija el día en el calendario.`);
        }
        return;
      }
      if (d === inicio) return;
      if (!elige(d, true)) { inicio = null; recuerdaSemana(null); if (mesValido(d)) { mes = mesDe(d); foco = d; } }
      pintaTodo(false);
    };
    fi.addEventListener('input', deCampo);
    fi.addEventListener('change', deCampo);
    if (inicio) fi.value = V().dmaDeIso(inicio);
    if (pedida && !inicio) diga(`El ${APD.diaSemana(pedida)} ${fecha(pedida)} no se puede: ${razon(pedida).texto}. Elija otro día.`);

    /* ----- Paso 2 · instructor y hora ----- */
    const selInstructor = $('#instructor');
    const selHora = $('#hora_entrada');
    if (gExistente && gExistente.instructor) selInstructor.value = gExistente.instructor;
    if (gExistente && gExistente.hora_entrada) selHora.value = APD.hhmm(gExistente.hora_entrada);
    // La propuesta, si no hay otra: entrada a las 09:00 y el primer instructor libre esas fechas
    if (!selHora.value) selHora.value = '09:00';
    if (!selInstructor.value) {
      const libre = inicio && [...selInstructor.options].find((o) => o.value && !P.ocupado(datos, o.value, inicio, finDe(inicio), excepto).length);
      if (libre) selInstructor.value = libre.value;
    }
    for (const s of [selInstructor, selHora]) s.toggleAttribute('data-vacio', !s.value);
    function pintaInstructores() {
      const fin = inicio ? finDe(inicio) : null;
      for (const o of selInstructor.options) {
        if (!o.value) continue;
        const nombre = P.nombreInstructor(o.value);
        const otros = inicio ? P.ocupado(datos, o.value, inicio, fin, excepto) : [];
        o.textContent = inicio ? `${nombre} · ${otros.length ? 'tiene otro curso esas fechas' : 'libre esas fechas'}` : nombre;
      }
      const sel = selInstructor.value;
      const otros = sel && inicio ? P.ocupado(datos, sel, inicio, fin, excepto) : [];
      // «ya da» sólo un grupo confirmado o en curso; uno por confirmar sólo lo tiene propuesto (F3 B9)
      const seguros = otros.filter((g) => g.estado !== 'en_integracion');
      const propuestos = otros.filter((g) => g.estado === 'en_integracion');
      const nombres = (l) => l.map((g) => `«${APD.nombreGrupo(g, datos)}»`).join(' y ');
      $('[data-ayuda-instructor]').textContent = otros.length
        ? `${P.nombreInstructor(sel)} ${[seguros.length ? `ya da ${nombres(seguros)}` : '', propuestos.length ? `tiene propuesto ${nombres(propuestos)}, todavía sin confirmar,` : ''].filter(Boolean).join(' y ')} esas fechas. Puede elegirlo, pero no podría estar en los dos.`
        : 'Se indica si ya tiene otro curso esas fechas. Puede cambiar durante el curso; cada día queda quién capturó la asistencia.';
    }
    selInstructor.addEventListener('change', () => pintaTodo(false));
    selHora.addEventListener('change', () => pintaTodo(false));

    /* ----- Paso 3 · personas ----- */
    const propia = gExistente && gExistente.integracion === 'especifico' ? gExistente.organizacion_id : null;
    const espera = P.enEspera(datos, tipo, modalidad).filter((x) => !propia || x.s.organizacion_id === propia);
    const pedidas = (params.get('personas') || '').split(',').map((f) => f.trim()).filter(Boolean);
    const deUrl = espera.filter((x) => pedidas.includes(x.s.folio));
    // Si alguna de las elegidas en «Grupos» ya no espera (ya tiene grupo: se recargó la página o se volvió con «Atrás»),
    // se dice y no se propone a nadie más (auditoría «intentar romperlo», F3 M5: se marcaban 18 que nadie eligió)
    const yaNo = pedidas.length - deUrl.length;
    const propuestas = new Set((pedidas.length || gExistente ? deUrl : P.lasQueMasEsperan(espera, c.cupo_maximo)).map((x) => x.s.folio));
    $('[data-propuesta]').textContent = yaNo
      ? `${yaNo === pedidas.length ? (yaNo === 1 ? 'La persona que eligió en «Grupos» ya no está en espera: ya tiene grupo.' : `Las ${yaNo} que eligió en «Grupos» ya no están en espera: ya tienen grupo.`)
        : `${yaNo} de las ${pedidas.length} que eligió en «Grupos» ya no ${yaNo === 1 ? 'está' : 'están'} en espera: ya ${yaNo === 1 ? 'tiene' : 'tienen'} grupo. Quedan marcadas las demás.`} No se propone a nadie más: marque a quien quiera agregar.`
      : deUrl.length ? `Las ${deUrl.length === 1 ? 'que eligió' : `${deUrl.length} que eligió`} en «Grupos»; puede agregar o quitar.`
        : gExistente ? 'Marque a quien quiera agregar de la espera.'
          : 'Propuesta: las que más esperan, hasta 25, primero las prioritarias y las de una misma organización juntas.';
    if (gExistente) {
      const ya = $('[data-ya-estan]');
      ya.hidden = false;
      const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
      const sols = Object.fromEntries(datos.solicitud.map((s) => [s.id, s]));
      ya.replaceChildren(el('p', { class: 'prog-ya-titulo', texto: xG.n ? `Ya están en el grupo (${xG.n}):` : 'El grupo todavía no tiene personas.' }),
        xG.n ? el('ul', { class: 'prog-ya' }, xG.inscritas.map((i) => el('li', { texto: APD.nombreCompleto(persona[(sols[i.solicitud_id] || {}).solicitante_id] || {}) }))) : null);
      // El tipo de grupo (específico o combinado) no cambia después de crearlo
      $('[data-campo="integracion"]').hidden = true;
    }
    const filas = [];
    // La fila de cada persona y el bloque de su organización, los mismos de «Grupos» (P.filaEspera, P.bloqueEspera)
    const persona = (x, conOrg) => {
      const k = el('input', { class: 'casilla-input plan-casilla', type: 'checkbox', value: x.s.folio, checked: propuestas.has(x.s.folio) });
      filas.push({ x, k });
      return P.filaEspera(x, k, conOrg);
    };
    const items = P.bloquesEspera(espera).map((b, i) => {
      if (!b.junta) return el('li', {}, [persona(b.xs[0], true)]);
      const propias = b.xs.map((x) => persona(x, false));
      const { bloque, refleja } = P.bloqueEspera(b, `pb-${i}`, propias, filas.filter((f) => b.xs.includes(f.x)).map((f) => f.k), null, () => pintaTodo(false));
      refleja();
      return el('li', {}, [bloque]);
    });
    $('[data-personas]').replaceChildren(...(items.length ? items : [el('li', { class: 'texto-gris', texto: propia ? 'Nadie de esa organización espera en este curso.' : 'Nadie espera en este curso.' })]));
    $('[data-personas]').addEventListener('change', () => pintaTodo(false));
    const elegidas = () => filas.filter((f) => f.k.checked).map((f) => f.x);
    const total = () => (xG ? xG.n : 0) + elegidas().length;
    /* Tipo de grupo: «Sólo de …» dice de cuál, si todas las elegidas son de la misma organización registrada */
    const orgDeElegidas = () => { const o = [...new Set(elegidas().map((x) => x.s.organizacion_id || null))]; return o.length === 1 && o[0] ? o[0] : null; };
    function pintaIntegracion() {
      if (gExistente) return;
      const org = orgDeElegidas();
      const nombre = org ? (elegidas()[0] || {}).organizacion : '';
      $('[data-especifico-de]').textContent = org ? `Sólo de ${nombre}` : 'Sólo de una organización';
      const y = suGrupo();
      $('[data-especifico-desc]').textContent = org
        ? `Recibe únicamente a la gente de ${nombre}.${total() < c.cupo_minimo ? ` Para confirmarlo se necesitan ${c.cupo_minimo} de esa organización.` : ''}${y ? ` Ya tiene su grupo ${y.g.folio}, que recibe personas.` : ''}`
        : 'Todas las elegidas tienen que ser de la misma organización registrada; ahora son de varias o independientes.';
    }
    const integracion = () => (gExistente ? gExistente.integracion : (($('input[name="integracion"]:checked') || {}).value || 'combinado'));

    /* «Su grupo» (decisión 2 de la auditoría del 2026-10-19, Liber; auditoría de tareas, M3): si todas las elegidas son de
       una organización que ya tiene un grupo propio de este curso que recibe personas, se dice y se ofrece agregarlas ahí;
       crear otro de esa organización pide confirmación (con dos grupos, ninguno llega al mínimo) */
    const propiosQueReciben = P.grupos(datos).filter((x) => x.recibe && x.g.integracion === 'especifico' && x.g.tipo_acreditacion === tipo && x.g.modalidad === modalidad);
    const suGrupo = () => { const org = gExistente ? null : orgDeElegidas(); return org ? propiosQueReciben.find((x) => x.g.organizacion_id === org) || null : null; };
    const cajaSuGrupo = $('[data-su-grupo]');
    const activasEn = (d, gid) => new Set(d.inscripcion.filter((i) => i.grupo_id === gid && i.activa).map((i) => (d.solicitud.find((s) => s.id === i.solicitud_id) || {}).folio));
    function agregaASuGrupo(y, boton) {
      const folios = elegidas().map((x) => x.s.folio);
      if (folios.length > y.lugar) {
        APD.pintaAviso(cajaSuGrupo, 'error', 'Eligió más personas de las que caben', `«${y.calculado}» tiene lugar para ${plural(y.lugar, 'persona', 'personas')}; eligió ${folios.length}.`, true);
        return;
      }
      const libera = APD.ocupa(boton);
      if (!libera) return;
      let entraron = [];
      P.guardaGrupoComprobado({
        eventos: () => ({ tipo: 'agregar', grupo_id: y.g.id, folios, por: P.REVISORA.usuario }),
        comprueba(d2, d1) {
          const antes = activasEn(d1, y.g.id);
          const ahora = activasEn(d2, y.g.id);
          entraron = folios.filter((f) => ahora.has(f) && !antes.has(f));
          return entraron.length ? null : 'no se agregó a nadie: el grupo ya no recibe personas o ya tienen grupo';
        }
      }).then(() => {
        sinGuardar = false;
        const no = folios.filter((f) => !entraron.includes(f));
        location.href = `grupo.html?folio=${encodeURIComponent(y.g.folio)}&hecho=agregadas&n=${entraron.length}${no.length ? `&no=${no.map(encodeURIComponent).join(',')}` : ''}`;
      }).catch((e) => {
        libera();
        APD.pintaAviso(cajaSuGrupo, 'error', `No se agregó a nadie a «${y.calculado}»`, e && e.motivo ? `${mayuscula(e.motivo)}. Vuelva a cargar la página para ver la espera de ahora.` : 'No se pudo guardar; intente de nuevo.', true);
      });
    }
    function pintaSuGrupo() {
      const y = suGrupo();
      if (!y) { cajaSuGrupo.hidden = true; cajaSuGrupo.replaceChildren(); return; }
      const nombre = (elegidas()[0] || {}).organizacion;
      const falta = y.g.cupo_minimo - y.n;
      APD.pintaAviso(cajaSuGrupo, 'info', `${nombre} ya tiene su grupo`,
        `El grupo ${y.g.folio} tiene ${y.n} de ${y.g.cupo_maximo}${falta > 0 ? `, le ${falta === 1 ? 'falta 1' : `faltan ${falta}`} para el mínimo` : ''} y recibe personas. Conviene agregarlas ahí: con dos grupos de la misma organización, ninguno llega al mínimo.`);
      const b = el('button', { type: 'button', class: 'btn btn-secundario btn-chico', texto: `Agregarlas a ${y.g.folio}` });
      b.addEventListener('click', () => agregaASuGrupo(y, b));
      $('.aviso-texto', cajaSuGrupo).append(el('p', {}, [b]));
    }

    /* ----- Así quedaría ----- */
    function pintaResumen() {
      const fin = inicio ? finDe(inicio) : null;
      // Con el año cuando el curso no es de este año o cruza de año (F3 B4: «al viernes 1 de enero» sin año)
      const conAnio = Boolean(inicio) && (inicio.slice(0, 4) !== hoy.slice(0, 4) || fin.slice(0, 4) !== inicio.slice(0, 4));
      const n = total();
      const borrador = { tipo_acreditacion: tipo, modalidad, fecha_inicio: inicio, integracion: integracion(), organizacion_id: integracion() === 'especifico' ? (gExistente ? gExistente.organizacion_id : orgDeElegidas()) : null };
      $('[data-resumen-nombre]').replaceChildren(el('span', { class: 'grupo-titulo' }, [el('span', { class: 'grupo-nombre', texto: APD.nombreGrupo(borrador, datos) }),
        el('span', { class: 'grupo-folio mono', texto: gExistente ? gExistente.folio : `${P.siguienteFolioGrupo(datos)} (lo asigna el sistema al guardar)` })]));
      const falta = c.cupo_minimo - n;
      $('[data-resumen]').replaceChildren(APD.datosLista([
        ['Curso', largo],
        ['Fechas', inicio ? mayuscula(dur > 1 ? `${APD.diaSemana(inicio)} ${APD.diaMes(inicio, conAnio)} al ${APD.diaSemana(fin)} ${APD.diaMes(fin, conAnio)}` : `${APD.diaSemana(inicio)} ${APD.diaMes(inicio, conAnio)}`) : 'Sin elegir'],
        ['Horario', selHora.value ? `${selHora.value}, ${dur > 1 ? `los ${dur} días` : 'ese día'}` : 'Sin elegir'],
        ['Instructor', selInstructor.value ? P.nombreInstructor(selInstructor.value) : 'Sin elegir'],
        ['Examen', inicio ? `${mayuscula(APD.diaSemana(fin))} ${APD.diaMes(fin, conAnio)}, en el salón de cómputo del PILARES` : 'El último día del curso, en el PILARES'],
        ['Lugar del curso', `Aula de capacitación del ${sede}`],
        ['Personas', `${n} de ${c.cupo_maximo}${n > c.cupo_maximo ? ` · sobran ${n - c.cupo_maximo}` : falta > 0 ? ` · ${falta === 1 ? 'falta 1' : `faltan ${falta}`} para confirmarlo` : ''}`]
      ]));
      $('[data-resumen-nota]').textContent = gExistente ? 'Al confirmar, cada persona del grupo ve en «Mis trámites» la fecha, la hora y el lugar.' : 'Al confirmar, cada persona ve en «Mis trámites» la fecha, la hora y el lugar.';
    }
    function pintaTodo(enfocar) {
      pintaCalendario(enfocar);
      pintaInstructores();
      pintaIntegracion();
      pintaSuGrupo();
      pintaResumen();
    }
    if (gExistente) {
      $('[data-programar="confirmar"]').textContent = 'Confirmar el grupo';
      $('[data-programar="guardar"]').textContent = 'Guardar la fecha propuesta';
    }
    pintaTodo(false);

    /* ----- Guardar ----- */
    let accion = 'confirmar';
    // Mientras guarda, ninguno de los dos botones vuelve a guardar: el estándar sólo bloquea el primero ([data-accion=
    // "enviar"]) y «Guardar sin confirmar» mandaba dos creaciones con un doble clic (auditoría «intentar romperlo», F3 M6)
    const botones = $$('[data-programar]');
    for (const b of botones) b.addEventListener('click', (e) => { if (b.getAttribute('aria-disabled') === 'true') { e.preventDefault(); e.stopImmediatePropagation(); return; } accion = b.dataset.programar; }, true);
    const avisoFalta = $('[data-falta]');
    const inst = FormKit.iniciar(form, {
      enviar(payload) {
        avisoFalta.hidden = true;
        const d = payload.datos;
        const ini = isoDe(d.fecha_inicio) || d.fecha_inicio;
        const confirmar = accion === 'confirmar';
        const falta = [];
        const r = razon(ini);
        if (r) { inst.marcaError('fecha_inicio', `Ese día no se puede empezar: ${r.texto}.`); falta.push(`otro primer día: ${r.texto}`); }
        if (confirmar && !d.instructor) { inst.marcaError('instructor', 'Para confirmar el grupo, elija el instructor.'); falta.push('el instructor'); }
        if (confirmar && !d.hora_entrada) { inst.marcaError('hora_entrada', 'Para confirmar el grupo, elija la hora de entrada.'); falta.push('la hora de entrada'); }
        const n = total();
        const sinPersonas = confirmar ? n < c.cupo_minimo : !gExistente && n < 1;
        if (confirmar && n < c.cupo_minimo) falta.push(`${c.cupo_minimo - n === 1 ? 'una persona más' : `${c.cupo_minimo - n} personas más`}: ${n === 1 ? 'hay 1' : `hay ${n}`} y el mínimo es ${c.cupo_minimo}`);
        else if (sinPersonas) falta.push('al menos una persona');
        if (n > c.cupo_maximo) falta.push(`quitar ${plural(n - c.cupo_maximo, 'persona', 'personas')}: el grupo recibe hasta ${c.cupo_maximo}`);
        const esp = integracion() === 'especifico' && !gExistente;
        if (esp && !orgDeElegidas()) { inst.marcaError('integracion', 'Para un grupo de una sola organización, todas las elegidas tienen que ser de ella.'); falta.push('que todas las elegidas sean de la misma organización, o un grupo combinado'); }
        if (falta.length) {
          // Lo que falta, junto a los botones y con el foco ahí; cada campo, además, con su error
          avisoFalta.hidden = false;
          avisoFalta.replaceChildren();
          FormKit.aviso(avisoFalta, { tono: 'bloqueo', titulo: confirmar ? (gExistente ? 'No se confirmó el grupo' : 'No se creó el grupo') : 'No se guardó el grupo',
            texto: [confirmar ? 'Para confirmarlo falta:' : 'Falta:', el('ul', { class: 'lista-obs' }, falta.map((t) => el('li', { texto: mayuscula(t) })))], foco: true });
          return Promise.resolve({ rechazado: true });
        }
        const libera = APD.ocupa(botones.filter((b) => !b.matches('[data-accion="enviar"]')));
        // Un segundo grupo de una organización que ya tiene el suyo: se pregunta antes (decisión 2, 2026-10-19)
        const y = esp ? suGrupo() : null;
        const sigue = !y ? Promise.resolve(true) : FormKit.confirma(botones.find((b) => b.dataset.programar === accion) || botones[0], {
          titulo: `¿Crear otro grupo de ${(elegidas()[0] || {}).organizacion}?`,
          consecuencias: [`Ya tiene el grupo ${y.g.folio}, con ${y.n} de ${y.g.cupo_maximo}, que recibe personas.`,
            `Con dos grupos de la misma organización, ninguno llega al mínimo. Para agregarlas a ese grupo, elija «No» y use «Agregarlas a ${y.g.folio}».`],
          si: 'Sí, crear otro grupo', no: 'No' });
        return sigue.then((si) => (si ? guarda({ ini, hora: d.hora_entrada || null, instructor: d.instructor || null, confirmar, integracion: integracion() }) : { rechazado: true }))
          .finally(() => { if (libera) libera(); });
      },
      alEnviar(r) { if (r && r.rechazado) return; muestraResultado(r); },
      alFallar(err) { if (APD.muestraRechazo(err, form)) return; const a = $('[data-estado-envio] .aviso-texto', form); if (err && err.mensaje && a) a.textContent = err.mensaje; }
    });

    /* Los eventos de siempre, en orden (la base hace lo mismo en una transacción), como lo haría la API (auditoría «intentar
       romperlo», F3 A1): el folio de un grupo nuevo se calcula al guardar, con lo guardado más reciente (no con lo de cuando
       se abrió la página), y la creación lleva un id propio; después se lee lo que quedó. Si otra pestaña creó un grupo con
       ese folio al mismo tiempo, la base rechaza éste y no se toca el otro. */
    function guarda({ ini, hora, instructor, confirmar, integracion: tipoGrupo }) {
      const folios = elegidas().map((x) => x.s.folio);
      const por = P.REVISORA.usuario;
      let id = gExistente ? gExistente.id : null;
      return P.guardaGrupoComprobado({
        // Un grupo que ya existe: sigue por confirmar (otra pestaña pudo confirmarlo o cancelarlo)
        antes: (d1) => {
          if (!gExistente) return null;
          const g1 = d1.grupo.find((x) => x.id === gExistente.id);
          return !g1 ? 'el grupo ya no existe' : g1.estado !== 'en_integracion' ? `el grupo ya está «${P.grupo(d1, g1).situacion.texto}»` : null;
        },
        eventos: (d1) => {
          const pasos = [];
          if (gExistente) { if (folios.length) pasos.push({ tipo: 'agregar', grupo_id: id, folios, por }); } else {
            const folio = P.siguienteFolioGrupo(d1);
            id = `prueba-grupo:${folio}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            pasos.push({ tipo: 'crear', grupo_id: id, folio, tipo_acreditacion: tipo, modalidad, integracion: tipoGrupo, organizacion_id: tipoGrupo === 'especifico' ? orgDeElegidas() : null, folios, por });
          }
          pasos.push({ tipo: 'proponer', grupo_id: id, fecha_inicio: ini, hora_entrada: hora, instructor, por });
          if (confirmar) pasos.push({ tipo: 'confirmar', grupo_id: id, fecha_inicio: ini, hora_entrada: hora, instructor, por });
          return pasos;
        },
        comprueba: (d2) => {
          const g = d2.grupo.find((x) => x.id === id);
          if (!g) return 'otra pestaña creó un grupo con el mismo folio al mismo tiempo';
          return g.fecha_inicio === ini ? null : 'la fecha propuesta no se guardó';
        }
      }).then(({ datos: d2 }) => {
        const g = d2.grupo.find((x) => x.id === id);
        // Las elegidas que de verdad entraron (otra pestaña pudo darles grupo en ese momento): el resultado lo dice
        const dentro = new Set(d2.inscripcion.filter((i) => i.grupo_id === id && i.activa).map((i) => (d2.solicitud.find((x) => x.id === i.solicitud_id) || {}).folio));
        return { datos: d2, g, confirmar, fuera: folios.filter((f) => !dentro.has(f)) };
      }, (e) => Promise.reject(e && e.motivo ? APD.rechazo(gExistente ? 'No se guardó el grupo' : 'No se creó el grupo',
        `${e.motivo.charAt(0).toLocaleUpperCase('es-MX')}${e.motivo.slice(1)}. No se guardó nada; lo que eligió sigue aquí.`,
        { href: location.pathname.split('/').pop() + location.search, texto: 'Volver a cargar «Programar»' }, 'conflicto') : e));
    }

    function muestraResultado({ datos: d2, g, confirmar, fuera }) {
      sinGuardar = false;
      const x = P.grupo(d2, g);
      const nombre = APD.nombreGrupo(g, d2);
      const quedo = g.estado === 'confirmado';
      $('[data-ir-grupo]').href = `grupo.html?folio=${encodeURIComponent(g.folio)}`;
      const noEntraron = fuera && fuera.length ? ` ${fuera.length === 1 ? '1 de las que eligió no entró' : `${fuera.length} de las que eligió no entraron`}: ya tenían grupo.` : '';
      const datosTxt = `${g.folio} · ${plural(x.n, 'persona', 'personas')}${g.hora_entrada ? ` · entrada a las ${APD.hhmm(g.hora_entrada)}` : ''}${g.instructor ? ` · ${P.nombreInstructor(g.instructor)}` : ''}.${noEntraron}`;
      if (quedo) {
        FormKit.resultado($('[data-resultado]'), { tono: 'ok', titulo: `Grupo confirmado: ${nombre}`, texto: datosTxt, quien: P.REVISORA.nombre, oculta: form,
          pasos: ['Cada persona ve en «Mis trámites» las fechas, la hora de entrada y dónde presentarse.',
            `El grupo sigue recibiendo personas hasta el ${fecha(APD.sumaDias(g.fecha_inicio, -1))}, sin pasar de ${g.cupo_maximo}.`,
            `Del ${fecha(g.fecha_inicio)} en adelante, el instructor pasa asistencia cada día y aplica el examen el último, en el PILARES.`] });
      } else {
        const sigue = [];
        if (x.n < g.cupo_minimo) sigue.push(`Complete al menos ${g.cupo_minimo} personas (${x.n < g.cupo_minimo - 1 ? `faltan ${g.cupo_minimo - x.n}` : 'falta 1'}).`);
        if (!g.hora_entrada || !g.instructor) sigue.push('Elija el instructor y la hora de entrada.');
        sigue.push(`Confírmelo en «Grupos» o en la ficha del grupo; el curso empieza al menos ${anticipacion} días después de confirmarlo.`);
        FormKit.resultado($('[data-resultado]'), { tono: 'atencion', titulo: `${confirmar ? 'El grupo se guardó, pero no se pudo confirmar' : 'Grupo guardado sin confirmar'}: ${nombre}`,
          texto: `${datosTxt} La fecha queda como propuesta: las personas todavía no la ven como segura.`, quien: P.REVISORA.nombre, oculta: form, pasos: sigue });
      }
      $('[data-bajada]').hidden = true;
      // Recargar o volver con «Atrás» no reabre el formulario para un grupo nuevo: la dirección pasa a la ficha del grupo
      // (F3 M5)
      history.replaceState(null, '', `grupo.html?folio=${encodeURIComponent(g.folio)}`);
    }
  }).catch(() => {
    $('[data-bajada]').textContent = 'No se pudo cargar la información para programar. Intente de nuevo más tarde.';
    // Sin datos, el formulario no se queda a medias con sus botones activos (F3 B2)
    $('#programar').hidden = true;
  });
}());
