/* material.js · «Material de estudio» (pública, sin cuenta; decisión 2026-10-18, Liber). Los documentos de la Secretaría
   para preparar el examen, publicados por el personal (apd.material_publico): por cada uno, su edición, su archivo y los
   apartados que conviene estudiar, con enlace a su página del PDF. El examen es a libro cerrado.
   ?curso=poda|dictaminador elige la acreditación al llegar desde «Mis trámites»; ?desde=tramites cambia el enlace de
   regreso. Un dictaminador ve todos los apartados; quien prepara poda y derribo, los que no son sólo de dictaminación.
   El temario por tema lo confirma la Secretaría (P136). */
(function () {
  'use strict';
  const { el } = APD;
  const $ = (s, r) => (r || document).querySelector(s);
  const params = new URLSearchParams(location.search);
  const TIPOS = { poda: 'Poda y derribo', dictaminador: 'Dictaminador técnico' };

  if (params.get('desde') === 'tramites') {
    $('[data-atras]').setAttribute('href', 'tramites.html');
    $('[data-atras-texto]').textContent = 'Mis trámites';
  }
  const pedido = params.get('curso');
  if (TIPOS[pedido]) $(`input[name="curso"][value="${pedido}"]`).checked = true;

  APD.cargar().then((datos) => {
    APD.pintaCorte(datos);
    const docs = APD.materialPublico(datos);
    $('[data-material-vacio]').hidden = docs.length > 0;
    const curso = () => $('input[name="curso"]:checked').value;
    const nuevaPestana = el('span', { class: 'solo-lector', texto: ' (se abre en otra pestaña)' });

    function pinta() {
      const c = curso();
      let apartados = 0;
      $('[data-material]').replaceChildren(...docs
        .filter((m) => !m.tipo_acreditacion || m.tipo_acreditacion === c || c === 'dictaminador')
        .map((m) => {
          const temas = (m.temas || []).filter((t) => !t.tipo_acreditacion || t.tipo_acreditacion === c || c === 'dictaminador');
          apartados += temas.length;
          const grande = m.tamano_bytes > 5 * 1048576;
          const id = `doc-${m.clave}`;
          return el('article', { class: 'material-doc', 'aria-labelledby': id }, [
            el('h3', { class: 'material-titulo', id, texto: m.titulo }),
            // Fechas dd/mm/aaaa con el cero (D23: el dato de los ficticios trae «1/04/2016»; queda pedido corregirlo en la base)
            el('p', { class: 'material-edicion', texto: String(m.edicion || '').replace(/(^|[^\d/])(\d)\/(\d{2})\/(\d{4})/g, '$10$2/$3/$4') }),
            el('p', { texto: m.descripcion }),
            el('div', { class: 'material-archivo' }, [
              el('a', { class: 'btn btn-secundario', href: m.url, target: '_blank', rel: 'noopener' }, [
                document.createTextNode('Abrir el documento'), nuevaPestana.cloneNode(true)]),
              el('a', { class: 'btn-enlace', href: m.url, download: m.nombre_archivo, texto: 'Descargar' }),
              el('span', { class: 'material-peso', texto: `PDF · ${m.paginas} páginas · ${APD.tamano(m.tamano_bytes)}${grande ? ' · conviene descargarlo con wifi' : ''}` })
            ]),
            temas.length ? el('details', { class: 'material-temas' }, [
              el('summary', { texto: `Qué estudiar: ${temas.length === 1 ? '1 apartado' : `${temas.length} apartados`}` }),
              el('ol', { class: 'material-temas-lista' }, temas.map((t) => el('li', {}, [
                el('a', { href: `${m.url}#page=${t.pagina}`, target: '_blank', rel: 'noopener' }, [
                  el('span', { texto: t.titulo }),
                  el('span', { class: 'material-pagina', texto: `pág. ${t.pagina}` }),
                  nuevaPestana.cloneNode(true)]),
                t.tipo_acreditacion === 'dictaminador' && c === 'dictaminador' ? el('span', { class: 'material-solo', texto: 'Dictaminación' }) : null
              ])))
            ]) : null
          ]);
        }));
      const n = $('[data-material]').children.length;
      $('[data-resumen]').textContent = n
        ? `${TIPOS[c]}: ${n === 1 ? '1 documento' : `${n} documentos`} y ${apartados === 1 ? '1 apartado' : `${apartados} apartados`} para estudiar.`
        : '';
    }
    for (const r of document.querySelectorAll('input[name="curso"]')) r.addEventListener('change', pinta);
    pinta();
  }).catch(() => {
    $('[data-material-vacio]').hidden = false;
    $('[data-material-vacio]').textContent = 'No se pudo cargar el material de estudio. Intenta de nuevo más tarde.';
  });
}());
