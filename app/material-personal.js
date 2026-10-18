/* material-personal.js · «Material de estudio» del personal (decisión 2026-10-18, Liber). Los documentos que cualquiera
   ve en la página pública «Material de estudio»: agregar uno (PDF), editar sus datos y sus apartados para estudiar,
   reemplazar su archivo y publicarlo u ocultarlo. Como la base (apd.material_alta y apd.material_cambio): reemplazar el
   archivo no borra el anterior y conserva si estaba publicado; el archivo cargado no se modifica.
   Un solo formulario; el campo auxiliar «modo» (nuevo, editar, reemplazar) decide qué se pide.
   ACCESO SIMULADO (P27). En la prueba lo subido se guarda en este navegador (archivos-prueba.js, almacén «material»);
   las páginas del PDF se cuentan con pdf.js, que en el SIA cuenta el servidor. */
(function () {
  'use strict';
  const { el, estado, fecha } = APD;
  const P = APD_PERSONAL;
  const A = window.APD_ARCHIVOS_PRUEBA;
  const $ = (s, r) => (r || document).querySelector(s);
  const params = new URLSearchParams(location.search);
  const PARA = { ambas: 'Ambas acreditaciones', poda: 'Poda y derribo', dictaminador: 'Dictaminador técnico' };
  const form = $('#form-material');
  const nuevaPestana = () => el('span', { class: 'solo-lector', texto: ' (se abre en otra pestaña)' });

  /* «34 - Capítulo 3. Poda de árboles (sólo dictaminador)» ↔ { pagina: 34, titulo, tipo_acreditacion } */
  const RENGLON = /^\s*(\d{1,4})\s*[-–—·|]\s*(.+?)\s*(\((?:s[oó]lo\s+)?dictaminador\))?\s*$/i;
  const temasATexto = (temas) => (temas || []).map((t) => `${t.pagina} - ${t.titulo}${t.tipo_acreditacion === 'dictaminador' ? ' (sólo dictaminador)' : ''}`).join('\n');
  function textoATemas(texto, paginas) {
    const temas = [];
    const renglones = String(texto || '').split('\n').map((r) => r.trim()).filter(Boolean);
    for (const [i, r] of renglones.entries()) {
      const m = r.match(RENGLON);
      if (!m) return { error: `El renglón ${i + 1} no empieza con la página y un guion: «${r.slice(0, 40)}».` };
      const pagina = Number(m[1]);
      if (paginas && (pagina < 1 || pagina > paginas)) return { error: `El renglón ${i + 1} cita la página ${pagina}, pero el documento tiene ${paginas} páginas.` };
      temas.push(Object.assign({ titulo: m[2], pagina }, m[3] ? { tipo_acreditacion: 'dictaminador' } : {}));
    }
    return { temas };
  }
  // Clave estable del documento a partir de su nombre (apd.material_estudio.clave: [a-z0-9_]{3,40})
  function claveDe(titulo, existentes) {
    const base = (titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 34) || 'documento').padEnd(3, '_');
    let clave = base;
    for (let n = 2; existentes.includes(clave); n++) clave = `${base}_${n}`;
    return clave;
  }
  function sha256(buffer) {
    return crypto.subtle.digest('SHA-256', buffer).then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''));
  }
  // Páginas del PDF con el pdf.js del visor (vendor/pdfjs-dist); un PDF dañado o con contraseña no se acepta
  function cuentaPaginas(buffer) {
    return import(new URL('vendor/pdfjs-dist/pdf.min.mjs', document.baseURI).href).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs-dist/pdf.worker.min.mjs', document.baseURI).href;
      return pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise.then((doc) => { const n = doc.numPages; doc.destroy(); return n; });
    });
  }

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'material');
    const maximo = Number(APD.parametro(datos, 'tamano_maximo_material_bytes')) || 31457280;
    // La prueba vive en la fecha simulada (fecha_corte): lo hecho hoy se registra ese día, a la hora real
    const ahora = () => `${datos.fecha_corte}T${new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour12: false })}-06:00`;
    $('[data-maximo]').textContent = APD.tamano(maximo);
    const vigentes = (datos.material_estudio || []).filter((m) => m.vigente)
      .sort((a, b) => (a.orden - b.orden) || String(a.titulo).localeCompare(String(b.titulo), 'es'));
    const porId = Object.fromEntries(vigentes.map((m) => [m.id, m]));
    const publicados = vigentes.filter((m) => m.publicado).length;
    $('[data-cuenta]').textContent = vigentes.length
      ? `${vigentes.length === 1 ? '1 documento' : `${vigentes.length} documentos`}: ${publicados === 1 ? '1 publicado' : `${publicados} publicados`}${vigentes.length - publicados ? ` y ${vigentes.length - publicados} sin publicar` : ''}.`
      : '';

    /* Lo que se acaba de hacer (después de guardar, la página se vuelve a cargar con ?hecho) */
    const hecho = params.get('hecho');
    const doc = vigentes.find((m) => m.clave === params.get('doc'));
    if (hecho && doc) {
      const HECHO = {
        nuevo: [`«${doc.titulo}» agregado`, doc.publicado ? 'Ya se ve en la página pública «Material de estudio».' : 'Quedó sin publicar: la página pública todavía no lo muestra.',
          [doc.publicado ? 'Ábralo en la página pública y revise que se abra y se descargue completo.' : 'Cuando esté listo, presione «Publicar» en su renglón.',
            (doc.temas || []).length ? '' : 'Agregue en «Editar datos» los apartados que conviene estudiar, con su página.'].filter(Boolean)],
        editar: [`Datos de «${doc.titulo}» guardados`, doc.publicado ? 'La página pública ya muestra los cambios.' : 'El documento sigue sin publicar.', []],
        reemplazar: [`Archivo de «${doc.titulo}» reemplazado`, 'El anterior quedó registrado en el sistema; la página pública ya ofrece el nuevo.',
          ['Revise en «Editar datos» que los apartados para estudiar sigan en las mismas páginas del archivo nuevo.']],
        publicado: [`«${doc.titulo}» publicado`, 'Ya se ve en la página pública «Material de estudio».', []],
        oculto: [`«${doc.titulo}» oculto`, 'Ya no se ve en la página pública. Se conserva aquí: puede publicarlo de nuevo cuando quiera.', []]
      }[hecho];
      if (HECHO) {
        FormKit.resultado($('[data-resultado]'), { tono: hecho === 'oculto' ? 'terminado' : 'ok', titulo: HECHO[0], texto: HECHO[1], pasos: HECHO[2],
          quien: P.REVISORA.nombre });
      }
      params.delete('hecho'); params.delete('doc');
      history.replaceState(null, '', `${location.pathname}${params.toString() ? `?${params}` : ''}`);
    }

    /* La lista */
    $('[data-filas]').replaceChildren(...vigentes.map((m) => {
      const accion = (texto, que, etiqueta) => el('button', { type: 'button', class: 'btn-enlace sin-corte', 'data-accion-material': que, 'data-id': m.id, 'aria-label': `${etiqueta || texto}: ${m.titulo}`, texto });
      return el('tr', { 'data-clave-material': m.clave }, [
        el('td', {}, [el('strong', { texto: m.titulo }), el('span', { class: 'material-edicion-celda', texto: m.edicion })]),
        el('td', { texto: PARA[m.tipo_acreditacion || 'ambas'] }),
        el('td', {}, [
          el('a', { href: m.url, target: '_blank', rel: 'noopener' }, [document.createTextNode(`PDF · ${m.paginas} págs. · ${APD.tamano(m.tamano_bytes)}`), nuevaPestana()]),
          el('span', { class: 'material-edicion-celda', texto: `Cargado el ${fecha(m.cargado_en)}` })
        ]),
        el('td', {}, [m.publicado ? estado('Publicado', 'ok') : estado('Sin publicar', 'pend')]),
        el('td', {}, [el('div', { class: 'material-acciones' }, [
          accion('Editar datos', 'editar'),
          accion('Reemplazar archivo', 'reemplazar'),
          m.publicado ? accion('Ocultar', 'ocultar', 'Ocultar de la página pública') : accion('Publicar', 'publicar', 'Publicar en la página pública')
        ])])
      ]);
    }));
    $('[data-tabla-vacia]').hidden = vigentes.length > 0;
    $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));

    /* El formulario: agregar, editar o reemplazar */
    let actual = null;   // documento que se edita o reemplaza
    let origen = null;   // botón que abrió el formulario, para regresar el foco
    const ponValor = (id, v) => { const c = document.getElementById(id); c.value = v; c.dispatchEvent(new Event('input', { bubbles: true })); };
    function abre(modo, m, boton) {
      actual = m || null;
      origen = boton;
      ponValor('modo', modo);
      if (modo !== 'reemplazar') {
        ponValor('titulo', m ? m.titulo : '');
        ponValor('edicion', m ? m.edicion : '');
        ponValor('descripcion', m ? m.descripcion : '');
        ponValor('temas', m ? temasATexto(m.temas) : '');
        for (const r of form.querySelectorAll('input[name="para"]')) r.checked = !!m && r.value === (m.tipo_acreditacion || 'ambas');
      }
      $('[data-form-titulo]').textContent = { nuevo: 'Agregar un documento', editar: `Editar «${m && m.titulo}»`, reemplazar: `Reemplazar el archivo de «${m && m.titulo}»` }[modo];
      $('[data-form-bajada]').textContent = {
        nuevo: 'Se publica en cuanto lo guarde, salvo que desmarque «Publicar al guardar».',
        editar: m && m.publicado ? 'Está publicado: la página pública mostrará los cambios en cuanto los guarde.' : 'Está sin publicar: los cambios no se ven en la página pública hasta que lo publique.',
        reemplazar: `La página pública ofrecerá el archivo nuevo. El actual (${m && m.nombre_archivo}) queda registrado en el sistema, no se borra.`
      }[modo];
      $('[data-archivo-etiqueta]').textContent = modo === 'reemplazar' ? 'Archivo nuevo' : 'Archivo';
      $('[data-guardar]').textContent = { nuevo: 'Agregar el documento', editar: 'Guardar los datos', reemplazar: 'Reemplazar el archivo' }[modo];
      $('[data-editor]').hidden = false;
      $('[data-editor]').scrollIntoView({ block: 'start' });
      $('#t-form').setAttribute('tabindex', '-1');
      $('#t-form').focus();
    }
    function cierra() {
      $('[data-editor]').hidden = true;
      if (origen) origen.focus();
    }
    $('[data-agregar]').addEventListener('click', (e) => abre('nuevo', null, e.currentTarget));
    $('[data-cancelar]').addEventListener('click', cierra);
    const vuelve = (que, clave) => { location.href = `material-personal.html?hecho=${que}&doc=${encodeURIComponent(clave)}`; };
    // Un cambio lleva sólo lo que cambia: archivos-prueba.js lo combina con lo guardado del documento (C4)
    const guardaCambio = (m, cambios) => A.guardaMaterial(Object.assign({ id: m.id, actualizado_en: ahora(), actualizado_por: P.REVISORA.usuario }, cambios));

    $('[data-filas]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-accion-material]');
      if (!b) return;
      const m = porId[b.dataset.id];
      const que = b.dataset.accionMaterial;
      if (que === 'editar' || que === 'reemplazar') { abre(que, m, b); return; }
      if (que === 'publicar') { guardaCambio(m, { publicado: true }).then(() => vuelve('publicado', m.clave)); return; }
      // Ocultar quita el documento a quien estudia: se confirma (módulo modal del estándar)
      FormKit.confirma(b, {
        titulo: `¿Ocultar «${m.titulo}» de la página pública?`,
        consecuencias: ['Deja de verse en «Material de estudio»: quien prepara su examen ya no podrá descargarlo.', 'Se conserva aquí, con sus datos: puede publicarlo de nuevo cuando quiera.'],
        si: 'Ocultar el documento'
      }).then((si) => { if (si) guardaCambio(m, { publicado: false }).then(() => vuelve('oculto', m.clave)); });
    });

    FormKit.iniciar(form, {
      enviar(payload) {
        const d = payload.datos;
        const modo = document.getElementById('modo').value;
        const archivo = (payload.archivos || []).find((a) => a.campo === 'archivo' && a.blob);
        // Como un error del servidor: junto al campo y en el resumen (contrato del núcleo: e.errores)
        const falla = (campo, mensaje) => Promise.reject(Object.assign(new Error(mensaje), { errores: [{ campo, mensaje }] }));
        const tipo = d.para === 'ambas' ? null : d.para;
        if (modo === 'editar') {
          const t = textoATemas(d.temas, actual.paginas);
          if (t.error) return falla('temas', t.error);
          return guardaCambio(actual, { titulo: d.titulo.trim(), edicion: d.edicion.trim(), descripcion: d.descripcion.trim(), tipo_acreditacion: tipo, temas: t.temas })
            .then(() => ({ modo, clave: actual.clave }));
        }
        if (!archivo) return falla('archivo', 'Elija el PDF.');
        return archivo.blob.arrayBuffer().then((buffer) => Promise.all([
          sha256(buffer),
          cuentaPaginas(buffer).catch(() => null)
        ]).then(([suma, paginas]) => {
          if (!paginas) return falla('archivo', 'No se pudo abrir el PDF: revise que no esté dañado ni protegido con contraseña.');
          const id = crypto.randomUUID();
          const base = modo === 'reemplazar' ? actual : null;
          let temas = base ? base.temas : [];
          if (!base) { const t = textoATemas(d.temas, paginas); if (t.error) return falla('temas', t.error); temas = t.temas; }
          const registro = {
            id, clave: base ? base.clave : claveDe(d.titulo, vigentes.map((m) => m.clave)),
            titulo: base ? base.titulo : d.titulo.trim(), edicion: base ? base.edicion : d.edicion.trim(), descripcion: base ? base.descripcion : d.descripcion.trim(),
            tipo_acreditacion: base ? base.tipo_acreditacion : tipo, temas, orden: base ? base.orden : Math.max(0, ...vigentes.map((m) => m.orden)) + 1,
            publicado: base ? base.publicado : d.publicar === 'si',
            archivo_clave: `prueba/material/${id}.pdf`, nombre_archivo: archivo.nombre, tipo_mime: 'application/pdf', tamano_bytes: archivo.size,
            sha256: suma, paginas, cargado_en: ahora(), cargado_por: P.REVISORA.usuario, actualizado_en: null, actualizado_por: null,
            blob: archivo.blob
          };
          return A.guardaMaterial(registro).then(() => ({ modo, clave: registro.clave }));
        }));
      },
      alEnviar({ modo, clave }) { vuelve(modo, clave); }
    });
  }).catch(() => {
    $('[data-cuenta]').textContent = 'No se pudo cargar el material de estudio. Intente de nuevo más tarde.';
  });
}());
