/* capacitacion.js · Inicio del área de Instructores y Capacitación (perfil «capacitación»; ajustes del equipo, 25/10/2026).
   Los grupos que esperan persona instructora o confirmación (en integración), del que empieza antes al más lejano (los que
   todavía no tienen semana, al final), con lo que les falta; y los confirmados y en curso, para cambiar a la persona
   instructora. Cada fila abre la ficha del grupo, donde se asigna o se cambia a la persona instructora (sólo las libres esas
   fechas) y se confirma el grupo. Lee los datos ficticios y lo registrado en la prueba (APD.cargar); en la etapa 3 los da la
   API del personal. El perfil de la prueba llega en ?perfil= (sin él, capacitación) y pasa a la ficha. */
(function () {
  'use strict';
  const { el, estado, fechaCorta } = APD;
  const P = APD_PERSONAL;
  const $ = (s, r) => (r || document).querySelector(s);
  const perfil = P.perfilDePrueba('capacitacion');
  const y = (l) => (l.length < 2 ? l[0] || '' : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`);
  const mayus = (t) => t.charAt(0).toLocaleUpperCase('es-MX') + t.slice(1);

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'capacitacion', perfil);
    // El directivo (respuesta de Liber del 26/10/2026) consulta aquí los grupos, sólo de lectura: cada fila sólo abre la ficha
    const soloLectura = P.gruposSoloLectura(datos, perfil);
    if (soloLectura) {
      document.title = 'Grupos · Personal · Acreditaciones de arbolado urbano';
      $('#t-por-confirmar').textContent = 'Grupos por confirmar';
      $('[data-bajada]').textContent = 'Los grupos que esperan persona instructora o confirmación, del que empieza antes al más lejano, con lo que les falta. Es una consulta: los arma el personal de revisión y cotejo y los confirma el área de Instructores y Capacitación.';
      $('[data-bajada-confirmados]').textContent = 'Los grupos confirmados y los que están en curso, con su persona instructora.';
    }
    const hoy = APD.hoy(datos);
    const anticipacion = APD.parametro(datos, 'dias_anticipacion_grupo') || 7;
    const minimo = APD.sumaDias(hoy, anticipacion);
    // Del más próximo al más lejano; sin semana, al final
    const porFecha = (a, b) => String(a.g.fecha_inicio || '9999').localeCompare(String(b.g.fecha_inicio || '9999')) || a.g.folio.localeCompare(b.g.folio);
    const todos = P.grupos(datos);
    const semana = (x) => (x.g.fecha_inicio ? (x.ultimo && x.ultimo !== x.g.fecha_inicio ? `Del ${fechaCorta(x.g.fecha_inicio)} al ${fechaCorta(x.ultimo)}` : `El ${fechaCorta(x.g.fecha_inicio)}`) : 'Sin semana');
    const grupoCelda = (x) => el('td', {}, [APD.grupoTitulo(x.g, datos)]);
    const instructorCelda = (x) => el('td', { texto: x.g.instructor ? P.nombreInstructor(x.g.instructor) : 'Sin asignar' });

    /* Esperan persona instructora o confirmación: lo que les falta, como la base (apd.grupo_cambio) */
    const porConfirmar = todos.filter((x) => x.g.estado === 'en_integracion').sort(porFecha);
    const filas = porConfirmar.map((x) => {
      const { g } = x;
      const faltaMin = g.cupo_minimo - x.n;
      const r = g.fecha_inicio ? P.razonNoInicio(datos, g.tipo_acreditacion, g.modalidad, g.fecha_inicio, g.id) : null;
      const falta = [];
      if (!g.fecha_inicio) falta.push('semana (la elige quien arma los grupos)');
      else if (r || g.fecha_inicio < minimo) falta.push('otra semana');
      if (faltaMin > 0) falta.push(faltaMin === 1 ? '1 persona' : `${faltaMin} personas`);
      if (!g.instructor) falta.push('persona instructora');
      const listo = !falta.length;
      const texto = listo ? 'Confirmarlo' : mayus(y(falta));
      // La acción de la fila, según lo que le toca a Capacitación: asignar, confirmar o sólo ver (sin semana)
      const verbo = soloLectura ? 'Ver' : listo ? 'Confirmar el grupo' : !g.fecha_inicio ? 'Ver' : !g.instructor ? 'Asignar la persona instructora' : 'Ver';
      const nombre = `${x.calculado} · ${g.folio}`;
      return el('tr', { 'data-grupo': g.folio, 'data-listo': listo ? 'si' : null }, [
        grupoCelda(x),
        el('td', { texto: semana(x) }),
        el('td', { texto: `${x.n} de ${g.cupo_maximo}` }),
        instructorCelda(x),
        el('td', {}, [listo ? estado('Lista para confirmar', 'pend') : document.createTextNode(texto)]),
        el('td', {}, [el('a', { class: 'btn btn-secundario btn-chico', href: P.fichaGrupo(g.folio, perfil), 'aria-label': `${verbo}: ${nombre}`, texto: verbo })])
      ]);
    });
    const marco = $('[data-por-confirmar]');
    $('[data-filas]', marco).replaceChildren(...filas);
    $('[data-tabla-vacia]', marco).hidden = filas.length > 0;
    const listos = porConfirmar.filter((x, i) => filas[i].dataset.listo === 'si').length;
    const sinInstructor = porConfirmar.filter((x) => !x.g.instructor).length;
    $('[data-cuenta]').textContent = filas.length
      ? `${APD.plural(filas.length, 'grupo espera', 'grupos esperan')}: ${APD.plural(sinInstructor, 'sin persona instructora', 'sin persona instructora')}${listos ? `; ${APD.plural(listos, 'listo para confirmar', 'listos para confirmar')}` : ''}.`
      : 'Ningún grupo espera persona instructora ni confirmación.';
    marco.dispatchEvent(new CustomEvent('formkit:tabla'));

    /* Confirmados y en curso: cambiar a la persona instructora */
    const marcoC = $('[data-confirmados]');
    const filasC = todos.filter((x) => ['confirmado', 'en_curso'].includes(x.g.estado)).sort(porFecha).map((x) => {
      const nombre = `${x.calculado} · ${x.g.folio}`;
      const dia = P.diaDelCurso(datos, x.g);
      return el('tr', { 'data-grupo': x.g.folio }, [
        grupoCelda(x),
        el('td', { texto: semana(x) }),
        el('td', {}, [dia ? estado(`En curso · ${dia.texto.charAt(0).toLocaleLowerCase('es-MX')}${dia.texto.slice(1)}`, 'marcha') : estado(x.situacion.texto, x.situacion.tono)]),
        instructorCelda(x),
        el('td', {}, [soloLectura ? el('a', { class: 'btn-enlace', href: P.fichaGrupo(x.g.folio, perfil), 'aria-label': `Ver: ${nombre}`, texto: 'Ver' })
          : el('a', { class: 'btn-enlace', href: `${P.fichaGrupo(x.g.folio, perfil)}#t-confirmar`, 'aria-label': `Cambiar la persona instructora: ${nombre}`, texto: 'Cambiar la persona instructora' })])
      ]);
    });
    $('[data-filas]', marcoC).replaceChildren(...filasC);
    $('[data-tabla-vacia]', marcoC).hidden = filasC.length > 0;
    marcoC.dispatchEvent(new CustomEvent('formkit:tabla'));
  }).catch(() => { $('[data-cuenta]').textContent = 'No se pudieron cargar los grupos. Intente de nuevo más tarde.'; });
}());
