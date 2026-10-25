/* grupos.js · «Grupos» como paso a paso (personal, etapa 2; opción B1 de la maqueta «Grupos: propuestas de rediseño»,
   decisión de Liber del 24/10/2026). Un solo camino para armar un grupo; sustituye al planeador por curso y a «Programar
   un curso» (programar.html sólo trae aquí con sus datos).
     1. El curso: los cuatro cursos como opciones del estándar, cada uno con cuántas personas esperan y una nota
        (prioritarias desde dias_alerta_espera días, vencidas en renovación, si falta gente para un grupo o para cuántos
        alcanza).
     2. La semana: calendario por mes (de este mes a tres más) con la columna «Semana»: «Libre» con los lugares que quedan
        (de grupos_simultaneos_maximo) y un botón para elegirla, o «No disponible» y su motivo (ya pasó, ya empezó, faltan
        menos de dias_anticipacion_grupo días, ya hay 2 grupos, día inhábil). Los grupos existentes se pintan en sus días
        (color por situación) con su folio el primer día y «Examen» el último; sábado y domingo sombreados; «Hoy» marcado.
        Todas las reglas salen de APD_PERSONAL (razonNoInicio, delDia, primerDiaPosible, diasInhabiles: P149, P150, P151),
        como la base (apd.comprobar_fechas_grupo). El curso de un día (renovación) elige además el día dentro de la semana.
        En teléfono, el calendario es una lista de semanas.
     3. Quiénes van: la espera del curso con las que más esperan ya marcadas hasta el cupo (P.lasQueMasEsperan: prioridad
        desde 15 días, renovación por vencimiento con vencidas primero, bloques sólo de gobierno local y federal); las
        propuestas a la vista y el resto plegado (C3-01, decisión del 20/10). El grupo propio de una organización, sólo de
        una institución de gobierno (ajustes del equipo, 25/10/2026): para las demás, la opción no se ofrece y se dice por qué.
     4. Confirmar: el resumen (con el horario, fijo: la hora de entrada no se elige y el grupo la toma del parámetro
        curso_hora_entrada; decisión de Liber del 24/10/2026) y quién sigue: «Crear el grupo» lo crea por confirmar, sin
        persona instructora; la asigna, y confirma el grupo, el área de Instructores y Capacitación (ajustes del equipo,
        25/10/2026), y lo dice antes con lo que le falta.
   Grupos programados: una tabla por curso (folio con enlace a su ficha, semana, personas, situación y lo que falta) con
   «Completar con las N que más esperan», «Elegir semana» o «Cambiar la semana» (abre el paso 2 con ese grupo) y «Agregar
   personas» (paso 3); «Grupos que ya terminaron», plegado. Confirmar ya no es de aquí: lo hace Capacitación en la ficha.
   La dirección guarda ?curso=&mes=&semana=&paso= (y ?grupo= con un grupo que ya existe): «Atrás» regresa al paso
   anterior y recargar conserva el paso. Lo guardado son los eventos de siempre (APD_PERSONAL.guardaGrupoComprobado:
   crear, agregar, proponer); la base lo vuelve a aplicar todo (apd.grupo_alta, apd.inscripcion_alta,
   apd.grupo_cambio). En la etapa 3 los datos los da la API del personal. */
(function () {
  'use strict';
  /* Fechas (decisión 16 b, 20/10/2026): el día de hoy, la semana elegida y lo que sigue, con fecha larga; la tabla y los
     plazos, dd/mm/aaaa. El nombre de una semana o de un grupo («del 2 al 6 de noviembre») es el nombre calculado del
     grupo (APD.nombreGrupo, decisión del 18/10). */
  const { el, estado, fechaLarga, fechaCorta } = APD;
  const P = APD_PERSONAL;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const plural = APD.plural;
  const mayus = (t) => t.charAt(0).toLocaleUpperCase('es-MX') + t.slice(1);
  const minus = (t) => t.charAt(0).toLocaleLowerCase('es-MX') + t.slice(1);
  const params = new URLSearchParams(location.search);
  const V = () => window.FORMKIT_VALIDACIONES;
  /* Un espacio entre las piezas de un bloque (rótulo y dato, nombre y folio): no se ve (son bloques), pero el texto del
     paso que está oculto se lee con sus palabras separadas («Grupo Poda nueva · del 2 al 6 de noviembre APD-G-…») */
  const separa = (raiz) => {
    for (const e of [raiz, ...raiz.querySelectorAll('*')]) {
      for (const h of [...e.children].slice(1)) if (!(h.previousSibling && h.previousSibling.nodeType === 3)) h.before(document.createTextNode(' '));
    }
    return raiz;
  };
  const ACTIVOS = ['en_integracion', 'confirmado', 'en_curso'];
  // El calendario va de este mes a tres más (decisión del 24/10/2026)
  const MESES_ADELANTE = 3;
  // «a, b y c»; «e» antes de «i» o «hi» («1 persona e instructor»)
  const y = (lista) => {
    if (lista.length < 2) return lista[0] || '';
    const ultimo = lista[lista.length - 1];
    return `${lista.slice(0, -1).join(', ')} ${/^h?i(?![aeouáéóú])/i.test(ultimo) ? 'e' : 'y'} ${ultimo}`;
  };

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'grupos');
    const hoy = APD.hoy(datos);
    const curso0 = datos.curso[0] || {};
    $('[data-cupo-min]').textContent = curso0.cupo_minimo;
    $('[data-cupo-max]').textContent = curso0.cupo_maximo;
    $('[data-bajada]').textContent = `Hoy es ${fechaLarga(hoy)}. Arme un grupo en cuatro pasos: el curso, la semana, quiénes van y confirmar.`;
    const anticipacion = APD.parametro(datos, 'dias_anticipacion_grupo') || 7;
    const maxSimultaneos = APD.parametro(datos, 'grupos_simultaneos_maximo') || 2;
    const horaEntrada = APD.parametroTexto(datos, 'curso_hora_entrada') || '09:00';
    const horaSalida = APD.parametroTexto(datos, 'curso_hora_salida') || '15:00';
    const hm = (t) => String(t).replace(/^0/, '');
    const minimo = P.primerDiaPosible(datos);
    const maximo = P.ultimoDiaPosible(datos);
    const inhabiles = new Set(P.diasInhabiles(datos));
    const todos = P.grupos(datos);
    const sede = APD.sede(datos).nombre;
    $('[data-leyenda-no]').textContent = `No disponible: ya pasó, faltan menos de ${anticipacion} días o ya hay ${maxSimultaneos} grupos`;

    /* ----- Un grupo que ya existe (?grupo=): completarlo o darle semana ----- */
    const pedido = params.get('grupo');
    const gPedido = pedido ? datos.grupo.find((g) => g.folio === pedido) : null;
    const xPedido = gPedido ? P.grupo(datos, gPedido) : null;
    // Se completa o se programa uno por confirmar, o se le agregan personas a uno confirmado que todavía recibe
    const gExistente = xPedido && (gPedido.estado === 'en_integracion' || xPedido.recibe) ? gPedido : null;
    const xG = gExistente ? xPedido : null;
    const confirmadoYa = Boolean(gExistente && gExistente.estado === 'confirmado');
    const excepto = gExistente ? gExistente.id : null;
    const modo = $('[data-modo-grupo]');
    if (pedido && !gPedido) {
      // Lo que trae la dirección no se repite en pantalla: sólo un folio con forma de folio (auditoría 2026-10-19, E1-02)
      APD.pintaAviso(modo, 'info', `No se encontró ${/^APD-G-\d{4}-\d{3}$/.test(pedido) ? `el grupo ${pedido}` : 'ese grupo'}`, 'Puede armar un grupo nuevo aquí o buscar el grupo en «Grupos programados».');
    } else if (gPedido && !gExistente) {
      // Un enlace guardado a un grupo que ya no recibe (concluido, en curso, lleno): se dice, con su ficha (F3 B6)
      APD.pintaAviso(modo, 'info', `«${xPedido.calculado}» ya no recibe personas`,
        `Su situación es «${xPedido.situacion.texto}»${xPedido.lugar <= 0 ? ' y está lleno' : ''}. Puede armar otro grupo del curso aquí.`);
      $('.aviso-texto', modo).append(el('p', {}, [el('a', { href: `grupo.html?folio=${encodeURIComponent(gPedido.folio)}`, texto: 'Ver la ficha del grupo' })]));
    } else if (gExistente) {
      APD.pintaAviso(modo, 'info', `${confirmadoYa ? 'Agregando personas a' : 'Completando'} «${xG.calculado}» · ${gExistente.folio}`,
        confirmadoYa ? `Está confirmado: su semana no cambia aquí. Caben ${xG.lugar}.` : `Tiene ${plural(xG.n, 'persona', 'personas')}. Su curso y su tipo de grupo no cambian.`);
      $('.aviso-texto', modo).append(el('p', {}, [el('a', { href: `grupos.html?curso=${P.claveCurso(gExistente.tipo_acreditacion, gExistente.modalidad)}`, texto: 'Armar un grupo nuevo en su lugar' })]));
    }

    /* ----- Estado del paso a paso (lo que guarda la dirección) ----- */
    const form = $('#armar');
    const mesDe = (d) => String(d).slice(0, 7);
    const mesMas = (m, n) => APD.sumaMeses(`${m}-01`, n).slice(0, 7);
    let clave = gExistente ? P.claveCurso(gExistente.tipo_acreditacion, gExistente.modalidad)
      : P.deClave(params.get('curso')) ? params.get('curso') : gPedido ? P.claveCurso(gPedido.tipo_acreditacion, gPedido.modalidad) : null;
    let inicio = null; // primer día del curso elegido (AAAA-MM-DD)
    let mes = null; // AAAA-MM del calendario
    let paso = 1;
    // Mientras se restaura el paso de la dirección o de «Atrás», el cambio de paso no agrega una entrada al historial
    let restaurando = false;
    // Lo elegido a mano sin guardar: salir lo advierte el navegador (auditoría 2026-10-19, B5-02)
    let sinGuardar = false;
    const curso = () => (clave ? P.deClave(clave) : null);
    const c = () => (clave ? APD.curso(datos, ...curso()) : null);
    const dur = () => (c() ? c().dias_duracion : 5);
    const finDe = (d) => APD.sumaDias(d, dur() - 1);
    const razon = (d) => (clave ? P.razonNoInicio(datos, ...curso(), d, excepto) : null);
    const mesMin = mesDe(hoy);
    const mesMax = () => [mesMas(mesMin, MESES_ADELANTE), gExistente && gExistente.fecha_inicio ? mesDe(gExistente.fecha_inicio) : ''].sort().pop();
    const mesValido = (m) => /^\d{4}-\d{2}$/.test(m || '') && m >= mesMin && m <= mesMax();
    // El primer día que se puede elegir: un lunes en el de cinco días; en el de un día, el primero de la semana que se pueda
    function primerElegible() {
      if (!clave) return null;
      for (let l = P.lunesDe(minimo), k = 0; k < 6 * (MESES_ADELANTE + 1); k++, l = APD.sumaDias(l, 7)) {
        const d = diaElegible(l);
        if (d && mesDe(d) <= mesMax()) return d;
      }
      return null;
    }
    // El día en que empezaría el curso esa semana (el lunes, o el primer día posible en el de un día), o null
    function diaElegible(lunes) {
      if (dur() > 1) return lunes > hoy && !razon(lunes) ? lunes : null;
      for (let i = 0; i < 5; i++) { const d = APD.sumaDias(lunes, i); if (d > hoy && !razon(d)) return d; }
      return null;
    }

    /* ----- Leer la dirección ----- */
    const semanaPedida = params.get('semana') || '';
    const fechaReal = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && V() && V().isoDeDma(V().dmaDeIso(d)) === d;
    let avisoSemana = '';
    if (clave) {
      if (fechaReal(semanaPedida)) {
        const r = razon(semanaPedida);
        // Una semana guardada en la dirección que ya no se puede: se dice y se propone otra (auditoría 2026-10-19, B5-02)
        if (r) avisoSemana = `El ${fechaLarga(semanaPedida)} no se puede: ${r.texto}. Elija otra semana.`;
        else if (mesDe(semanaPedida) > mesMax()) avisoSemana = `El ${fechaLarga(semanaPedida)} queda fuera del calendario (hasta ${APD.MESES[Number(mesMax().slice(5)) - 1]} de ${mesMax().slice(0, 4)}). Elija otra semana.`;
        else inicio = semanaPedida;
      }
      // Un grupo que ya existe conserva su semana si todavía se puede
      if (!inicio && !avisoSemana && gExistente && gExistente.fecha_inicio && (confirmadoYa || !razon(gExistente.fecha_inicio))) inicio = gExistente.fecha_inicio;
      // Un grupo nuevo empieza con la primera semana que se puede (el sistema propone; usted ajusta). Un grupo que ya
      // existe sin semana sigue sin ella hasta que se elija: completarlo no le pone una semana sin que se vea
      if (!inicio && !gExistente) inicio = primerElegible();
    }
    mes = mesValido(params.get('mes')) ? params.get('mes') : mesDe(inicio || hoy);
    if (!mesValido(mes)) mes = mesMin;

    /* ----- Paso 1 · el curso ----- */
    const radios = $$('input[name="curso"]', form);
    for (const r of radios) {
      const [t, m] = P.deClave(r.value);
      const lista = P.enEspera(datos, t, m);
      const cc = APD.curso(datos, t, m);
      const prio = lista.filter((x) => x.prioritaria).length;
      const venc = lista.filter((x) => x.vencida).length;
      /* Prioritarias (desde dias_alerta_espera días, P143), vencidas (renovación) y cuántos grupos nuevos alcanzan, como
         la cuenta del planeador (auditoría 2026-10-20, C1-01; M7): los completos de cupo_maximo y uno más si lo que sobra
         llega al mínimo */
      const nuevos = Math.floor(lista.length / cc.cupo_maximo) + (lista.length % cc.cupo_maximo >= cc.cupo_minimo ? 1 : 0);
      const notas = [
        prio ? `${plural(prio, 'espera', 'esperan')} ${APD.parametro(datos, 'dias_alerta_espera') || 15} días o más` : '',
        venc ? plural(venc, 'ya vencida', 'ya vencidas') : '',
        !lista.length ? 'Nadie espera por ahora' : lista.length < cc.cupo_minimo ? `Falta gente para un grupo (mínimo ${cc.cupo_minimo})`
          : `Alcanza para ${nuevos === 1 ? 'un grupo nuevo' : `${nuevos} grupos nuevos`} de hasta ${cc.cupo_maximo}`
      ].filter(Boolean);
      $(`[data-espera-curso="${r.value}"]`).replaceChildren(el('span', { class: 'arm-curso-espera', texto: plural(lista.length, 'persona en espera', 'personas en espera') }),
        el('span', { class: 'arm-curso-nota', texto: notas.join(' · ') }));
      r.checked = r.value === clave;
      // El curso de un grupo que ya existe no cambia
      if (gExistente && r.value !== clave) r.disabled = true;
    }
    form.addEventListener('change', (e) => {
      if (e.target.name !== 'curso' || e.target.value === clave) return;
      clave = e.target.value;
      inicio = primerElegible();
      mes = mesDe(inicio || hoy);
      construyePersonas(false);
      pintaTodo();
      recuerda(false);
    });

    /* ----- Paso 2 · la semana ----- */
    const estadoCal = $('[data-cal-estado]');
    const diga = (texto) => FormKit.anuncia(texto, { visible: estadoCal });
    const fi = $('#fecha_inicio');
    // Un grupo que ya existe puede seguir sin semana (se completa con personas sin elegirla todavía)
    if (gExistente && !gExistente.fecha_inicio) $('[data-campo="fecha_inicio"]').removeAttribute('data-requerido');
    $('[data-campo="fecha_inicio"]').dataset.min = minimo;
    $('[data-campo="fecha_inicio"]').dataset.max = maximo;
    // El nombre de la semana: el del grupo que se armaría (APD.nombreGrupo, «Del 2 al 6 de noviembre»)
    const nombreSemana = (d) => APD.nombreGrupo({ tipo_acreditacion: curso()[0], modalidad: curso()[1], fecha_inicio: d, integracion: 'combinado' }, datos, { sinCurso: true });
    const nombreDeLaSemana = (lunes) => APD.nombreGrupo({ tipo_acreditacion: 'poda', modalidad: 'nueva', fecha_inicio: lunes, integracion: 'combinado' }, datos, { sinCurso: true });
    // Los grupos que se pintan en un día: los activos de cualquier curso (cuentan para el máximo) y los concluidos del curso
    const delCalendario = datos.grupo.filter((g) => g.id !== excepto && g.fecha_inicio && (ACTIVOS.includes(g.estado) || g.estado === 'concluido'));
    const pintadosEn = (d) => delCalendario.filter((g) => g.fecha_inicio <= d && d <= APD.ultimoDia(datos, g)
      && (ACTIVOS.includes(g.estado) || P.claveCurso(g.tipo_acreditacion, g.modalidad) === clave));
    const SITUACION_DIA = { en_integracion: 'por confirmar', confirmado: 'confirmado', en_curso: 'en curso', concluido: 'ya terminó' };
    /* Por qué no se puede una semana, en pocas palabras (la columna «Semana»), con la razón completa de la regla */
    function motivoCorto(r) {
      if (!r) return '';
      if (r.clave === 'anticipacion') return `Faltan menos de ${anticipacion} días`;
      if (r.clave === 'simultaneos') return `Ya hay ${maxSimultaneos} grupos`;
      if (r.clave === 'inhabil') return 'Día inhábil';
      if (r.clave === 'lejana') return 'Falta más de un año';
      return 'Sábado o domingo';
    }
    function semanaInfo(lunes) {
      const viernes = APD.sumaDias(lunes, 4);
      const habiles = [0, 1, 2, 3, 4].map((i) => APD.sumaDias(lunes, i));
      let motivo = null;
      if (viernes < hoy) motivo = { clave: 'paso', corto: 'Ya pasó' };
      else if (lunes <= hoy) motivo = { clave: 'empezo', corto: 'Ya empezó' };
      else if (!diaElegible(lunes)) {
        // De cinco días, la regla del lunes; de un día, la del último día hábil de la semana (todos están bloqueados)
        const r = dur() > 1 ? razon(lunes) : habiles.map(razon).reverse().find(Boolean);
        motivo = r ? { clave: r.clave, corto: motivoCorto(r), texto: r.texto } : { clave: 'otro', corto: 'No se puede' };
      }
      // Lugares libres: el máximo de grupos a la vez menos los del día más ocupado (de cinco días) o del día más libre
      // que se pueda (de un día)
      const ocupados = habiles.filter((d) => d > hoy && (dur() > 1 || !razon(d))).map((d) => P.delDia(datos, d, excepto).length);
      const libres = motivo ? 0 : Math.max(0, maxSimultaneos - (dur() > 1 ? Math.max(0, ...ocupados) : Math.min(...ocupados)));
      return { lunes, viernes, motivo, libres };
    }
    const lugaresTexto = (n) => (n >= maxSimultaneos ? `${n} lugares libres` : `${plural(n, 'lugar libre', 'lugares libres')} de ${maxSimultaneos}`);

    function pintaCalendario() {
      const [a, m] = mes.split('-').map(Number);
      APD.escribe($('[data-mes-nombre]'), `${mayus(APD.MESES[m - 1])} de ${a}`);
      const primero = `${mes}-01`;
      const ultimo = APD.sumaDias(`${mesMas(mes, 1)}-01`, -1);
      const lunesElegido = inicio ? P.lunesDe(inicio) : null;
      const items = [];
      for (let lunes = P.lunesDe(primero); lunes <= ultimo; lunes = APD.sumaDias(lunes, 7)) {
        const info = semanaInfo(lunes);
        const elegida = lunes === lunesElegido;
        // Con su año, también el de este año («Elegir la semana del 2 al 6 de noviembre de 2026»); el nombre del grupo lo
        // lleva sólo si es otro (APD.nombreGrupo)
        const nombre = /\d{4}$/.test(nombreDeLaSemana(lunes)) ? nombreDeLaSemana(lunes) : `${nombreDeLaSemana(lunes)} de ${info.viernes.slice(0, 4)}`;
        const grupos = [...new Set([0, 1, 2, 3, 4].flatMap((i) => pintadosEn(APD.sumaDias(lunes, i))))];
        const delCurso = (g) => P.claveCurso(g.tipo_acreditacion, g.modalidad) === clave;
        const cuales = grupos.map((g) => `${g.folio} (${delCurso(g) ? SITUACION_DIA[g.estado] : `otro curso, ${SITUACION_DIA[g.estado]}`})`);
        // La columna «Semana»: sus fechas (visibles en teléfono), libre con su botón o no disponible con su motivo, y sus grupos
        // Las fechas y los grupos de la semana: para el lector de pantalla siempre (.solo-lector) y, a la vista, sólo en
        // teléfono (en la rejilla se ven en sus días)
        const cabeza = [el('span', { class: 'solo-lector', texto: `Semana ${minus(nombre)}.` }), el('span', { class: 'arm-semana-fechas', 'aria-hidden': 'true', texto: `Semana ${minus(nombre)}` })];
        if (!info.motivo) {
          const libreTxt = lugaresTexto(info.libres);
          const b = el('button', { type: 'button', class: 'arm-semana-elegir', 'data-lunes': lunes, 'aria-pressed': String(elegida),
            'aria-label': `${elegida ? 'Semana elegida' : 'Elegir la semana'} ${minus(nombre)}: ${libreTxt}` }, [
            el('span', { class: 'arm-semana-estado' }, [APD.icono('palomita', 'icono icono-sm arm-semana-marca'), document.createTextNode(elegida ? 'Elegida' : 'Libre')]),
            el('span', { class: 'arm-semana-lugares', texto: libreTxt })]);
          cabeza.push(b);
        } else {
          cabeza.push(el('p', { class: 'arm-semana-no', 'data-motivo': info.motivo.clave }, [
            el('span', { class: 'arm-semana-estado', texto: 'No disponible' }),
            el('span', { class: 'arm-semana-lugares', texto: info.motivo.corto })]));
        }
        if (cuales.length) {
          const grupos = `${cuales.length === 1 ? 'Grupo' : 'Grupos'}: ${y(cuales)}`;
          cabeza.push(el('span', { class: 'solo-lector', texto: `${grupos}.` }), el('p', { class: 'arm-semana-grupos', 'aria-hidden': 'true', texto: grupos }));
        }
        const dias = [];
        for (let i = 0; i < 7; i++) {
          const d = APD.sumaDias(lunes, i);
          const finde = i >= 5;
          const marcas = [];
          if (!finde) {
            for (const g of pintadosEn(d)) {
              const otro = !delCurso(g);
              const fin = APD.ultimoDia(datos, g);
              const texto = d === g.fecha_inicio ? g.folio.replace(/^APD-/, '') : d === fin ? 'Examen' : '';
              marcas.push(el('span', { class: 'arm-marca', 'data-situacion': otro ? 'otro' : g.estado, 'data-grupo': g.folio, texto }));
            }
            if (inicio && d >= inicio && d <= finDe(inicio)) {
              const nuevo = gExistente ? gExistente.folio.replace(/^APD-/, '') : 'Nuevo grupo';
              // El curso de un día: su examen es ese mismo día (lo dice la semana elegida, a la derecha)
              marcas.push(el('span', { class: 'arm-marca', 'data-situacion': 'elegida', texto: d === inicio ? nuevo : d === finDe(inicio) ? 'Examen' : '' }));
            }
          }
          if (d === hoy) marcas.push(el('span', { class: 'arm-hoy', texto: 'Hoy' }));
          if (inhabiles.has(d)) marcas.push(el('span', { class: 'arm-inhabil', texto: 'Inhábil' }));
          dias.push(el('div', { class: 'arm-dia', 'data-fecha': d, 'data-fuera': mesDe(d) !== mes ? 'si' : null, 'data-finde': finde ? 'si' : null, 'data-hoy': d === hoy ? 'si' : null }, [
            el('span', { class: 'arm-dia-num', texto: String(Number(d.slice(8))) }), ...marcas]));
        }
        items.push(separa(el('li', { class: 'arm-semana', 'data-lunes': lunes, 'data-libre': info.motivo ? 'no' : 'si', 'data-elegida': elegida ? 'si' : null }, [
          el('div', { class: 'arm-semana-cabeza' }, cabeza),
          el('div', { class: 'arm-semana-dias', 'aria-hidden': 'true' }, dias)
        ])));
      }
      $('[data-semanas]').replaceChildren(...items);
      // En el primer mes y en el último el botón queda inactivo con aria-disabled, no con disabled: conserva el foco
      // (auditoría 2026-10-20, RI-02)
      for (const [b, si] of [[$('[data-mes="-1"]'), mes <= mesMin], [$('[data-mes="1"]'), mes >= mesMax()]]) {
        if (si) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
      }
    }
    function pintaElegida() {
      const cc = c();
      if (!cc) return;
      const final = APD.diaFinal(cc).toLowerCase();
      $('[data-bajada-semana]').textContent = confirmadoYa ? `${APD.cursoLargo(...curso())} · el grupo ya está confirmado: su semana no cambia aquí.`
        : `${APD.cursoLargo(...curso())} · ${dur() > 1 ? `lunes a viernes, de ${hm(horaEntrada)} a ${hm(horaSalida)}` : `un día, de ${hm(horaEntrada)} a ${hm(horaSalida)}`}. Puede haber ${maxSimultaneos} grupos al mismo tiempo, de cualquier curso; el curso empieza al menos ${anticipacion} días después de confirmarlo.`;
      // De cinco días, el nombre del grupo («Del 2 al 6 de noviembre»); de un día, la fecha larga del día
      $('[data-elegida-nombre]').textContent = !inicio ? (gExistente ? 'Sin semana todavía' : 'Ninguna todavía') : dur() > 1 ? nombreSemana(inicio) : fechaLarga(inicio, { mayuscula: true });
      $('[data-elegida-horario]').textContent = !inicio ? (gExistente ? 'Toque «Libre» en la semana que quiere, o siga sin semana: el grupo la conserva como está.' : 'Toque «Libre» en la semana que quiere.')
        : dur() > 1 ? `Del ${fechaLarga(inicio)} al ${fechaLarga(finDe(inicio))}, de ${hm(horaEntrada)} a ${hm(horaSalida)}. El viernes, ${final} en el PILARES.`
          : `El ${fechaLarga(inicio)}, de ${hm(horaEntrada)} a ${hm(horaSalida)}, con el examen ese mismo día en el PILARES.`;
      fi.value = inicio ? V().dmaDeIso(inicio) : '';
      // El curso de un día: el día dentro de la semana elegida (de lunes a viernes; el que no se puede dice por qué)
      const caja = $('[data-dias-curso]');
      caja.hidden = !(inicio && dur() === 1);
      if (!caja.hidden) {
        const lunes = P.lunesDe(inicio);
        const botones = [0, 1, 2, 3, 4].map((i) => {
          const d = APD.sumaDias(lunes, i);
          const r = d <= hoy ? { texto: 'ya pasó' } : razon(d);
          return el('button', { type: 'button', class: 'arm-dia-curso', 'data-fecha': d, 'aria-pressed': String(d === inicio), 'aria-disabled': r ? 'true' : null,
            'aria-label': `${mayus(fechaLarga(d))}${r ? `: no se puede, ${r.texto}` : d === inicio ? ': día elegido' : ''}` }, [
            el('span', { class: 'arm-dia-curso-nombre', 'aria-hidden': 'true', texto: `${['Lun', 'Mar', 'Mié', 'Jue', 'Vie'][i]} ${Number(d.slice(8))}` })]);
        });
        caja.replaceChildren(el('p', { class: 'arm-dias-titulo', id: 'arm-dias-titulo', texto: '¿Qué día?' }), el('div', { class: 'arm-dias-lista', role: 'group', 'aria-labelledby': 'arm-dias-titulo' }, botones));
      }
    }
    function eligeSemana(d, porPersona) {
      const r = d <= hoy ? { texto: 'ya pasó' } : razon(d);
      if (r) { diga(`El ${fechaLarga(d)} no se puede: ${r.texto}.`); return false; }
      inicio = d;
      if (porPersona) sinGuardar = true;
      if (mesDe(P.lunesDe(d)) !== mes && mesDe(d) !== mes) mes = mesDe(d);
      $('[data-campo="fecha_inicio"] .err')?.remove();
      fi.removeAttribute('aria-invalid');
      pintaTodo();
      recuerda(false);
      diga(dur() > 1 ? `Elegida la semana ${minus(nombreSemana(d))}: del ${fechaLarga(d)} al ${fechaLarga(finDe(d))}.` : `Elegido el ${fechaLarga(d)}, con su examen.`);
      return true;
    }
    $('[data-semanas]').addEventListener('click', (e) => {
      const b = e.target.closest('.arm-semana-elegir');
      if (!b) return;
      const lunes = b.dataset.lunes;
      // En el de un día, el día de la semana que ya estaba elegido se conserva si se vuelve a tocar la semana
      eligeSemana(inicio && P.lunesDe(inicio) === lunes ? inicio : diaElegible(lunes), e.isTrusted);
      const otro = $(`.arm-semana-elegir[data-lunes="${lunes}"]`);
      if (otro) otro.focus();
    });
    $('[data-dias-curso]').addEventListener('click', (e) => {
      const b = e.target.closest('.arm-dia-curso');
      if (!b) return;
      if (eligeSemana(b.dataset.fecha, e.isTrusted)) { const otro = $(`.arm-dia-curso[data-fecha="${b.dataset.fecha}"]`); if (otro) otro.focus(); }
    });
    for (const b of $$('[data-mes]')) {
      b.addEventListener('click', () => {
        if (b.getAttribute('aria-disabled') === 'true') return;
        mes = mesMas(mes, Number(b.dataset.mes));
        pintaCalendario();
        recuerda(false);
        FormKit.anuncia($('[data-mes-nombre]').textContent);
      });
    }

    /* ----- Paso 3 · quiénes van ----- */
    let filas = [];
    let propuestas = new Set();
    const CLAVE_ELEGIDAS = 'apd.grupos.armar';
    // Las elegidas se conservan en esta pestaña al recargar o al volver con «Atrás» aunque el navegador vuelva a cargar
    // la página (auditoría 2026-10-20, C4-04); al llegar de nuevo se empieza con la propuesta
    let guardadas = null;
    try {
      if (['reload', 'back_forward'].includes((performance.getEntriesByType('navigation')[0] || {}).type)) guardadas = JSON.parse(sessionStorage.getItem(CLAVE_ELEGIDAS) || 'null');
      else sessionStorage.removeItem(CLAVE_ELEGIDAS);
    } catch (e) { /* sin almacenamiento: sólo en memoria */ }
    /* Las elegidas de cada curso se conservan al cambiar de curso y volver (auditoría «intentar romperlo», F3 B7) */
    const elegidasDe = new Map();
    if (guardadas && guardadas.porCurso && guardadas.grupo === (gExistente ? gExistente.folio : '')) {
      for (const [k, v] of Object.entries(guardadas.porCurso)) if (Array.isArray(v)) elegidasDe.set(k, new Set(v));
    }
    const guardaElegidas = () => {
      if (clave) elegidasDe.set(clave, new Set(elegidas().map((x) => x.s.folio)));
      try { sessionStorage.setItem(CLAVE_ELEGIDAS, JSON.stringify({ grupo: gExistente ? gExistente.folio : '', porCurso: Object.fromEntries([...elegidasDe].map(([k, v]) => [k, [...v]])) })); } catch (e) { /* sin almacenamiento */ }
    };
    const pedidas = (params.get('personas') || '').split(',').map((f) => f.trim()).filter(Boolean);
    const propia = gExistente && gExistente.integracion === 'especifico' ? gExistente.organizacion_id : null;
    const esperaDe = () => (clave ? P.enEspera(datos, ...curso()).filter((x) => !propia || x.s.organizacion_id === propia) : []);
    const elegidas = () => filas.filter((f) => f.k.checked).map((f) => f.x);
    const total = () => (xG ? xG.n : 0) + elegidas().length;
    function construyePersonas(desdeDireccion) {
      filas = [];
      const cc = c();
      if (!cc) { $('[data-personas]').replaceChildren(); return; }
      const espera = esperaDe();
      const renov = curso()[1] === 'renovacion';
      const deUrl = desdeDireccion ? espera.filter((x) => pedidas.includes(x.s.folio)) : [];
      const yaNo = desdeDireccion ? pedidas.length - deUrl.length : 0;
      const falta = xG ? Math.max(0, xG.g.cupo_minimo - xG.n) : 0;
      const recordadas = elegidasDe.get(clave) || null;
      const propuesta = pedidas.length && desdeDireccion ? deUrl
        : xG ? (falta ? P.lasQueMasEsperan(espera, Math.min(falta, xG.lugar), propia ? () => true : null) : [])
          : P.lasQueMasEsperan(espera, cc.cupo_maximo);
      propuestas = new Set(propuesta.map((x) => x.s.folio));
      const marcadas = recordadas || propuestas;
      if (renov) $('[data-ayuda-personas]').textContent = `Si hay más de ${cc.cupo_maximo}, entran primero las que ya vencieron y después las que vencen antes, con las de una misma institución de gobierno juntas; el resto sigue en espera para otra semana.`;
      else $('[data-ayuda-personas]').textContent = `Si hay más de ${cc.cupo_maximo}, entran las que más esperan y las de una misma institución de gobierno van juntas; el resto sigue en espera para otra semana.`;
      // Si alguna de las que llegaron en la dirección ya no espera (ya tiene grupo), se dice y no se propone a nadie más
      // (auditoría «intentar romperlo», F3 M5)
      $('[data-propuesta]').textContent = yaNo
        ? `${yaNo === pedidas.length ? (yaNo === 1 ? 'La persona elegida ya no está en espera: ya tiene grupo.' : `Las ${yaNo} personas elegidas ya no están en espera: ya tienen grupo.`)
          : `${yaNo} de las ${pedidas.length} personas elegidas ya no ${yaNo === 1 ? 'está' : 'están'} en espera: ya ${yaNo === 1 ? 'tiene' : 'tienen'} grupo. Quedan marcadas las demás.`} No se propone a nadie más: marque a quien quiera agregar.`
        : !espera.length ? (propia ? 'Nadie de esa organización espera en este curso.' : 'Nadie espera en este curso por ahora.')
          : xG ? (propuestas.size ? `Se proponen ${propuestas.size === 1 ? 'la que más espera' : `las ${propuestas.size} que más esperan`} para llegar al mínimo de ${xG.g.cupo_minimo}. Quite o agregue a quien haga falta.` : 'Marque a quien quiera agregar de la espera.')
            // En renovación, primero las que ya vencieron (decisión 11 b, auditoría 2026-10-20, C1-03)
            : renov ? `Se proponen hasta ${cc.cupo_maximo}: primero las que ya vencieron y después las que vencen antes, con las de una misma institución de gobierno juntas. Quite o agregue a quien haga falta.`
              : `Se proponen ${propuestas.size === 1 ? 'la persona que más espera' : `las ${propuestas.size} personas que más esperan`}, primero las prioritarias y las de una misma institución de gobierno juntas. Quite o agregue a quien haga falta.`;
      const ya = $('[data-ya-estan]');
      ya.hidden = !xG;
      if (xG) {
        const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
        const sols = Object.fromEntries(datos.solicitud.map((s) => [s.id, s]));
        ya.replaceChildren(el('p', { class: 'prog-ya-titulo', texto: xG.n ? `Ya están en el grupo (${xG.n}):` : 'El grupo todavía no tiene personas.' }),
          xG.n ? el('ul', { class: 'prog-ya' }, xG.inscritas.map((i) => el('li', { texto: APD.nombreCompleto(persona[(sols[i.solicitud_id] || {}).solicitante_id] || {}) }))) : null);
      }
      // El tipo de grupo (específico o combinado) no cambia después de crearlo
      $('[data-campo="integracion"]').hidden = Boolean(gExistente);
      // La fila de cada persona y el bloque de su organización, los de APD_PERSONAL (R4-08)
      const fila = (x, conOrg) => {
        const k = el('input', { class: 'casilla-input plan-casilla', type: 'checkbox', value: x.s.folio, checked: marcadas.has(x.s.folio) });
        filas.push({ x, k });
        return P.filaEspera(x, k, conOrg);
      };
      /* «Su grupo» de cada organización (decisión 2 de la auditoría del 2026-10-19, Liber; DECISIONES, 17/10), como lo decía
         el planeador: si ya tiene un grupo propio de este curso que recibe personas, se dice cuál y cuántas le faltan; si
         no, si alcanzan para uno propio. Al armar un grupo nuevo (al completar uno, ya se sabe a cuál van). */
      const reciben = gExistente ? [] : todos.filter((y) => y.recibe && y.g.integracion === 'especifico' && P.claveCurso(y.g.tipo_acreditacion, y.g.modalidad) === clave);
      const suGrupoDe = (org) => (org ? reciben.find((y) => y.g.organizacion_id === org) || null : null);
      const textoSuGrupo = (y) => {
        const f = y.g.cupo_minimo - y.n;
        return `Su grupo ${y.g.folio}: ${y.n} de ${y.g.cupo_maximo}${f > 0 ? `, le ${f === 1 ? 'falta 1' : `faltan ${f}`} para el mínimo` : `, caben ${y.lugar}`}`;
      };
      const situacionBloque = (b) => {
        if (gExistente) return null;
        const suyo = suGrupoDe(b.clave);
        if (suyo) return estado(textoSuGrupo(suyo), suyo.n < suyo.g.cupo_minimo ? 'pend' : 'ok');
        const f = cc.cupo_minimo - b.xs.length;
        return f <= 0 ? estado('Alcanza para un grupo propio', 'ok')
          : el('span', { class: 'plan-bloque-grupo', texto: `${f === 1 ? 'Falta 1' : `Faltan ${f}`} para un grupo propio de ${cc.cupo_minimo}; o van a un grupo combinado` });
      };
      const items = P.bloquesEspera(espera).map((b, i) => {
        if (!b.junta) {
          // Sola de su organización, pero con su grupo: también se dice
          const una = fila(b.xs[0], true);
          const suyo = suGrupoDe(b.xs[0].s.organizacion_id);
          if (suyo) una.append(el('span', { class: 'plan-persona-org' }, [estado(textoSuGrupo(suyo), suyo.n < suyo.g.cupo_minimo ? 'pend' : 'ok')]));
          return el('li', {}, [una]);
        }
        const propias = b.xs.map((x) => fila(x, false));
        const { bloque, refleja } = P.bloqueEspera(b, `pb-${i}`, propias, filas.filter((f) => b.xs.includes(f.x)).map((f) => f.k), situacionBloque(b), () => cambioPersonas(true));
        refleja();
        return el('li', {}, [bloque]);
      });
      /* Las propuestas a la vista; las demás, plegadas en «Cambiar a quiénes van (N más en espera)» (decisión de Liber
         sobre C3-01, auditoría 2026-10-20: la lista de 66 ocupaba 12.4 pantallas en teléfono). Un bloque con alguna
         propuesta va completo a la vista. Sin propuesta, todas a la vista. */
      const conMarca = (li) => [...li.querySelectorAll('.plan-casilla[value]')].some((k) => marcadas.has(k.value));
      const aLaVista = marcadas.size ? items.filter(conMarca) : items;
      const resto = items.filter((li) => !aLaVista.includes(li));
      const nResto = resto.reduce((n, li) => n + li.querySelectorAll('.plan-casilla[value]').length, 0);
      const plegadas = resto.length ? el('li', {}, [el('details', { class: 'plegable', 'data-mas-espera': '' }, [
        el('summary', { class: 'plegable-titulo', texto: `Cambiar a quiénes van (${nResto} más en espera)` }),
        el('div', { class: 'plegable-cuerpo' }, [el('ul', { class: 'prog-personas', 'aria-label': `Las otras ${nResto} personas en espera` }, resto)])
      ])]) : null;
      $('[data-personas]').replaceChildren(...(items.length ? [...aLaVista, plegadas].filter(Boolean) : []));
      $('[data-error-personas]').hidden = true;
    }
    function cambioPersonas(porPersona) {
      if (porPersona) sinGuardar = true;
      guardaElegidas();
      pintaCuenta(porPersona);
      pintaIntegracion();
      pintaSuGrupo();
      pintaEleccion();
      pintaResumen();
      if (elegidas().length) $('[data-error-personas]').hidden = true;
    }
    $('[data-personas]').addEventListener('change', (e) => cambioPersonas(e.isTrusted));
    function pintaCuenta(anuncia) {
      const cc = c();
      if (!cc) return;
      const n = total();
      const texto = `${n} de ${cc.cupo_maximo} lugares · se confirma con al menos ${cc.cupo_minimo} personas${n > cc.cupo_maximo ? ` · sobran ${n - cc.cupo_maximo}` : ''}`;
      $('[data-cuenta-personas]').textContent = texto;
      // Se anuncia sólo cuando quien arma el grupo marca o desmarca, no al pintar (auditoría 2026-10-20, RI-04)
      if (anuncia) FormKit.anuncia(texto);
    }
    /* Tipo de grupo: «Sólo de …» dice de cuál, si todas las elegidas son de la misma organización registrada. El grupo
       propio de una organización, sólo de una institución de gobierno: dependencias de la Ciudad, Alcaldías y dependencias
       federales (la base: grupo_propio_sin_gobierno; ajustes del equipo, 25/10/2026). Empresas, consultorías, particulares,
       instituciones educativas e independientes van siempre a grupos combinados: donde no aplica, la opción no se ofrece y
       una línea dice por qué. No se pide oficio: el personal arma el grupo. */
    const orgDeElegidas = () => { const o = [...new Set(elegidas().map((x) => x.s.organizacion_id || null))]; return o.length === 1 && o[0] ? o[0] : null; };
    const deGobierno = (org) => Boolean(org) && elegidas().some((x) => x.s.organizacion_id === org && x.gobierno);
    const integracion = () => (gExistente ? gExistente.integracion : (($('input[name="integracion"]:checked', form) || {}).value || 'combinado'));
    function pintaIntegracion() {
      if (gExistente || !clave) return;
      const org = orgDeElegidas();
      const nombre = org ? (elegidas()[0] || {}).organizacion : '';
      const gob = deGobierno(org);
      const opcion = $('[data-opcion-especifico]');
      const porque = $('[data-sin-grupo-propio]');
      opcion.hidden = !gob;
      porque.hidden = gob || !elegidas().length;
      if (!gob) {
        // Sin la opción, el grupo es combinado
        const comb = $('input[name="integracion"][value="combinado"]', form);
        if (!comb.checked) { comb.checked = true; APD.avisa(comb); }
        porque.textContent = org
          ? `${nombre} no es una institución de gobierno: su gente va a un grupo combinado. Sólo las dependencias de la Ciudad, las Alcaldías y las dependencias federales tienen grupo propio.`
          : 'El grupo es combinado: las elegidas son de varias organizaciones o independientes. Sólo las dependencias de la Ciudad, las Alcaldías y las dependencias federales tienen grupo propio, con toda su gente.';
        return;
      }
      $('[data-especifico-de]').textContent = `Sólo de ${nombre}`;
      const suyo = suGrupo();
      $('[data-especifico-desc]').textContent = `Recibe únicamente a la gente de ${nombre}.${total() < c().cupo_minimo ? ` Para confirmarlo se necesitan ${c().cupo_minimo} de esa institución.` : ''}${suyo ? ` Ya tiene su grupo ${suyo.g.folio}, que recibe personas.` : ''}`;
    }
    /* «Su grupo» (decisión 2 de la auditoría del 2026-10-19, Liber; auditoría de tareas, M3): si todas las elegidas son de
       una organización que ya tiene un grupo propio de este curso que recibe personas, se dice y se ofrece agregarlas ahí;
       crear otro de esa organización pide confirmación (con dos grupos, ninguno llega al mínimo) */
    const suGrupo = () => {
      const org = gExistente ? null : orgDeElegidas();
      return org ? todos.find((x) => x.recibe && x.g.integracion === 'especifico' && P.claveCurso(x.g.tipo_acreditacion, x.g.modalidad) === clave && x.g.organizacion_id === org) || null : null;
    };
    const cajaSuGrupo = $('[data-su-grupo]');
    const activasEn = (d, gid) => new Set(d.inscripcion.filter((i) => i.grupo_id === gid && i.activa).map((i) => (d.solicitud.find((s) => s.id === i.solicitud_id) || {}).folio));
    function pintaSuGrupo() {
      const suyo = suGrupo();
      if (!suyo) { cajaSuGrupo.hidden = true; cajaSuGrupo.replaceChildren(); return; }
      const nombre = (elegidas()[0] || {}).organizacion;
      const falta = suyo.g.cupo_minimo - suyo.n;
      APD.pintaAviso(cajaSuGrupo, 'info', `${nombre} ya tiene su grupo`,
        `El grupo ${suyo.g.folio} tiene ${suyo.n} de ${suyo.g.cupo_maximo}${falta > 0 ? `, le ${falta === 1 ? 'falta 1' : `faltan ${falta}`} para el mínimo` : ''} y recibe personas. Conviene agregarlas ahí: con dos grupos de la misma organización, ninguno llega al mínimo.`);
      const b = el('button', { type: 'button', class: 'btn btn-secundario', texto: `Agregarlas a ${suyo.g.folio}` });
      b.addEventListener('click', () => agregaASuGrupo(suyo, b));
      $('.aviso-texto', cajaSuGrupo).append(el('p', {}, [b]));
    }
    function agregaASuGrupo(suyo, boton) {
      const folios = elegidas().map((x) => x.s.folio);
      if (folios.length > suyo.lugar) {
        APD.pintaAviso(cajaSuGrupo, 'error', 'Eligió más personas de las que caben', `«${suyo.calculado}» tiene lugar para ${plural(suyo.lugar, 'persona', 'personas')}; eligió ${folios.length}.`, true);
        return;
      }
      const libera = APD.ocupa(boton);
      if (!libera) return;
      agrega(suyo.g, folios).then(({ n, no }) => {
        sinGuardar = false;
        location.href = `grupo.html?folio=${encodeURIComponent(suyo.g.folio)}&hecho=agregadas&n=${n}${no.length ? `&no=${no.map(encodeURIComponent).join(',')}` : ''}`;
      }).catch((e) => {
        libera();
        APD.pintaAviso(cajaSuGrupo, 'error', `No se agregó a nadie a «${suyo.calculado}»`, e && e.motivo ? `${mayus(e.motivo.replace(/^No se agregó a nadie: /, ''))}. Vuelva a cargar la página para ver la espera de ahora.` : 'No se pudo guardar; intente de nuevo.', true);
      });
    }

    /* ----- Paso 4 · confirmar ----- */
    /* Quien arma el grupo ya no elige instructor ni confirma (ajustes del equipo, 25/10/2026): el grupo se crea o se guarda
       por confirmar, sin persona instructora; la asigna, y confirma el grupo, el área de Instructores y Capacitación en la
       ficha del grupo. Lo que le falta para confirmarse, como lo pediría la base (apd.grupo_cambio: datos_para_confirmar). */
    function faltaParaConfirmar() {
      const cc = c();
      const falta = [];
      const n = total();
      if (!inicio) falta.push('la semana');
      else if (razon(inicio)) falta.push('otra semana');
      if (n < cc.cupo_minimo) falta.push(cc.cupo_minimo - n === 1 ? '1 persona más' : `${cc.cupo_minimo - n} personas más`);
      return falta;
    }
    function pintaResumen() {
      const cc = c();
      if (!cc) return;
      const n = total();
      const fin = inicio ? finDe(inicio) : null;
      const borrador = { tipo_acreditacion: curso()[0], modalidad: curso()[1], fecha_inicio: inicio, integracion: integracion(), organizacion_id: integracion() === 'especifico' ? (gExistente ? gExistente.organizacion_id : orgDeElegidas()) : null };
      const titulo = el('span', { class: 'grupo-titulo' }, [el('span', { class: 'grupo-nombre', texto: APD.nombreGrupo(borrador, datos) }),
        el('span', { class: 'grupo-folio mono', texto: gExistente ? gExistente.folio : `${P.siguienteFolioGrupo(datos)} (lo asigna el sistema al guardar)` })]);
      $('[data-resumen]').replaceChildren(separa(APD.datosLista([
        ['Grupo', titulo],
        ['Curso', APD.cursoLargo(...curso())],
        ['Semana', inicio ? (dur() > 1 ? `Del ${fechaLarga(inicio)} al ${fechaLarga(fin)}` : `El ${fechaLarga(inicio)}`) : 'Sin elegir'],
        // La hora es fija (decisión de Liber del 24/10/2026): se muestra como dato, no se elige
        ['Horario', `De ${hm(horaEntrada)} a ${hm(horaSalida)}${dur() > 1 ? ', de lunes a viernes' : ''}`],
        ['Lugar del curso', `Aula de capacitación del ${sede}`],
        [APD.diaFinal(cc) === 'Examen' ? 'Examen' : 'Examen final', inicio ? `El ${fechaLarga(fin)}, en el salón de cómputo del PILARES` : 'El último día del curso, en el PILARES'],
        ['Personas', `${n} de ${cc.cupo_maximo}${xG && elegidas().length ? ` (${plural(elegidas().length, 'nueva', 'nuevas')})` : ''}${n > cc.cupo_maximo ? ` · sobran ${n - cc.cupo_maximo}` : ''}`],
        ['Tipo de grupo', gExistente ? xG.integracion : integracion() === 'especifico' ? `Sólo de ${(elegidas()[0] || {}).organizacion || 'una institución de gobierno'}` : 'Combinado'],
        ['Persona instructora', gExistente && gExistente.instructor ? P.nombreInstructor(gExistente.instructor) : 'La asigna el área de Instructores y Capacitación']
      ])));
      // Cómo queda al guardarlo: siempre por confirmar (lo confirma Capacitación) y, si le falta algo, qué
      const falta = confirmadoYa ? [] : faltaParaConfirmar();
      const queda = $('[data-queda]');
      const crear = $('[data-armar="crear"]');
      if (confirmadoYa) {
        queda.replaceChildren(estado('Ya está confirmado', 'ok'), el('p', { texto: 'Las personas que agregue verán en «Mis trámites» la fecha, la hora y el lugar.' }));
        crear.textContent = 'Agregar al grupo';
      } else {
        const capacitacion = gExistente && gExistente.instructor ? 'el área de Instructores y Capacitación lo confirma' : 'el área de Instructores y Capacitación le asigna la persona instructora y lo confirma';
        queda.replaceChildren(estado(gExistente ? 'Sigue por confirmar' : 'Se crea por confirmar', 'pend'),
          el('p', { texto: falta.length
            ? `Le falta: ${y(falta)}; después, ${capacitacion}. Lo puede completar en «Grupos programados» o en su ficha; mientras, las personas no ven la fecha como segura.`
            : `Ya tiene lo que le toca a usted: ahora ${capacitacion}. Mientras, las personas no ven la fecha como segura.` }));
        crear.textContent = gExistente ? 'Guardar los cambios' : 'Crear el grupo';
      }
    }

    /* ----- Lo elegido hasta ahora y el resumen de cada paso hecho ----- */
    function pintaEleccion() {
      const caja = $('[data-eleccion]');
      const partes = [clave ? APD.cursoLargo(...curso()) : '', paso > 2 && inicio ? nombreSemana(inicio) : '', paso > 3 ? plural(total(), 'persona', 'personas') : ''].filter(Boolean);
      caja.hidden = paso === 1 || !partes.length;
      caja.replaceChildren(...(caja.hidden ? [] : [APD.lineaDatos(partes)]));
    }
    function pintaTodo() {
      if (!clave) return;
      pintaCalendario();
      pintaElegida();
      pintaCuenta(false);
      pintaIntegracion();
      pintaSuGrupo();
      pintaResumen();
      pintaEleccion();
    }

    /* ----- La dirección: ?curso=&mes=&semana=&paso= (y ?grupo=) ----- */
    function direccion() {
      const q = new URLSearchParams();
      if (gExistente) q.set('grupo', gExistente.folio);
      else if (clave) q.set('curso', clave);
      if (clave && mes) q.set('mes', mes);
      if (clave && inicio) q.set('semana', inicio);
      q.set('paso', String(paso));
      return `${location.pathname}?${q.toString()}`;
    }
    // nuevo: un paso nuevo en el historial («Atrás» regresa al anterior); si no, la dirección cambia en su lugar
    function recuerda(nuevo) {
      const url = direccion();
      if (url === `${location.pathname}${location.search}`) return;
      if (nuevo) history.pushState({ paso }, '', url); else history.replaceState({ paso }, '', url);
    }

    /* ----- Lo que impide pasar de un paso al siguiente (además de lo que valida el estándar) ----- */
    const pasos = $$('[data-paso]', form);
    function impide(i) {
      if (i === 1) {
        if (!inicio && !(gExistente && !gExistente.fecha_inicio)) return { campo: 'fecha_inicio', mensaje: 'Elija una semana libre en el calendario: toque «Libre» en la semana que quiere.' };
        const r = !confirmadoYa && inicio && razon(inicio);
        if (r) return { campo: 'fecha_inicio', mensaje: `Esa semana ya no se puede: ${r.texto}. Elija otra.` };
      }
      if (i === 2) {
        const cc = c();
        const n = total();
        if (!gExistente && n < 1) return { aviso: ['Elija a quién va', 'Marque la casilla junto al nombre de al menos una persona. El grupo se confirma con al menos 5.'] };
        if (confirmadoYa && !elegidas().length) return { aviso: ['Elija a quién agregar', 'Marque la casilla junto al nombre de cada persona que quiere agregar al grupo.'] };
        if (n > cc.cupo_maximo) return { aviso: ['Eligió más personas de las que caben', `Un grupo recibe hasta ${cc.cupo_maximo}; ${xG ? `ya tiene ${xG.n} y ` : ''}eligió ${elegidas().length}. Quite ${plural(n - cc.cupo_maximo, 'persona', 'personas')}.`] };
        if (integracion() === 'especifico' && !gExistente && !deGobierno(orgDeElegidas())) return { campo: 'integracion', mensaje: 'Un grupo propio es sólo de una institución de gobierno, con toda su gente. Elija «Combinado» o quite a quien no sea de esa institución.' };
      }
      return null;
    }
    function muestraImpide(i, f) {
      if (f.aviso) {
        const caja = $('[data-error-personas]');
        if (!elegidas().length) for (const x of filas) x.k.closest('.plan-persona').classList.add('falta-marcar');
        APD.pintaAviso(caja, 'error', f.aviso[0], f.aviso[1], true);
        return;
      }
      inst.marcaError(f.campo, f.mensaje);
      inst.ctx.muestraResumen(pasos[i], [f]);
    }
    // Antes que el módulo pasos (fase de captura): «Siguiente» y la barra revisan lo de cada paso que se deja atrás
    function antesDeAvanzar(e, destino) {
      const actual = FormKit.pasos.actual();
      if (destino <= actual) return;
      for (let i = actual; i < destino; i++) {
        const f = impide(i);
        if (!f) continue;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (i !== actual) FormKit.pasos.ir(i);
        muestraImpide(i, f);
        return;
      }
    }
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-accion="siguiente"]');
      if (b && form.contains(b)) antesDeAvanzar(e, FormKit.pasos.actual() + 1);
    }, true);
    $('[data-barra]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ir]');
      if (b) antesDeAvanzar(e, Number(b.dataset.ir));
    }, true);
    for (const x of document.querySelectorAll('.falta-marcar')) x.classList.remove('falta-marcar');

    /* ----- Guardar ----- */
    let accion = 'crear';
    // Salir a mitad pierde lo elegido: el navegador lo advierte mientras haya algo sin guardar (auditoría 2026-10-19, B5-02)
    window.addEventListener('beforeunload', (e) => { if (sinGuardar) { e.preventDefault(); e.returnValue = ''; } });
    const botones = $$('[data-armar]');
    // Mientras guarda, ninguno de los dos botones vuelve a guardar: el estándar sólo bloquea el primero (P157, F3 M6)
    for (const b of botones) b.addEventListener('click', (e) => { if (b.getAttribute('aria-disabled') === 'true') { e.preventDefault(); e.stopImmediatePropagation(); return; } accion = b.dataset.armar; }, true);
    const avisoFalta = $('[data-falta]');
    const inst = FormKit.iniciar(form, {
      enviar(payload) {
        avisoFalta.hidden = true;
        const d = payload.datos;
        const ini = (V().isoDeDma(d.fecha_inicio || '') || d.fecha_inicio || inicio || null);
        const cc = c();
        const n = total();
        const falta = [];
        const r = !confirmadoYa && ini && razon(ini);
        if (r) { inst.marcaError('fecha_inicio', `Esa semana no se puede: ${r.texto}.`); falta.push(`otra semana: ${r.texto}`); }
        if (!gExistente && n < 1) falta.push('al menos una persona');
        if (confirmadoYa && !elegidas().length) falta.push('al menos una persona que agregar');
        if (n > cc.cupo_maximo) falta.push(`quitar ${plural(n - cc.cupo_maximo, 'persona', 'personas')}: el grupo recibe hasta ${cc.cupo_maximo}`);
        const esp = integracion() === 'especifico' && !gExistente;
        if (esp && !deGobierno(orgDeElegidas())) falta.push('que todas las elegidas sean de la misma institución de gobierno, o un grupo combinado');
        if (falta.length) {
          avisoFalta.hidden = false;
          avisoFalta.replaceChildren();
          FormKit.aviso(avisoFalta, { tono: 'bloqueo', titulo: gExistente ? 'No se guardó el grupo' : 'No se creó el grupo',
            texto: [el('p', { texto: 'Falta:' }), el('ul', { class: 'lista-obs' }, falta.map((t) => el('li', { texto: mayus(t) })))], foco: true });
          return Promise.resolve({ rechazado: true });
        }
        const libera = APD.ocupa(botones.filter((b) => !b.matches('[data-accion="enviar"]')));
        // Un segundo grupo de una organización que ya tiene el suyo: se pregunta antes (decisión 2, 2026-10-19)
        const suyo = esp ? suGrupo() : null;
        const sigue = !suyo ? Promise.resolve(true) : FormKit.confirma(botones.find((b) => b.dataset.armar === accion) || botones[0], {
          titulo: `¿Crear otro grupo de ${(elegidas()[0] || {}).organizacion}?`,
          consecuencias: [`Ya tiene el grupo ${suyo.g.folio}, con ${suyo.n} de ${suyo.g.cupo_maximo}, que recibe personas.`,
            `Con dos grupos de la misma organización, ninguno llega al mínimo. Para agregarlas a ese grupo, elija «No» y use «Agregarlas a ${suyo.g.folio}» en el paso 3.`],
          si: 'Sí, crear otro grupo', no: 'No' });
        // La hora de entrada es la del curso (parámetro curso_hora_entrada; decisión de Liber del 24/10/2026)
        return sigue.then((si) => (si ? guarda({ ini, hora: APD.hhmm(horaEntrada), tipoGrupo: integracion() }) : { rechazado: true }))
          .finally(() => { if (libera) libera(); });
      },
      alEnviar(r) { if (r && r.rechazado) return; termina(r); },
      alFallar(err) { if (APD.muestraRechazo(err, form)) return; const a = $('[data-estado-envio] .aviso-texto', form); if (err && err.mensaje && a) a.textContent = err.mensaje; }
    });

    /* Los eventos de siempre, en orden (la base hace lo mismo en una transacción), como lo haría la API (auditoría «intentar
       romperlo», F3 A1): el folio de un grupo nuevo se calcula al guardar, con lo guardado más reciente, y la creación
       lleva un id propio; después se lee lo que quedó. */
    function guarda({ ini, hora, tipoGrupo }) {
      const folios = elegidas().map((x) => x.s.folio);
      const por = P.REVISORA.usuario;
      let id = gExistente ? gExistente.id : null;
      return P.guardaGrupoComprobado({
        // Un grupo que ya existe: sigue como estaba (otra pestaña pudo confirmarlo o cancelarlo)
        antes: (d1) => {
          if (!gExistente) return null;
          const g1 = d1.grupo.find((x) => x.id === gExistente.id);
          return !g1 ? 'el grupo ya no existe' : g1.estado !== gExistente.estado ? `el grupo ya está «${P.grupo(d1, g1).situacion.texto}»` : null;
        },
        eventos: (d1) => {
          const lista = [];
          if (gExistente) { if (folios.length) lista.push({ tipo: 'agregar', grupo_id: id, folios, por }); } else {
            const folio = P.siguienteFolioGrupo(d1);
            id = `prueba-grupo:${folio}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            lista.push({ tipo: 'crear', grupo_id: id, folio, tipo_acreditacion: curso()[0], modalidad: curso()[1], integracion: tipoGrupo, organizacion_id: tipoGrupo === 'especifico' ? orgDeElegidas() : null, folios, por });
          }
          // Sin semana (un grupo que ya existe y sigue sin ella) no se propone nada: sólo se agregan personas. La persona
          // instructora y la confirmación son del área de Instructores y Capacitación (25/10/2026)
          if (!confirmadoYa && ini) lista.push({ tipo: 'proponer', grupo_id: id, fecha_inicio: ini, hora_entrada: hora, por, perfil: 'revision_cotejo' });
          return lista;
        },
        comprueba: (d2, d1) => {
          const g = d2.grupo.find((x) => x.id === id);
          if (!g) return 'otra pestaña creó un grupo con el mismo folio al mismo tiempo';
          // A un grupo que ya existe: si no entró nadie de las elegidas, no se guarda nada y se dice quién y por qué (F3 M1)
          if (gExistente && folios.length) {
            const antes = activasEn(d1, id);
            if (!folios.some((f) => activasEn(d2, id).has(f) && !antes.has(f))) return `No se agregó a nadie: ${porQueNoEntraron(d2, g, folios)}`;
          }
          return !ini || confirmadoYa || g.fecha_inicio === ini ? null : 'la fecha propuesta no se guardó';
        }
      }).then(({ datos: d2, antes: d1 }) => {
        const g = d2.grupo.find((x) => x.id === id);
        // Las elegidas que de verdad entraron (otra pestaña pudo darles grupo en ese momento): el aviso lo dice
        const previas = activasEn(d1, id);
        const dentro = activasEn(d2, id);
        return { g, entraron: folios.filter((f) => dentro.has(f) && !previas.has(f)), fuera: folios.filter((f) => !dentro.has(f)) };
      }, (e) => Promise.reject(e && e.motivo ? APD.rechazo(gExistente ? 'No se guardó el grupo' : 'No se creó el grupo',
        `${mayus(e.motivo)}. No se guardó nada; lo que eligió sigue aquí.`,
        { href: location.pathname.split('/').pop() + location.search, texto: 'Volver a cargar «Grupos»' }, 'conflicto') : e));
    }
    // Al terminar: un grupo nuevo regresa a «Grupos programados» con su aviso y su fila resaltada; uno que ya existía, a su
    // ficha. Recargar o volver con «Atrás» no repite lo guardado.
    function termina({ g, entraron, fuera }) {
      sinGuardar = false;
      try { sessionStorage.removeItem(CLAVE_ELEGIDAS); } catch (e) { /* sin almacenamiento */ }
      const no = fuera.length ? `&no=${fuera.map(encodeURIComponent).join(',')}` : '';
      if (!gExistente) { location.replace(`grupos.html?curso=${clave}&hecho=creado&a=${encodeURIComponent(g.folio)}${no}`); return; }
      const hecho = entraron.length && (confirmadoYa || (g.fecha_inicio || null) === (gExistente.fecha_inicio || null)) ? 'agregadas' : 'propuesto';
      location.replace(`grupo.html?folio=${encodeURIComponent(g.folio)}&hecho=${hecho}&n=${entraron.length}${no}`);
    }

    /* ----- Arranque del paso a paso ----- */
    construyePersonas(true);
    // El paso de la dirección, sin pasar de lo que ya se puede (sin curso, el 1; sin semana, el 2; …)
    const pedidoPaso = Number(params.get('paso')) || (gExistente ? (gExistente.fecha_inicio || confirmadoYa ? 3 : 2) : clave && params.get('semana') ? 2 : 1);
    let alcanza = 1;
    if (clave) { alcanza = 2; if (!impide(1)) { alcanza = 3; if (!impide(2)) alcanza = 4; } }
    paso = Math.max(1, Math.min(4, pedidoPaso, alcanza));
    pintaTodo();
    if (avisoSemana) diga(avisoSemana);
    form.addEventListener('formkit:paso', (e) => {
      const nuevo = e.detail.indice + 1;
      const cambia = nuevo !== paso;
      paso = nuevo;
      pintaEleccion();
      if (paso === 4) pintaResumen();
      if (cambia) recuerda(!restaurando);
    });
    // Restaurar el paso al cargar sin mover el foco ni anunciarlo (el módulo pasos lo hace así al recuperar un borrador)
    restaurando = true;
    if (paso > 1) FormKit.ganchos.restauraBorrador(form, { paso: paso - 1, hechos: [...Array(paso - 1).keys()] });
    restaurando = false;
    recuerda(false);
    // «Atrás» y «Adelante» del navegador: el paso de esa entrada del historial
    window.addEventListener('popstate', () => {
      const n = Math.max(1, Math.min(4, Number(new URLSearchParams(location.search).get('paso')) || 1));
      if (n === paso) return;
      restaurando = true;
      if (n < paso) FormKit.pasos.ir(n - 1);
      else { let i = paso; while (i < n && !impide(i - 1)) i++; FormKit.pasos.ir(i - 1); }
      restaurando = false;
      recuerda(false);
    });

    /* ----- Grupos programados ----- */
    pintaProgramados();
    avisoHecho();

    function pintaProgramados() {
      const activos = todos.filter((x) => ACTIVOS.includes(x.g.estado));
      const link = $('[data-ir-programados]');
      link.textContent = `Ver los grupos programados (${activos.length})`;
      const secciones = P.CURSOS.map(([t, m]) => {
        const k = P.claveCurso(t, m);
        const suyos = activos.filter((x) => x.g.tipo_acreditacion === t && x.g.modalidad === m)
          .sort((a, b) => String(a.g.fecha_inicio || '9999').localeCompare(String(b.g.fecha_inicio || '9999')) || a.g.folio.localeCompare(b.g.folio));
        const id = `t-prog-${k}`;
        const titulo = el('h4', { class: 'arm-prog-titulo', id }, [document.createTextNode(APD.cursoLargo(t, m)), el('span', { class: 'arm-prog-cuenta', texto: ` · ${plural(suyos.length, 'grupo', 'grupos')}` })]);
        if (!suyos.length) return el('section', { class: 'arm-prog', 'aria-labelledby': id, 'data-programados': k }, [titulo, el('p', { class: 'texto-gris', texto: 'Sin grupos programados.' })]);
        const espera = P.enEspera(datos, t, m);
        const filasT = suyos.map((x) => filaProgramado(x, espera));
        const marco = el('div', { class: 'tabla-marco', 'data-tabla': '', 'data-clave': 'grupo' }, [
          el('table', { class: 'tabla tabla-bandeja arm-tabla' }, [
            el('caption', { class: 'solo-lector', texto: `Grupos programados de ${APD.cursoLargo(t, m)}` }),
            el('thead', {}, [el('tr', {}, ['Grupo', 'Semana', 'Personas', 'Situación', 'Lo que falta'].map((h) => el('th', { scope: 'col', texto: h }))
              .concat([el('th', { scope: 'col' }, [el('span', { class: 'solo-lector', texto: 'Acciones' })])]))]),
            el('tbody', {}, filasT)
          ])
        ]);
        return el('section', { class: 'arm-prog', 'aria-labelledby': id, 'data-programados': k }, [titulo, marco]);
      });
      $('[data-programados]').replaceChildren(...secciones);
      if (FormKit.tabla && FormKit.tabla.inicia) FormKit.tabla.inicia();
      for (const m of $$('[data-programados] [data-tabla]')) m.dispatchEvent(new CustomEvent('formkit:tabla'));

      /* Grupos que ya terminaron: concluidos y cancelados, de los cuatro cursos */
      const hechos = todos.filter((x) => ['concluido', 'cancelado'].includes(x.g.estado));
      $('[data-terminados]').hidden = !hechos.length;
      $('[data-terminados-titulo]').textContent = `Grupos que ya terminaron · ${hechos.length}`;
      $('[data-terminados-lista]').replaceChildren(...hechos.map((x) => el('li', { class: 'plan-terminado', 'data-grupo': x.g.folio }, [
        APD.grupoTitulo(x.g, datos), estado(x.situacion.texto, x.situacion.tono),
        el('a', { class: 'btn-enlace', href: `grupo.html?folio=${encodeURIComponent(x.g.folio)}`, 'aria-label': `Ver el grupo ${x.calculado} · ${x.g.folio}`, texto: 'Ver' })
      ])));
    }

    /* La fila de un grupo: folio con su ficha, semana, personas, situación, lo que falta y sus acciones */
    function filaProgramado(x, espera) {
      const { g } = x;
      const k = P.claveCurso(g.tipo_acreditacion, g.modalidad);
      const fin = APD.ultimoDia(datos, g);
      const integra = g.estado === 'en_integracion';
      // Con fecha, pero ya pasó: una propuesta que nadie confirmó o un grupo confirmado que no inició (P124; R4-04 y RI-07)
      const pasada = Boolean(g.fecha_inicio) && g.estado !== 'en_curso' && g.fecha_inicio <= hoy;
      const dia = P.diaDelCurso(datos, g);
      const situacion = dia ? estado(`En curso · ${minus(dia.texto)}`, 'marcha')
        : pasada && integra ? estado('Propuesta vencida', 'pend')
          : pasada ? estado(`${x.situacion.texto} · no inició`, 'pend')
            : integra && !g.fecha_inicio ? estado('Sin semana', 'pend') : estado(x.situacion.texto, x.situacion.tono);
      const faltaMin = g.cupo_minimo - x.n;
      const falta = [];
      if (integra || pasada) {
        if (!g.fecha_inicio) falta.push('semana'); else if (pasada) falta.push('otra semana');
        if (faltaMin > 0) falta.push(faltaMin === 1 ? '1 persona' : `${faltaMin} personas`);
        // La persona instructora y la confirmación son del área de Instructores y Capacitación (25/10/2026)
        if (!g.instructor) falta.push('persona instructora');
      }
      const textoFalta = !integra && !pasada ? '—' : falta.length ? mayus(y(falta)) : 'Que Capacitación lo confirme';
      const acciones = [];
      const nombre = `${x.calculado} · ${g.folio}`;
      if (x.recibe && faltaMin > 0 && !pasada) {
        const propia = g.integracion === 'especifico';
        const van = P.lasQueMasEsperan(espera, Math.min(faltaMin, x.lugar), propia ? (z) => z.s.organizacion_id === g.organizacion_id : null);
        if (van.length) {
          const b = el('button', { type: 'button', class: 'btn btn-secundario btn-chico', 'aria-label': `${van.length === 1 ? 'Completar con la que más espera' : `Completar con las ${van.length} que más esperan`}: ${nombre}`,
            texto: van.length === 1 ? 'Completar con la que más espera' : `Completar con las ${van.length} que más esperan` });
          b.addEventListener('click', () => {
            // Deshabilitado mientras guarda (F3 B10); el aviso dice cuántas entraron de verdad (F3 M1)
            const libera = APD.ocupa(b);
            if (!libera) return;
            agrega(g, van.map((z) => z.s.folio))
              .then(({ n, no }) => irConAviso('agregadas', g.folio, n, no, k))
              .catch((e) => { libera(); APD.pintaAviso($('[data-hecho]'), 'error', e && e.motivo ? `No se agregó a nadie a «${x.calculado}»` : 'No se pudo guardar',
                e && e.motivo ? `${mayus(e.motivo.replace(/^No se agregó a nadie: /, ''))}. Vuelva a cargar la página para ver la espera de ahora.` : 'Intente de nuevo.', true); });
          });
          acciones.push(b);
        }
      }
      if (integra) {
        const texto = pasada ? 'Elegir otra semana' : g.fecha_inicio ? 'Cambiar la semana' : 'Elegir semana';
        acciones.push(el('a', { class: 'btn-enlace', href: `grupos.html?grupo=${encodeURIComponent(g.folio)}&paso=2`, 'aria-label': `${texto}: ${nombre}`, texto }));
      }
      if (x.recibe) acciones.push(el('a', { class: 'btn-enlace', href: `grupos.html?grupo=${encodeURIComponent(g.folio)}&paso=3`, 'aria-label': `Agregar personas: ${nombre}`, texto: 'Agregar personas' }));
      const semana = g.fecha_inicio ? (fin && fin !== g.fecha_inicio ? `Del ${fechaCorta(g.fecha_inicio)} al ${fechaCorta(fin)}` : `El ${fechaCorta(g.fecha_inicio)}`) : 'Sin semana';
      return el('tr', { 'data-grupo': g.folio, 'data-situacion': g.estado }, [
        el('td', {}, [el('a', { class: 'btn-enlace mono', href: `grupo.html?folio=${encodeURIComponent(g.folio)}`, 'aria-label': `${g.folio}: ver la ficha de ${x.calculado}`, texto: g.folio }),
          el('span', { class: 'arm-prog-tipo', texto: g.integracion === 'especifico' ? x.integracion.replace('De una organización · ', '') : 'Combinado' })]),
        el('td', { texto: semana }),
        el('td', { texto: `${x.n} de ${g.cupo_maximo}${x.lugar <= 0 ? ' · lleno' : ''}` }),
        el('td', {}, [situacion]),
        el('td', { texto: textoFalta }),
        el('td', { 'data-etiqueta-oculta': '' }, [el('div', { class: 'arm-prog-acciones' }, acciones)])
      ]);
    }

    /* Por qué una persona no entró a un grupo, con lo guardado de ahora (como lo diría la API) */
    function porQueNo(d, g, folio) {
      const s = d.solicitud.find((z) => z.folio === folio);
      const quien = s ? APD.nombreCompleto(d.solicitante.find((p) => p.id === s.solicitante_id) || {}) : folio;
      if (!s) return [quien, 'ya no existe'];
      const ins = d.inscripcion.find((i) => i.solicitud_id === s.id && i.activa);
      const otro = ins && d.grupo.find((z) => z.id === ins.grupo_id);
      if (otro && otro.id === g.id) return [quien, 'ya estaba en el grupo'];
      if (otro) return [quien, `ya está en «${APD.nombreGrupo(otro, d)}» (${otro.folio})`];
      if (s.estado !== 'lista_para_curso') return [quien, `ya no está en espera («${APD.nombrePersonal(s.estado)}»)`];
      const z = P.grupo(d, g);
      if (z.n >= g.cupo_maximo) return [quien, `el grupo se llenó (${z.n} de ${g.cupo_maximo})`];
      if (!z.recibe) return [quien, `el grupo ya no recibe personas («${z.situacion.texto}»)`];
      if (g.integracion === 'especifico' && (s.organizacion_id || null) !== g.organizacion_id) return [quien, 'no es de la organización del grupo'];
      return [quien, 'no se pudo agregar'];
    }
    function porQueNoEntraron(d, g, folios) {
      const porRazon = new Map();
      for (const f of folios) { const [quien, r] = porQueNo(d, g, f); porRazon.set(r, (porRazon.get(r) || []).concat([quien])); }
      return [...porRazon].map(([r, quienes]) => `${quienes.join(', ')}: ${r}`).join('; ');
    }
    /* Agregar a un grupo como lo haría la API (F3 M1 y B10): se guarda, se vuelve a leer y se cuenta a quién inscribió de
       verdad la base; si no entró nadie, no queda nada guardado y se dice por qué. Resuelve con { n, no }. */
    function agrega(g, folios) {
      let entraron = [];
      return P.guardaGrupoComprobado({
        eventos: () => ({ tipo: 'agregar', grupo_id: g.id, folios, por: P.REVISORA.usuario }),
        comprueba(d2, d1) {
          const antes = activasEn(d1, g.id);
          const ahora = activasEn(d2, g.id);
          entraron = folios.filter((f) => ahora.has(f) && !antes.has(f));
          return entraron.length ? null : `No se agregó a nadie: ${porQueNoEntraron(d2, d2.grupo.find((z) => z.id === g.id) || g, folios)}`;
        }
      }).then(() => ({ n: entraron.length, no: folios.filter((f) => !entraron.includes(f)) }));
    }
    function irConAviso(hecho, folio, n, no, k) {
      location.href = `grupos.html?curso=${k || clave || ''}&hecho=${hecho}&a=${encodeURIComponent(folio)}${n ? `&n=${n}` : ''}${no && no.length ? `&no=${no.map(encodeURIComponent).join(',')}` : ''}`;
    }
    /* ----- Aviso de lo que se acaba de hacer (llega en la dirección): crear, completar, confirmar ----- */
    function avisoHecho() {
      const hecho = params.get('hecho');
      const g = datos.grupo.find((z) => z.folio === params.get('a'));
      if (!hecho || !g) return;
      const x = P.grupo(datos, g);
      const n = Number(params.get('n')) || 0;
      const no = (params.get('no') || '').split(',').filter(Boolean);
      const enlace = el('p', {}, [el('a', { href: `grupo.html?folio=${encodeURIComponent(g.folio)}`, texto: 'Ver la ficha del grupo' })]);
      // Sin fecha, dos grupos se llaman igual: el aviso lleva el folio (auditoría «intentar romperlo», F3 B5)
      const cual = g.fecha_inicio ? x.calculado : `${x.calculado} · ${g.folio}`;
      const falta = g.cupo_minimo - x.n;
      let aviso = null;
      if (hecho === 'creado') {
        const quedo = g.estado === 'confirmado';
        const noEntraron = no.length ? ` ${no.length === 1 ? '1 de las que eligió no entró' : `${no.length} de las que eligió no entraron`}: ${porQueNoEntraron(datos, g, no)}.` : '';
        const linea = `${g.folio} · ${plural(x.n, 'persona', 'personas')}${g.hora_entrada ? ` · entrada a las ${APD.hhmm(g.hora_entrada)}` : ''}.${noEntraron}`;
        const sigue = [];
        if (quedo) {
          sigue.push('Cada persona ve en «Mis trámites» las fechas, la hora de entrada y dónde presentarse.',
            `El grupo sigue recibiendo personas hasta el ${fechaCorta(APD.sumaDias(g.fecha_inicio, -1))}, sin pasar de ${g.cupo_maximo}.`,
            `A partir del ${fechaLarga(g.fecha_inicio)}, el instructor pasa asistencia cada día y aplica el examen el último, en el PILARES.`);
        } else {
          if (falta > 0) sigue.push(`Complete al menos ${g.cupo_minimo} personas (${falta === 1 ? 'falta 1' : `faltan ${falta}`}).`);
          if (!g.fecha_inicio) sigue.push('Elija su semana en el calendario.');
          sigue.push(`El área de Instructores y Capacitación le asigna la persona instructora y lo confirma; el curso empieza al menos ${anticipacion} días después de confirmarlo.`);
        }
        aviso = { tono: quedo && !no.length ? 'ok' : 'advertencia', titulo: `${quedo ? 'Grupo creado y confirmado' : 'Grupo creado, por confirmar'}: ${x.calculado}`,
          texto: [el('p', { texto: `${linea}${quedo ? '' : ' La fecha queda como propuesta: las personas todavía no la ven como segura.'}` }), enlace, APD.tituloPasos()], pasos: sigue };
      } else if (hecho === 'agregadas') {
        // n: las que de verdad entraron (lo leído después de guardar); no: las que no, con su razón (F3 M1)
        const resto = falta > 0 ? `Le ${falta === 1 ? 'falta 1' : `faltan ${falta}`} para el mínimo de ${g.cupo_minimo}.`
          : g.estado === 'en_integracion' ? 'Ya tiene el mínimo: lo confirma el área de Instructores y Capacitación.' : `Tiene ${plural(x.n, 'persona', 'personas')}.`;
        aviso = { tono: no.length ? 'advertencia' : 'ok', titulo: `${n === 1 ? 'Se agregó 1 persona' : `Se agregaron ${n} personas`} a «${cual}»`,
          texto: [el('p', { texto: no.length ? `${no.length === 1 ? '1 de las que eligió no entró' : `${no.length} de las que eligió no entraron`}. ${porQueNoEntraron(datos, g, no)}. ${resto}` : resto }), enlace] };
      }
      if (!aviso) return;
      const caja = $('[data-hecho]');
      caja.hidden = false;
      caja.replaceChildren();
      FormKit.aviso(caja, Object.assign(aviso, { foco: true }));
      // La fila del grupo, resaltada (con «Recién creado» o «Recién cambiado» para quien no ve el color)
      const fila = $(`[data-programados] tr[data-grupo="${CSS.escape(g.folio)}"]`);
      if (fila) {
        fila.setAttribute('data-nuevo', '');
        const celda = fila.querySelector('td');
        (celda.querySelector('.tabla-valor') || celda).append(el('span', { class: 'arm-prog-nuevo', texto: hecho === 'creado' ? 'Recién creado' : 'Recién cambiado' }));
      }
      // Que recargar la página no repita el aviso
      history.replaceState({ paso }, '', direccion());
    }
  }).catch(() => {
    $('[data-bajada]').textContent = 'No se pudieron cargar los grupos. Intente de nuevo más tarde.';
    // Sin datos, el paso a paso no se queda a medias con sus botones activos (F3 B2)
    $('#armar').hidden = true;
  });
}());
